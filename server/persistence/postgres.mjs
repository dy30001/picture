import { Pool } from "pg";

function quoteIdentifier(value) {
  return `"${String(value || "").replace(/"/g, "\"\"")}"`;
}

export const postgresSchema = {
  databaseName: "墨境图片客户库",
  tables: {
    authUsers: quoteIdentifier("客户账号"),
    verificationCodes: quoteIdentifier("账号验证码"),
    loginFailures: quoteIdentifier("登录失败记录"),
    creditAccounts: quoteIdentifier("积分账户"),
    creditLedgers: quoteIdentifier("积分流水"),
    creditOrders: quoteIdentifier("积分订单"),
    historyTasks: quoteIdentifier("生图历史任务")
  },
  rawTables: {
    authUsers: "客户账号",
    verificationCodes: "账号验证码",
    loginFailures: "登录失败记录",
    creditAccounts: "积分账户",
    creditLedgers: "积分流水",
    creditOrders: "积分订单",
    historyTasks: "生图历史任务"
  },
  authUsers: {
    id: quoteIdentifier("账号编号"),
    accountType: quoteIdentifier("账号类型"),
    account: quoteIdentifier("账号"),
    accountLabel: quoteIdentifier("账号显示名"),
    username: quoteIdentifier("用户名"),
    nickname: quoteIdentifier("昵称"),
    passwordHash: quoteIdentifier("密码哈希"),
    createdAt: quoteIdentifier("创建时间"),
    lastLoginAt: quoteIdentifier("最后登录时间")
  },
  verificationCodes: {
    accountType: quoteIdentifier("账号类型"),
    account: quoteIdentifier("账号"),
    purpose: quoteIdentifier("用途"),
    codeHash: quoteIdentifier("验证码哈希"),
    delivery: quoteIdentifier("发送方式"),
    sentAt: quoteIdentifier("发送时间"),
    expiresAt: quoteIdentifier("过期时间"),
    createdAt: quoteIdentifier("创建时间"),
    updatedAt: quoteIdentifier("更新时间")
  },
  loginFailures: {
    id: quoteIdentifier("记录编号"),
    accountType: quoteIdentifier("账号类型"),
    account: quoteIdentifier("账号"),
    clientIp: quoteIdentifier("客户端IP"),
    createdAt: quoteIdentifier("创建时间")
  },
  creditAccounts: {
    clientKey: quoteIdentifier("客户键"),
    balance: quoteIdentifier("余额"),
    createdAt: quoteIdentifier("创建时间"),
    updatedAt: quoteIdentifier("更新时间")
  },
  creditLedgers: {
    id: quoteIdentifier("流水编号"),
    clientKey: quoteIdentifier("客户键"),
    type: quoteIdentifier("类型"),
    packageId: quoteIdentifier("套餐编号"),
    orderId: quoteIdentifier("订单编号"),
    taskId: quoteIdentifier("任务编号"),
    provider: quoteIdentifier("支付渠道"),
    title: quoteIdentifier("标题"),
    reason: quoteIdentifier("原因"),
    credits: quoteIdentifier("积分变动"),
    balanceAfter: quoteIdentifier("变动后余额"),
    amountCny: quoteIdentifier("金额元"),
    imageCount: quoteIdentifier("图片数量"),
    unitCost: quoteIdentifier("单张成本"),
    status: quoteIdentifier("状态"),
    createdAt: quoteIdentifier("创建时间")
  },
  creditOrders: {
    id: quoteIdentifier("订单编号"),
    clientKey: quoteIdentifier("客户键"),
    packageId: quoteIdentifier("套餐编号"),
    packageName: quoteIdentifier("套餐名称"),
    credits: quoteIdentifier("积分"),
    bonus: quoteIdentifier("赠送积分"),
    amountCny: quoteIdentifier("金额元"),
    provider: quoteIdentifier("支付渠道"),
    providerSessionId: quoteIdentifier("渠道会话编号"),
    providerPaymentId: quoteIdentifier("渠道支付编号"),
    status: quoteIdentifier("状态"),
    ledgerId: quoteIdentifier("流水编号"),
    failureReason: quoteIdentifier("失败原因"),
    createdAt: quoteIdentifier("创建时间"),
    updatedAt: quoteIdentifier("更新时间")
  },
  historyTasks: {
    clientKey: quoteIdentifier("客户键"),
    id: quoteIdentifier("任务编号"),
    prompt: quoteIdentifier("提示词"),
    paramsJson: quoteIdentifier("参数JSON"),
    referencesJson: quoteIdentifier("参考图JSON"),
    status: quoteIdentifier("状态"),
    imagesJson: quoteIdentifier("图片JSON"),
    error: quoteIdentifier("错误信息"),
    revisedPrompt: quoteIdentifier("优化提示词"),
    creditCost: quoteIdentifier("积分成本"),
    creditUnitCost: quoteIdentifier("单张积分成本"),
    creditLedgerId: quoteIdentifier("积分流水编号"),
    createdAt: quoteIdentifier("创建时间"),
    finishedAt: quoteIdentifier("完成时间"),
    deletedAt: quoteIdentifier("删除时间")
  }
};

const t = postgresSchema.tables;
const u = postgresSchema.authUsers;
const v = postgresSchema.verificationCodes;
const f = postgresSchema.loginFailures;
const a = postgresSchema.creditAccounts;
const l = postgresSchema.creditLedgers;
const o = postgresSchema.creditOrders;
const h = postgresSchema.historyTasks;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS ${t.authUsers} (
    ${u.id} TEXT PRIMARY KEY,
    ${u.accountType} TEXT NOT NULL,
    ${u.account} TEXT NOT NULL,
    ${u.accountLabel} TEXT NOT NULL DEFAULT '',
    ${u.username} TEXT NOT NULL,
    ${u.nickname} TEXT NOT NULL,
    ${u.passwordHash} TEXT NOT NULL,
    ${u.createdAt} TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ${u.lastLoginAt} TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ${quoteIdentifier("客户账号_账号唯一索引")} ON ${t.authUsers} (${u.accountType}, ${u.account})`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ${quoteIdentifier("客户账号_用户名唯一索引")} ON ${t.authUsers} (LOWER(${u.username}))`,
  `CREATE TABLE IF NOT EXISTS ${t.verificationCodes} (
    ${v.accountType} TEXT NOT NULL,
    ${v.account} TEXT NOT NULL,
    ${v.purpose} TEXT NOT NULL DEFAULT 'register',
    ${v.codeHash} TEXT NOT NULL,
    ${v.delivery} TEXT NOT NULL DEFAULT 'email',
    ${v.sentAt} TIMESTAMPTZ NOT NULL,
    ${v.expiresAt} TIMESTAMPTZ NOT NULL,
    ${v.createdAt} TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ${v.updatedAt} TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (${v.accountType}, ${v.account}, ${v.purpose})
  )`,
  `CREATE TABLE IF NOT EXISTS ${t.loginFailures} (
    ${f.id} BIGSERIAL PRIMARY KEY,
    ${f.accountType} TEXT NOT NULL,
    ${f.account} TEXT NOT NULL,
    ${f.clientIp} TEXT NOT NULL DEFAULT '',
    ${f.createdAt} TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS ${quoteIdentifier("登录失败记录_账号索引")} ON ${t.loginFailures} (${f.accountType}, ${f.account}, ${f.createdAt} DESC)`,
  `CREATE INDEX IF NOT EXISTS ${quoteIdentifier("登录失败记录_IP索引")} ON ${t.loginFailures} (${f.clientIp}, ${f.createdAt} DESC)`,
  `CREATE TABLE IF NOT EXISTS ${t.creditAccounts} (
    ${a.clientKey} TEXT PRIMARY KEY,
    ${a.balance} INTEGER NOT NULL DEFAULT 0,
    ${a.createdAt} TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ${a.updatedAt} TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS ${t.creditLedgers} (
    ${l.id} TEXT PRIMARY KEY,
    ${l.clientKey} TEXT NOT NULL REFERENCES ${t.creditAccounts}(${a.clientKey}) ON DELETE CASCADE,
    ${l.type} TEXT NOT NULL,
    ${l.packageId} TEXT NOT NULL DEFAULT '',
    ${l.orderId} TEXT NOT NULL DEFAULT '',
    ${l.taskId} TEXT NOT NULL DEFAULT '',
    ${l.provider} TEXT NOT NULL DEFAULT '',
    ${l.title} TEXT NOT NULL DEFAULT '',
    ${l.reason} TEXT NOT NULL DEFAULT '',
    ${l.credits} INTEGER NOT NULL DEFAULT 0,
    ${l.balanceAfter} INTEGER NOT NULL DEFAULT 0,
    ${l.amountCny} NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ${l.imageCount} INTEGER NOT NULL DEFAULT 0,
    ${l.unitCost} INTEGER NOT NULL DEFAULT 0,
    ${l.status} TEXT NOT NULL DEFAULT 'succeeded',
    ${l.createdAt} TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS ${quoteIdentifier("积分流水_客户索引")} ON ${t.creditLedgers} (${l.clientKey}, ${l.createdAt} DESC)`,
  `CREATE TABLE IF NOT EXISTS ${t.creditOrders} (
    ${o.id} TEXT PRIMARY KEY,
    ${o.clientKey} TEXT NOT NULL,
    ${o.packageId} TEXT NOT NULL DEFAULT '',
    ${o.packageName} TEXT NOT NULL DEFAULT '',
    ${o.credits} INTEGER NOT NULL DEFAULT 0,
    ${o.bonus} INTEGER NOT NULL DEFAULT 0,
    ${o.amountCny} NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ${o.provider} TEXT NOT NULL DEFAULT 'pending',
    ${o.providerSessionId} TEXT NOT NULL DEFAULT '',
    ${o.providerPaymentId} TEXT NOT NULL DEFAULT '',
    ${o.status} TEXT NOT NULL DEFAULT 'draft',
    ${o.ledgerId} TEXT NOT NULL DEFAULT '',
    ${o.failureReason} TEXT NOT NULL DEFAULT '',
    ${o.createdAt} TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ${o.updatedAt} TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS ${quoteIdentifier("积分订单_客户索引")} ON ${t.creditOrders} (${o.clientKey}, ${o.createdAt} DESC)`,
  `CREATE TABLE IF NOT EXISTS ${t.historyTasks} (
    ${h.clientKey} TEXT NOT NULL,
    ${h.id} TEXT NOT NULL,
    ${h.prompt} TEXT NOT NULL DEFAULT '',
    ${h.paramsJson} JSONB NOT NULL DEFAULT '{}'::jsonb,
    ${h.referencesJson} JSONB NOT NULL DEFAULT '[]'::jsonb,
    ${h.status} TEXT NOT NULL DEFAULT 'succeeded',
    ${h.imagesJson} JSONB NOT NULL DEFAULT '[]'::jsonb,
    ${h.error} TEXT NOT NULL DEFAULT '',
    ${h.revisedPrompt} TEXT NOT NULL DEFAULT '',
    ${h.creditCost} INTEGER NOT NULL DEFAULT 0,
    ${h.creditUnitCost} INTEGER NOT NULL DEFAULT 0,
    ${h.creditLedgerId} TEXT NOT NULL DEFAULT '',
    ${h.createdAt} BIGINT NOT NULL,
    ${h.finishedAt} BIGINT,
    ${h.deletedAt} BIGINT,
    PRIMARY KEY (${h.clientKey}, ${h.id})
  )`,
  `CREATE INDEX IF NOT EXISTS ${quoteIdentifier("生图历史任务_客户索引")} ON ${t.historyTasks} (${h.clientKey}, ${h.createdAt} DESC)`
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
  await ensureAuthVerificationCodeSchema(executor);
}

async function ensureAuthVerificationCodeSchema(executor) {
  await executor.query(`ALTER TABLE ${t.verificationCodes} ADD COLUMN IF NOT EXISTS ${v.purpose} TEXT NOT NULL DEFAULT 'register'`);
  await executor.query(`UPDATE ${t.verificationCodes} SET ${v.purpose} = 'register' WHERE ${v.purpose} IS NULL OR ${v.purpose} = ''`);
  const currentPrimaryKey = await executor.query(`
    SELECT kcu.column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_name = $1
      AND tc.constraint_type = 'PRIMARY KEY'
    ORDER BY kcu.ordinal_position
  `, [postgresSchema.rawTables.verificationCodes]);
  const columns = currentPrimaryKey.rows.map((row) => String(row.column_name || ""));
  if (columns.join(",") !== "账号类型,账号,用途") {
    await executor.query(`ALTER TABLE ${t.verificationCodes} DROP CONSTRAINT IF EXISTS ${quoteIdentifier("账号验证码_pkey")}`);
    await executor.query(`ALTER TABLE ${t.verificationCodes} DROP CONSTRAINT IF EXISTS ${quoteIdentifier("账号验证码主键")}`);
    await executor.query(
      `ALTER TABLE ${t.verificationCodes} ADD CONSTRAINT ${quoteIdentifier("账号验证码主键")} PRIMARY KEY (${v.accountType}, ${v.account}, ${v.purpose})`
    );
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
