import { normalizeCreditOrder } from "./orders.mjs";

let orderWriteQueue = Promise.resolve();

function clientKeyOf(safeClientKey, value) {
  return safeClientKey(value || "local");
}

export function createPostgresCreditOrderStore({ db, safeClientKey }) {
  async function readOrders(clientKey = "local") {
    const key = clientKeyOf(safeClientKey, clientKey);
    const result = await db.query(
      `SELECT id, package_id, package_name, credits, bonus, amount_cny, provider,
              provider_session_id, provider_payment_id, status, ledger_id, failure_reason,
              created_at, updated_at
       FROM credit_orders
       WHERE client_key = $1
       ORDER BY created_at DESC`,
      [key]
    );
    return result.rows.map((row) => normalizeCreditOrder({
      id: row.id,
      packageId: row.package_id,
      packageName: row.package_name,
      credits: Number(row.credits) || 0,
      bonus: Number(row.bonus) || 0,
      amountCny: Number(row.amount_cny) || 0,
      provider: row.provider,
      providerSessionId: row.provider_session_id,
      providerPaymentId: row.provider_payment_id,
      status: row.status,
      ledgerId: row.ledger_id,
      failureReason: row.failure_reason,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
    }));
  }

  async function writeOrders(orders, clientKey = "local") {
    const key = clientKeyOf(safeClientKey, clientKey);
    await db.withTransaction(async (tx) => {
      await tx.query("DELETE FROM credit_orders WHERE client_key = $1", [key]);
      for (const order of Array.isArray(orders) ? orders : []) {
        await insertOrder(tx, key, order);
      }
    });
  }

  function mutateOrders(mutator, clientKey = "local") {
    const key = clientKeyOf(safeClientKey, clientKey);
    const run = orderWriteQueue.then(async () => {
      return await db.withTransaction(async (tx) => {
        const existing = await tx.query(
          `SELECT id, package_id, package_name, credits, bonus, amount_cny, provider,
                  provider_session_id, provider_payment_id, status, ledger_id, failure_reason,
                  created_at, updated_at
           FROM credit_orders
           WHERE client_key = $1
           ORDER BY created_at DESC`,
          [key]
        );
        const orders = existing.rows.map((row) => normalizeCreditOrder({
          id: row.id,
          packageId: row.package_id,
          packageName: row.package_name,
          credits: Number(row.credits) || 0,
          bonus: Number(row.bonus) || 0,
          amountCny: Number(row.amount_cny) || 0,
          provider: row.provider,
          providerSessionId: row.provider_session_id,
          providerPaymentId: row.provider_payment_id,
          status: row.status,
          ledgerId: row.ledger_id,
          failureReason: row.failure_reason,
          createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
          updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
        }));
        const result = await mutator(orders);
        trimOrders(orders);
        await tx.query("DELETE FROM credit_orders WHERE client_key = $1", [key]);
        for (const order of orders) {
          await insertOrder(tx, key, order);
        }
        return result;
      });
    });
    orderWriteQueue = run.catch(() => {});
    return run;
  }

  return { readOrders, writeOrders, mutateOrders };
}

async function insertOrder(tx, clientKey, order) {
  const normalized = normalizeCreditOrder(order);
  await tx.query(
    `INSERT INTO credit_orders (
      id, client_key, package_id, package_name, credits, bonus, amount_cny, provider,
      provider_session_id, provider_payment_id, status, ledger_id, failure_reason, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14, $15
    )`,
    [
      normalized.id,
      clientKey,
      normalized.packageId,
      normalized.packageName,
      normalized.credits,
      normalized.bonus,
      normalized.amountCny,
      normalized.provider,
      normalized.providerSessionId,
      normalized.providerPaymentId,
      normalized.status,
      normalized.ledgerId,
      normalized.failureReason,
      normalized.createdAt,
      normalized.updatedAt
    ]
  );
}

function trimOrders(orders) {
  orders.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  if (orders.length > 200) orders.splice(200);
}
