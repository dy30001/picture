import { Pool } from "pg";

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS auth_users (
    id TEXT PRIMARY KEY,
    account_type TEXT NOT NULL,
    account TEXT NOT NULL,
    account_label TEXT NOT NULL DEFAULT '',
    username TEXT NOT NULL,
    nickname TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS auth_users_account_unique ON auth_users (account_type, account)",
  `CREATE TABLE IF NOT EXISTS auth_verification_codes (
    account_type TEXT NOT NULL,
    account TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    delivery TEXT NOT NULL DEFAULT 'email',
    sent_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (account_type, account)
  )`,
  `CREATE TABLE IF NOT EXISTS auth_login_failures (
    id BIGSERIAL PRIMARY KEY,
    account_type TEXT NOT NULL,
    account TEXT NOT NULL,
    client_ip TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  "CREATE INDEX IF NOT EXISTS auth_login_failures_account_idx ON auth_login_failures (account_type, account, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS auth_login_failures_ip_idx ON auth_login_failures (client_ip, created_at DESC)",
  `CREATE TABLE IF NOT EXISTS credit_accounts (
    client_key TEXT PRIMARY KEY,
    balance INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS credit_ledgers (
    id TEXT PRIMARY KEY,
    client_key TEXT NOT NULL REFERENCES credit_accounts(client_key) ON DELETE CASCADE,
    type TEXT NOT NULL,
    package_id TEXT NOT NULL DEFAULT '',
    order_id TEXT NOT NULL DEFAULT '',
    task_id TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL DEFAULT '',
    credits INTEGER NOT NULL DEFAULT 0,
    balance_after INTEGER NOT NULL DEFAULT 0,
    amount_cny NUMERIC(12, 2) NOT NULL DEFAULT 0,
    image_count INTEGER NOT NULL DEFAULT 0,
    unit_cost INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'succeeded',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  "CREATE INDEX IF NOT EXISTS credit_ledgers_client_idx ON credit_ledgers (client_key, created_at DESC)",
  `CREATE TABLE IF NOT EXISTS credit_orders (
    id TEXT PRIMARY KEY,
    client_key TEXT NOT NULL,
    package_id TEXT NOT NULL DEFAULT '',
    package_name TEXT NOT NULL DEFAULT '',
    credits INTEGER NOT NULL DEFAULT 0,
    bonus INTEGER NOT NULL DEFAULT 0,
    amount_cny NUMERIC(12, 2) NOT NULL DEFAULT 0,
    provider TEXT NOT NULL DEFAULT 'pending',
    provider_session_id TEXT NOT NULL DEFAULT '',
    provider_payment_id TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    ledger_id TEXT NOT NULL DEFAULT '',
    failure_reason TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  "CREATE INDEX IF NOT EXISTS credit_orders_client_idx ON credit_orders (client_key, created_at DESC)",
  `CREATE TABLE IF NOT EXISTS history_tasks (
    client_key TEXT NOT NULL,
    id TEXT NOT NULL,
    prompt TEXT NOT NULL DEFAULT '',
    params_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    references_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'succeeded',
    images_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    error TEXT NOT NULL DEFAULT '',
    revised_prompt TEXT NOT NULL DEFAULT '',
    credit_cost INTEGER NOT NULL DEFAULT 0,
    credit_unit_cost INTEGER NOT NULL DEFAULT 0,
    credit_ledger_id TEXT NOT NULL DEFAULT '',
    created_at BIGINT NOT NULL,
    finished_at BIGINT,
    deleted_at BIGINT,
    PRIMARY KEY (client_key, id)
  )`,
  "CREATE INDEX IF NOT EXISTS history_tasks_client_idx ON history_tasks (client_key, created_at DESC)"
];

function text(value) {
  return String(value || "").trim();
}

function number(value, fallback) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export function postgresConfigFromEnv(env = process.env) {
  const backend = text(env.APP_STORAGE_BACKEND || env.STORAGE_BACKEND || "").toLowerCase();
  const host = text(env.POSTGRES_HOST || env.PGHOST || "");
  const port = number(env.POSTGRES_PORT || env.PGPORT, 5432);
  const database = text(env.POSTGRES_DATABASE || env.PGDATABASE || "");
  const user = text(env.POSTGRES_USER || env.PGUSER || "");
  const password = env.POSTGRES_PASSWORD ?? env.PGPASSWORD ?? "";
  const hasCoreConfig = Boolean(host && database && user);
  const enabled = backend === "postgres" ? true : backend === "file" ? false : hasCoreConfig;
  return {
    backend: enabled ? "postgres" : "file",
    enabled,
    host,
    port,
    database,
    user,
    password: String(password || ""),
    connectionTimeoutMillis: number(env.POSTGRES_CONNECTION_TIMEOUT_MS, 10_000),
    idleTimeoutMillis: number(env.POSTGRES_IDLE_TIMEOUT_MS, 30_000),
    max: number(env.POSTGRES_POOL_MAX, 10)
  };
}

export function postgresAdminConfigFromEnv(env = process.env) {
  const project = postgresConfigFromEnv(env);
  return {
    host: text(env.POSTGRES_ADMIN_HOST || project.host || "127.0.0.1"),
    port: number(env.POSTGRES_ADMIN_PORT || project.port, 5432),
    database: text(env.POSTGRES_ADMIN_DATABASE || "postgres"),
    user: text(env.POSTGRES_ADMIN_USER || project.user || "postgres"),
    password: String(env.POSTGRES_ADMIN_PASSWORD ?? project.password ?? ""),
    connectionTimeoutMillis: project.connectionTimeoutMillis
  };
}

export async function ensurePostgresSchema(executor) {
  for (const statement of schemaStatements) {
    await executor.query(statement);
  }
}

export function createPostgresPersistence({ env = process.env, pool = null } = {}) {
  const config = postgresConfigFromEnv(env);
  let internalPool = pool;
  let readyPromise = null;

  function connectionConfig() {
    if (!config.enabled) return null;
    if (!config.host || !config.database || !config.user) {
      throw new Error("PostgreSQL 已启用，但缺少 POSTGRES_HOST / POSTGRES_DATABASE / POSTGRES_USER");
    }
    return {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      max: config.max,
      idleTimeoutMillis: config.idleTimeoutMillis,
      connectionTimeoutMillis: config.connectionTimeoutMillis
    };
  }

  function getPool() {
    if (!config.enabled && !internalPool) throw new Error("PostgreSQL 未启用");
    if (!internalPool) internalPool = new Pool(connectionConfig());
    return internalPool;
  }

  async function ensureReady() {
    if (!config.enabled && !internalPool) return;
    if (!readyPromise) {
      readyPromise = ensurePostgresSchema(getPool()).catch((error) => {
        readyPromise = null;
        throw error;
      });
    }
    await readyPromise;
  }

  async function query(textValue, params = []) {
    await ensureReady();
    return await getPool().query(textValue, params);
  }

  async function withTransaction(work) {
    await ensureReady();
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const api = {
        query(sql, params = []) {
          return client.query(sql, params);
        }
      };
      const result = await work(api);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function end() {
    if (internalPool?.end) await internalPool.end();
  }

  return {
    enabled: config.enabled || Boolean(pool),
    backend: config.enabled || pool ? "postgres" : "file",
    config,
    ensureReady,
    query,
    withTransaction,
    end
  };
}
