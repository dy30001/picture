import { isWelcomeOnlyCreditStore } from "./store.mjs";

export async function migrateCreditAndOrderStores({
  sourceKey,
  targetKey,
  creditStore,
  orderStore,
  normalizeClientKey,
  safeId
}) {
  const source = normalizeClientKey(sourceKey);
  const target = normalizeClientKey(targetKey);
  if (!source || !target || source === target) return;
  const migrationIds = createCreditMigrationIds(safeId);
  await prepareCreditMigrationIds(source, migrationIds, creditStore, orderStore);
  await migrateCreditStore(source, target, migrationIds, creditStore);
  await migrateOrderStore(source, target, migrationIds, orderStore);
}

function createCreditMigrationIds(safeId) {
  const ledgerIds = new Map();
  const orderIds = new Map();
  return {
    ledgerIdFor(id) {
      const key = String(id || "");
      if (!key) return "";
      if (!ledgerIds.has(key)) {
        ledgerIds.set(key, safeId(`migrated-ledger-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`));
      }
      return ledgerIds.get(key);
    },
    mappedLedgerId(id) {
      return ledgerIds.get(String(id || "")) || "";
    },
    orderIdFor(id) {
      const key = String(id || "");
      if (!key) return "";
      if (!orderIds.has(key)) {
        orderIds.set(key, safeId(`migrated-order-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`));
      }
      return orderIds.get(key);
    },
    mappedOrderId(id) {
      return orderIds.get(String(id || "")) || "";
    }
  };
}

async function prepareCreditMigrationIds(sourceKey, migrationIds, creditStore, orderStore) {
  const source = await creditStore.readCreditStore(sourceKey);
  for (const entry of source.ledger || []) {
    migrationIds.ledgerIdFor(entry?.id);
  }
  const orders = await orderStore.readOrders(sourceKey);
  for (const order of orders) {
    migrationIds.orderIdFor(order?.id);
  }
}

async function migrateCreditStore(sourceKey, targetKey, migrationIds, creditStore) {
  const source = await creditStore.readCreditStore(sourceKey);
  if (!source.balance && !source.ledger.length) return;
  const sourceIsWelcomeOnly = isWelcomeOnlyCreditStore(source);
  await creditStore.mutateCreditStore((draft) => {
    const targetIsWelcomeOnly = isWelcomeOnlyCreditStore(draft);
    if (sourceIsWelcomeOnly && !targetIsWelcomeOnly) return draft;
    if (targetIsWelcomeOnly) {
      draft.balance = 0;
      draft.ledger = [];
      draft.updatedAt = source.updatedAt || draft.updatedAt;
    }
    const seen = new Set((Array.isArray(draft.ledger) ? draft.ledger : []).map((entry) => String(entry?.id || "")));
    for (const entry of source.ledger || []) {
      const id = String(entry?.id || "");
      if (!id || seen.has(id)) continue;
      const orderId = String(entry?.orderId || "");
      const nextId = migrationIds.ledgerIdFor(id);
      draft.ledger.push({
        ...entry,
        id: nextId,
        orderId: migrationIds.mappedOrderId(orderId) || orderId
      });
      seen.add(nextId);
    }
    draft.balance += Math.max(0, Number(source.balance) || 0);
    draft.updatedAt = newestIsoDate(draft.updatedAt, source.updatedAt);
    return draft;
  }, targetKey);
  await creditStore.mutateCreditStore((draft) => {
    draft.balance = 0;
    draft.ledger = [];
    draft.updatedAt = new Date().toISOString();
    return draft;
  }, sourceKey);
}

async function migrateOrderStore(sourceKey, targetKey, migrationIds, orderStore) {
  const orders = await orderStore.readOrders(sourceKey);
  if (!orders.length) return;
  await orderStore.mutateOrders((draft) => {
    const seen = new Set((Array.isArray(draft) ? draft : []).map((entry) => String(entry?.id || "")));
    for (const order of orders) {
      const id = String(order?.id || "");
      if (!id || seen.has(id)) continue;
      const ledgerId = String(order?.ledgerId || "");
      const nextId = migrationIds.orderIdFor(id);
      draft.push({
        ...order,
        id: nextId,
        ledgerId: migrationIds.mappedLedgerId(ledgerId) || ledgerId
      });
      seen.add(nextId);
    }
    return draft;
  }, targetKey);
  await orderStore.mutateOrders((draft) => {
    draft.splice(0, draft.length);
    return draft;
  }, sourceKey);
}

function newestIsoDate(left, right) {
  const leftDate = safeDate(left, new Date(0));
  const rightDate = safeDate(right, new Date(0));
  return leftDate.getTime() >= rightDate.getTime() ? leftDate.toISOString() : rightDate.toISOString();
}

function safeDate(value, fallback) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : fallback;
}
