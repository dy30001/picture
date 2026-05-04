import { createSign, createVerify } from "node:crypto";
import { PaymentProviderError } from "./stripe.mjs";

const defaultGatewayUrl = "https://openapi.alipay.com/gateway.do";

export function createAlipayPaymentProvider({ env = process.env, fetchImpl = fetch } = {}) {
  const appId = String(env.ALIPAY_APP_ID || "").trim();
  const appPrivateKey = normalizePem(env.ALIPAY_APP_PRIVATE_KEY, "private");
  const alipayPublicKey = normalizePem(env.ALIPAY_PUBLIC_KEY, "public");
  const gatewayUrl = normalizeGatewayUrl(env.ALIPAY_GATEWAY_URL || defaultGatewayUrl);
  const appBaseUrl = String(env.APP_BASE_URL || "").trim();
  const overrideReturnUrl = String(env.ALIPAY_RETURN_URL || "").trim();
  const overrideNotifyUrl = String(env.ALIPAY_NOTIFY_URL || "").trim();
  const charset = "utf-8";
  const signType = "RSA2";
  const version = "1.0";

  function publicConfig(origin = "") {
    const baseUrl = resolvedBaseUrl(origin);
    if (!appId) {
      return {
        provider: "alipay",
        mode: "disabled",
        enabled: false,
        ready: false,
        currency: "cny",
        publicKeyConfigured: false,
        confirmationMode: "disabled",
        message: "付款暂未开放，先看套餐"
      };
    }
    if (!appPrivateKey) {
      return {
        provider: "alipay",
        mode: gatewayMode(gatewayUrl),
        enabled: true,
        ready: false,
        currency: "cny",
        publicKeyConfigured: Boolean(alipayPublicKey),
        confirmationMode: "disabled",
        message: "付款暂未开放，先看套餐"
      };
    }
    if (!baseUrl && !overrideReturnUrl) {
      return {
        provider: "alipay",
        mode: gatewayMode(gatewayUrl),
        enabled: true,
        ready: false,
        currency: "cny",
        publicKeyConfigured: Boolean(alipayPublicKey),
        confirmationMode: alipayPublicKey ? "notify+return" : "return-query",
        message: "付款暂未开放，稍后再试"
      };
    }
    return {
      provider: "alipay",
      mode: gatewayMode(gatewayUrl),
      enabled: true,
      ready: true,
      currency: "cny",
      publicKeyConfigured: Boolean(alipayPublicKey),
      confirmationMode: alipayPublicKey ? "notify+return" : "return-query",
      message: alipayPublicKey
        ? `支付宝网页支付已就绪（${gatewayMode(gatewayUrl) === "live" ? "正式" : "测试"}模式）`
        : `支付宝网页支付已就绪（${gatewayMode(gatewayUrl) === "live" ? "正式" : "测试"}模式，支付完成后将在回跳页查询确认到账）`
    };
  }

  async function createCheckoutSession({ order, clientKey, origin = "" }) {
    const config = publicConfig(origin);
    if (!config.ready) throw new PaymentProviderError(config.message, 503, config);

    const params = signRequestParams({
      app_id: appId,
      method: "alipay.trade.page.pay",
      format: "JSON",
      charset,
      sign_type: signType,
      timestamp: formatAlipayTimestamp(new Date()),
      version,
      return_url: resolvedReturnUrl(origin),
      biz_content: JSON.stringify(buildPagePayBizContent(order, clientKey))
    }, appPrivateKey);
    const notifyUrl = resolvedNotifyUrl(origin);
    if (notifyUrl) params.notify_url = notifyUrl;

    const checkoutUrl = buildGatewayUrl(gatewayUrl, params);
    return {
      sessionId: String(order?.id || ""),
      checkoutUrl,
      paymentStatus: "pending",
      currency: "cny"
    };
  }

  async function confirmPayment({ orderId = "", tradeNo = "" } = {}) {
    const trade = await queryTrade({ orderId, tradeNo });
    return {
      sessionId: String(trade.outTradeNo || orderId || ""),
      orderId: String(trade.outTradeNo || orderId || ""),
      clientKey: "",
      paymentStatus: trade.tradeStatus,
      sessionStatus: trade.tradeStatus,
      paymentIntentId: String(trade.tradeNo || tradeNo || ""),
      orderStatus: normalizeTradeOrderStatus(trade.tradeStatus),
      tradeNo: String(trade.tradeNo || tradeNo || "")
    };
  }

  async function queryTrade({ orderId = "", tradeNo = "" } = {}) {
    if (!appId || !appPrivateKey) {
      throw new PaymentProviderError("支付宝支付未配置完成", 503);
    }
    const cleanOrderId = String(orderId || "").trim();
    const cleanTradeNo = String(tradeNo || "").trim();
    if (!cleanOrderId && !cleanTradeNo) throw new PaymentProviderError("缺少订单号或支付宝交易号", 400);

    const bizContent = JSON.stringify({
      ...(cleanOrderId ? { out_trade_no: cleanOrderId } : {}),
      ...(cleanTradeNo ? { trade_no: cleanTradeNo } : {})
    });
    const params = signRequestParams({
      app_id: appId,
      method: "alipay.trade.query",
      format: "JSON",
      charset,
      sign_type: signType,
      timestamp: formatAlipayTimestamp(new Date()),
      version,
      biz_content: bizContent
    }, appPrivateKey);
    const response = await fetchImpl(gatewayUrl, {
      method: "POST",
      headers: { "Content-Type": `application/x-www-form-urlencoded;charset=${charset}` },
      body: toFormEncoded(params)
    });
    const text = await response.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new PaymentProviderError(`支付宝查询返回非 JSON：${text.slice(0, 200) || response.statusText}`, 502);
    }
    const payload = json?.alipay_trade_query_response;
    if (!payload || typeof payload !== "object") {
      throw new PaymentProviderError(`支付宝查询响应缺少主体：${text.slice(0, 200) || response.statusText}`, 502);
    }
    if (alipayPublicKey) verifyResponseSignature(json, "alipay_trade_query_response", alipayPublicKey);
    if (!response.ok) {
      throw new PaymentProviderError(payload.sub_msg || payload.msg || `支付宝查询失败：${response.status}`, 502, payload);
    }
    if (String(payload.code || "") !== "10000") {
      if (String(payload.sub_code || "") === "ACQ.TRADE_NOT_EXIST") {
        return {
          outTradeNo: cleanOrderId,
          tradeNo: cleanTradeNo,
          tradeStatus: "WAIT_BUYER_PAY",
          raw: payload
        };
      }
      throw new PaymentProviderError(payload.sub_msg || payload.msg || "支付宝查询失败", 502, payload);
    }
    return {
      outTradeNo: String(payload.out_trade_no || cleanOrderId || ""),
      tradeNo: String(payload.trade_no || cleanTradeNo || ""),
      tradeStatus: String(payload.trade_status || ""),
      totalAmount: String(payload.total_amount || ""),
      buyerLogonId: String(payload.buyer_logon_id || ""),
      raw: payload
    };
  }

  function verifyNotificationPayload(payload) {
    const params = normalizeRequestParams(payload);
    if (!params.out_trade_no) throw new PaymentProviderError("支付宝通知缺少 out_trade_no", 400);
    if (!params.trade_no) throw new PaymentProviderError("支付宝通知缺少 trade_no", 400);
    if (!alipayPublicKey) {
      throw new PaymentProviderError("缺少 ALIPAY_PUBLIC_KEY，暂时不能校验支付宝异步通知", 503);
    }
    if (!verifySignature(params, alipayPublicKey)) {
      throw new PaymentProviderError("支付宝异步通知验签失败", 400);
    }
    const passback = parsePassbackParams(params.passback_params);
    return {
      orderId: String(params.out_trade_no || ""),
      tradeNo: String(params.trade_no || ""),
      clientKey: String(passback.clientKey || ""),
      tradeStatus: String(params.trade_status || ""),
      orderStatus: normalizeTradeOrderStatus(params.trade_status),
      totalAmount: String(params.total_amount || ""),
      buyerLogonId: String(params.buyer_logon_id || ""),
      raw: params
    };
  }

  function buildReturnRedirectUrl(query, origin = "") {
    const baseUrl = new URL("/", resolvedBaseUrl(origin));
    baseUrl.searchParams.set("tab", "credits");
    if (query?.out_trade_no) {
      baseUrl.searchParams.set("payment", "success");
      baseUrl.searchParams.set("order", String(query.out_trade_no || ""));
      if (query?.trade_no) baseUrl.searchParams.set("trade_no", String(query.trade_no || ""));
      return baseUrl.toString();
    }
    baseUrl.searchParams.set("payment", "cancel");
    return baseUrl.toString();
  }

  function resolvedBaseUrl(origin = "") {
    const fallback = String(origin || "").trim().replace(/\/+$/, "");
    const preferred = appBaseUrl.replace(/\/+$/, "");
    return preferred || fallback;
  }

  function resolvedReturnUrl(origin = "") {
    if (overrideReturnUrl) return overrideReturnUrl;
    return new URL("/api/payments/alipay/return", resolvedBaseUrl(origin)).toString();
  }

  function resolvedNotifyUrl(origin = "") {
    if (overrideNotifyUrl) return overrideNotifyUrl;
    const baseUrl = resolvedBaseUrl(origin);
    if (!baseUrl) return "";
    return new URL("/api/payments/alipay/notify", baseUrl).toString();
  }

  return {
    publicConfig,
    createCheckoutSession,
    confirmPayment,
    queryTrade,
    verifyNotificationPayload,
    buildReturnRedirectUrl
  };
}

function buildPagePayBizContent(order, clientKey) {
  const totalCredits = Math.max(0, Number(order?.credits) || 0) + Math.max(0, Number(order?.bonus) || 0);
  return {
    out_trade_no: String(order?.id || ""),
    product_code: "FAST_INSTANT_TRADE_PAY",
    total_amount: formatAmount(order?.amountCny),
    subject: `${String(order?.packageName || order?.packageId || "积分充值")} · ${totalCredits} 积分`,
    body: `${Math.max(0, Number(order?.credits) || 0)} 基础积分${order?.bonus ? `，赠送 ${Math.max(0, Number(order?.bonus) || 0)} 积分` : ""}`,
    timeout_express: "90m",
    passback_params: encodeURIComponent(JSON.stringify({
      clientKey: String(clientKey || ""),
      packageId: String(order?.packageId || "")
    }))
  };
}

function normalizeRequestParams(value) {
  const params = {};
  if (!value || typeof value !== "object") return params;
  for (const [key, raw] of Object.entries(value)) {
    if (!key) continue;
    const current = Array.isArray(raw) ? raw[0] : raw;
    if (current === undefined || current === null) continue;
    params[key] = String(current);
  }
  return params;
}

function signRequestParams(params, privateKey) {
  const normalized = normalizeRequestParams(params);
  const sign = signContent(canonicalize(normalized), privateKey);
  return { ...normalized, sign };
}

function buildGatewayUrl(gatewayUrl, params) {
  const url = new URL(gatewayUrl || defaultGatewayUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function signContent(content, privateKey) {
  try {
    const signer = createSign("RSA-SHA256");
    signer.update(content, "utf8");
    signer.end();
    return signer.sign(privateKey, "base64");
  } catch (error) {
    throw new PaymentProviderError(`支付宝签名失败：${errorMessage(error)}`, 500);
  }
}

function verifySignature(params, publicKey) {
  const normalized = normalizeRequestParams(params);
  const sign = String(normalized.sign || "").trim();
  if (!sign) return false;
  delete normalized.sign;
  delete normalized.sign_type;
  return verifySignatureContent(canonicalize(normalized), sign, publicKey);
}

function verifyResponseSignature(json, responseKey, publicKey) {
  const sign = String(json?.sign || "").trim();
  const payload = json?.[responseKey];
  if (!sign || !payload || typeof payload !== "object") {
    throw new PaymentProviderError("支付宝响应缺少签名或主体", 502);
  }
  const content = JSON.stringify(payload);
  if (!verifySignatureContent(content, sign, publicKey)) {
    throw new PaymentProviderError("支付宝响应验签失败", 502);
  }
}

function verifySignatureContent(content, sign, publicKey) {
  try {
    const verifier = createVerify("RSA-SHA256");
    verifier.update(content, "utf8");
    verifier.end();
    return verifier.verify(publicKey, sign, "base64");
  } catch {
    return false;
  }
}

function canonicalize(params) {
  return Object.keys(params)
    .filter((key) => key && params[key] !== undefined && params[key] !== null && String(params[key]) !== "")
    .sort()
    .map((key) => `${key}=${String(params[key])}`)
    .join("&");
}

function toFormEncoded(params) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === "") continue;
    searchParams.set(key, String(value));
  }
  return searchParams.toString();
}

function normalizePem(value, type) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.includes("-----BEGIN")) return raw;
  const base64 = raw.replace(/\s+/g, "");
  if (!base64) return "";
  const body = base64.match(/.{1,64}/g)?.join("\n") || base64;
  if (type === "private") {
    return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`;
  }
  return `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----`;
}

function parsePassbackParams(value) {
  const raw = String(value || "").trim();
  if (!raw) return {};
  const candidates = [raw];
  try {
    candidates.push(decodeURIComponent(raw));
  } catch {}
  for (const item of candidates) {
    try {
      const parsed = JSON.parse(item);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {}
  }
  return {};
}

function normalizeGatewayUrl(value) {
  const raw = String(value || defaultGatewayUrl).trim();
  try {
    const url = new URL(raw);
    return url.toString();
  } catch {
    return defaultGatewayUrl;
  }
}

function gatewayMode(url) {
  return String(url || "").includes("sandbox") ? "test" : "live";
}

function formatAmount(value) {
  const amount = Math.max(0, Number(value) || 0);
  return amount.toFixed(2);
}

function formatAlipayTimestamp(date) {
  const source = date instanceof Date ? date : new Date();
  const year = source.getFullYear();
  const month = String(source.getMonth() + 1).padStart(2, "0");
  const day = String(source.getDate()).padStart(2, "0");
  const hour = String(source.getHours()).padStart(2, "0");
  const minute = String(source.getMinutes()).padStart(2, "0");
  const second = String(source.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function normalizeTradeOrderStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  if (status === "TRADE_SUCCESS" || status === "TRADE_FINISHED") return "paid";
  if (status === "TRADE_CLOSED") return "cancelled";
  return "pending";
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
