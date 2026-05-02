import { estimateCreditCost, findCreditPackage, publicCreditPackages } from "./config.mjs";
import { normalizeCreditStore } from "./store.mjs";
import { normalizeCreditOrder } from "./orders.mjs";

export function createCreditService({ store, orderStore, safeId }) {
  async function getCredits(clientKey) {
    const creditStore = await store.readCreditStore(clientKey);
    return creditResponse(creditStore);
  }

  async function listOrders(clientKey) {
    const orders = orderStore ? await orderStore.readOrders(clientKey) : [];
    return { orders: orders.slice(0, 20) };
  }

  async function createRechargeOrder(packageId, clientKey, options = {}) {
    const selected = findCreditPackage(packageId);
    if (!selected) throw new CreditServiceError("充值档位不存在", 400);
    const order = createOrderEntry(selected, safeId, options);
    if (orderStore) {
      await orderStore.mutateOrders((orders) => {
        orders.unshift(order);
        return order;
      }, clientKey);
    }
    return { order };
  }

  async function updateRechargeOrder(orderId, clientKey, patch = {}) {
    if (!orderStore) throw new CreditServiceError("充值订单服务未启用", 503);
    const order = await orderStore.mutateOrders((orders) => {
      const target = orders.find((item) => item.id === String(orderId || ""));
      if (!target) throw new CreditServiceError("充值订单不存在", 404);
      patchOrder(target, patch);
      target.updatedAt = new Date().toISOString();
      return normalizeCreditOrder(target);
    }, clientKey);
    return { order };
  }

  async function fulfillRechargeOrder({ orderId, clientKey, provider = "stripe", providerSessionId = "", providerPaymentId = "" }) {
    if (!orderStore) throw new CreditServiceError("充值订单服务未启用", 503);
    const currentOrder = await readRechargeOrder(orderId, clientKey, orderStore);
    if (!currentOrder) throw new CreditServiceError("充值订单不存在", 404);
    const selected = findCreditPackage(currentOrder.packageId);
    if (!selected) throw new CreditServiceError("充值档位不存在", 400);

    let entryId = "";
    const updatedStore = await store.mutateCreditStore((draft) => {
      const existing = Array.isArray(draft.ledger)
        ? draft.ledger.find((item) => String(item?.orderId || "") === currentOrder.id)
        : null;
      if (existing) {
        entryId = String(existing.id || "");
        return draft;
      }
      const entry = rechargeEntry(selected, safeId, {
        title: currentOrder.packageName || selected.name,
        reason: rechargeReason(provider),
        orderId: currentOrder.id,
        provider
      });
      const nextBalance = draft.balance + entry.credits;
      const withBalance = { ...entry, balanceAfter: nextBalance };
      draft.balance = nextBalance;
      draft.ledger.unshift(withBalance);
      draft.updatedAt = withBalance.createdAt;
      entryId = withBalance.id;
      return draft;
    }, clientKey);

    const order = (await updateRechargeOrder(orderId, clientKey, {
      status: "paid",
      provider,
      providerSessionId,
      providerPaymentId,
      ledgerId: entryId || currentOrder.ledgerId,
      failureReason: ""
    })).order;

    return {
      order,
      entry: updatedStore.ledger.find((item) => item.id === entryId) || null,
      ...creditResponse(updatedStore)
    };
  }

  async function estimate(params, references, clientKey) {
    const creditStore = await store.readCreditStore(clientKey);
    const cost = estimateCreditCost(params, references);
    return {
      ...cost,
      balance: creditStore.balance,
      enough: creditStore.balance >= cost.estimatedCost,
      shortage: Math.max(0, cost.estimatedCost - creditStore.balance)
    };
  }

  async function recharge(packageId, clientKey) {
    const selected = findCreditPackage(packageId);
    if (!selected) throw new CreditServiceError("充值档位不存在", 400);
    const entry = rechargeEntry(selected, safeId, { reason: "模拟充值入账", provider: "mock_recharge" });
    let paidOrder = null;
    if (orderStore) {
      paidOrder = await orderStore.mutateOrders((orders) => {
        const order = createOrderEntry(selected, safeId, {
          status: "paid",
          provider: "mock_recharge",
          ledgerId: entry.id,
          failureReason: ""
        });
        orders.unshift(order);
        return order;
      }, clientKey);
    }
    const updated = await store.mutateCreditStore((draft) => {
      const nextBalance = draft.balance + entry.credits;
      const withBalance = { ...entry, balanceAfter: nextBalance };
      draft.balance = nextBalance;
      draft.ledger.unshift(withBalance);
      draft.updatedAt = withBalance.createdAt;
      return draft;
    }, clientKey);
    return { entry: updated.ledger[0], order: paidOrder ? normalizeCreditOrder(paidOrder) : null, ...creditResponse(updated) };
  }

  async function assertEnough(params, references, clientKey) {
    const result = await estimate(params, references, clientKey);
    if (!result.enough) {
      throw new CreditServiceError(`积分不足，还差 ${result.shortage} 积分`, 402, result);
    }
    return result;
  }

  async function spendForGeneration({ taskId, params, references, imageCount, clientKey }) {
    const cost = estimateCreditCost(params, references, { successfulImageCount: imageCount });
    if (cost.finalCost <= 0) return { ...cost, entry: null, balance: (await store.readCreditStore(clientKey)).balance };
    const updated = await store.mutateCreditStore((draft) => {
      if (draft.balance < cost.finalCost) {
        throw new CreditServiceError(`积分不足，还差 ${cost.finalCost - draft.balance} 积分`, 402, { ...cost, balance: draft.balance });
      }
      const nextBalance = Math.max(0, draft.balance - cost.finalCost);
      const entry = spendEntry({ taskId, cost, nextBalance, safeId });
      draft.balance = nextBalance;
      draft.ledger.unshift(entry);
      draft.updatedAt = entry.createdAt;
      return draft;
    }, clientKey);
    return {
      ...cost,
      entry: updated.ledger[0],
      balance: updated.balance
    };
  }

  return {
    getCredits,
    listOrders,
    createRechargeOrder,
    updateRechargeOrder,
    fulfillRechargeOrder,
    estimate,
    recharge,
    assertEnough,
    spendForGeneration
  };
}

export class CreditServiceError extends Error {
  constructor(message, status = 400, details = {}) {
    super(message);
    this.name = "CreditServiceError";
    this.status = status;
    this.details = details;
  }
}

function creditResponse(store) {
  const normalized = normalizeCreditStore(store);
  return {
    balance: normalized.balance,
    ledger: normalized.ledger.slice(0, 20),
    updatedAt: normalized.updatedAt,
    packages: publicCreditPackages()
  };
}

function rechargeEntry(selected, safeId, options = {}) {
  const credits = Number(selected.credits) + Number(selected.bonus || 0);
  return {
    id: safeId(`recharge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`),
    type: "recharge",
    packageId: selected.id,
    orderId: String(options.orderId || ""),
    provider: String(options.provider || ""),
    title: String(options.title || selected.name),
    reason: String(options.reason || "充值入账"),
    credits,
    balanceAfter: 0,
    amountCny: selected.amountCny,
    imageCount: 0,
    unitCost: 0,
    status: "succeeded",
    createdAt: new Date().toISOString()
  };
}

function createOrderEntry(selected, safeId, options = {}) {
  return {
    id: safeId(`order-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`),
    packageId: selected.id,
    packageName: selected.name,
    credits: Number(selected.credits) || 0,
    bonus: Number(selected.bonus) || 0,
    amountCny: Number(selected.amountCny) || 0,
    provider: String(options.provider || "pending"),
    providerSessionId: String(options.providerSessionId || ""),
    providerPaymentId: String(options.providerPaymentId || ""),
    status: ["draft", "pending", "paid", "failed", "cancelled", "refunded"].includes(options.status) ? options.status : "draft",
    ledgerId: String(options.ledgerId || ""),
    failureReason: String(options.failureReason || ""),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function spendEntry({ taskId, cost, nextBalance, safeId }) {
  return {
    id: safeId(`spend-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`),
    type: "spend",
    packageId: "",
    taskId: safeId(taskId),
    title: "生成图片扣费",
    reason: cost.referenceCount > 0 ? "图片编辑" : "普通生成",
    credits: -cost.finalCost,
    balanceAfter: nextBalance,
    amountCny: 0,
    imageCount: cost.successfulImageCount,
    unitCost: cost.unitCost,
    status: "succeeded",
    createdAt: new Date().toISOString()
  };
}

async function readRechargeOrder(orderId, clientKey, orderStore) {
  if (!orderStore) return null;
  const orders = await orderStore.readOrders(clientKey);
  return orders.find((item) => item.id === String(orderId || "")) || null;
}

function patchOrder(order, patch = {}) {
  if (!order || typeof order !== "object") return order;
  if (patch.provider !== undefined) order.provider = String(patch.provider || order.provider || "");
  if (patch.providerSessionId !== undefined) order.providerSessionId = String(patch.providerSessionId || "");
  if (patch.providerPaymentId !== undefined) order.providerPaymentId = String(patch.providerPaymentId || "");
  if (patch.status !== undefined) {
    const nextStatus = ["draft", "pending", "paid", "failed", "cancelled", "refunded"].includes(patch.status)
      ? patch.status
      : order.status;
    if (!(order.status === "paid" && !["paid", "refunded"].includes(nextStatus))) order.status = nextStatus;
  }
  if (patch.ledgerId !== undefined) order.ledgerId = String(patch.ledgerId || "");
  if (patch.failureReason !== undefined) order.failureReason = String(patch.failureReason || "");
  return order;
}

function rechargeReason(provider) {
  if (provider === "stripe") return "Stripe 支付到账";
  return "充值到账";
}
