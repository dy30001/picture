import {
  emptyCreditStore,
  isWelcomeOnlyCreditStore,
  normalizeCreditEntry,
  normalizeCreditStore,
  trimCreditLedger
} from "./store.mjs";
import { postgresSchema } from "../persistence/postgres.mjs";

let creditWriteQueue = Promise.resolve();
const t = postgresSchema.tables;
const a = postgresSchema.creditAccounts;
const l = postgresSchema.creditLedgers;

function normalizeClientKey(safeClientKey, value) {
  return safeClientKey(value || "local");
}

export function createPostgresCreditStore({ db, safeClientKey }) {
  function clientKeyOf(value) {
    return normalizeClientKey(safeClientKey, value);
  }

  async function ensureCreditAccount(clientKey, tx = db) {
    const key = clientKeyOf(clientKey);
    const existing = await tx.query(`SELECT ${a.clientKey} AS client_key FROM ${t.creditAccounts} WHERE ${a.clientKey} = $1 LIMIT 1`, [key]);
    if (existing.rowCount > 0) return key;
    const initial = emptyCreditStore();
    await tx.query(
      `INSERT INTO ${t.creditAccounts} (${a.clientKey}, ${a.balance}, ${a.createdAt}, ${a.updatedAt})
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
    `SELECT ${a.balance} AS balance, ${a.createdAt} AS created_at, ${a.updatedAt} AS updated_at
     FROM ${t.creditAccounts}
     WHERE ${a.clientKey} = $1
     LIMIT 1`,
    [clientKey]
  );
  const ledger = await tx.query(
    `SELECT ${l.id} AS id, ${l.type} AS type, ${l.packageId} AS package_id,
            ${l.orderId} AS order_id, ${l.taskId} AS task_id, ${l.provider} AS provider,
            ${l.title} AS title, ${l.reason} AS reason, ${l.credits} AS credits,
            ${l.balanceAfter} AS balance_after, ${l.amountCny} AS amount_cny,
            ${l.imageCount} AS image_count, ${l.unitCost} AS unit_cost,
            ${l.status} AS status, ${l.createdAt} AS created_at
     FROM ${t.creditLedgers}
     WHERE ${l.clientKey} = $1
     ORDER BY ${l.createdAt} DESC`,
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
    `UPDATE ${t.creditAccounts}
     SET ${a.balance} = $2, ${a.createdAt} = $3, ${a.updatedAt} = $4
     WHERE ${a.clientKey} = $1`,
    [clientKey, store.balance, store.createdAt, store.updatedAt]
  );
  await tx.query(`DELETE FROM ${t.creditLedgers} WHERE ${l.clientKey} = $1`, [clientKey]);
  for (const entry of store.ledger || []) {
    await insertLedgerEntry(tx, clientKey, entry);
  }
}

async function insertLedgerEntry(tx, clientKey, entry) {
  const normalized = normalizeCreditEntry(entry);
  await tx.query(
    `INSERT INTO ${t.creditLedgers} (
      ${l.id}, ${l.clientKey}, ${l.type}, ${l.packageId}, ${l.orderId}, ${l.taskId},
      ${l.provider}, ${l.title}, ${l.reason}, ${l.credits}, ${l.balanceAfter},
      ${l.amountCny}, ${l.imageCount}, ${l.unitCost}, ${l.status}, ${l.createdAt}
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
