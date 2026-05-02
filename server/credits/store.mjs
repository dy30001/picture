import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const creditReadyPromises = new Map();
let creditWriteQueue = Promise.resolve();

export function createCreditStore({ dataDir, safeClientKey }) {
  const creditStoreDir = join(dataDir, "credits");

  function creditStoreFileForClient(clientKey = "local") {
    return join(creditStoreDir, `${safeClientKey(clientKey)}.json`);
  }

  function ensureCreditStore(clientKey = "local") {
    const key = safeClientKey(clientKey);
    if (!creditReadyPromises.has(key)) creditReadyPromises.set(key, initializeCreditStore(key));
    return creditReadyPromises.get(key);
  }

  async function initializeCreditStore(clientKey = "local") {
    await mkdir(dataDir, { recursive: true });
    await mkdir(creditStoreDir, { recursive: true });
    const storeFile = creditStoreFileForClient(clientKey);
    try {
      await access(storeFile);
    } catch {
      await writeFile(storeFile, `${JSON.stringify(emptyCreditStore(), null, 2)}\n`);
    }
  }

  async function readCreditStore(clientKey = "local") {
    await ensureCreditStore(clientKey);
    try {
      const text = await readFile(creditStoreFileForClient(clientKey), "utf8");
      return normalizeCreditStore(JSON.parse(text || "{}"));
    } catch (error) {
      if (error?.code === "ENOENT") return emptyCreditStore();
      throw error;
    }
  }

  async function writeCreditStore(store, clientKey = "local") {
    await ensureCreditStore(clientKey);
    await writeFile(creditStoreFileForClient(clientKey), `${JSON.stringify(normalizeCreditStore(store), null, 2)}\n`);
  }

  function mutateCreditStore(mutator, clientKey = "local") {
    const run = creditWriteQueue.then(async () => {
      const store = await readCreditStore(clientKey);
      const result = await mutator(store);
      trimCreditLedger(store);
      await writeCreditStore(store, clientKey);
      return result || store;
    });
    creditWriteQueue = run.catch(() => {});
    return run;
  }

  return { readCreditStore, mutateCreditStore };
}

export function emptyCreditStore() {
  const now = new Date().toISOString();
  return { balance: 0, ledger: [], createdAt: now, updatedAt: now };
}

export function normalizeCreditStore(value) {
  const now = new Date().toISOString();
  const store = value && typeof value === "object" ? value : {};
  const ledger = Array.isArray(store.ledger) ? store.ledger.map(normalizeCreditEntry).filter(Boolean) : [];
  return {
    balance: Math.max(0, Number(store.balance) || 0),
    ledger: ledger.slice(0, 120),
    createdAt: String(store.createdAt || now),
    updatedAt: String(store.updatedAt || store.createdAt || now)
  };
}

export function normalizeCreditEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  return {
    id: String(entry.id || `credit-${Date.now().toString(36)}`),
    type: normalizeCreditType(entry.type),
    packageId: String(entry.packageId || ""),
    orderId: String(entry.orderId || ""),
    taskId: String(entry.taskId || ""),
    provider: String(entry.provider || ""),
    title: String(entry.title || ""),
    reason: String(entry.reason || ""),
    credits: Number(entry.credits) || 0,
    balanceAfter: Math.max(0, Number(entry.balanceAfter) || 0),
    amountCny: Number(entry.amountCny) || 0,
    imageCount: Math.max(0, Number(entry.imageCount) || 0),
    unitCost: Math.max(0, Number(entry.unitCost) || 0),
    status: String(entry.status || "succeeded"),
    createdAt: String(entry.createdAt || new Date().toISOString())
  };
}

export function trimCreditLedger(store) {
  if (!Array.isArray(store.ledger)) store.ledger = [];
  store.ledger.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  if (store.ledger.length > 120) store.ledger.splice(120);
}

function normalizeCreditType(type) {
  return ["recharge", "spend", "refund", "adjustment"].includes(type) ? type : "recharge";
}
