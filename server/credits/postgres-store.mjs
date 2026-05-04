import {
  emptyCreditStore,
  isWelcomeOnlyCreditStore,
  normalizeCreditEntry,
  normalizeCreditStore,
  trimCreditLedger
} from "./store.mjs";

let creditWriteQueue = Promise.resolve();

function normalizeClientKey(safeClientKey, value) {
  return safeClientKey(value || "local");
}

export function createPostgresCreditStore({ db, safeClientKey }) {
  function clientKeyOf(value) {
    return normalizeClientKey(safeClientKey, value);
  }

  async function ensureCreditAccount(clientKey, tx = db) {
    const key = clientKeyOf(clientKey);
    const existing = await tx.query("SELECT client_key FROM credit_accounts WHERE client_key = $1 LIMIT 1", [key]);
    if (existing.rowCount > 0) return key;
    const initial = emptyCreditStore();
    await tx.query(
      `INSERT INTO credit_accounts (client_key, balance, created_at, updated_at)
       VALUES ($1, $2, $3, $4)`,
      [key, initial.balance, initial.createdAt, initial.updatedAt]
    );
    for (const entry of initial.ledger) {
      await insertLedgerEntry(tx, key, entry);
    }
    return key;
  }

  async function readCreditStore(clientKey = "local") {
    const key = clientKeyOf(clientKey);
    return await db.withTransaction(async (tx) => {
      await ensureCreditAccount(key, tx);
      return await readCreditStoreTx(tx, key);
    });
  }

  async function writeCreditStore(store, clientKey = "local") {
    const key = clientKeyOf(clientKey);
    const normalized = normalizeCreditStore(store);
    await db.withTransaction(async (tx) => {
      await ensureCreditAccount(key, tx);
      await replaceCreditStoreTx(tx, key, normalized);
    });
  }

  function mutateCreditStore(mutator, clientKey = "local") {
    const key = clientKeyOf(clientKey);
    const run = creditWriteQueue.then(async () => {
      return await db.withTransaction(async (tx) => {
        await ensureCreditAccount(key, tx);
        const store = await readCreditStoreTx(tx, key);
        const result = await mutator(store);
        trimCreditLedger(store);
        await replaceCreditStoreTx(tx, key, normalizeCreditStore(store));
        return result || store;
      });
    });
    creditWriteQueue = run.catch(() => {});
    return run;
  }

  return { readCreditStore, writeCreditStore, mutateCreditStore };
}

async function readCreditStoreTx(tx, clientKey) {
  const account = await tx.query(
    `SELECT balance, created_at, updated_at
     FROM credit_accounts
     WHERE client_key = $1
     LIMIT 1`,
    [clientKey]
  );
  const ledger = await tx.query(
    `SELECT id, type, package_id, order_id, task_id, provider, title, reason, credits,
            balance_after, amount_cny, image_count, unit_cost, status, created_at
     FROM credit_ledgers
     WHERE client_key = $1
     ORDER BY created_at DESC`,
    [clientKey]
  );
  const row = account.rows[0] || {};
  return normalizeCreditStore({
    balance: Number(row.balance) || 0,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    ledger: ledger.rows.map((item) => normalizeCreditEntry({
      id: item.id,
      type: item.type,
      packageId: item.package_id,
      orderId: item.order_id,
      taskId: item.task_id,
      provider: item.provider,
      title: item.title,
      reason: item.reason,
      credits: Number(item.credits) || 0,
      balanceAfter: Number(item.balance_after) || 0,
      amountCny: Number(item.amount_cny) || 0,
      imageCount: Number(item.image_count) || 0,
      unitCost: Number(item.unit_cost) || 0,
      status: item.status,
      createdAt: item.created_at ? new Date(item.created_at).toISOString() : new Date().toISOString()
    }))
  });
}

async function replaceCreditStoreTx(tx, clientKey, store) {
  await tx.query(
    `UPDATE credit_accounts
     SET balance = $2, created_at = $3, updated_at = $4
     WHERE client_key = $1`,
    [clientKey, store.balance, store.createdAt, store.updatedAt]
  );
  await tx.query("DELETE FROM credit_ledgers WHERE client_key = $1", [clientKey]);
  for (const entry of store.ledger || []) {
    await insertLedgerEntry(tx, clientKey, entry);
  }
}

async function insertLedgerEntry(tx, clientKey, entry) {
  const normalized = normalizeCreditEntry(entry);
  await tx.query(
    `INSERT INTO credit_ledgers (
      id, client_key, type, package_id, order_id, task_id, provider, title, reason, credits,
      balance_after, amount_cny, image_count, unit_cost, status, created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16
    )`,
    [
      normalized.id,
      clientKey,
      normalized.type,
      normalized.packageId,
      normalized.orderId,
      normalized.taskId,
      normalized.provider,
      normalized.title,
      normalized.reason,
      normalized.credits,
      normalized.balanceAfter,
      normalized.amountCny,
      normalized.imageCount,
      normalized.unitCost,
      normalized.status,
      normalized.createdAt
    ]
  );
}

export { isWelcomeOnlyCreditStore };
