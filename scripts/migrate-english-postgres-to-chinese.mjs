#!/usr/bin/env node

import { Client } from "pg";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensurePostgresSchema, postgresConfigFromEnv, postgresSchema } from "../server/persistence/postgres.mjs";

loadLocalEnv();

function loadLocalEnv() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const envPath = join(root, ".env");
  let text = "";
  try {
    text = readFileSync(envPath, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return;
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) continue;
    process.env[key] = parseEnvValue(line.slice(separatorIndex + 1).trim());
  }
}

function parseEnvValue(value) {
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

async function createClient(config) {
  const client = new Client(config);
  await client.connect();
  return client;
}

function targetConfig() {
  const config = postgresConfigFromEnv(process.env);
  if (!config.enabled) throw new Error("PostgreSQL 未启用，无法迁移旧英文库");
  return config;
}

function sourceConfig(target) {
  return {
    host: process.env.OLD_POSTGRES_HOST || process.env.POSTGRES_OLD_HOST || target.host,
    port: Number(process.env.OLD_POSTGRES_PORT || process.env.POSTGRES_OLD_PORT || target.port),
    database: process.env.OLD_POSTGRES_DATABASE || process.env.POSTGRES_OLD_DATABASE || "mojing_pic",
    user: process.env.OLD_POSTGRES_USER || process.env.POSTGRES_OLD_USER || "mojing_pic",
    password: String(process.env.OLD_POSTGRES_PASSWORD ?? process.env.POSTGRES_OLD_PASSWORD ?? ""),
    connectionTimeoutMillis: target.connectionTimeoutMillis
  };
}

async function sourceHasTable(client, tableName) {
  const result = await client.query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1",
    [tableName]
  );
  return result.rowCount > 0;
}

async function mergeTable({ source, target, sourceTable, targetTable, columnMap, conflictColumns, updateColumns }) {
  if (!(await sourceHasTable(source, sourceTable))) return 0;
  const sourceColumns = columnMap.map(([from]) => from).join(", ");
  const sourceRows = await source.query(`SELECT ${sourceColumns} FROM ${sourceTable}`);
  if (sourceRows.rowCount <= 0) return 0;
  const targetColumns = columnMap.map(([, to]) => to).join(", ");
  const placeholders = columnMap.map((_, index) => `$${index + 1}`).join(", ");
  const conflict = conflictColumns.join(", ");
  const updates = updateColumns.length
    ? ` DO UPDATE SET ${updateColumns.map((column) => `${column} = EXCLUDED.${column}`).join(", ")}`
    : " DO NOTHING";
  const sql = `INSERT INTO ${targetTable} (${targetColumns}) VALUES (${placeholders}) ON CONFLICT (${conflict})${updates}`;
  let count = 0;
  for (const row of sourceRows.rows) {
    await target.query(sql, columnMap.map(([from,, transform]) => transform ? transform(row[from]) : row[from]));
    count += 1;
  }
  return count;
}

function jsonValue(value, fallback) {
  if (value == null) return fallback;
  return typeof value === "string" ? value : JSON.stringify(value);
}

export async function migrateEnglishPostgresToChinese() {
  const target = targetConfig();
  const source = sourceConfig(target);
  const sourceClient = await createClient(source);
  const targetClient = await createClient(target);
  try {
    await ensurePostgresSchema(targetClient);
    const t = postgresSchema.tables;
    const u = postgresSchema.authUsers;
    const v = postgresSchema.verificationCodes;
    const f = postgresSchema.loginFailures;
    const a = postgresSchema.creditAccounts;
    const l = postgresSchema.creditLedgers;
    const o = postgresSchema.creditOrders;
    const h = postgresSchema.historyTasks;
    const result = {
      users: await mergeTable({
        source: sourceClient,
        target: targetClient,
        sourceTable: "auth_users",
        targetTable: t.authUsers,
        columnMap: [
          ["id", u.id],
          ["account_type", u.accountType],
          ["account", u.account],
          ["account_label", u.accountLabel],
          ["username", u.username],
          ["nickname", u.nickname],
          ["password_hash", u.passwordHash],
          ["created_at", u.createdAt],
          ["last_login_at", u.lastLoginAt]
        ],
        conflictColumns: [u.id],
        updateColumns: [u.accountType, u.account, u.accountLabel, u.username, u.nickname, u.passwordHash, u.createdAt, u.lastLoginAt]
      }),
      verificationCodes: await mergeTable({
        source: sourceClient,
        target: targetClient,
        sourceTable: "auth_verification_codes",
        targetTable: t.verificationCodes,
        columnMap: [
          ["account_type", v.accountType],
          ["account", v.account],
          ["purpose", v.purpose],
          ["code_hash", v.codeHash],
          ["delivery", v.delivery],
          ["sent_at", v.sentAt],
          ["expires_at", v.expiresAt],
          ["created_at", v.createdAt],
          ["updated_at", v.updatedAt]
        ],
        conflictColumns: [v.accountType, v.account, v.purpose],
        updateColumns: [v.codeHash, v.delivery, v.sentAt, v.expiresAt, v.updatedAt]
      }),
      loginFailures: await mergeTable({
        source: sourceClient,
        target: targetClient,
        sourceTable: "auth_login_failures",
        targetTable: t.loginFailures,
        columnMap: [
          ["id", f.id],
          ["account_type", f.accountType],
          ["account", f.account],
          ["client_ip", f.clientIp],
          ["created_at", f.createdAt]
        ],
        conflictColumns: [f.id],
        updateColumns: [f.accountType, f.account, f.clientIp, f.createdAt]
      }),
      creditAccounts: await mergeTable({
        source: sourceClient,
        target: targetClient,
        sourceTable: "credit_accounts",
        targetTable: t.creditAccounts,
        columnMap: [
          ["client_key", a.clientKey],
          ["balance", a.balance],
          ["created_at", a.createdAt],
          ["updated_at", a.updatedAt]
        ],
        conflictColumns: [a.clientKey],
        updateColumns: [a.balance, a.createdAt, a.updatedAt]
      }),
      creditLedgers: await mergeTable({
        source: sourceClient,
        target: targetClient,
        sourceTable: "credit_ledgers",
        targetTable: t.creditLedgers,
        columnMap: [
          ["id", l.id],
          ["client_key", l.clientKey],
          ["type", l.type],
          ["package_id", l.packageId],
          ["order_id", l.orderId],
          ["task_id", l.taskId],
          ["provider", l.provider],
          ["title", l.title],
          ["reason", l.reason],
          ["credits", l.credits],
          ["balance_after", l.balanceAfter],
          ["amount_cny", l.amountCny],
          ["image_count", l.imageCount],
          ["unit_cost", l.unitCost],
          ["status", l.status],
          ["created_at", l.createdAt]
        ],
        conflictColumns: [l.id],
        updateColumns: [
          l.clientKey,
          l.type,
          l.packageId,
          l.orderId,
          l.taskId,
          l.provider,
          l.title,
          l.reason,
          l.credits,
          l.balanceAfter,
          l.amountCny,
          l.imageCount,
          l.unitCost,
          l.status,
          l.createdAt
        ]
      }),
      creditOrders: await mergeTable({
        source: sourceClient,
        target: targetClient,
        sourceTable: "credit_orders",
        targetTable: t.creditOrders,
        columnMap: [
          ["id", o.id],
          ["client_key", o.clientKey],
          ["package_id", o.packageId],
          ["package_name", o.packageName],
          ["credits", o.credits],
          ["bonus", o.bonus],
          ["amount_cny", o.amountCny],
          ["provider", o.provider],
          ["provider_session_id", o.providerSessionId],
          ["provider_payment_id", o.providerPaymentId],
          ["status", o.status],
          ["ledger_id", o.ledgerId],
          ["failure_reason", o.failureReason],
          ["created_at", o.createdAt],
          ["updated_at", o.updatedAt]
        ],
        conflictColumns: [o.id],
        updateColumns: [
          o.clientKey,
          o.packageId,
          o.packageName,
          o.credits,
          o.bonus,
          o.amountCny,
          o.provider,
          o.providerSessionId,
          o.providerPaymentId,
          o.status,
          o.ledgerId,
          o.failureReason,
          o.createdAt,
          o.updatedAt
        ]
      }),
      historyTasks: await mergeTable({
        source: sourceClient,
        target: targetClient,
        sourceTable: "history_tasks",
        targetTable: t.historyTasks,
        columnMap: [
          ["client_key", h.clientKey],
          ["id", h.id],
          ["prompt", h.prompt],
          ["params_json", h.paramsJson, (value) => jsonValue(value, "{}")],
          ["references_json", h.referencesJson, (value) => jsonValue(value, "[]")],
          ["status", h.status],
          ["images_json", h.imagesJson, (value) => jsonValue(value, "[]")],
          ["error", h.error],
          ["revised_prompt", h.revisedPrompt],
          ["credit_cost", h.creditCost],
          ["credit_unit_cost", h.creditUnitCost],
          ["credit_ledger_id", h.creditLedgerId],
          ["created_at", h.createdAt],
          ["finished_at", h.finishedAt],
          ["deleted_at", h.deletedAt]
        ],
        conflictColumns: [h.clientKey, h.id],
        updateColumns: [
          h.prompt,
          h.paramsJson,
          h.referencesJson,
          h.status,
          h.imagesJson,
          h.error,
          h.revisedPrompt,
          h.creditCost,
          h.creditUnitCost,
          h.creditLedgerId,
          h.createdAt,
          h.finishedAt,
          h.deletedAt
        ]
      })
    };
    return { source, target, result };
  } finally {
    await sourceClient.end();
    await targetClient.end();
  }
}

async function main() {
  const migration = await migrateEnglishPostgresToChinese();
  const parts = Object.entries(migration.result).map(([key, value]) => `${key}=${value}`);
  process.stdout.write(`已从旧英文 PostgreSQL 合并到中文库：${parts.join(", ")}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error?.message || error}\n`);
  process.exitCode = 1;
});
