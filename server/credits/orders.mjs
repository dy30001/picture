import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const orderReadyPromises = new Map();
let orderWriteQueue = Promise.resolve();

export function createCreditOrderStore({ dataDir, safeClientKey }) {
  const orderStoreDir = join(dataDir, "credit-orders");

  function orderStoreFileForClient(clientKey = "local") {
    return join(orderStoreDir, `${safeClientKey(clientKey)}.json`);
  }

  function ensureOrderStore(clientKey = "local") {
    const key = safeClientKey(clientKey);
    if (!orderReadyPromises.has(key)) orderReadyPromises.set(key, initializeOrderStore(key));
    return orderReadyPromises.get(key);
  }

  async function initializeOrderStore(clientKey = "local") {
    await mkdir(dataDir, { recursive: true });
    await mkdir(orderStoreDir, { recursive: true });
    const storeFile = orderStoreFileForClient(clientKey);
    try {
      await access(storeFile);
    } catch {
      await writeFile(storeFile, "[]\n");
    }
  }

  async function readOrders(clientKey = "local") {
    await ensureOrderStore(clientKey);
    try {
      const text = await readFile(orderStoreFileForClient(clientKey), "utf8");
      const parsed = JSON.parse(text || "[]");
      return Array.isArray(parsed) ? parsed.map(normalizeCreditOrder).filter(Boolean) : [];
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }
  }

  async function writeOrders(orders, clientKey = "local") {
    await ensureOrderStore(clientKey);
    await writeFile(orderStoreFileForClient(clientKey), `${JSON.stringify((Array.isArray(orders) ? orders : []).map(normalizeCreditOrder), null, 2)}\n`);
  }

  function mutateOrders(mutator, clientKey = "local") {
    const run = orderWriteQueue.then(async () => {
      const orders = await readOrders(clientKey);
      const result = await mutator(orders);
      trimOrders(orders);
      await writeOrders(orders, clientKey);
      return result;
    });
    orderWriteQueue = run.catch(() => {});
    return run;
  }

  return { readOrders, mutateOrders };
}

export function normalizeCreditOrder(value) {
  if (!value || typeof value !== "object") return null;
  const createdAt = String(value.createdAt || new Date().toISOString());
  const updatedAt = String(value.updatedAt || createdAt);
  return {
    id: String(value.id || `order-${Date.now().toString(36)}`),
    packageId: String(value.packageId || ""),
    packageName: String(value.packageName || ""),
    credits: Math.max(0, Number(value.credits) || 0),
    bonus: Math.max(0, Number(value.bonus) || 0),
    amountCny: Math.max(0, Number(value.amountCny) || 0),
    provider: String(value.provider || "pending"),
    providerSessionId: String(value.providerSessionId || ""),
    providerPaymentId: String(value.providerPaymentId || ""),
    status: normalizeOrderStatus(value.status),
    ledgerId: String(value.ledgerId || ""),
    failureReason: String(value.failureReason || ""),
    createdAt,
    updatedAt
  };
}

function normalizeOrderStatus(value) {
  return ["draft", "pending", "paid", "failed", "cancelled", "refunded"].includes(value) ? value : "draft";
}

function trimOrders(orders) {
  orders.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  if (orders.length > 200) orders.splice(200);
}
