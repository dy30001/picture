let historyWriteQueue = Promise.resolve();

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
    status: ["running", "succeeded", "failed"].includes(task?.status) ? task.status : "succeeded",
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
      `SELECT id, prompt, params_json, references_json, status, images_json, error, revised_prompt,
              credit_cost, credit_unit_cost, credit_ledger_id, created_at, finished_at, deleted_at
       FROM history_tasks
       WHERE client_key = $1
       ORDER BY created_at DESC`,
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
      await tx.query("DELETE FROM history_tasks WHERE client_key = $1", [key]);
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
          `SELECT id, prompt, params_json, references_json, status, images_json, error, revised_prompt,
                  credit_cost, credit_unit_cost, credit_ledger_id, created_at, finished_at, deleted_at
           FROM history_tasks
           WHERE client_key = $1
           ORDER BY created_at DESC`,
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
        await tx.query("DELETE FROM history_tasks WHERE client_key = $1", [key]);
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
    `INSERT INTO history_tasks (
      client_key, id, prompt, params_json, references_json, status, images_json, error,
      revised_prompt, credit_cost, credit_unit_cost, credit_ledger_id, created_at, finished_at, deleted_at
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
