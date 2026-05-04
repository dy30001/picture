import express from "express";
import nodemailer from "nodemailer";
import { access, appendFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { createCreditOrderStore } from "./credits/orders.mjs";
import { createPostgresCreditOrderStore } from "./credits/postgres-orders.mjs";
import { createPostgresCreditStore } from "./credits/postgres-store.mjs";
import { createCreditService, CreditServiceError } from "./credits/service.mjs";
import { createCreditStore, isWelcomeOnlyCreditStore } from "./credits/store.mjs";
import { hashPassword, verifyPassword } from "./auth/crypto.mjs";
import { createPostgresAuthStore } from "./auth/postgres-store.mjs";
import { createAlipayPaymentProvider } from "./payments/alipay.mjs";
import { createStripePaymentProvider } from "./payments/stripe.mjs";
import { createPostgresPersistence } from "./persistence/postgres.mjs";
import { createPostgresHistoryStore } from "./history/postgres-store.mjs";
import { createTemplateStore } from "./template-store.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadLocalEnv();
const publicDir = join(root, "public");
const dataDir = join(root, "data");
const historyImageDir = join(dataDir, "generated-history");
const historyStoreDir = join(dataDir, "history");
const authDataDir = resolve(process.env.INKLENS_AUTH_DIR || process.env.AUTH_DATA_DIR || join(dataDir, "auth"));
const authUsersFile = join(authDataDir, "users.json");
const logDir = join(dataDir, "logs");
const generationErrorLogFile = join(logDir, "generation-errors.ndjson");
const studioPreviewDir = join(root, "final_4k");
const studioPreviewThumbDir = resolve(process.env.INKLENS_STUDIO_PREVIEW_THUMB_DIR || process.env.STUDIO_PREVIEW_THUMB_DIR || join(dataDir, "studio-preview-thumbs"));
const studioReviewDir = join(root, "review");
const authCodeTtlMs = 5 * 60 * 1000;
const authCodeCooldownMs = 60 * 1000;
const authLoginFailureWindowMs = 15 * 60 * 1000;
const authLoginFailureLimit = 5;
const studioAdminKey = String(process.env.INKLENS_STUDIO_ADMIN_KEY || process.env.STUDIO_ADMIN_KEY || "mojing-admin-local").trim();
const studioOrderStoreFile = join(dataDir, "studio-orders.json");
const studioOrderAssetDir = join(dataDir, "studio-order-assets");
const postgres = createPostgresPersistence({ env: process.env });
if (postgres.enabled) await postgres.ensureReady();
const templateStore = createTemplateStore({ publicDir });
const creditStore = postgres.enabled
  ? createPostgresCreditStore({ db: postgres, safeClientKey })
  : createCreditStore({ dataDir, safeClientKey });
const creditOrderStore = postgres.enabled
  ? createPostgresCreditOrderStore({ db: postgres, safeClientKey })
  : createCreditOrderStore({ dataDir, safeClientKey });
const historyStore = postgres.enabled ? createPostgresHistoryStore({ db: postgres, safeClientKey }) : null;
const authStore = postgres.enabled ? createPostgresAuthStore({ db: postgres }) : null;
const creditService = createCreditService({ store: creditStore, orderStore: creditOrderStore, safeId });
const stripePaymentProvider = createStripePaymentProvider({ env: process.env });
const alipayPaymentProvider = createAlipayPaymentProvider({ env: process.env });
const verificationCodes = new Map();
const defaultSettings = {
  apiUrl: "https://img.inklens.art/v1",
  apiKey: "",
  codexCli: false,
  apiMode: "images",
  mainModelId: "gpt-5.5",
  modelId: "gpt-image-2",
  toolName: "image_generation",
  timeoutSeconds: 120
};
const studioSampleSceneIds = ["wedding", "couple", "friends", "child10", "portrait", "senior"];
let studioSampleCatalogCache = null;
const studioSampleSceneLabels = {
  wedding: "婚纱照",
  couple: "情侣照",
  friends: "闺蜜照",
  child10: "儿童10岁照",
  portrait: "女生写真",
  senior: "夕阳红"
};
const studioSampleDirectionLabels = {
  wedding: { chinese: "中式礼服", travel: "旅拍大片", registry: "婚登照" },
  couple: { daily: "日常胶片", travel: "旅行同行", cinema: "城市地标" },
  friends: { studio: "棚拍合照", street: "城市街拍", birthday: "闺蜜婚礼" },
  child10: { campus: "校园成长", birthday: "生日纪念", outdoor: "户外奔跑" },
  portrait: { french: "法式胶片", magazine: "杂志肖像", guofeng: "轻国风" },
  senior: { anniversary: "纪念合照", travel: "旅行留念", qipao: "旗袍礼服" }
};
const studioDestinationLabels = {
  "01_paris_v02": "巴黎旅拍",
  "02_santorini_v02": "圣托里尼",
  "03_venice_v09_repair": "威尼斯",
  "04_kyoto_v01": "京都",
  "05_swiss_alps_v01": "瑞士雪山",
  "06_maldives_v01": "马尔代夫",
  "07_new_york_v01": "纽约",
  "08_cappadocia_v01": "卡帕多奇亚",
  "09_prague_v01": "布拉格"
};
const studioSampleImagePattern = /\.(?:png|jpe?g|webp|gif)$/i;

const app = express();
app.use((_request, response, next) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  next();
});
app.post("/api/payments/stripe/webhook", express.raw({ type: "application/json" }), async (request, response) => {
  try {
    const event = stripePaymentProvider.constructWebhookEvent(request.body, request.headers?.["stripe-signature"]);
    await handlePaymentWebhookEvent(event);
    response.json({ ok: true, received: true });
  } catch (error) {
    response.status(errorStatus(error, 400)).json({ ok: false, message: errorMessage(error) });
  }
});
app.post("/api/payments/alipay/notify", express.urlencoded({ extended: false }), async (request, response) => {
  try {
    const notification = alipayPaymentProvider.verifyNotificationPayload(request.body);
    if (!notification.clientKey || !notification.orderId) {
      throw new Error("支付宝通知缺少订单归属信息");
    }
    await syncRechargeOrderFromProvider({
      provider: "alipay",
      clientKey: notification.clientKey,
      orderId: notification.orderId,
      orderStatus: notification.orderStatus,
      providerSessionId: notification.orderId,
      providerPaymentId: notification.tradeNo,
      failureReason: notification.orderStatus === "failed" ? "支付宝异步通知失败" : ""
    });
    response.type("text/plain").send("success");
  } catch (error) {
    response.status(errorStatus(error, 400)).type("text/plain").send("failure");
  }
});
app.use(express.json({ limit: "80mb" }));
const immutableImageStatic = { maxAge: "30d", immutable: true };
app.use("/generated-history", express.static(historyImageDir));
app.use("/studio-preview-thumbs", express.static(studioPreviewThumbDir, immutableImageStatic));
app.use("/studio-previews", express.static(studioPreviewDir, immutableImageStatic));
app.use("/studio-review", express.static(studioReviewDir, immutableImageStatic));
app.use("/studio-order-assets", express.static(studioOrderAssetDir));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "gpt-image-node", time: new Date().toISOString() });
});

app.get("/api/studio-samples", async (request, response) => {
  try {
    const full = ["1", "true", "yes"].includes(String(request.query?.full || "").toLowerCase());
    sendJson(request, response, { ok: true, ...await studioSampleCatalog({ includeItems: full }) }, { cacheSeconds: 60 });
  } catch (error) {
    response.status(500).json({ ok: false, message: errorMessage(error) });
  }
});

app.get("/api/studio-samples/:sceneId/:groupId", async (request, response) => {
  try {
    const group = await studioSampleGroupDetail(request.params.sceneId, request.params.groupId);
    if (!group) {
      response.status(404).json({ ok: false, message: "样片组不存在" });
      return;
    }
    sendJson(request, response, { ok: true, group }, { cacheSeconds: 60 });
  } catch (error) {
    response.status(500).json({ ok: false, message: errorMessage(error) });
  }
});

app.get("/api/studio-orders", async (request, response) => {
  try {
    const clientKey = clientKeyFromRequest(request);
    if (!await requireAccountClientKey(response, clientKey)) return;
    const orders = await listStudioOrders({ clientKey, limit: 20 });
    response.json({ ok: true, clientKey, orders, total: orders.length, updatedAt: orders[0]?.updatedAt || "" });
  } catch (error) {
    response.status(errorStatus(error, 503)).json({ ok: false, message: errorMessage(error), orders: [] });
  }
});

app.post("/api/studio-orders", async (request, response) => {
  try {
    const clientKey = clientKeyFromRequest(request);
    if (!await requireAccountClientKey(response, clientKey)) return;
    const order = await createStudioOrder(request.body, clientKey);
    response.status(201).json({ ok: true, clientKey, order });
  } catch (error) {
    response.status(errorStatus(error, 400)).json({ ok: false, message: errorMessage(error) });
  }
});

app.get("/api/admin/studio-orders", async (request, response) => {
  try {
    if (!requireStudioAdmin(response, request)) return;
    const status = String(request.query?.status || "").trim();
    const orders = await listStudioOrders({
      limit: 100,
      status: status || ""
    });
    response.json({ ok: true, orders, total: orders.length, updatedAt: orders[0]?.updatedAt || "" });
  } catch (error) {
    response.status(errorStatus(error, 503)).json({ ok: false, message: errorMessage(error), orders: [] });
  }
});

app.post("/api/admin/studio-orders/:id", async (request, response) => {
  try {
    if (!requireStudioAdmin(response, request)) return;
    const order = await updateStudioOrder(request.params.id, request.body);
    if (!order) {
      response.status(404).json({ ok: false, message: "订单不存在" });
      return;
    }
    response.json({ ok: true, order });
  } catch (error) {
    response.status(errorStatus(error, 400)).json({ ok: false, message: errorMessage(error) });
  }
});

app.get("/api/auth/options", (_request, response) => {
  response.json({ ok: true, modes: ["email"], defaultMode: "email" });
});

app.post("/api/auth/verification-code", async (request, response) => {
  try {
    const type = normalizeAccountType(request.body?.type);
    const account = normalizeAccount(request.body?.account, type);
    const existing = await readStoredVerificationCode(type, account);
    if (existing?.sentAt && Date.now() - existing.sentAt < authCodeCooldownMs) {
      response.status(429).json({ ok: false, message: "验证码刚发送过，稍后可重试" });
      return;
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const delivery = authCodeDelivery(request);
    if (delivery === "email") await sendVerificationEmail(account, code);
    const sentAt = Date.now();
    await writeStoredVerificationCode(type, account, { code, delivery, sentAt, expiresAt: sentAt + authCodeTtlMs });
    const result = {
      ok: true,
      type,
      accountLabel: maskAccount(account, type),
      expiresIn: 300,
      delivery,
      message: authCodeMessage(delivery)
    };
    if (delivery !== "email") result.code = code;
    response.json(result);
  } catch (error) {
    const duplicate = error?.code === "23505";
    response.status(duplicate ? 409 : 400).json({ ok: false, message: duplicate ? "账号已注册" : errorMessage(error) });
  }
});

app.post("/api/auth/register", async (request, response) => {
  try {
    const type = normalizeAccountType(request.body?.type);
    const account = normalizeAccount(request.body?.account, type);
    const users = await readUsers();
    const username = normalizeUsername(request.body?.username ?? request.body?.nickname, account, users);
    const password = normalizePassword(request.body?.password);
    if (users.some((user) => user.type === type && user.account === account)) {
      response.status(409).json({ ok: false, message: "账号已注册" });
      return;
    }
    await verifyCode(type, account, request.body?.code);
    const user = {
      id: makeUserId(),
      type,
      account,
      accountLabel: maskAccount(account, type),
      username,
      nickname: username,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };
    if (authStore) {
      await authStore.createUser(user);
    } else {
      users.push(user);
      await writeUsers(users);
    }
    await deleteStoredVerificationCode(type, account);
    const clientKey = accountClientKey(user.id);
    await migrateClientData(normalizeExplicitClientKey(request.body?.clientKey), clientKey);
    response.status(201).json({ ok: true, user: publicUser(user), clientKey });
  } catch (error) {
    response.status(400).json({ ok: false, message: errorMessage(error) });
  }
});

app.post("/api/auth/login", async (request, response) => {
  try {
    const type = normalizeAccountType(request.body?.type);
    const account = normalizeAccount(request.body?.account, type);
    const password = normalizePassword(request.body?.password);
    const clientIp = clientIpFromRequest(request);
    if (authStore) {
      const failures = await authStore.countRecentLoginFailures({
        type,
        account,
        clientIp,
        since: Date.now() - authLoginFailureWindowMs
      });
      if (Math.max(failures.accountFailures, failures.ipFailures) >= authLoginFailureLimit) {
        response.status(429).json({ ok: false, message: "登录失败次数过多，15 分钟后可重试" });
        return;
      }
    }
    const users = await readUsers();
    const user = users.find((item) => item.type === type && item.account === account);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      if (authStore) {
        await authStore.recordLoginFailure({
          type,
          account,
          clientIp,
          createdAt: new Date().toISOString()
        });
      }
      response.status(401).json({ ok: false, message: "账号或密码不正确" });
      return;
    }
    user.lastLoginAt = new Date().toISOString();
    if (authStore) {
      await authStore.updateLastLogin(user.id, user.lastLoginAt);
      await authStore.clearLoginFailures({ type, account, clientIp });
    } else {
      await writeUsers(users);
    }
    const clientKey = accountClientKey(user.id);
    await migrateClientData(normalizeExplicitClientKey(request.body?.clientKey), clientKey);
    response.json({ ok: true, user: publicUser(user), clientKey });
  } catch (error) {
    response.status(400).json({ ok: false, message: errorMessage(error) });
  }
});

app.get("/api/templates", async (request, response) => {
  try {
    const full = request.query?.full === "1" || request.query?.full === "true";
    const catalog = await templateStore.catalog({ full });
    sendJson(request, response, { ok: true, ...catalog }, {
      cacheSeconds: full ? 60 : 300
    });
  } catch (error) {
    response.status(500).json({ ok: false, message: errorMessage(error) });
  }
});

app.get("/api/templates/:id", async (request, response) => {
  try {
    const template = await templateStore.find(request.params.id);
    if (!template) {
      response.status(404).json({ ok: false, message: "模板不存在" });
      return;
    }
    response.json({ ok: true, template });
  } catch (error) {
    response.status(500).json({ ok: false, message: errorMessage(error) });
  }
});

app.post("/api/test-connection", async (request, response) => {
  const settings = sanitizeSettings(request.body?.settings);
  if (!settings.apiKey.trim()) {
    response.status(400).json({ ok: false, message: "API Key 为空" });
    return;
  }
  try {
    const upstream = await fetchWithTimeout(joinUrl(settings.apiUrl, "/models"), settings, {
      method: "GET",
      headers: { Authorization: `Bearer ${settings.apiKey.trim()}` }
    });
    const json = await parseJson(upstream);
    assertOk(upstream, json);
    const count = Array.isArray(json.data) ? json.data.length : 0;
    response.json({ ok: true, message: count ? `连接成功，读取到 ${count} 个模型` : "连接成功" });
  } catch (error) {
    response.status(502).json({ ok: false, message: errorMessage(error) });
  }
});

app.get("/api/credits", async (request, response) => {
  try {
    const clientKey = clientKeyFromRequest(request);
    response.json({ ok: true, clientKey, ...await creditService.getCredits(clientKey) });
  } catch (error) {
    response.status(503).json({ ok: false, message: errorMessage(error) });
  }
});

app.post("/api/credits/estimate", async (request, response) => {
  try {
    const clientKey = clientKeyFromRequest(request);
    const params = sanitizeParams(request.body?.params);
    const references = requestReferences(request.body?.references);
    response.json({ ok: true, clientKey, ...await creditService.estimate(params, references, clientKey) });
  } catch (error) {
    response.status(503).json({ ok: false, message: errorMessage(error) });
  }
});

app.post("/api/credits/recharge", async (request, response) => {
  try {
    const clientKey = clientKeyFromRequest(request);
    if (!await requireAccountClientKey(response, clientKey)) return;
    const packageId = String(request.body?.packageId || "");
    response.json({ ok: true, clientKey, ...await creditService.recharge(packageId, clientKey) });
  } catch (error) {
    response.status(errorStatus(error, 503)).json({ ok: false, message: errorMessage(error) });
  }
});

app.get("/api/credits/orders", async (request, response) => {
  try {
    const clientKey = clientKeyFromRequest(request);
    response.json({ ok: true, clientKey, ...await creditService.listOrders(clientKey) });
  } catch (error) {
    response.status(503).json({ ok: false, message: errorMessage(error) });
  }
});

app.post("/api/credits/orders", async (request, response) => {
  try {
    const clientKey = clientKeyFromRequest(request);
    if (!await requireAccountClientKey(response, clientKey)) return;
    const packageId = String(request.body?.packageId || "");
    response.json({ ok: true, clientKey, ...await creditService.createRechargeOrder(packageId, clientKey, { status: "pending" }) });
  } catch (error) {
    response.status(errorStatus(error, 503)).json({ ok: false, message: errorMessage(error) });
  }
});

app.get("/api/payments/config", (request, response) => {
  response.json({ ok: true, payment: selectedPayment(requestOrigin(request)).payment });
});

app.post("/api/payments/checkout-session", async (request, response) => {
  try {
    const clientKey = clientKeyFromRequest(request);
    if (!await requireAccountClientKey(response, clientKey)) return;
    const packageId = String(request.body?.packageId || "");
    const origin = requestOrigin(request);
    const { provider, payment } = selectedPayment(origin);
    if (!payment.ready) {
      response.status(503).json({ ok: false, message: payment.message, payment });
      return;
    }
    const created = await creditService.createRechargeOrder(packageId, clientKey, {
      status: "draft",
      provider: payment.provider
    });
    let session = null;
    try {
      session = await provider.createCheckoutSession({
        order: created.order,
        clientKey,
        origin
      });
    } catch (error) {
      await creditService.updateRechargeOrder(created.order.id, clientKey, {
        status: "failed",
        provider: payment.provider,
        failureReason: errorMessage(error)
      }).catch(() => {});
      throw error;
    }
    const updated = await creditService.updateRechargeOrder(created.order.id, clientKey, {
      status: "pending",
      provider: payment.provider,
      providerSessionId: session.sessionId,
      failureReason: ""
    });
    response.status(201).json({
      ok: true,
      clientKey,
      order: updated.order,
      checkoutUrl: session.checkoutUrl,
      sessionId: session.sessionId,
      payment
    });
  } catch (error) {
    response.status(errorStatus(error, 503)).json({ ok: false, message: errorMessage(error) });
  }
});

app.get("/api/payments/alipay/return", (request, response) => {
  try {
    response.redirect(303, alipayPaymentProvider.buildReturnRedirectUrl(request.query, requestOrigin(request)));
  } catch {
    response.redirect(303, "/?tab=credits&payment=cancel");
  }
});

app.post("/api/payments/confirm-session", async (request, response) => {
  try {
    const origin = requestOrigin(request);
    const { provider, payment } = selectedPayment(origin);
    const requestClientKey = clientKeyFromRequest(request);
    if (!await requireAccountClientKey(response, requestClientKey)) return;
    const sessionId = safeId(request.body?.sessionId || request.body?.session_id || "");
    const orderId = safeId(request.body?.orderId || request.body?.order || "");
    const tradeNo = safeId(request.body?.tradeNo || request.body?.trade_no || "");
    const confirmation = payment.provider === "alipay"
      ? await provider.confirmPayment({
        orderId,
        tradeNo
      })
      : await provider.confirmCheckoutSession({
        sessionId,
        clientKey: requestClientKey,
        expectedOrderId: orderId
      });
    const confirmedClientKey = normalizeExplicitClientKey(confirmation.clientKey) || requestClientKey;
    const result = await syncRechargeOrderFromProvider({
      provider: payment.provider,
      clientKey: confirmedClientKey,
      orderId: confirmation.orderId,
      orderStatus: confirmation.orderStatus,
      providerSessionId: confirmation.sessionId,
      providerPaymentId: confirmation.paymentIntentId || confirmation.tradeNo || tradeNo
    });
    response.json({
      ok: true,
      clientKey: confirmedClientKey,
      confirmation,
      ...result,
      payment
    });
  } catch (error) {
    response.status(errorStatus(error, 503)).json({ ok: false, message: errorMessage(error) });
  }
});

app.post("/api/generate", async (request, response) => {
  const requestId = generationRequestId();
  const clientKey = clientKeyFromRequest(request);
  const settings = sanitizeSettings(request.body?.settings);
  const prompt = String(request.body?.prompt || "").trim();
  const params = sanitizeParams(request.body?.params);
  const references = requestReferences(request.body?.references);
  const taskId = safeId(request.body?.taskId || request.body?.id || `task-${Date.now().toString(36)}`);
  const createdAt = safeDate(request.body?.createdAt, new Date());
  if (!settings.apiKey.trim()) {
    response.status(400).json({ ok: false, message: "API 配置不可用" });
    return;
  }
  if (!prompt) {
    response.status(400).json({ ok: false, message: "请输入提示词" });
    return;
  }
  let creditEstimate = null;
  try {
    creditEstimate = await creditService.assertEnough(params, references, clientKey);
    const result = await generateOpenAIImage(settings, prompt, params, references);
    const images = await persistHistoryImages(result.images, taskId, params.outputFormat, clientKey);
    const creditSpend = await creditService.spendForGeneration({
      taskId,
      params,
      references,
      imageCount: images.length,
      clientKey
    });
    const task = {
      id: taskId,
      prompt,
      params,
      references: historyReferences(references),
      status: "succeeded",
      images,
      error: "",
      revisedPrompt: result.revisedPrompt || "",
      creditCost: creditSpend.finalCost,
      creditUnitCost: creditSpend.unitCost,
      creditLedgerId: creditSpend.entry?.id || "",
      createdAt: createdAt.getTime(),
      finishedAt: Date.now()
    };
    const historySaved = await saveHistoryTaskSafely(task, clientKey);
    response.json({
      ok: true,
      ...result,
      images,
      historySaved,
      creditCost: creditSpend.finalCost,
      creditUnitCost: creditSpend.unitCost,
      creditBalance: creditSpend.balance,
      creditLedgerId: creditSpend.entry?.id || "",
      creditEstimate
    });
  } catch (error) {
    const message = errorMessage(error);
    if (error instanceof CreditServiceError) {
      response.status(errorStatus(error, 402)).json({ ok: false, message, credit: error.details || null });
      return;
    }
    await writeGenerationErrorLog({
      requestId,
      clientKey,
      taskId,
      prompt,
      params,
      settings,
      referencesCount: references.length,
      error
    });
    await saveHistoryTaskSafely({
      id: taskId,
      prompt,
      params,
      references: historyReferences(references),
      status: "failed",
      images: [],
      error: message,
      revisedPrompt: "",
      creditCost: 0,
      creditUnitCost: creditEstimate?.unitCost || 0,
      creditLedgerId: "",
      createdAt: createdAt.getTime(),
      finishedAt: Date.now()
    }, clientKey);
    response.status(502).json({ ok: false, message, requestId });
  }
});

app.get("/api/history", async (request, response) => {
  try {
    const clientKey = clientKeyFromRequest(request);
    const limit = clampNumber(Number(request.query?.limit) || 80, 1, 200);
    const deleted = request.query?.deleted === "1" || request.query?.deleted === "true";
    const history = await listHistoryTasks(limit, deleted, clientKey);
    response.json({ ok: true, history, total: history.length, clientKey });
  } catch (error) {
    response.status(503).json({ ok: false, message: errorMessage(error), history: [] });
  }
});

app.post("/api/history/sync", async (request, response) => {
  try {
    const clientKey = clientKeyFromRequest(request);
    const history = Array.isArray(request.body?.history) ? request.body.history.slice(0, 80) : [];
    let saved = 0;
    for (const task of history) {
      if (!task?.id || !task?.prompt) continue;
      await saveHistoryTask(normalizeClientHistoryTask(task), clientKey);
      saved += 1;
    }
    response.json({ ok: true, saved, clientKey });
  } catch (error) {
    response.status(503).json({ ok: false, message: errorMessage(error), saved: 0 });
  }
});

app.delete("/api/history/:id", async (request, response) => {
  try {
    const task = await softDeleteHistoryTask(request.params.id, clientKeyFromRequest(request));
    response.json({ ok: true, task });
  } catch (error) {
    response.status(503).json({ ok: false, message: errorMessage(error) });
  }
});

app.post("/api/history/:id/restore", async (request, response) => {
  try {
    const task = await restoreHistoryTask(request.params.id, clientKeyFromRequest(request));
    response.json({ ok: true, task });
  } catch (error) {
    response.status(503).json({ ok: false, message: errorMessage(error) });
  }
});

app.delete("/api/history/:id/permanent", async (request, response) => {
  try {
    await deleteHistoryTaskPermanently(request.params.id, clientKeyFromRequest(request));
    response.json({ ok: true });
  } catch (error) {
    response.status(503).json({ ok: false, message: errorMessage(error) });
  }
});

app.delete("/api/history", async (request, response) => {
  try {
    const clientKey = clientKeyFromRequest(request);
    const deleted = request.query?.deleted === "1" || request.query?.deleted === "true";
    const count = deleted ? await clearDeletedHistoryTasks(clientKey) : await softDeleteAllHistoryTasks(clientKey);
    response.json({ ok: true, deleted, count });
  } catch (error) {
    response.status(503).json({ ok: false, message: errorMessage(error), count: 0 });
  }
});

app.use("/api", (_request, response) => {
  response.status(404).json({ ok: false, message: "接口不存在" });
});

app.use(express.static(publicDir, { extensions: ["html"] }));

app.use((_request, response) => {
  response.sendFile(join(publicDir, "index.html"));
});

const { host, port } = parseArgs(process.argv.slice(2));
app.listen(port, host, () => {
  process.stdout.write(`gpt-image-node listening on http://${host}:${port}\n`);
});

function parseArgs(args) {
  const next = { host: "127.0.0.1", port: 9999 };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--host" && args[index + 1]) next.host = args[index + 1];
    if (args[index] === "--port" && args[index + 1]) next.port = Number(args[index + 1]) || 9999;
  }
  return next;
}

function sendJson(request, response, payload, { cacheSeconds = 0 } = {}) {
  const json = JSON.stringify(payload);
  const jsonLength = Buffer.byteLength(json);
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", cacheSeconds > 0
    ? `public, max-age=${cacheSeconds}, stale-while-revalidate=3600`
    : "no-store");
  response.setHeader("Vary", "Accept-Encoding");

  const acceptEncoding = String(request.headers["accept-encoding"] || "");
  if (jsonLength > 1024 && /\bgzip\b/i.test(acceptEncoding)) {
    const compressed = gzipSync(json);
    response.setHeader("Content-Encoding", "gzip");
    response.setHeader("Content-Length", String(compressed.length));
    response.end(compressed);
    return;
  }

  response.setHeader("Content-Length", String(jsonLength));
  response.end(json);
}

function sanitizeSettings(value) {
  const settings = { ...defaultSettings, ...(value && typeof value === "object" ? value : {}) };
  return {
    ...settings,
    apiUrl: normalizeApiBaseUrl(String(settings.apiUrl || defaultSettings.apiUrl)),
    apiKey: String(settings.apiKey || ""),
    apiMode: settings.apiMode === "responses" ? "responses" : "images",
    mainModelId: String(settings.mainModelId || defaultSettings.mainModelId),
    modelId: String(settings.modelId || defaultSettings.modelId),
    toolName: String(settings.toolName || defaultSettings.toolName),
    timeoutSeconds: Math.max(1, Number(settings.timeoutSeconds) || defaultSettings.timeoutSeconds)
  };
}

function sanitizeParams(value) {
  const params = value && typeof value === "object" ? value : {};
  const outputFormat = ["png", "jpeg", "webp"].includes(params.outputFormat) ? params.outputFormat : "png";
  return {
    size: String(params.size || "auto"),
    quality: ["auto", "low", "medium", "high"].includes(params.quality) ? params.quality : "auto",
    outputFormat,
    compression: outputFormat === "png" ? "" : clampNumber(Number(params.compression) || 100, 0, 100),
    moderation: params.moderation === "low" ? "low" : "auto",
    count: clampNumber(Number(params.count) || 1, 1, 4)
  };
}

async function generateOpenAIImage(settings, prompt, params, references) {
  if (settings.apiMode === "responses") {
    return generateViaResponsesApi(settings, prompt, params, references);
  }
  if (references.length > 0) {
    return editViaImagesApi(settings, prompt, params, references);
  }
  return generateViaImagesApi(settings, prompt, params);
}

async function generateViaImagesApi(settings, prompt, params) {
  const upstream = await fetchWithTimeout(joinUrl(settings.apiUrl, "/images/generations"), settings, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey.trim()}`
    },
    body: JSON.stringify(buildImagesGenerationBody(settings, prompt, params))
  });
  const json = await parseJson(upstream);
  assertOk(upstream, json);
  return imagesResult(json, params.outputFormat);
}

async function editViaImagesApi(settings, prompt, params, references) {
  const form = new FormData();
  form.set("model", settings.modelId.trim() || "gpt-image-2");
  form.set("prompt", prompt);
  form.set("n", String(params.count));
  addImageOptions(form, params);
  for (const reference of references) {
    if (!reference?.dataUrl) continue;
    form.append("image", dataUrlToBlob(reference.dataUrl), reference.name || "reference.png");
  }
  const upstream = await fetchWithTimeout(joinUrl(settings.apiUrl, "/images/edits"), settings, {
    method: "POST",
    headers: { Authorization: `Bearer ${settings.apiKey.trim()}` },
    body: form
  });
  const json = await parseJson(upstream);
  assertOk(upstream, json);
  return imagesResult(json, params.outputFormat);
}

async function generateViaResponsesApi(settings, prompt, params, references) {
  const upstream = await fetchWithTimeout(joinUrl(settings.apiUrl, "/responses"), settings, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey.trim()}`
    },
    body: JSON.stringify(buildResponsesBody(settings, prompt, params, references))
  });
  const json = await parseJson(upstream);
  assertOk(upstream, json);
  const calls = (json.output ?? []).filter((item) => item.type === "image_generation_call" && item.result);
  const images = calls.map((item) => asDataImage(String(item.result), params.outputFormat));
  if (!images.length) throw new Error("API 未返回图片数据");
  return { images, revisedPrompt: calls.find((item) => item.revised_prompt)?.revised_prompt };
}

function buildImagesGenerationBody(settings, prompt, params) {
  const body = {
    model: settings.modelId.trim() || "gpt-image-2",
    prompt,
    n: params.count
  };
  addImageOptions(body, params);
  return body;
}

function buildResponsesBody(settings, prompt, params, references) {
  const tool = {
    type: settings.toolName.trim() || "image_generation",
    action: references.length > 0 ? "edit" : "generate"
  };
  addImageOptions(tool, params);
  return {
    model: responseModel(settings.mainModelId),
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          ...references.filter((reference) => reference?.dataUrl).map((reference) => ({ type: "input_image", image_url: reference.dataUrl }))
        ]
      }
    ],
    tools: [tool],
    tool_choice: { type: settings.toolName.trim() || "image_generation" }
  };
}

function addImageOptions(target, params) {
  setValue(target, "size", params.size);
  setValue(target, "quality", params.quality);
  setValue(target, "output_format", params.outputFormat);
  if (params.outputFormat !== "png" && params.compression !== "") setValue(target, "output_compression", params.compression);
  if (params.moderation !== "auto") setValue(target, "moderation", params.moderation);
}

function setValue(target, key, value) {
  if (target instanceof FormData) target.set(key, String(value));
  else target[key] = value;
}

async function fetchWithTimeout(url, settings, init) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, settings.timeoutSeconds) * 1000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error(`请求超时（${settings.timeoutSeconds} 秒）`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function parseJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const contentType = response.headers.get("content-type") ?? "";
    if (/html/i.test(contentType) || /^\s*<!doctype html/i.test(text) || /^\s*<html/i.test(text)) {
      const error = new Error("接口返回了网页 HTML，不是 JSON。请确认 API URL 使用 OpenAI 兼容地址，例如 https://img.inklens.art/v1");
      attachUpstreamDetails(error, response, text);
      throw error;
    }
    const error = new Error(text.slice(0, 300));
    attachUpstreamDetails(error, response, text);
    throw error;
  }
}

function assertOk(response, json) {
  if (response.ok && !json.error) return;
  const error = new Error(json.error?.message ?? `${response.status} ${response.statusText}`);
  attachUpstreamDetails(error, response, JSON.stringify(json).slice(0, 1000));
  throw error;
}

function imagesResult(json, format) {
  const images = (json.data ?? []).flatMap((item) => {
    if (item.b64_json) return [asDataImage(item.b64_json, format)];
    if (item.url) return [item.url];
    return [];
  });
  if (!images.length) throw new Error("API 未返回图片数据");
  return {
    images,
    revisedPrompt: (json.data ?? []).find((item) => item.revised_prompt)?.revised_prompt
  };
}

function asDataImage(base64, format) {
  return `data:${format === "jpeg" ? "image/jpeg" : `image/${format}`};base64,${base64}`;
}

async function persistHistoryImages(images, taskId, format, clientKey = "local") {
  const clientDir = historyImageDirForClient(clientKey);
  await mkdir(clientDir, { recursive: true });
  const saved = [];
  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    if (typeof image !== "string") continue;
    const parsed = parseDataImage(image, format);
    if (!parsed) {
      await assertImageOutputValue(image);
      saved.push(image);
      continue;
    }
    const filename = `${safeId(taskId)}-${index + 1}.${parsed.extension}`;
    await writeFile(join(clientDir, filename), parsed.buffer);
    saved.push(`/generated-history/${safeClientKey(clientKey)}/${filename}`);
  }
  return saved;
}

async function assertImageOutputValue(value) {
  const image = String(value || "").trim();
  if (!image) throw new Error("API 返回了空图片地址");
  if (looksLikeHtmlOutput(image)) throw new Error("API 返回了 HTML 内容，不是图片。请检查 API URL、模型权限或上游代理页");
  if (!/^https?:\/\//i.test(image)) return;
  await assertRemoteImageContentType(image);
}

async function assertRemoteImageContentType(url) {
  const response = await fetchHeadWithTimeout(url).catch(() => null);
  if (!response) return;
  const contentType = response.headers.get("content-type") || "";
  if (/html/i.test(contentType)) {
    const error = new Error("API 返回的图片地址实际是 HTML 页面，不是图片");
    attachUpstreamDetails(error, response, "");
    throw error;
  }
  if (contentType && !/^image\//i.test(contentType)) {
    const error = new Error(`API 返回的图片地址内容类型不是图片：${contentType}`);
    attachUpstreamDetails(error, response, "");
    throw error;
  }
}

async function fetchHeadWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    return await fetch(url, { method: "HEAD", signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timeout);
  }
}

function parseDataImage(value, fallbackFormat) {
  const match = value.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1] || `image/${fallbackFormat}`;
  const extension = mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
  return { extension, buffer: Buffer.from(match[2], "base64") };
}

function normalizeClientHistoryTask(task) {
  const params = sanitizeParams(task.params);
  return {
    id: safeId(task.id),
    prompt: String(task.prompt || ""),
    params,
    references: historyReferences(task.references),
    status: ["running", "succeeded", "failed"].includes(task.status) ? task.status : "succeeded",
    images: Array.isArray(task.images) ? task.images : Array.isArray(task.outputImages) ? task.outputImages : [],
    error: String(task.error || ""),
    revisedPrompt: String(task.revisedPrompt || task.revised_prompt || ""),
    creditCost: Math.max(0, Number(task.creditCost) || 0),
    creditUnitCost: Math.max(0, Number(task.creditUnitCost) || 0),
    creditLedgerId: String(task.creditLedgerId || ""),
    createdAt: safeDate(task.createdAt, new Date()).getTime(),
    finishedAt: task.finishedAt ? safeDate(task.finishedAt, new Date()).getTime() : null
  };
}

async function saveHistoryTaskSafely(task, clientKey = "local") {
  try {
    await saveHistoryTask(task, clientKey);
    return true;
  } catch (error) {
    process.stderr.write(`history save failed: ${errorMessage(error)}\n`);
    return false;
  }
}

async function saveHistoryTask(task, clientKey = "local") {
  const params = sanitizeParams(task.params);
  const images = await persistHistoryImages(Array.isArray(task.images) ? task.images : [], task.id, params.outputFormat, clientKey);
  const record = normalizeHistoryRecord({
    ...task,
    id: safeId(task.id),
    params,
    images,
    createdAt: safeDate(task.createdAt, new Date()).getTime(),
    finishedAt: task.finishedAt ? safeDate(task.finishedAt, new Date()).getTime() : null
  });
  await mutateHistoryStore((history) => {
    const index = history.findIndex((item) => item.id === record.id);
    if (index >= 0) history[index] = { ...history[index], ...record, deletedAt: history[index].deletedAt ?? record.deletedAt ?? null };
    else history.push(record);
    trimHistoryStore(history);
  }, clientKey);
}

async function listHistoryTasks(limit, deleted = false, clientKey = "local") {
  const history = await readHistoryStore(clientKey);
  return history
    .filter((task) => deleted ? task.deletedAt : !task.deletedAt)
    .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0))
    .slice(0, clampNumber(Number(limit) || 80, 1, 200));
}

async function softDeleteHistoryTask(id, clientKey = "local") {
  const safeTaskId = safeId(id);
  return mutateHistoryStore((history) => {
    const task = history.find((item) => item.id === safeTaskId);
    if (!task) return null;
    task.deletedAt = Date.now();
    return task;
  }, clientKey);
}

async function restoreHistoryTask(id, clientKey = "local") {
  const safeTaskId = safeId(id);
  return mutateHistoryStore((history) => {
    const task = history.find((item) => item.id === safeTaskId);
    if (!task) return null;
    task.deletedAt = null;
    return task;
  }, clientKey);
}

async function softDeleteAllHistoryTasks(clientKey = "local") {
  return mutateHistoryStore((history) => {
    const now = Date.now();
    let count = 0;
    for (const task of history) {
      if (task.deletedAt) continue;
      task.deletedAt = now;
      count += 1;
    }
    return count;
  }, clientKey);
}

async function deleteHistoryTaskPermanently(id, clientKey = "local") {
  const safeTaskId = safeId(id);
  const images = await mutateHistoryStore((history) => {
    const index = history.findIndex((item) => item.id === safeTaskId);
    if (index < 0) return [];
    const [task] = history.splice(index, 1);
    return task.images;
  }, clientKey);
  await removeHistoryImages(images);
}

async function clearDeletedHistoryTasks(clientKey = "local") {
  const { count, images } = await mutateHistoryStore((history) => {
    const deleted = history.filter((task) => task.deletedAt);
    const active = history.filter((task) => !task.deletedAt);
    history.splice(0, history.length, ...active);
    return { count: deleted.length, images: deleted.flatMap((task) => task.images) };
  }, clientKey);
  await removeHistoryImages(images);
  return count;
}

async function removeHistoryImages(images) {
  for (const image of Array.isArray(images) ? images : []) {
    const relative = String(image || "");
    if (!relative.startsWith("/generated-history/")) continue;
    const filePath = relative.slice("/generated-history/".length).split(/[?#]/)[0];
    if (!filePath || filePath.includes("\\") || filePath.includes("\0")) continue;
    const rootDir = resolve(historyImageDir);
    const target = resolve(historyImageDir, filePath);
    if (target !== rootDir && !target.startsWith(`${rootDir}${sep}`)) continue;
    await rm(target, { force: true });
  }
}

const historyReadyPromises = new Map();
let historyWriteQueue = Promise.resolve();

function ensureHistoryStore(clientKey = "local") {
  if (historyStore) return Promise.resolve();
  const key = safeClientKey(clientKey);
  if (!historyReadyPromises.has(key)) historyReadyPromises.set(key, initializeHistoryStore(key));
  return historyReadyPromises.get(key);
}

async function initializeHistoryStore(clientKey = "local") {
  await mkdir(dataDir, { recursive: true });
  await mkdir(historyImageDir, { recursive: true });
  await mkdir(historyStoreDir, { recursive: true });
  await mkdir(historyImageDirForClient(clientKey), { recursive: true });
  const storeFile = historyStoreFileForClient(clientKey);
  try {
    await access(storeFile);
  } catch {
    await writeFile(storeFile, "[]\n");
  }
}

async function readHistoryStore(clientKey = "local") {
  if (historyStore) return await historyStore.readHistoryStore(clientKey);
  await ensureHistoryStore(clientKey);
  try {
    const text = await readFile(historyStoreFileForClient(clientKey), "utf8");
    const parsed = JSON.parse(text || "[]");
    return Array.isArray(parsed) ? parsed.map(normalizeHistoryRecord) : [];
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function writeHistoryStore(history, clientKey = "local") {
  if (historyStore) {
    await historyStore.writeHistoryStore(history, clientKey);
    return;
  }
  await ensureHistoryStore(clientKey);
  await writeFile(historyStoreFileForClient(clientKey), `${JSON.stringify(history.map(normalizeHistoryRecord), null, 2)}\n`);
}

function mutateHistoryStore(mutator, clientKey = "local") {
  if (historyStore) return historyStore.mutateHistoryStore(mutator, clientKey);
  const run = historyWriteQueue.then(async () => {
    const history = await readHistoryStore(clientKey);
    const result = await mutator(history);
    trimHistoryStore(history);
    await writeHistoryStore(history, clientKey);
    return result;
  });
  historyWriteQueue = run.catch(() => {});
  return run;
}

function normalizeHistoryRecord(task) {
  return {
    id: safeId(task?.id),
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
    createdAt: safeDate(task?.createdAt, new Date()).getTime(),
    finishedAt: task?.finishedAt ? safeDate(task.finishedAt, new Date()).getTime() : null,
    deletedAt: task?.deletedAt ? safeDate(task.deletedAt, new Date()).getTime() : null
  };
}

function trimHistoryStore(history) {
  history.sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
  if (history.length > 300) history.splice(300);
}

function historyReferences(references) {
  return (Array.isArray(references) ? references : []).map((reference) => ({
    id: String(reference?.id || ""),
    name: String(reference?.name || "reference.png")
  }));
}

function requestReferences(references) {
  return (Array.isArray(references) ? references : [])
    .filter((reference) => typeof reference?.dataUrl === "string" && reference.dataUrl.startsWith("data:image/"))
    .map((reference) => ({
      id: String(reference.id || ""),
      name: String(reference.name || "reference.png"),
      dataUrl: String(reference.dataUrl)
    }));
}

let studioOrderReadyPromise = null;
let studioOrderWriteQueue = Promise.resolve();

const studioOrderStatusLabels = {
  submitted: "已提交",
  needs_more: "资料需补充",
  producing: "制作中",
  completed: "已完成"
};

function requireStudioAdmin(response, request) {
  const provided = String(
    request.headers?.["x-admin-key"]
    || request.query?.adminKey
    || request.body?.adminKey
    || ""
  ).trim();
  if (studioAdminKey && provided === studioAdminKey) return true;
  response.status(401).json({ ok: false, message: "管理员登录后可操作" });
  return false;
}

async function listStudioOrders({ clientKey = "", status = "", limit = 50 } = {}) {
  const orders = await readStudioOrders();
  const normalizedStatus = status ? normalizeStudioOrderStatus(status) : "";
  return orders
    .filter((order) => clientKey ? order.clientKey === clientKey : true)
    .filter((order) => normalizedStatus ? order.status === normalizedStatus : true)
    .sort((left, right) => String(right.updatedAt || right.createdAt).localeCompare(String(left.updatedAt || left.createdAt), "en"))
    .slice(0, clampNumber(Number(limit) || 50, 1, 200));
}

async function createStudioOrder(payload, clientKey) {
  const source = payload && typeof payload === "object" ? payload : {};
  const orderId = safeId(`studio-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
  const now = new Date().toISOString();
  const people = normalizeStudioPeople(source.people, source.peopleCount);
  const rawPhotos = normalizeIncomingStudioAssets(source.photos);
  const photos = await persistStudioOrderAssets({
    clientKey,
    orderId,
    folder: "references",
    prefix: "ref",
    items: rawPhotos
  });
  if (!photos.length) {
    const error = new Error("请至少上传 1 张照片");
    error.status = 400;
    throw error;
  }
  const order = normalizeStudioOrderRecord({
    id: orderId,
    clientKey,
    customerLabel: compactStudioText(source.customerLabel, 80),
    comboId: safeId(source.comboId || "custom"),
    comboLabel: compactStudioText(source.comboLabel || "定制组合", 40),
    sceneId: safeId(source.sceneId || ""),
    sceneLabel: compactStudioText(source.sceneLabel || "拍摄定制", 40),
    peopleCount: people.length,
    people,
    styleIds: normalizeStudioTextArray(source.styleIds, 12, 40),
    styleLabels: normalizeStudioTextArray(source.styleLabels, 12, 40),
    note: compactStudioText(source.note, 500),
    status: "submitted",
    adminNote: "",
    resultNote: "",
    photos,
    results: [],
    submittedAt: now,
    createdAt: now,
    updatedAt: now
  });
  await mutateStudioOrders((orders) => {
    orders.unshift(order);
    return order;
  });
  return order;
}

async function updateStudioOrder(id, payload) {
  const orderId = safeId(id);
  const source = payload && typeof payload === "object" ? payload : {};
  return await mutateStudioOrders(async (orders) => {
    const index = orders.findIndex((item) => item.id === orderId);
    if (index < 0) return null;
    const order = { ...orders[index] };
    const hasStatus = Object.hasOwn(source, "status");
    const status = hasStatus ? normalizeStudioOrderStatus(source.status) : order.status;
    const now = new Date().toISOString();
    const incomingResults = normalizeIncomingStudioAssets(source.results);
    if (incomingResults.length) {
      const savedResults = await persistStudioOrderAssets({
        clientKey: order.clientKey,
        orderId: order.id,
        folder: "results",
        prefix: "result",
        items: incomingResults
      });
      order.results = [...(Array.isArray(order.results) ? order.results : []), ...savedResults];
      order.resultNote = compactStudioText(source.resultNote || order.resultNote, 500);
      order.status = "completed";
    } else {
      order.status = status;
    }
    if (Object.hasOwn(source, "adminNote")) order.adminNote = compactStudioText(source.adminNote, 500);
    if (Object.hasOwn(source, "resultNote") && !incomingResults.length) order.resultNote = compactStudioText(source.resultNote, 500);
    order.updatedAt = now;
    order.notifications = [
      ...(Array.isArray(order.notifications) ? order.notifications : []),
      {
        id: safeId(`notice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`),
        status: order.status,
        title: studioOrderStatusLabels[order.status] || "订单已更新",
        note: incomingResults.length ? "后台已上传成果" : compactStudioText(source.adminNote || source.resultNote || "", 160),
        createdAt: now
      }
    ].slice(-20);
    const normalized = normalizeStudioOrderRecord(order);
    orders[index] = normalized;
    return normalized;
  });
}

async function persistStudioOrderAssets({ clientKey, orderId, folder, prefix, items }) {
  const orderKey = safeId(orderId);
  const folderKey = safeId(folder || "assets");
  const clientKeySafe = safeClientKey(clientKey);
  const dir = join(studioOrderAssetDir, clientKeySafe, orderKey, folderKey);
  await mkdir(dir, { recursive: true });
  const now = new Date().toISOString();
  const saved = [];
  const entries = Array.isArray(items) ? items.slice(0, 80) : [];
  for (let index = 0; index < entries.length; index += 1) {
    const item = entries[index] && typeof entries[index] === "object" ? entries[index] : {};
    const directSrc = String(item.src || item.url || "").trim();
    if (directSrc && !String(item.dataUrl || "").startsWith("data:image/")) {
      saved.push(normalizeStudioAssetRecord({ ...item, id: item.id || `${prefix}-${index + 1}`, src: directSrc, uploadedAt: now }));
      continue;
    }
    const parsed = parseDataImage(String(item.dataUrl || ""), "jpg");
    if (!parsed) continue;
    const fileStem = safeId(`${prefix}-${index + 1}-${String(item.name || "image").replace(/\.[a-z0-9]+$/i, "")}`);
    const filename = `${fileStem}.${parsed.extension}`;
    await writeFile(join(dir, filename), parsed.buffer);
    saved.push(normalizeStudioAssetRecord({
      ...item,
      id: item.id || `${prefix}-${index + 1}`,
      src: studioOrderAssetUrl(clientKeySafe, orderKey, folderKey, filename),
      uploadedAt: now
    }));
  }
  return saved;
}

function studioOrderAssetUrl(clientKey, orderId, folder, filename) {
  return `/studio-order-assets/${[clientKey, orderId, folder, filename].map((part) => encodeURIComponent(part)).join("/")}`;
}

function normalizeIncomingStudioAssets(value) {
  return (Array.isArray(value) ? value : [])
    .filter((item) => item && typeof item === "object")
    .slice(0, 80);
}

function normalizeStudioAssetRecord(item) {
  return {
    id: safeId(item?.id || `asset-${Date.now().toString(36)}`),
    src: String(item?.src || item?.url || ""),
    name: compactStudioText(item?.name || "photo.jpg", 120),
    title: compactStudioText(item?.title || item?.name || "成片", 80),
    note: compactStudioText(item?.note, 240),
    personIndex: Math.max(0, Number(item?.personIndex) || 0),
    personLabel: compactStudioText(item?.personLabel || "", 40),
    uploadedAt: String(item?.uploadedAt || "")
  };
}

function normalizeStudioOrderRecord(item) {
  const status = normalizeStudioOrderStatus(item?.status);
  const people = normalizeStudioPeople(item?.people, item?.peopleCount);
  const photos = (Array.isArray(item?.photos) ? item.photos : []).map(normalizeStudioAssetRecord).filter((entry) => entry.src);
  const results = (Array.isArray(item?.results) ? item.results : []).map(normalizeStudioAssetRecord).filter((entry) => entry.src);
  const photoCounts = photos.reduce((counts, photo) => {
    counts[photo.personIndex] = (counts[photo.personIndex] || 0) + 1;
    return counts;
  }, {});
  const peopleWithPhotoCounts = people.map((person, index) => ({ ...person, photoCount: photoCounts[index] || person.photoCount || 0 }));
  const createdAt = String(item?.createdAt || item?.submittedAt || new Date().toISOString());
  const updatedAt = String(item?.updatedAt || createdAt);
  return {
    id: safeId(item?.id),
    clientKey: safeClientKey(item?.clientKey),
    customerLabel: compactStudioText(item?.customerLabel, 80),
    comboId: safeId(item?.comboId || "custom"),
    comboLabel: compactStudioText(item?.comboLabel || "定制组合", 40),
    sceneId: safeId(item?.sceneId || ""),
    sceneLabel: compactStudioText(item?.sceneLabel || "拍摄定制", 40),
    peopleCount: peopleWithPhotoCounts.length,
    people: peopleWithPhotoCounts,
    styleIds: normalizeStudioTextArray(item?.styleIds, 12, 40),
    styleLabels: normalizeStudioTextArray(item?.styleLabels, 12, 40),
    note: compactStudioText(item?.note, 500),
    status,
    customerStatus: status,
    customerStatusLabel: studioOrderStatusLabels[status] || "已提交",
    adminStatusLabel: studioOrderStatusLabels[status] || "已提交",
    adminNote: compactStudioText(item?.adminNote, 500),
    resultNote: compactStudioText(item?.resultNote, 500),
    photoCount: photos.length,
    resultCount: results.length,
    photos,
    results,
    notifications: (Array.isArray(item?.notifications) ? item.notifications : []).slice(-20),
    submittedAt: String(item?.submittedAt || createdAt),
    createdAt,
    updatedAt
  };
}

function normalizeStudioOrderStatus(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/-/g, "_");
  return ["submitted", "needs_more", "producing", "completed"].includes(normalized) ? normalized : "submitted";
}

function normalizeStudioPeople(value, fallbackCount = 1) {
  const source = Array.isArray(value) ? value : [];
  const count = clampNumber(Number(fallbackCount) || source.length || 1, 1, 12);
  const people = [];
  for (let index = 0; index < count; index += 1) {
    const item = source[index] && typeof source[index] === "object" ? source[index] : {};
    people.push({
      id: safeId(item.id || `person-${index + 1}`),
      label: compactStudioText(item.label || `人物 ${index + 1}`, 40),
      note: compactStudioText(item.note, 120),
      photoCount: Math.max(0, Number(item.photoCount) || 0)
    });
  }
  return people;
}

function normalizeStudioTextArray(value, limit = 12, maxLength = 80) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map((item) => compactStudioText(item, maxLength))
    .filter(Boolean))]
    .slice(0, limit);
}

function compactStudioText(value, max = 200) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

async function ensureStudioOrderStore() {
  if (!studioOrderReadyPromise) {
    studioOrderReadyPromise = (async () => {
      await mkdir(dataDir, { recursive: true });
      await mkdir(dirname(studioOrderStoreFile), { recursive: true });
      await mkdir(studioOrderAssetDir, { recursive: true });
      try {
        await access(studioOrderStoreFile);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
        await writeFile(studioOrderStoreFile, "[]\n", "utf-8");
      }
    })();
  }
  return studioOrderReadyPromise;
}

async function readStudioOrders() {
  await ensureStudioOrderStore();
  try {
    const text = await readFile(studioOrderStoreFile, "utf-8");
    const parsed = JSON.parse(text || "[]");
    return (Array.isArray(parsed) ? parsed : []).map(normalizeStudioOrderRecord);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function writeStudioOrders(orders) {
  await ensureStudioOrderStore();
  const normalized = (Array.isArray(orders) ? orders : []).map(normalizeStudioOrderRecord);
  await writeFile(studioOrderStoreFile, `${JSON.stringify(normalized, null, 2)}\n`, "utf-8");
}

function mutateStudioOrders(mutator) {
  const run = studioOrderWriteQueue.then(async () => {
    const orders = await readStudioOrders();
    const result = await mutator(orders);
    await writeStudioOrders(orders.map(normalizeStudioOrderRecord));
    return result;
  });
  studioOrderWriteQueue = run.catch(() => {});
  return run;
}

function historyStoreFileForClient(clientKey = "local") {
  return join(historyStoreDir, `${safeClientKey(clientKey)}.json`);
}

function historyImageDirForClient(clientKey = "local") {
  return join(historyImageDir, safeClientKey(clientKey));
}

async function handlePaymentWebhookEvent(event) {
  const type = String(event?.type || "");
  const session = event?.data?.object;
  if (!session || typeof session !== "object") return;
  const metadata = session.metadata && typeof session.metadata === "object" ? session.metadata : {};
  const clientKey = normalizeExplicitClientKey(metadata.clientKey);
  const orderId = safeId(metadata.orderId || session.client_reference_id || "");
  if (!clientKey || !orderId) return;

  if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
    await syncRechargeOrderFromProvider({
      provider: "stripe",
      clientKey,
      orderId,
      orderStatus: String(session.payment_status || "") === "paid" || type === "checkout.session.async_payment_succeeded" ? "paid" : "pending",
      providerSessionId: safeId(session.id || ""),
      providerPaymentId: safeId(session.payment_intent || "")
    });
    return;
  }

  if (type === "checkout.session.expired") {
    await syncRechargeOrderFromProvider({
      provider: "stripe",
      clientKey,
      orderId,
      orderStatus: "cancelled",
      providerSessionId: safeId(session.id || ""),
      providerPaymentId: safeId(session.payment_intent || "")
    });
    return;
  }

  if (type === "checkout.session.async_payment_failed") {
    await syncRechargeOrderFromProvider({
      provider: "stripe",
      clientKey,
      orderId,
      orderStatus: "failed",
      providerSessionId: safeId(session.id || ""),
      providerPaymentId: safeId(session.payment_intent || ""),
      failureReason: "Stripe 异步支付失败"
    });
  }
}

async function syncRechargeOrderFromProvider({
  provider,
  clientKey,
  orderId,
  orderStatus,
  providerSessionId = "",
  providerPaymentId = "",
  failureReason = ""
}) {
  if (!clientKey || !orderId) return { order: null, entry: null };
  if (orderStatus === "paid") {
    return await creditService.fulfillRechargeOrder({
      orderId,
      clientKey,
      provider: String(provider || "stripe"),
      providerSessionId: safeId(providerSessionId || ""),
      providerPaymentId: safeId(providerPaymentId || "")
    });
  }
  const updated = await creditService.updateRechargeOrder(orderId, clientKey, {
    status: ["pending", "cancelled", "failed", "refunded"].includes(orderStatus) ? orderStatus : "pending",
    provider: String(provider || "stripe"),
    providerSessionId: safeId(providerSessionId || ""),
    providerPaymentId: safeId(providerPaymentId || ""),
    failureReason: orderStatus === "failed" ? String(failureReason || `${providerLabel(provider)}支付失败`) : ""
  });
  return { order: updated.order, entry: null };
}

function selectedPayment(origin = "") {
  const preferred = String(process.env.PAYMENT_PROVIDER || "auto").trim().toLowerCase();
  const alipay = { provider: alipayPaymentProvider, payment: alipayPaymentProvider.publicConfig(origin), weight: alipaySelectionWeight() };
  const stripe = { provider: stripePaymentProvider, payment: stripePaymentProvider.publicConfig(origin), weight: stripeSelectionWeight() };
  const ordered = preferred === "stripe"
    ? [stripe, alipay]
    : preferred === "alipay"
      ? [alipay, stripe]
      : [alipay, stripe];
  const selected = ordered.find((item) => item.weight > 0) || ordered[0];
  return { provider: selected.provider, payment: selected.payment };
}

function alipaySelectionWeight() {
  const hasAppId = Boolean(String(process.env.ALIPAY_APP_ID || "").trim());
  const hasPrivateKey = Boolean(String(process.env.ALIPAY_APP_PRIVATE_KEY || "").trim());
  if (hasAppId && hasPrivateKey) return 3;
  if (hasAppId || hasPrivateKey) return 1;
  return 0;
}

function stripeSelectionWeight() {
  if (["1", "true", "yes", "on"].includes(String(process.env.STRIPE_FAKE_MODE || "").trim().toLowerCase())) return 3;
  return String(process.env.STRIPE_SECRET_KEY || "").trim() ? 2 : 0;
}

function providerLabel(provider) {
  return String(provider || "").trim() === "alipay" ? "支付宝" : "Stripe";
}

function clientKeyFromRequest(request) {
  const explicit = normalizeExplicitClientKey(request.headers?.["x-client-key"]);
  if (explicit) return explicit;
  return safeClientKey(clientIpFromRequest(request));
}

async function isAccountClientKey(clientKey) {
  const normalized = normalizeExplicitClientKey(clientKey);
  if (!normalized) return false;
  const users = await readUsers();
  return users.some((user) => accountClientKey(user.id) === normalized);
}

async function requireAccountClientKey(response, clientKey) {
  if (await isAccountClientKey(clientKey)) return true;
  response.status(401).json({ ok: false, message: "登录后可买积分" });
  return false;
}

async function readUsers() {
  if (authStore) return await authStore.listUsers();
  try {
    const raw = await readFile(authUsersFile, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.users) ? parsed.users.filter((user) => user && typeof user === "object") : [];
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function writeUsers(users) {
  if (authStore) return;
  await mkdir(authDataDir, { recursive: true });
  await writeFile(authUsersFile, `${JSON.stringify({ users }, null, 2)}\n`, "utf-8");
}

function normalizeAccountType(value) {
  if (!value || value === "email") return "email";
  throw new Error("当前只支持邮箱注册");
}

function normalizeAccount(value, type) {
  if (type !== "email") throw new Error("当前只支持邮箱注册");
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("请输入正确的邮箱地址");
  return email;
}

function normalizeUsername(value, account = "", users = []) {
  const username = String(value || "").trim().replace(/\s+/g, " ");
  if (!username) return deriveDefaultUsername(account, users);
  if (username.length < 2 || username.length > 24) throw new Error("用户名需为 2-24 个字符");
  return username;
}

function deriveDefaultUsername(account, users = []) {
  const [localPart = ""] = String(account || "").split("@");
  let base = String(localPart || "").trim().replace(/\s+/g, "");
  if (!base) base = "新用户";
  if (base.length < 2) base = `${base}用户`;
  base = base.slice(0, 24);
  const taken = new Set(users.map((user) => String(user.username || "").trim()).filter(Boolean));
  if (!taken.has(base)) return base;
  let index = 2;
  while (index < 1000) {
    const suffix = String(index);
    const candidate = `${base.slice(0, Math.max(1, 24 - suffix.length))}${suffix}`;
    if (!taken.has(candidate)) return candidate;
    index += 1;
  }
  return `${base.slice(0, 21)}001`;
}

function normalizePassword(value) {
  const password = String(value || "");
  if (password.length < 6 || password.length > 64) throw new Error("密码需为 6-64 个字符");
  return password;
}

async function verifyCode(type, account, value) {
  const code = String(value || "").trim();
  if (authStore) {
    const result = await authStore.verifyCode(type, account, code);
    if (!result.ok && result.reason === "expired") throw new Error("验证码已过期，请重新获取");
    if (!result.ok) throw new Error("验证码不正确");
    return;
  }
  const stored = verificationCodes.get(authKey(type, account));
  if (!stored || stored.expiresAt < Date.now()) throw new Error("验证码已过期，请重新获取");
  if (stored.code !== code) throw new Error("验证码不正确");
}

function authKey(type, account) {
  return `${type}:${account}`;
}

async function readStoredVerificationCode(type, account) {
  if (authStore) return await authStore.getVerificationCode(type, account);
  return verificationCodes.get(authKey(type, account)) || null;
}

async function writeStoredVerificationCode(type, account, value) {
  if (authStore) {
    await authStore.saveVerificationCode({
      type,
      account,
      code: value.code,
      delivery: value.delivery,
      sentAt: value.sentAt,
      expiresAt: value.expiresAt
    });
    return;
  }
  verificationCodes.set(authKey(type, account), {
    code: value.code,
    sentAt: value.sentAt,
    expiresAt: value.expiresAt
  });
}

async function deleteStoredVerificationCode(type, account) {
  if (authStore) {
    await authStore.deleteVerificationCode(type, account);
    return;
  }
  verificationCodes.delete(authKey(type, account));
}

function maskAccount(account, type) {
  if (type !== "email") return String(account || "");
  const [name = "", domain = ""] = String(account || "").split("@");
  const visible = name.length <= 2 ? name : `${name.slice(0, 2)}***`;
  return `${visible}@${domain}`;
}

async function sendVerificationEmail(account, code) {
  const config = emailConfig();
  if (!config.host) throw new Error("邮箱服务未配置，请设置 INKLENS_SMTP_HOST");
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined
  });
  await transporter.sendMail({
    from: config.from,
    to: account,
    subject: "墨境邮箱验证码",
    text: `你正在创建墨境账号，邮箱验证码是 ${code}，5 分钟内有效。若非本人操作，请忽略这封邮件。`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937;line-height:1.6;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
          <img src="https://img.inklens.art/assets/icon-192.png" alt="墨境" width="48" height="48" style="display:block;border-radius:12px;" />
          <div>
            <div style="font-size:18px;font-weight:700;color:#111827;">墨境</div>
            <div style="font-size:13px;color:#6b7280;">邮箱验证码</div>
          </div>
        </div>
        <p>你正在创建 <strong>墨境</strong> 账号</p>
        <p>邮箱验证码是 <strong style="font-size:20px;color:#9f2f22;">${code}</strong></p>
        <p>5 分钟内有效。若非本人操作，请忽略这封邮件。</p>
      </div>`
  });
}

function emailConfig() {
  const user = process.env.INKLENS_SMTP_USER || process.env.SMTP_USER || process.env.IDENTITY_WORKFLOW_SMTP_USER || "";
  return {
    host: process.env.INKLENS_SMTP_HOST || process.env.SMTP_HOST || process.env.IDENTITY_WORKFLOW_SMTP_HOST || "",
    port: Number(process.env.INKLENS_SMTP_PORT || process.env.SMTP_PORT || process.env.IDENTITY_WORKFLOW_SMTP_PORT || 587),
    secure: ["1", "true", "yes"].includes(String(
      process.env.INKLENS_SMTP_SECURE || process.env.SMTP_SECURE || process.env.IDENTITY_WORKFLOW_SMTP_SECURE || ""
    ).toLowerCase()),
    user,
    pass: process.env.INKLENS_SMTP_PASS || process.env.SMTP_PASS || process.env.IDENTITY_WORKFLOW_SMTP_PASS || "",
    from: process.env.INKLENS_MAIL_FROM || process.env.SMTP_FROM || process.env.IDENTITY_WORKFLOW_MAIL_FROM || user || "墨境 <no-reply@localhost>"
  };
}

function authCodeDelivery(request) {
  if (isAuthTestMode()) return "test";
  if (!emailConfig().host && allowLocalAuthCodePreview(request)) return "onscreen";
  return "email";
}

function authCodeMessage(delivery) {
  if (delivery === "test") return "测试模式已返回验证码，5 分钟内有效";
  if (delivery === "onscreen") return "当前未配置邮箱服务，本机模式已直接显示验证码，可继续完成注册";
  return "验证码已发送到邮箱，5 分钟内有效";
}

function isAuthTestMode() {
  return ["1", "true", "yes"].includes(String(
    process.env.INKLENS_AUTH_TEST_MODE || process.env.AUTH_TEST_MODE || process.env.IDENTITY_WORKFLOW_AUTH_TEST_MODE || ""
  ).toLowerCase());
}

// Only show the code on loopback or LAN hosts so public domains still require a real mail channel.
function allowLocalAuthCodePreview(request) {
  const host = requestHostName(request);
  const clientIp = clientIpFromRequest(request);
  return isLocalHostName(host) || isPrivateNetworkIp(clientIp);
}

function requestHostName(request) {
  const raw = String(request.headers?.["x-forwarded-host"] || request.headers?.host || "").split(",")[0].trim();
  const withoutBrackets = raw.startsWith("[") ? raw.slice(1) : raw;
  const unwrapped = withoutBrackets.replace(/\]$/, "");
  if (!unwrapped) return "";
  const ipv6Host = unwrapped.includes(":") && !/\.\d+$/.test(unwrapped) ? unwrapped : "";
  if (ipv6Host) return ipv6Host.toLowerCase();
  const [host] = unwrapped.split(":");
  return String(host || "").trim().toLowerCase();
}

function isLocalHostName(value) {
  if (!value) return false;
  return value === "localhost"
    || value === "127.0.0.1"
    || value === "::1"
    || value === "0.0.0.0"
    || value.endsWith(".local")
    || isPrivateNetworkIp(value);
}

function isPrivateNetworkIp(value) {
  const ip = String(value || "").trim().toLowerCase();
  if (!ip) return false;
  if (ip === "127.0.0.1" || ip === "::1" || ip === "0.0.0.0") return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(ip)) return true;
  if (/^(fc|fd)[0-9a-f:]+$/.test(ip)) return true;
  if (ip.startsWith("fe80:")) return true;
  return false;
}

function makeUserId() {
  const suffix = typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID().replace(/-/g, "").slice(0, 6)
    : Math.random().toString(16).slice(2, 8);
  return safeId(`user_${Date.now().toString(36)}_${suffix}`);
}

function publicUser(user) {
  return {
    id: String(user.id || ""),
    username: String(user.username || user.nickname || ""),
    nickname: String(user.nickname || user.username || ""),
    type: String(user.type || "email"),
    accountLabel: String(user.accountLabel || ""),
    createdAt: String(user.createdAt || ""),
    lastLoginAt: String(user.lastLoginAt || "")
  };
}

function accountClientKey(userId) {
  return safeClientKey(`account-${userId}`);
}

async function migrateClientData(sourceKey, targetKey) {
  const source = normalizeExplicitClientKey(sourceKey);
  const target = normalizeExplicitClientKey(targetKey);
  if (!source || !target || source === target) return;
  await migrateCreditStore(source, target);
  await migrateOrderStore(source, target);
  await migrateHistoryStore(source, target);
}

async function migrateCreditStore(sourceKey, targetKey) {
  const source = await creditStore.readCreditStore(sourceKey);
  if (!source.balance && !source.ledger.length) return;
  const sourceIsWelcomeOnly = isWelcomeOnlyCreditStore(source);
  await creditStore.mutateCreditStore((draft) => {
    const targetIsWelcomeOnly = isWelcomeOnlyCreditStore(draft);
    if (sourceIsWelcomeOnly && !targetIsWelcomeOnly) return draft;
    if (targetIsWelcomeOnly) {
      draft.balance = 0;
      draft.ledger = [];
      draft.updatedAt = source.updatedAt || draft.updatedAt;
    }
    const seen = new Set((Array.isArray(draft.ledger) ? draft.ledger : []).map((entry) => String(entry?.id || "")));
    for (const entry of source.ledger || []) {
      const id = String(entry?.id || "");
      if (!id || seen.has(id)) continue;
      draft.ledger.push(entry);
      seen.add(id);
    }
    draft.balance += Math.max(0, Number(source.balance) || 0);
    draft.updatedAt = newestIsoDate(draft.updatedAt, source.updatedAt);
    return draft;
  }, targetKey);
  await creditStore.mutateCreditStore((draft) => {
    draft.balance = 0;
    draft.ledger = [];
    draft.updatedAt = new Date().toISOString();
    return draft;
  }, sourceKey);
}

async function migrateOrderStore(sourceKey, targetKey) {
  const orders = await creditOrderStore.readOrders(sourceKey);
  if (!orders.length) return;
  await creditOrderStore.mutateOrders((draft) => {
    const seen = new Set((Array.isArray(draft) ? draft : []).map((entry) => String(entry?.id || "")));
    for (const order of orders) {
      const id = String(order?.id || "");
      if (!id || seen.has(id)) continue;
      draft.push(order);
      seen.add(id);
    }
    return draft;
  }, targetKey);
  await creditOrderStore.mutateOrders((draft) => {
    draft.splice(0, draft.length);
    return draft;
  }, sourceKey);
}

async function migrateHistoryStore(sourceKey, targetKey) {
  const history = await readHistoryStore(sourceKey);
  if (!history.length) return;
  await mutateHistoryStore((draft) => {
    const seen = new Set((Array.isArray(draft) ? draft : []).map((entry) => String(entry?.id || "")));
    for (const item of history) {
      const id = String(item?.id || "");
      if (!id || seen.has(id)) continue;
      draft.push(item);
      seen.add(id);
    }
    return draft;
  }, targetKey);
  await writeHistoryStore([], sourceKey);
}

function newestIsoDate(left, right) {
  const leftDate = safeDate(left, new Date(0));
  const rightDate = safeDate(right, new Date(0));
  return leftDate.getTime() >= rightDate.getTime() ? leftDate.toISOString() : rightDate.toISOString();
}

function requestOrigin(request) {
  const origin = String(request.headers?.origin || "").trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(origin)) return origin;
  const proto = String(request.headers?.["x-forwarded-proto"] || "").split(",")[0].trim() || (request.socket?.encrypted ? "https" : "http");
  const host = String(request.headers?.["x-forwarded-host"] || request.headers?.host || "").split(",")[0].trim();
  if (!host) return "";
  return `${proto}://${host}`.replace(/\/+$/, "");
}

function clientIpFromRequest(request) {
  const forwarded = String(request.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  const raw = forwarded || request.ip || request.socket?.remoteAddress || "local";
  return normalizeClientIp(raw);
}

function normalizeClientIp(value) {
  let next = String(value || "local").trim();
  if (!next) return "local";
  if (next.startsWith("::ffff:")) next = next.slice(7);
  if (next === "::1") next = "127.0.0.1";
  if (next.startsWith("[") && next.includes("]")) next = next.slice(1, next.indexOf("]"));
  const ipv4WithPort = next.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/);
  if (ipv4WithPort) next = ipv4WithPort[1];
  return next.replace(/%.+$/, "") || "local";
}

function safeClientKey(value) {
  const clean = String(value || "local")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return clean || "local";
}

function normalizeExplicitClientKey(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  const clean = safeClientKey(raw);
  if (!clean || clean === "local") return "";
  return clean;
}

function attachUpstreamDetails(error, response, bodyText) {
  error.upstreamStatus = response.status;
  error.upstreamStatusText = response.statusText;
  error.upstreamContentType = response.headers.get("content-type") || "";
  error.upstreamUrl = response.url || "";
  error.upstreamBodySnippet = compactLogText(bodyText, 600);
}

async function writeGenerationErrorLog(entry) {
  try {
    await mkdir(logDir, { recursive: true });
    const payload = {
      time: new Date().toISOString(),
      requestId: entry.requestId,
      clientKey: entry.clientKey,
      taskId: safeId(entry.taskId),
      promptPreview: compactLogText(entry.prompt, 180),
      referencesCount: entry.referencesCount,
      params: sanitizeParams(entry.params),
      apiMode: entry.settings.apiMode,
      apiUrl: safeLogUrl(entry.settings.apiUrl),
      mainModelId: entry.settings.mainModelId,
      modelId: entry.settings.modelId,
      error: {
        message: errorMessage(entry.error),
        upstreamStatus: entry.error?.upstreamStatus || null,
        upstreamStatusText: entry.error?.upstreamStatusText || "",
        upstreamContentType: entry.error?.upstreamContentType || "",
        upstreamUrl: safeLogUrl(entry.error?.upstreamUrl || ""),
        upstreamBodySnippet: entry.error?.upstreamBodySnippet || ""
      }
    };
    await appendFile(generationErrorLogFile, `${JSON.stringify(payload)}\n`);
  } catch (error) {
    process.stderr.write(`generation error log failed: ${errorMessage(error)}\n`);
  }
}

function generationRequestId() {
  return `gen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function looksLikeHtmlOutput(value) {
  const trimmed = String(value || "").trim().toLowerCase();
  if (!trimmed) return false;
  if (trimmed.startsWith("<!doctype html") || trimmed.startsWith("<html") || trimmed.startsWith("<body") || trimmed.startsWith("<h1")) return true;
  if (trimmed.startsWith("data:text/html")) return true;
  try {
    const url = new URL(trimmed);
    return /\.(?:html?|xhtml)$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function compactLogText(value, max = 300) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function safeLogUrl(value) {
  const raw = String(value || "");
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return raw.replace(/([?&](?:api[_-]?key|key|token|access_token)=)[^&]+/gi, "$1***").slice(0, 300);
  }
}

function safeDate(value, fallback) {
  const date = value ? new Date(value) : fallback;
  return Number.isNaN(date.getTime()) ? fallback : date;
}

async function studioSampleCatalog({ includeItems = false } = {}) {
  const fullCatalog = await fullStudioSampleCatalog();
  return includeItems ? fullCatalog : slimStudioSampleCatalog(fullCatalog);
}

async function studioSampleGroupDetail(sceneId, groupId) {
  const catalog = await fullStudioSampleCatalog();
  const sceneGroups = catalog.sceneGroups?.[sceneId] || [];
  return sceneGroups.find((group) => group.id === groupId || group.groupId === groupId) || null;
}

async function fullStudioSampleCatalog() {
  const signature = await studioSampleCatalogSignature();
  if (studioSampleCatalogCache?.signature === signature && Date.now() - studioSampleCatalogCache.createdAt < 60_000) return studioSampleCatalogCache.catalog;
  const scenes = Object.fromEntries(studioSampleSceneIds.map((sceneId) => [sceneId, []]));
  const sceneGroups = Object.fromEntries(studioSampleSceneIds.map((sceneId) => [sceneId, []]));
  const groupIndex = new Map();
  let total = 0;
  let updatedAt = "";
  let entries = [];
  try {
    entries = await readStudioSampleEntries(studioPreviewDir);
  } catch (error) {
    if (error?.code === "ENOENT") return { total: 0, updatedAt: "", scenes, sceneGroups };
    throw error;
  }
  for (const entry of entries) {
    const classification = classifyStudioSampleEntry(entry);
    if (!classification) continue;
    const item = buildStudioSampleItem(entry, classification);
    scenes[classification.sceneId].push(item);
    const groupKey = `${classification.sceneId}:${classification.groupId}`;
    if (!groupIndex.has(groupKey)) {
      const group = buildStudioSampleGroup(entry, classification);
      groupIndex.set(groupKey, group);
      sceneGroups[classification.sceneId].push(group);
    }
    const group = groupIndex.get(groupKey);
    group.items.push(item);
    total += 1;
    if (item.updatedAt) updatedAt = updatedAt ? newestIsoDate(updatedAt, item.updatedAt) : item.updatedAt;
  }
  for (const sceneId of studioSampleSceneIds) {
    scenes[sceneId].sort((left, right) => right.sortKey.localeCompare(left.sortKey, "en") || left.title.localeCompare(right.title, "zh-CN"));
    sceneGroups[sceneId].forEach(finalizeStudioSampleGroup);
    sceneGroups[sceneId].sort(compareStudioSampleGroups);
  }
  const catalog = { total, updatedAt, scenes, sceneGroups };
  studioSampleCatalogCache = { signature, catalog, createdAt: Date.now() };
  return catalog;
}

async function studioSampleCatalogSignature() {
  try {
    const groups = await readdir(studioPreviewDir, { withFileTypes: true });
    return groups
      .map((entry) => `${entry.name}:${entry.isDirectory() ? "d" : "f"}`)
      .sort()
      .join("|");
  } catch (error) {
    if (error?.code === "ENOENT") return "missing";
    throw error;
  }
}

function slimStudioSampleCatalog(catalog) {
  const scenes = Object.fromEntries(studioSampleSceneIds.map((sceneId) => [sceneId, []]));
  const sceneGroups = Object.fromEntries(studioSampleSceneIds.map((sceneId) => [
    sceneId,
    (catalog.sceneGroups?.[sceneId] || []).map(slimStudioSampleGroup)
  ]));
  return {
    total: catalog.total,
    updatedAt: catalog.updatedAt,
    scenes,
    sceneGroups,
    mode: "index"
  };
}

function slimStudioSampleGroup(group) {
  return {
    id: group.id,
    sceneId: group.sceneId,
    sampleId: group.sampleId,
    sampleTitle: group.sampleTitle,
    groupId: group.groupId,
    group: group.group,
    title: group.title,
    subtitle: group.subtitle,
    cover: group.cover,
    coverAlt: group.coverAlt,
    count: group.count,
    items: group.items?.[0] ? [group.items[0]] : [],
    updatedAt: group.updatedAt,
    sortKey: group.sortKey,
    groupRank: group.groupRank,
    detailLoaded: false
  };
}

async function readStudioSampleEntries(baseDir) {
  const groups = (await readdir(baseDir, { withFileTypes: true }))
    .sort((left, right) => left.name.localeCompare(right.name, "en"));
  const entries = [];
  for (const group of groups) {
    if (group.name.startsWith(".")) continue;
    if (group.isDirectory()) {
      const groupPath = join(baseDir, group.name);
      const files = (await readdir(groupPath, { withFileTypes: true }))
        .sort((left, right) => left.name.localeCompare(right.name, "en"));
      for (const file of files) {
        if (!file.isFile() || !studioSampleImagePattern.test(file.name)) continue;
        entries.push({
          group: group.name,
          fileName: file.name,
          relativePath: join(group.name, file.name),
          absolutePath: join(groupPath, file.name)
        });
      }
      continue;
    }
    if (group.isFile() && studioSampleImagePattern.test(group.name)) {
      entries.push({
        group: "",
        fileName: group.name,
        relativePath: group.name,
        absolutePath: join(baseDir, group.name)
      });
    }
  }
  return entries;
}

function classifyStudioSampleEntry(entry) {
  const groupClassification = classifyStudioSampleGroup(entry.group, entry.fileName);
  return groupClassification ? { ...groupClassification, sortKey: sortKeyForEntry(entry) } : null;
}

function classifyStudioSampleGroup(group, fileName = "") {
  const groupName = String(group || "");
  const text = `${groupName}/${fileName}`.toLowerCase();
  if (studioDestinationLabels[groupName]) {
    return {
      sceneId: "wedding",
      sampleId: "travel",
      groupId: groupName,
      groupTitle: studioDestinationLabels[groupName],
      groupSubtitle: "目的地婚纱",
      groupRank: 0
    };
  }
  if (/identity_wedding/.test(text)) {
    return studioIdentityGroupClassification(groupName, "wedding", "registry", "婚登照", "身份婚纱批次", 1);
  }
  if (/identity_travel/.test(text)) {
    return studioIdentityGroupClassification(groupName, "couple", "travel", "情侣旅行", "旅行同行批次", 0);
  }
  if (/identity_landmark/.test(text)) {
    return studioIdentityGroupClassification(groupName, "couple", "cinema", "城市地标", "地标情侣批次", 1);
  }
  if (/identity_friendswedding/.test(text)) {
    return studioIdentityGroupClassification(groupName, "friends", "birthday", "闺蜜婚礼", "婚礼合照批次", 1);
  }
  if (/identity_friends/.test(text)) {
    return studioIdentityGroupClassification(groupName, "friends", "studio", "闺蜜合照", "棚拍合照批次", 0);
  }
  if (/identity_child10/.test(text)) {
    return studioIdentityGroupClassification(groupName, "child10", "campus", "10岁成长", "儿童成长批次", 0);
  }
  return null;
}

function buildStudioSampleItem(entry, classification) {
  const sceneId = classification.sceneId;
  const sampleId = classification.sampleId;
  const sceneLabel = studioSampleSceneLabels[sceneId] || sceneId;
  const sampleLabel = studioSampleDirectionLabels[sceneId]?.[sampleId] || sampleId;
  const groupLabel = classification.groupTitle || studioSampleGroupLabel(entry.group, sceneId);
  const shotNumber = extractStudioShotNumber(entry.fileName);
  const fullSrc = studioPreviewUrl(entry.relativePath);
  const previewSrc = studioPreviewThumbUrl(entry.relativePath);
  return {
    id: safeId(`sample-${entry.relativePath}`),
    sceneId,
    sampleId,
    groupId: classification.groupId || entry.group,
    groupTitle: groupLabel,
    group: entry.group,
    title: `${groupLabel} · ${sampleLabel}`,
    label: shotNumber ? `第 ${shotNumber} 张` : sampleLabel,
    alt: `${sceneLabel} · ${groupLabel} · ${sampleLabel}`,
    src: previewSrc,
    previewSrc,
    fullSrc,
    updatedAt: studioTimestampIso(groupTimestamp(entry.group)),
    sortKey: classification.sortKey
  };
}

function studioPreviewUrl(relativePath) {
  return `/studio-previews/${urlPath(relativePath)}`;
}

function studioPreviewThumbUrl(relativePath) {
  return `/studio-preview-thumbs/${urlPath(String(relativePath || "").replace(/\.[^.]+$/, ".jpg"))}`;
}

function urlPath(relativePath) {
  return String(relativePath || "").split(/[\\/]+/).filter(Boolean).map((part) => encodeURIComponent(part)).join("/");
}

function studioIdentityGroupClassification(groupName, sceneId, sampleId, titlePrefix, subtitle, groupRank) {
  const timestamp = groupTimestamp(groupName);
  const titleSuffix = timestamp ? ` · ${formatStudioSampleTimestamp(timestamp)}` : "";
  return {
    sceneId,
    sampleId,
    groupId: groupName,
    groupTitle: `${titlePrefix}${titleSuffix}`,
    groupSubtitle: subtitle,
    groupRank
  };
}

function buildStudioSampleGroup(entry, classification) {
  const sceneId = classification.sceneId;
  const sampleId = classification.sampleId;
  const sampleLabel = studioSampleDirectionLabels[sceneId]?.[sampleId] || sampleId;
  const groupTitle = classification.groupTitle || studioSampleGroupLabel(entry.group, sceneId);
  return {
    id: safeId(`sample-group-${sceneId}-${classification.groupId || entry.group || entry.fileName}`),
    sceneId,
    sampleId,
    sampleTitle: sampleLabel,
    groupId: classification.groupId || entry.group,
    group: entry.group,
    title: groupTitle,
    subtitle: classification.groupSubtitle || sampleLabel,
    cover: "",
    coverAlt: "",
    count: 0,
    items: [],
    updatedAt: studioTimestampIso(groupTimestamp(entry.group)),
    sortKey: entry.group || entry.fileName,
    groupRank: Number(classification.groupRank) || 0
  };
}

function finalizeStudioSampleGroup(group) {
  group.items.sort((left, right) => left.sortKey.localeCompare(right.sortKey, "en") || left.label.localeCompare(right.label, "zh-CN"));
  const cover = group.items[0] || {};
  group.cover = cover.src || "";
  group.coverAlt = cover.alt || group.title;
  group.count = group.items.length;
  group.subtitle = `${group.subtitle} · ${group.count} 张`;
}

function compareStudioSampleGroups(left, right) {
  if (left.groupRank !== right.groupRank) return left.groupRank - right.groupRank;
  if (left.updatedAt || right.updatedAt) {
    return String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""), "en")
      || left.title.localeCompare(right.title, "zh-CN");
  }
  return left.sortKey.localeCompare(right.sortKey, "en") || left.title.localeCompare(right.title, "zh-CN");
}

function extractStudioShotNumber(fileName) {
  const matches = [...String(fileName || "").matchAll(/(?:^|_)(\d{1,3})(?=_)/g)].map((match) => Number(match[1])).filter((value) => Number.isFinite(value) && value > 0);
  return matches.at(-1) || 0;
}

function studioSampleGroupLabel(group, sceneId) {
  if (!group) return studioSampleSceneLabels[sceneId] || sceneId;
  if (studioDestinationLabels[group]) return studioDestinationLabels[group];
  const timestamp = groupTimestamp(group);
  if (timestamp) return `${studioSampleSceneLabels[sceneId] || sceneId} 批次 ${formatStudioSampleTimestamp(timestamp)}`;
  return group.replace(/^identity_/, "").replace(/_/g, " ");
}

function groupTimestamp(group) {
  const match = String(group || "").match(/(20\d{12})/);
  return match ? match[1] : "";
}

function formatStudioSampleTimestamp(value) {
  if (!value || value.length < 12) return value;
  return `${value.slice(4, 6)}/${value.slice(6, 8)} ${value.slice(8, 10)}:${value.slice(10, 12)}`;
}

function studioTimestampIso(value) {
  if (!value || value.length < 14) return "";
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}.000Z`;
}

function sortKeyForEntry(entry) {
  const timestamp = groupTimestamp(entry.group) || "0";
  const shot = String(extractStudioShotNumber(entry.fileName)).padStart(3, "0");
  return `${timestamp}-${entry.group}-${shot}-${entry.fileName}`;
}

function safeId(value) {
  const clean = String(value || "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
  return clean || `task-${Date.now().toString(36)}`;
}

function normalizeApiBaseUrl(value) {
  const trimmed = value.trim() || "https://img.inklens.art/v1";
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    url.search = "";
    url.hash = "";
    const parts = url.pathname.split("/").filter(Boolean);
    const v1Index = parts.findIndex((part) => part === "v1");
    url.pathname = v1Index >= 0 ? `/${parts.slice(0, v1Index + 1).join("/")}` : "/v1";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

function joinUrl(base, path) {
  return `${normalizeApiBaseUrl(base)}${path}`;
}

function responseModel(model) {
  const trimmed = model.trim();
  if (!trimmed || trimmed.startsWith("gpt-image")) return "gpt-5.5";
  return trimmed;
}

function dataUrlToBlob(dataUrl) {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) throw new Error("参考图格式无效");
  const mime = match[1] || "image/png";
  const raw = match[2] ? Buffer.from(match[3], "base64") : Buffer.from(decodeURIComponent(match[3]));
  return new Blob([raw], { type: mime });
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function errorStatus(error, fallback = 500) {
  return Number.isFinite(error?.status) ? error.status : fallback;
}

function loadLocalEnv() {
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
