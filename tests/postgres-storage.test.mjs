import test from "node:test";
import assert from "node:assert/strict";
import { newDb } from "pg-mem";
import { createPostgresAuthStore } from "../server/auth/postgres-store.mjs";
import { hashPassword } from "../server/auth/crypto.mjs";
import { migrateCreditAndOrderStores } from "../server/credits/migration.mjs";
import { createPostgresCreditOrderStore } from "../server/credits/postgres-orders.mjs";
import { createPostgresCreditStore } from "../server/credits/postgres-store.mjs";
import { createPostgresHistoryStore } from "../server/history/postgres-store.mjs";
import { createPostgresPersistence } from "../server/persistence/postgres.mjs";

function safeClientKey(value) {
  return String(value || "local")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "local";
}

async function createMemoryPersistence() {
  const memory = newDb({ autoCreateForeignKeyIndices: true });
  const adapter = memory.adapters.createPg();
  const pool = new adapter.Pool();
  const db = createPostgresPersistence({ pool });
  await db.ensureReady();
  return { db, end: () => db.end() };
}

test("PostgreSQL auth store persists users, hashed codes, and login failures", async () => {
  const runtime = await createMemoryPersistence();
  const authStore = createPostgresAuthStore({ db: runtime.db });

  await authStore.saveVerificationCode({
    type: "email",
    account: "demo@example.com",
    purpose: "register",
    code: "123456",
    delivery: "email",
    sentAt: Date.now(),
    expiresAt: Date.now() + 300_000
  });
  const goodCode = await authStore.verifyCode("email", "demo@example.com", "register", "123456");
  assert.equal(goodCode.ok, true);
  const badCode = await authStore.verifyCode("email", "demo@example.com", "register", "000000");
  assert.equal(badCode.ok, false);
  await authStore.saveVerificationCode({
    type: "email",
    account: "demo@example.com",
    purpose: "reset",
    code: "654321",
    delivery: "email",
    sentAt: Date.now(),
    expiresAt: Date.now() + 300_000
  });
  const resetCode = await authStore.verifyCode("email", "demo@example.com", "reset", "654321");
  assert.equal(resetCode.ok, true);

  await authStore.createUser({
    id: "user_demo",
    type: "email",
    account: "demo@example.com",
    accountLabel: "de***@example.com",
    username: "demo",
    nickname: "demo",
    passwordHash: hashPassword("secret123"),
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  });
  const user = await authStore.findUserByAccount("email", "demo@example.com");
  assert.equal(user?.username, "demo");
  await authStore.updatePasswordHash("user_demo", hashPassword("changed123"));
  const changedUser = await authStore.findUserByAccount("email", "demo@example.com");
  assert.match(String(changedUser?.passwordHash || ""), /^scrypt:/);

  await authStore.recordLoginFailure({
    type: "email",
    account: "demo@example.com",
    clientIp: "127.0.0.1",
    createdAt: new Date().toISOString()
  });
  const failures = await authStore.countRecentLoginFailures({
    type: "email",
    account: "demo@example.com",
    clientIp: "127.0.0.1",
    since: Date.now() - 60_000
  });
  assert.equal(failures.accountFailures, 1);

  await runtime.end();
});

test("PostgreSQL schema uses Chinese table and column names", async () => {
  const runtime = await createMemoryPersistence();
  const tables = await runtime.db.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);
  const names = tables.rows.map((row) => row.table_name);
  assert.deepEqual(names, [
    "客户账号",
    "生图历史任务",
    "登录失败记录",
    "积分流水",
    "积分订单",
    "积分账户",
    "账号验证码"
  ]);
  assert.equal(names.some((name) => String(name).includes("_")), false);

  const columns = await runtime.db.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = '客户账号'
    ORDER BY ordinal_position
  `);
  assert.deepEqual(columns.rows.map((row) => row.column_name), [
    "账号编号",
    "账号类型",
    "账号",
    "账号显示名",
    "用户名",
    "昵称",
    "密码哈希",
    "创建时间",
    "最后登录时间"
  ]);

  await runtime.end();
});

test("PostgreSQL credit stores keep welcome credits, orders, and mutations", async () => {
  const runtime = await createMemoryPersistence();
  const creditStore = createPostgresCreditStore({ db: runtime.db, safeClientKey });
  const orderStore = createPostgresCreditOrderStore({ db: runtime.db, safeClientKey });

  const initial = await creditStore.readCreditStore("client-demo");
  assert.equal(initial.balance, 80);
  assert.equal(initial.ledger[0].title, "新客赠送");

  await creditStore.mutateCreditStore((store) => {
    store.balance += 330;
    store.ledger.unshift({
      id: "recharge-1",
      type: "recharge",
      packageId: "starter",
      orderId: "order-1",
      taskId: "",
      provider: "mock",
      title: "Starter",
      reason: "测试充值",
      credits: 330,
      balanceAfter: 410,
      amountCny: 99,
      imageCount: 0,
      unitCost: 0,
      status: "succeeded",
      createdAt: new Date().toISOString()
    });
    return store;
  }, "client-demo");
  const updated = await creditStore.readCreditStore("client-demo");
  assert.equal(updated.balance, 410);

  await orderStore.mutateOrders((orders) => {
    orders.unshift({
      id: "order-1",
      packageId: "starter",
      packageName: "Starter",
      credits: 300,
      bonus: 30,
      amountCny: 99,
      provider: "mock",
      providerSessionId: "sess-1",
      providerPaymentId: "pay-1",
      status: "paid",
      ledgerId: "recharge-1",
      failureReason: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return orders[0];
  }, "client-demo");
  const orders = await orderStore.readOrders("client-demo");
  assert.equal(orders[0].id, "order-1");

  await runtime.end();
});

test("PostgreSQL credit migration remaps global ledger and order ids", async () => {
  const runtime = await createMemoryPersistence();
  const creditStore = createPostgresCreditStore({ db: runtime.db, safeClientKey });
  const orderStore = createPostgresCreditOrderStore({ db: runtime.db, safeClientKey });
  const sourceClient = "client-register-source";
  const accountClient = "account-user-demo";
  const sourceInitial = await creditStore.readCreditStore(sourceClient);
  const oldWelcomeId = sourceInitial.ledger[0].id;

  await creditStore.mutateCreditStore((store) => {
    store.balance += 330;
    store.ledger.unshift({
      id: "recharge-legacy-1",
      type: "recharge",
      packageId: "starter",
      orderId: "order-legacy-1",
      taskId: "",
      provider: "mock",
      title: "Starter",
      reason: "测试充值",
      credits: 330,
      balanceAfter: 410,
      amountCny: 99,
      imageCount: 0,
      unitCost: 0,
      status: "succeeded",
      createdAt: new Date().toISOString()
    });
    return store;
  }, sourceClient);
  await orderStore.mutateOrders((orders) => {
    orders.unshift({
      id: "order-legacy-1",
      packageId: "starter",
      packageName: "Starter",
      credits: 300,
      bonus: 30,
      amountCny: 99,
      provider: "mock",
      providerSessionId: "sess-legacy",
      providerPaymentId: "pay-legacy",
      status: "paid",
      ledgerId: "recharge-legacy-1",
      failureReason: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return orders[0];
  }, sourceClient);

  await migrateCreditAndOrderStores({
    sourceKey: sourceClient,
    targetKey: accountClient,
    creditStore,
    orderStore,
    normalizeClientKey: safeClientKey,
    safeId: safeClientKey
  });

  const accountCredits = await creditStore.readCreditStore(accountClient);
  assert.equal(accountCredits.balance, 410);
  assert.equal(accountCredits.ledger.some((entry) => entry.id === oldWelcomeId), false);
  assert.equal(accountCredits.ledger.some((entry) => entry.id === "recharge-legacy-1"), false);
  const migratedRecharge = accountCredits.ledger.find((entry) => entry.title === "Starter");
  assert.ok(migratedRecharge?.id.startsWith("migrated-ledger-"));
  assert.ok(migratedRecharge.orderId.startsWith("migrated-order-"));

  const accountOrders = await orderStore.readOrders(accountClient);
  assert.equal(accountOrders.length, 1);
  assert.ok(accountOrders[0].id.startsWith("migrated-order-"));
  assert.equal(accountOrders[0].ledgerId, migratedRecharge.id);

  const sourceCredits = await creditStore.readCreditStore(sourceClient);
  const sourceOrders = await orderStore.readOrders(sourceClient);
  assert.equal(sourceCredits.balance, 0);
  assert.equal(sourceCredits.ledger.length, 0);
  assert.equal(sourceOrders.length, 0);

  await runtime.end();
});

test("PostgreSQL history store persists active and deleted tasks", async () => {
  const runtime = await createMemoryPersistence();
  const historyStore = createPostgresHistoryStore({ db: runtime.db, safeClientKey });

  await historyStore.writeHistoryStore([
    {
      id: "task-1",
      prompt: "first",
      params: { size: "auto", quality: "auto", outputFormat: "png", count: 1 },
      references: [{ id: "ref-1", name: "a.png" }],
      status: "succeeded",
      images: ["/generated-history/client-demo/task-1.png"],
      error: "",
      revisedPrompt: "",
      creditCost: 20,
      creditUnitCost: 20,
      creditLedgerId: "ledger-1",
      createdAt: Date.now(),
      finishedAt: Date.now(),
      deletedAt: null
    }
  ], "client-demo");

  await historyStore.mutateHistoryStore((history) => {
    history[0].deletedAt = Date.now();
    history.push({
      id: "task-2",
      prompt: "second",
      params: { size: "1024x1024", quality: "high", outputFormat: "png", count: 1 },
      references: [],
      status: "running",
      images: [],
      error: "",
      revisedPrompt: "",
      creditCost: 0,
      creditUnitCost: 0,
      creditLedgerId: "",
      createdAt: Date.now() + 1,
      finishedAt: null,
      deletedAt: null
    });
  }, "client-demo");

  const history = await historyStore.readHistoryStore("client-demo");
  assert.equal(history.length, 2);
  assert.equal(history.some((item) => item.id === "task-1" && item.deletedAt), true);
  assert.equal(history.some((item) => item.id === "task-2" && item.status === "running"), true);

  await runtime.end();
});
