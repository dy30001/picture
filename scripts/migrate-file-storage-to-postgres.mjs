#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createPostgresCreditOrderStore } from "../server/credits/postgres-orders.mjs";
import { createPostgresCreditStore } from "../server/credits/postgres-store.mjs";
import { createPostgresPersistence, postgresSchema } from "../server/persistence/postgres.mjs";
import { createPostgresHistoryStore } from "../server/history/postgres-store.mjs";

const dataDir = new URL("../data/", import.meta.url);

loadLocalEnv();

function safeClientKey(value) {
  const clean = String(value || "local")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return clean || "local";
}

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

async function readJsonFile(pathname, fallback) {
  try {
    const raw = await readFile(pathname, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function listJsonFiles(folderName) {
  try {
    const dir = join(dataDir.pathname, folderName);
    const files = await readdir(dir);
    return files.filter((name) => name.endsWith(".json")).sort();
  } catch {
    return [];
  }
}

async function migrateUsers(db) {
  const t = postgresSchema.tables;
  const u = postgresSchema.authUsers;
  const authFile = join(dataDir.pathname, "auth", "users.json");
  const parsed = await readJsonFile(authFile, { users: [] });
  const users = Array.isArray(parsed?.users) ? parsed.users : [];
  let count = 0;
  for (const user of users) {
    await db.query(
      `INSERT INTO ${t.authUsers} (
        ${u.id}, ${u.accountType}, ${u.account}, ${u.accountLabel}, ${u.username},
        ${u.nickname}, ${u.passwordHash}, ${u.createdAt}, ${u.lastLoginAt}
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (${u.id}) DO UPDATE SET
        ${u.accountType} = EXCLUDED.${u.accountType},
        ${u.account} = EXCLUDED.${u.account},
        ${u.accountLabel} = EXCLUDED.${u.accountLabel},
        ${u.username} = EXCLUDED.${u.username},
        ${u.nickname} = EXCLUDED.${u.nickname},
        ${u.passwordHash} = EXCLUDED.${u.passwordHash},
        ${u.createdAt} = EXCLUDED.${u.createdAt},
        ${u.lastLoginAt} = EXCLUDED.${u.lastLoginAt}`,
      [
        String(user.id || ""),
        String(user.type || "email"),
        String(user.account || ""),
        String(user.accountLabel || ""),
        String(user.username || user.nickname || ""),
        String(user.nickname || user.username || ""),
        String(user.passwordHash || ""),
        String(user.createdAt || new Date().toISOString()),
        String(user.lastLoginAt || user.createdAt || new Date().toISOString())
      ]
    );
    count += 1;
  }
  return count;
}

async function migrateClientStores(folderName, writer) {
  const files = await listJsonFiles(folderName);
  let count = 0;
  for (const fileName of files) {
    const key = safeClientKey(fileName.replace(/\.json$/i, ""));
    const payload = await readJsonFile(join(dataDir.pathname, folderName, fileName), folderName === "credit-orders" ? [] : {});
    await writer(key, payload);
    count += 1;
  }
  return count;
}

async function main() {
  const db = createPostgresPersistence({ env: process.env });
  if (!db.enabled) throw new Error("PostgreSQL 未启用，请先设置 APP_STORAGE_BACKEND=postgres 和 POSTGRES_*");
  await db.ensureReady();

  const creditStore = createPostgresCreditStore({ db, safeClientKey });
  const orderStore = createPostgresCreditOrderStore({ db, safeClientKey });
  const historyStore = createPostgresHistoryStore({ db, safeClientKey });

  const userCount = await migrateUsers(db);
  const creditCount = await migrateClientStores("credits", async (key, payload) => {
    await creditStore.writeCreditStore(payload, key);
  });
  const orderCount = await migrateClientStores("credit-orders", async (key, payload) => {
    await orderStore.writeOrders(payload, key);
  });
  const historyCount = await migrateClientStores("history", async (key, payload) => {
    await historyStore.writeHistoryStore(payload, key);
  });

  process.stdout.write(
    `已迁移到 PostgreSQL：users=${userCount}, credits=${creditCount}, orders=${orderCount}, history=${historyCount}\n`
  );
  await db.end();
}

main().catch((error) => {
  process.stderr.write(`${error?.message || error}\n`);
  process.exitCode = 1;
});
