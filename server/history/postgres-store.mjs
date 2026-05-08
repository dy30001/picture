import { postgresSchema } from "../persistence/postgres.mjs";

let historyWriteQueue = Promise.resolve();
const t = postgresSchema.tables;
const h = postgresSchema.historyTasks;

function safeTime(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  const time = date.getTime();
  return Number.isFinite(time) ? time : Date.now();
}

function sanitizeParamValue(value, fallback = "") {
  return value == null ? fallback : String(value);
}

function sanitizeParams(params) {
  const input = params && typeof params === "object" ? params : {};
  return {
    size: sanitizeParamValue(input.size, "auto"),
    quality: sanitizeParamValue(input.quality, "auto"),
    outputFormat: sanitizeParamValue(input.outputFormat, "png"),
    count: Math.max(1, Math.min(4, Number(input.count) || 1))
  };
}

function historyReferences(references) {
  return (Array.isArray(references) ? references : []).map((reference) => ({
    id: String(reference?.id || ""),
    name: String(reference?.name || "reference.png")
  }));
}

function normalizeHistoryRecord(task) {
  return {
    id: String(task?.id || "").trim(),
    prompt: String(task?.prompt || ""),
    params: sanitizeParams(task?.params),
    references: historyReferences(task?.references),
    status: ["queued", "running", "succeeded", "failed"].includes(task?.status) ? task.status : "succeeded",
    images: Array.isArray(task?.images) ? task.images.map(String) : [],
    error: String(task?.error || ""),
    revisedPrompt: String(task?.revisedPrompt || task?.revised_prompt || ""),
    creditCost: Math.max(0, Number(task?.creditCost) || 0),
    creditUnitCost: Math.max(0, Number(task?.creditUnitCost) || 0),
    creditLedgerId: String(task?.creditLedgerId || ""),
    createdAt: safeTime(task?.createdAt),
    finishedAt: task?.finishedAt ? safeTime(task.finishedAt) : null,
    deletedAt: task?.deletedAt ? safeTime(task.deletedAt) : null
  };
}

function trimHistoryStore(history) {
  history.sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
  if (history.length > 300) history.splice(300);
}

function clientKeyOf(safeClientKey, value) {
  return safeClientKey(value || "local");
}

export function createPostgresHistoryStore({ db, safeClientKey }) {
  async function readHistoryStore(clientKey = "local") {
    const key = clientKeyOf(safeClientKey, clientKey);
    const result = await db.query(
      `SELECT ${h.id} AS id, ${h.prompt} AS prompt, ${h.paramsJson} AS params_json,
              ${h.referencesJson} AS references_json, ${h.status} AS status,
              ${h.imagesJson} AS images_json, ${h.error} AS error,
              ${h.revisedPrompt} AS revised_prompt, ${h.creditCost} AS credit_cost,
              ${h.creditUnitCost} AS credit_unit_cost, ${h.creditLedgerId} AS credit_ledger_id,
              ${h.createdAt} AS created_at, ${h.finishedAt} AS finished_at, ${h.deletedAt} AS deleted_at
       FROM ${t.historyTasks}
       WHERE ${h.clientKey} = $1
       ORDER BY ${h.createdAt} DESC`,
      [key]
    );
    return result.rows.map((row) => normalizeHistoryRecord({
      id: row.id,
      prompt: row.prompt,
      params: row.params_json,
      references: row.references_json,
      status: row.status,
      images: row.images_json,
      error: row.error,
      revisedPrompt: row.revised_prompt,
      creditCost: Number(row.credit_cost) || 0,
      creditUnitCost: Number(row.credit_unit_cost) || 0,
      creditLedgerId: row.credit_ledger_id,
      createdAt: Number(row.created_at) || Date.now(),
      finishedAt: row.finished_at == null ? null : Number(row.finished_at),
      deletedAt: row.deleted_at == null ? null : Number(row.deleted_at)
    }));
  }

  async function writeHistoryStore(history, clientKey = "local") {
    const key = clientKeyOf(safeClientKey, clientKey);
    await db.withTransaction(async (tx) => {
      await tx.query(`DELETE FROM ${t.historyTasks} WHERE ${h.clientKey} = $1`, [key]);
      for (const item of Array.isArray(history) ? history : []) {
        await insertHistoryTask(tx, key, item);
      }
    });
  }

  function mutateHistoryStore(mutator, clientKey = "local") {
    const key = clientKeyOf(safeClientKey, clientKey);
    const run = historyWriteQueue.then(async () => {
      return await db.withTransaction(async (tx) => {
        const result = await tx.query(
          `SELECT ${h.id} AS id, ${h.prompt} AS prompt, ${h.paramsJson} AS params_json,
                  ${h.referencesJson} AS references_json, ${h.status} AS status,
                  ${h.imagesJson} AS images_json, ${h.error} AS error,
                  ${h.revisedPrompt} AS revised_prompt, ${h.creditCost} AS credit_cost,
                  ${h.creditUnitCost} AS credit_unit_cost, ${h.creditLedgerId} AS credit_ledger_id,
                  ${h.createdAt} AS created_at, ${h.finishedAt} AS finished_at, ${h.deletedAt} AS deleted_at
           FROM ${t.historyTasks}
           WHERE ${h.clientKey} = $1
           ORDER BY ${h.createdAt} DESC`,
          [key]
        );
        const history = result.rows.map((row) => normalizeHistoryRecord({
          id: row.id,
          prompt: row.prompt,
          params: row.params_json,
          references: row.references_json,
          status: row.status,
          images: row.images_json,
          error: row.error,
          revisedPrompt: row.revised_prompt,
          creditCost: Number(row.credit_cost) || 0,
          creditUnitCost: Number(row.credit_unit_cost) || 0,
          creditLedgerId: row.credit_ledger_id,
          createdAt: Number(row.created_at) || Date.now(),
          finishedAt: row.finished_at == null ? null : Number(row.finished_at),
          deletedAt: row.deleted_at == null ? null : Number(row.deleted_at)
        }));
        const mutateResult = await mutator(history);
        trimHistoryStore(history);
        await tx.query(`DELETE FROM ${t.historyTasks} WHERE ${h.clientKey} = $1`, [key]);
        for (const item of history) {
          await insertHistoryTask(tx, key, item);
        }
        return mutateResult;
      });
    });
    historyWriteQueue = run.catch(() => {});
    return run;
  }

  return { readHistoryStore, writeHistoryStore, mutateHistoryStore };
}

async function insertHistoryTask(tx, clientKey, task) {
  const normalized = normalizeHistoryRecord(task);
  await tx.query(
    `INSERT INTO ${t.historyTasks} (
      ${h.clientKey}, ${h.id}, ${h.prompt}, ${h.paramsJson}, ${h.referencesJson}, ${h.status},
      ${h.imagesJson}, ${h.error}, ${h.revisedPrompt}, ${h.creditCost}, ${h.creditUnitCost},
      ${h.creditLedgerId}, ${h.createdAt}, ${h.finishedAt}, ${h.deletedAt}
    ) VALUES (
      $1, $2, $3, $4::jsonb, $5::jsonb, $6, $7::jsonb, $8,
      $9, $10, $11, $12, $13, $14, $15
    )`,
    [
      clientKey,
      normalized.id,
      normalized.prompt,
      JSON.stringify(normalized.params),
      JSON.stringify(normalized.references),
      normalized.status,
      JSON.stringify(normalized.images),
      normalized.error,
      normalized.revisedPrompt,
      normalized.creditCost,
      normalized.creditUnitCost,
      normalized.creditLedgerId,
      normalized.createdAt,
      normalized.finishedAt,
      normalized.deletedAt
    ]
  );
}
