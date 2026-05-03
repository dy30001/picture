import Stripe from "stripe";

export class PaymentProviderError extends Error {
  constructor(message, status = 503, details = {}) {
    super(message);
    this.name = "PaymentProviderError";
    this.status = status;
    this.details = details;
  }
}

export function createStripePaymentProvider({ env = process.env, stripeClient = null } = {}) {
  const fakeMode = truthy(env.STRIPE_FAKE_MODE);
  const secretKey = String(env.STRIPE_SECRET_KEY || "").trim();
  const webhookSecret = String(env.STRIPE_WEBHOOK_SECRET || "").trim();
  const currency = normalizeCurrency(env.STRIPE_CURRENCY || "cny");
  const appBaseUrl = String(env.APP_BASE_URL || "").trim();
  const successUrl = String(env.PAYMENT_SUCCESS_URL || "").trim();
  const cancelUrl = String(env.PAYMENT_CANCEL_URL || "").trim();
  const stripe = stripeClient || (!fakeMode && secretKey ? new Stripe(secretKey) : null);

  function publicConfig(origin = "") {
    const baseUrl = resolvedBaseUrl(origin);
    if (fakeMode) {
      return {
        provider: "stripe",
        mode: "fake",
        enabled: true,
        ready: true,
        currency,
        webhookConfigured: true,
        confirmationMode: "fake",
        message: "测试支付模式已启用，可联调整体充值流程"
      };
    }
    if (!secretKey) {
      return {
        provider: "stripe",
        mode: "disabled",
        enabled: false,
        ready: false,
        currency,
        webhookConfigured: false,
        confirmationMode: "disabled",
        message: "支付功能准备中"
      };
    }
    if (!baseUrl) {
      return {
        provider: "stripe",
        mode: stripeKeyMode(secretKey),
        enabled: true,
        ready: false,
        currency,
        webhookConfigured: Boolean(webhookSecret),
        confirmationMode: webhookSecret ? "webhook" : "return",
        message: "支付功能准备中，请稍后再试"
      };
    }
    return {
      provider: "stripe",
      mode: stripeKeyMode(secretKey),
      enabled: true,
      ready: Boolean(baseUrl),
      currency,
      webhookConfigured: Boolean(webhookSecret),
      confirmationMode: webhookSecret ? "webhook" : "return",
      message: webhookSecret
        ? `Stripe Checkout 已就绪（${stripeKeyMode(secretKey) === "live" ? "正式" : "测试"}模式）`
        : `Stripe Checkout 已就绪（${stripeKeyMode(secretKey) === "live" ? "正式" : "测试"}模式，支付完成后将在回跳页确认到账）`
    };
  }

  async function createCheckoutSession({ order, clientKey, origin = "" }) {
    const config = publicConfig(origin);
    if (!config.ready) throw new PaymentProviderError(config.message, 503, config);

    if (fakeMode) {
      const sessionId = `cs_fake_${Date.now().toString(36)}`;
      return {
        sessionId,
        checkoutUrl: buildReturnUrl("success", order.id, origin, sessionId),
        paymentStatus: "unpaid",
        currency
      };
    }

    if (!stripe) throw new PaymentProviderError("Stripe 客户端未初始化", 503);
    const metadata = {
      orderId: String(order.id || ""),
      clientKey: String(clientKey || ""),
      packageId: String(order.packageId || "")
    };
    const totalCredits = Math.max(0, Number(order.credits) || 0) + Math.max(0, Number(order.bonus) || 0);
    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        locale: "zh",
        client_reference_id: String(order.id || ""),
        success_url: buildReturnUrl("success", order.id, origin, "{CHECKOUT_SESSION_ID}"),
        cancel_url: buildReturnUrl("cancel", order.id, origin),
        line_items: [{
          quantity: 1,
          price_data: {
            currency,
            unit_amount: Math.round((Number(order.amountCny) || 0) * 100),
            product_data: {
              name: `${String(order.packageName || order.packageId || "充值包")} · ${totalCredits} 积分`,
              description: `${Math.max(0, Number(order.credits) || 0)} 基础积分${order.bonus ? `，赠送 ${Math.max(0, Number(order.bonus) || 0)} 积分` : ""}`
            }
          }
        }],
        customer_creation: "if_required",
        billing_address_collection: "auto",
        metadata,
        payment_intent_data: { metadata }
      });
      if (!session.url) throw new PaymentProviderError("Stripe 未返回支付跳转地址", 502);
      return {
        sessionId: session.id,
        checkoutUrl: session.url,
        paymentStatus: String(session.payment_status || "unpaid"),
        currency: String(session.currency || currency)
      };
    } catch (error) {
      throw normalizeStripeError(error);
    }
  }

  function constructWebhookEvent(payload, signature) {
    if (fakeMode) {
      try {
        return JSON.parse(Buffer.isBuffer(payload) ? payload.toString("utf8") : String(payload || "{}"));
      } catch (error) {
        throw new PaymentProviderError(`测试 webhook 解析失败：${errorMessage(error)}`, 400);
      }
    }
    if (!stripe) throw new PaymentProviderError("Stripe 客户端未初始化", 503);
    if (!webhookSecret) throw new PaymentProviderError("缺少 STRIPE_WEBHOOK_SECRET", 503);
    try {
      return stripe.webhooks.constructEvent(payload, String(signature || ""), webhookSecret);
    } catch (error) {
      throw new PaymentProviderError(`Stripe webhook 校验失败：${errorMessage(error)}`, 400);
    }
  }

  async function confirmCheckoutSession({ sessionId, clientKey = "", expectedOrderId = "" } = {}) {
    const session = await retrieveCheckoutSession(sessionId);
    const metadata = session?.metadata && typeof session.metadata === "object" ? session.metadata : {};
    const actualClientKey = String(metadata.clientKey || "").trim();
    const actualOrderId = String(metadata.orderId || session.client_reference_id || "").trim();
    if (!actualOrderId) throw new PaymentProviderError("Stripe 会话缺少订单信息", 409);
    if (clientKey && actualClientKey && clientKey !== actualClientKey) {
      throw new PaymentProviderError("支付会话与当前账户不匹配", 403);
    }
    if (expectedOrderId && actualOrderId !== expectedOrderId) {
      throw new PaymentProviderError("支付会话与当前订单不匹配", 409);
    }
    return {
      sessionId: String(session.id || sessionId || ""),
      orderId: actualOrderId,
      clientKey: actualClientKey || String(clientKey || ""),
      paymentStatus: String(session.payment_status || ""),
      sessionStatus: String(session.status || ""),
      paymentIntentId: String(session.payment_intent?.id || session.payment_intent || ""),
      orderStatus: checkoutOrderStatus(session)
    };
  }

  async function retrieveCheckoutSession(sessionId) {
    const cleanSessionId = String(sessionId || "").trim();
    if (!cleanSessionId) throw new PaymentProviderError("缺少 session_id", 400);
    if (fakeMode) {
      return {
        id: cleanSessionId,
        payment_status: "paid",
        status: "complete",
        metadata: {},
        client_reference_id: ""
      };
    }
    if (!stripe) throw new PaymentProviderError("Stripe 客户端未初始化", 503);
    try {
      return await stripe.checkout.sessions.retrieve(cleanSessionId);
    } catch (error) {
      throw normalizeStripeError(error);
    }
  }

  function buildReturnUrl(kind, orderId, origin = "", sessionId = "") {
    const override = kind === "success" ? successUrl : cancelUrl;
    const url = override ? new URL(override, resolvedBaseUrl(origin)) : new URL("/", resolvedBaseUrl(origin));
    url.searchParams.set("tab", "credits");
    url.searchParams.set("payment", kind);
    url.searchParams.set("order", String(orderId || ""));
    if (kind === "success" && sessionId) url.searchParams.set("session_id", sessionId);
    return url.toString();
  }

  function resolvedBaseUrl(origin = "") {
    const fallback = String(origin || "").trim().replace(/\/+$/, "");
    const preferred = appBaseUrl.replace(/\/+$/, "");
    return preferred || fallback;
  }

  return { publicConfig, createCheckoutSession, constructWebhookEvent, confirmCheckoutSession };
}

function normalizeCurrency(value) {
  const clean = String(value || "cny").trim().toLowerCase();
  return /^[a-z]{3}$/.test(clean) ? clean : "cny";
}

function truthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function stripeKeyMode(secretKey) {
  if (String(secretKey || "").startsWith("sk_live_")) return "live";
  return "test";
}

function checkoutOrderStatus(session) {
  if (String(session?.payment_status || "") === "paid") return "paid";
  if (String(session?.status || "") === "expired") return "cancelled";
  return "pending";
}

function normalizeStripeError(error) {
  const status = Number(error?.statusCode) || 502;
  const message = String(error?.message || "Stripe 支付请求失败");
  return new PaymentProviderError(message, status, {
    code: String(error?.code || ""),
    type: String(error?.type || "")
  });
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
