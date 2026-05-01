import { estimateCreditCost, findCreditPackage, publicCreditPackages } from "./config.mjs";
import { normalizeCreditStore } from "./store.mjs";

export function createCreditService({ store, safeId }) {
  async function getCredits(clientKey) {
    const creditStore = await store.readCreditStore(clientKey);
    return creditResponse(creditStore);
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
    const entry = rechargeEntry(selected, safeId);
    const updated = await store.mutateCreditStore((draft) => {
      const nextBalance = draft.balance + entry.credits;
      const withBalance = { ...entry, balanceAfter: nextBalance };
      draft.balance = nextBalance;
      draft.ledger.unshift(withBalance);
      draft.updatedAt = withBalance.createdAt;
      return draft;
    }, clientKey);
    return { entry: updated.ledger[0], ...creditResponse(updated) };
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

  return { getCredits, estimate, recharge, assertEnough, spendForGeneration };
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

function rechargeEntry(selected, safeId) {
  const credits = Number(selected.credits) + Number(selected.bonus || 0);
  return {
    id: safeId(`recharge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`),
    type: "recharge",
    packageId: selected.id,
    title: selected.name,
    reason: "模拟充值入账",
    credits,
    balanceAfter: 0,
    amountCny: selected.amountCny,
    imageCount: 0,
    unitCost: 0,
    status: "succeeded",
    createdAt: new Date().toISOString()
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
