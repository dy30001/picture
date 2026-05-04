#!/usr/bin/env node

import { Client } from "pg";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensurePostgresSchema, postgresAdminConfigFromEnv, postgresConfigFromEnv } from "../server/persistence/postgres.mjs";

loadLocalEnv();

function normalizeText(value) {
  return String(value || "").trim();
}

function quoteIdentifier(value) {
  return `"${String(value || "").replace(/"/g, "\"\"")}"`;
}

function quoteLiteral(value) {
  return `'${String(value || "").replace(/'/g, "''")}'`;
}

function loadLocalEnv() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const envPath = join(root, ".env");
  let text = "";
  try {
    text = readFileSync(envPath, "utf-8");
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

async function ensureRole(client, userName, password) {
  const roleState = await client.query("SELECT 1 FROM pg_roles WHERE rolname = $1 LIMIT 1", [userName]);
  const passwordClause = password ? ` PASSWORD ${quoteLiteral(password)}` : "";
  if (roleState.rowCount <= 0) {
    await client.query(`CREATE ROLE ${quoteIdentifier(userName)} LOGIN${passwordClause}`);
    return;
  }
  await client.query(`ALTER ROLE ${quoteIdentifier(userName)} WITH LOGIN${passwordClause}`);
}

async function ensureDatabase(client, databaseName, userName) {
  const databaseState = await client.query("SELECT 1 FROM pg_database WHERE datname = $1 LIMIT 1", [databaseName]);
  if (databaseState.rowCount <= 0) {
    await client.query(`CREATE DATABASE ${quoteIdentifier(databaseName)} OWNER ${quoteIdentifier(userName)}`);
  }
  await client.query(`GRANT ALL PRIVILEGES ON DATABASE ${quoteIdentifier(databaseName)} TO ${quoteIdentifier(userName)}`);
}

export async function initLocalPostgres() {
  const project = postgresConfigFromEnv(process.env);
  if (!project.host || !project.database || !project.user) {
    throw new Error("缺少 POSTGRES_HOST / POSTGRES_DATABASE / POSTGRES_USER，无法初始化 PostgreSQL");
  }
  const adminConfig = postgresAdminConfigFromEnv(process.env);
  const adminClient = await createClient(adminConfig);
  try {
    await ensureRole(adminClient, project.user, project.password);
    await ensureDatabase(adminClient, project.database, project.user);
  } finally {
    await adminClient.end();
  }

  const projectClient = await createClient({
    host: project.host,
    port: project.port,
    database: project.database,
    user: project.user,
    password: project.password,
    connectionTimeoutMillis: project.connectionTimeoutMillis
  });
  try {
    await ensurePostgresSchema(projectClient);
  } finally {
    await projectClient.end();
  }

  return {
    host: project.host,
    port: project.port,
    database: project.database,
    user: project.user
  };
}

async function main() {
  const result = await initLocalPostgres();
  process.stdout.write(
    `PostgreSQL 已初始化: ${normalizeText(result.database)} (${normalizeText(result.user)}@${normalizeText(result.host)}:${result.port})\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${error?.message || error}\n`);
  process.exitCode = 1;
});
