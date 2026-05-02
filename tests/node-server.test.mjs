import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const serverEntry = new URL("../server/index.mjs", import.meta.url);
const serverEntryPath = fileURLToPath(serverEntry);
const generationErrorLog = new URL("../data/logs/generation-errors.ndjson", import.meta.url);

test("Node server serves the playground without a fixed port", { skip: !existsSync(serverEntryPath) }, async () => {
  const port = await getOpenPort();
  const authDir = mkdtempSync(join(tmpdir(), "inklens-auth-"));
  let successUpstream = null;
  let accountClient = "";
  const child = spawn(
    process.execPath,
    [serverEntryPath, "--host", "127.0.0.1", "--port", String(port)],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        STRIPE_FAKE_MODE: "1",
        APP_BASE_URL: `http://127.0.0.1:${port}`,
        INKLENS_AUTH_TEST_MODE: "1",
        INKLENS_AUTH_DIR: authDir
      }
    }
  );
  const output = collectOutput(child);
  const ipA = `2001:db8::${port.toString(16)}`;
  const ipB = `2001:db8::${(port + 1).toString(16)}`;
  const clientA = historyClientKey(ipA);
  const clientB = historyClientKey(ipB);
  const explicitClient = historyClientKey(`wallet-client-${port}`);
  const historyTaskId = `ip-history-${port}`;
  cleanupHistoryClient(clientA);
  cleanupHistoryClient(clientB);
  cleanupHistoryClient(explicitClient);
  cleanupCreditClient(clientA);
  cleanupCreditClient(clientB);
  cleanupCreditClient(explicitClient);
  cleanupOrderClient(clientA);
  cleanupOrderClient(clientB);
  cleanupOrderClient(explicitClient);

  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForHttp(baseUrl, child, output);
    const html = await fetchText(baseUrl);
    assert.match(html, /图片生成工作台|id="templatesPanel"/);
    assert.match(html, /data-tab="studio"/);
    assert.match(html, /data-tab="create"/);
    assert.match(html, /data-tab="history"/);
    assert.match(html, /data-tab="credits"/);
    assert.match(html, /data-tab="register"/);
    assert.doesNotMatch(html, /data-tab="templates"/);
    assert.doesNotMatch(html, /data-tab="generate"/);
    assert.match(html, /id="studioPanel"/);
    assert.match(html, /img\.inklens\.art/);
    assert.match(html, /Inklens AI 影像工作台/);
    assert.match(html, /拍摄定制/);
    assert.match(html, /图片创作/);
    assert.match(html, /我的作品/);
    assert.match(html, /账户权益/);
    assert.match(html, /注册开通/);
    assert.match(html, /<nav class="primary-nav"[\s\S]*拍摄定制[\s\S]*图片创作[\s\S]*我的作品[\s\S]*注册开通[\s\S]*账户权益[\s\S]*<\/nav>/);
    assert.match(html, /账户权益/);
    assert.match(html, /id="paymentStatusBadge"/);
    assert.match(html, /id="creditOrderList"/);
    assert.match(html, /id="secondaryNav"/);
    assert.match(html, /id="openTemplateLibraryBtn"/);
    assert.match(html, /id="creatorSettingsPanel"/);
    assert.match(html, /id="registerPanel"/);
    assert.match(html, /id="registerNowBtn"/);
    assert.match(html, /id="registerSetupBtn"/);
    assert.match(html, /<h2>我的作品<\/h2>/);
    assert.match(html, /商业服务分区/);
    assert.match(html, /id="studioCurrentStep"/);
    const appScript = await fetchText(`${baseUrl}/app.js`);
    assert.match(appScript, /婚纱照/);
    assert.match(appScript, /studioNextAction/);
    assert.match(appScript, /secondaryMenus/);
    assert.match(appScript, /creatorSettings/);
    assert.match(appScript, /label: "模板库"/);
    assert.match(appScript, /label: "智能生图"/);
    assert.match(appScript, /label: "连接设置"/);
    assert.match(appScript, /label: "场景套餐"/);
    assert.match(appScript, /label: "成片交付"/);
    assert.match(appScript, /label: "全部作品"/);
    assert.match(appScript, /label: "已删除"/);
    assert.match(appScript, /label: "登录"/);
    assert.match(appScript, /label: "权益总览"/);
    assert.match(appScript, /X-Client-Key/);
    assert.match(appScript, /\/api\/payments\/checkout-session/);
    assert.match(appScript, /20260502-personal-studio/);

    const health = await fetchJson(`${baseUrl}/api/health`);
    assert.equal(health.ok, true);

    const initialCredits = await fetchJson(`${baseUrl}/api/credits`, { headers: { "X-Forwarded-For": ipA } });
    assert.equal(initialCredits.ok, true);
    assert.equal(initialCredits.clientKey, clientA);
    assert.equal(initialCredits.balance, 0);
    assert.ok(initialCredits.packages.some((item) => item.id === "starter"));

    const explicitCredits = await fetchJson(`${baseUrl}/api/credits`, {
      headers: { "X-Forwarded-For": ipA, "X-Client-Key": explicitClient }
    });
    assert.equal(explicitCredits.clientKey, explicitClient);
    assert.equal(explicitCredits.balance, 0);

    const paymentConfig = await fetchJson(`${baseUrl}/api/payments/config`);
    assert.equal(paymentConfig.ok, true);
    assert.equal(paymentConfig.payment.ready, true);
    assert.equal(paymentConfig.payment.mode, "fake");

    const pendingOrder = await fetchJson(`${baseUrl}/api/payments/checkout-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Client-Key": explicitClient },
      body: JSON.stringify({ packageId: "starter" })
    });
    assert.equal(pendingOrder.ok, true);
    assert.equal(pendingOrder.clientKey, explicitClient);
    assert.equal(pendingOrder.order.status, "pending");
    assert.equal(pendingOrder.order.packageId, "starter");
    assert.match(pendingOrder.checkoutUrl, /payment=success/);
    assert.match(pendingOrder.sessionId, /^cs_fake_/);

    const explicitOrders = await fetchJson(`${baseUrl}/api/credits/orders`, { headers: { "X-Client-Key": explicitClient } });
    assert.equal(explicitOrders.clientKey, explicitClient);
    assert.equal(explicitOrders.orders[0].id, pendingOrder.order.id);

    const webhookResponse = await fetch(`${baseUrl}/api/payments/stripe/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Stripe-Signature": "fake" },
      body: JSON.stringify({
        type: "checkout.session.completed",
        data: {
          object: {
            id: pendingOrder.sessionId,
            client_reference_id: pendingOrder.order.id,
            payment_status: "paid",
            payment_intent: "pi_fake_checkout_paid",
            metadata: {
              clientKey: explicitClient,
              orderId: pendingOrder.order.id,
              packageId: "starter"
            }
          }
        }
      })
    });
    assert.equal(webhookResponse.ok, true, `webhook returned ${webhookResponse.status}`);
    const webhookJson = await webhookResponse.json();
    assert.equal(webhookJson.ok, true);
    assert.equal(webhookJson.received, true);

    const explicitCreditsAfterWebhook = await fetchJson(`${baseUrl}/api/credits`, { headers: { "X-Client-Key": explicitClient } });
    assert.equal(explicitCreditsAfterWebhook.balance, 330);

    const paidOrders = await fetchJson(`${baseUrl}/api/credits/orders`, { headers: { "X-Client-Key": explicitClient } });
    assert.equal(paidOrders.orders[0].status, "paid");
    assert.match(paidOrders.orders[0].ledgerId, /^recharge-/);

    const accountHistoryTaskId = `account-history-${port}`;
    const explicitHistorySync = await fetchJson(`${baseUrl}/api/history/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Client-Key": explicitClient },
      body: JSON.stringify({
        history: [{
          id: accountHistoryTaskId,
          prompt: "register migration check",
          params: { size: "auto", quality: "auto", outputFormat: "png", count: 1 },
          references: [],
          status: "succeeded",
          images: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="],
          createdAt: Date.now(),
          finishedAt: Date.now()
        }]
      })
    });
    assert.equal(explicitHistorySync.ok, true);
    assert.equal(explicitHistorySync.clientKey, explicitClient);

    const verification = await fetchJson(`${baseUrl}/api/auth/verification-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "email", account: `customer-${port}@example.com` })
    });
    assert.equal(verification.ok, true);
    assert.equal(verification.delivery, "test");
    assert.match(String(verification.code || ""), /^\d{6}$/);

    const registered = await fetchJson(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "email",
        account: `customer-${port}@example.com`,
        username: "客户测试",
        code: verification.code,
        password: "secret123",
        clientKey: explicitClient
      })
    });
    assert.equal(registered.ok, true);
    accountClient = registered.clientKey;
    assert.equal(accountClient, accountClientKey(registered.user.id));

    const accountCredits = await fetchJson(`${baseUrl}/api/credits`, { headers: { "X-Client-Key": accountClient } });
    assert.equal(accountCredits.clientKey, accountClient);
    assert.equal(accountCredits.balance, 330);

    const migratedOrders = await fetchJson(`${baseUrl}/api/credits/orders`, { headers: { "X-Client-Key": accountClient } });
    assert.equal(migratedOrders.orders[0].status, "paid");
    assert.equal(migratedOrders.orders[0].id, pendingOrder.order.id);

    const migratedHistory = await fetchJson(`${baseUrl}/api/history`, { headers: { "X-Client-Key": accountClient } });
    assert.equal(migratedHistory.clientKey, accountClient);
    assert.equal(migratedHistory.history.some((item) => item.id === accountHistoryTaskId), true);
    const migratedTask = migratedHistory.history.find((item) => item.id === accountHistoryTaskId);
    assert.ok(migratedTask.images[0].startsWith(`/generated-history/${explicitClient}/`), migratedTask.images[0]);

    const oldExplicitCredits = await fetchJson(`${baseUrl}/api/credits`, { headers: { "X-Client-Key": explicitClient } });
    assert.equal(oldExplicitCredits.balance, 0);
    const oldExplicitOrders = await fetchJson(`${baseUrl}/api/credits/orders`, { headers: { "X-Client-Key": explicitClient } });
    assert.equal(oldExplicitOrders.orders.length, 0);
    const oldExplicitHistory = await fetchJson(`${baseUrl}/api/history`, { headers: { "X-Client-Key": explicitClient } });
    assert.equal(oldExplicitHistory.history.length, 0);

    const loggedIn = await fetchJson(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "email",
        account: `customer-${port}@example.com`,
        password: "secret123",
        clientKey: clientB
      })
    });
    assert.equal(loggedIn.ok, true);
    assert.equal(loggedIn.clientKey, accountClient);

    const recharge = await fetchJson(`${baseUrl}/api/credits/recharge`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ipA },
      body: JSON.stringify({ packageId: "starter" })
    });
    assert.equal(recharge.ok, true);
    assert.equal(recharge.clientKey, clientA);
    assert.equal(recharge.entry.credits, 330);
    assert.equal(recharge.balance, 330);

    const creditsA = await fetchJson(`${baseUrl}/api/credits`, { headers: { "X-Forwarded-For": ipA } });
    assert.equal(creditsA.balance, 330);
    assert.equal(creditsA.ledger[0].packageId, "starter");

    const baseEstimate = await fetchJson(`${baseUrl}/api/credits/estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ipA },
      body: JSON.stringify({
        params: { size: "auto", quality: "auto", outputFormat: "png", count: 1 },
        references: []
      })
    });
    assert.equal(baseEstimate.unitCost, 20);
    assert.equal(baseEstimate.estimatedCost, 20);
    assert.equal(baseEstimate.enough, true);

    const high4kEditEstimate = await fetchJson(`${baseUrl}/api/credits/estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ipA },
      body: JSON.stringify({
        params: { size: "3840x2160", quality: "high", outputFormat: "png", count: 2 },
        references: [{ id: "a", name: "a.png", dataUrl: "data:image/png;base64,aa" }, { id: "b", name: "b.png", dataUrl: "data:image/png;base64,bb" }]
      })
    });
    assert.equal(high4kEditEstimate.unitCost, 110);
    assert.equal(high4kEditEstimate.estimatedCost, 220);
    assert.equal(high4kEditEstimate.enough, true);

    successUpstream = createHttpServer((request, response) => {
      if (request.url === "/v1/images/generations") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({
          data: [{ b64_json: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=" }]
        }));
        return;
      }
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "not found" } }));
    });
    successUpstream.listen(0, "127.0.0.1");
    await once(successUpstream, "listening");
    const successAddress = successUpstream.address();
    if (!successAddress || typeof successAddress === "string") throw new Error("Could not start fake success upstream");
    const chargedGenerate = await fetchJson(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ipA },
      body: JSON.stringify({
        taskId: `credit-success-${port}`,
        prompt: "credit success charge",
        settings: {
          apiUrl: `http://127.0.0.1:${successAddress.port}/v1`,
          apiKey: "test-key",
          apiMode: "images",
          modelId: "gpt-image-2",
          timeoutSeconds: 5
        },
        params: { size: "auto", quality: "auto", outputFormat: "png", count: 1 },
        references: []
      })
    });
    assert.equal(chargedGenerate.ok, true);
    assert.equal(chargedGenerate.creditCost, 20);
    assert.equal(chargedGenerate.creditBalance, 310);
    assert.match(chargedGenerate.creditLedgerId, /^spend-/);
    const chargedCredits = await fetchJson(`${baseUrl}/api/credits`, { headers: { "X-Forwarded-For": ipA } });
    assert.equal(chargedCredits.balance, 310);
    assert.equal(chargedCredits.ledger[0].type, "spend");
    assert.equal(chargedCredits.ledger[0].credits, -20);

    const creditsB = await fetchJson(`${baseUrl}/api/credits`, { headers: { "X-Forwarded-For": ipB } });
    assert.equal(creditsB.clientKey, clientB);
    assert.equal(creditsB.balance, 0, "client B must not see client A credits");

    const poorGenerate = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ipB },
      body: JSON.stringify({
        taskId: `poor-${port}`,
        prompt: "balance check",
        settings: { apiUrl: "http://127.0.0.1:1/v1", apiKey: "test", apiMode: "images", modelId: "gpt-image-2", timeoutSeconds: 1 },
        params: { size: "auto", quality: "auto", outputFormat: "png", count: 1 },
        references: []
      })
    });
    assert.equal(poorGenerate.status, 402);
    const poorGenerateJson = await poorGenerate.json();
    assert.match(poorGenerateJson.message, /积分不足/);

    const templates = await fetchJson(`${baseUrl}/api/templates`);
    assert.equal(templates.ok, true);
    assert.ok(templates.total > 100);
    assert.ok(templates.templates[0]?.promptPreview);
    assert.equal("prompt" in templates.templates[0], false);
    assert.ok(templates.categories.includes("婚纱照"), "catalog categories should include the wedding photo bucket");

    const templateDetail = await fetchJson(`${baseUrl}/api/templates/${encodeURIComponent(templates.templates[0].id)}`);
    assert.equal(templateDetail.ok, true);
    assert.equal(templateDetail.template.id, templates.templates[0].id);
    assert.ok(templateDetail.template.prompt.length >= templates.templates[0].promptPreview.length);

    const portraitTemplate = await fetchJson(`${baseUrl}/api/templates/portrait-axis-female-3view-v01`);
    assert.equal(portraitTemplate.ok, true);
    assert.equal(portraitTemplate.template.category, "人像基准");
    assert.match(portraitTemplate.template.prompt, /三视图/);

    const bestFriendsTemplate = await fetchJson(`${baseUrl}/api/templates/portrait-best-friends-studio-v01`);
    assert.equal(bestFriendsTemplate.ok, true);
    assert.equal(bestFriendsTemplate.template.category, "闺蜜照");
    assert.match(bestFriendsTemplate.template.prompt, /亲密朋友/);

    const weddingTemplate = await fetchJson(`${baseUrl}/api/templates/portrait-wedding-couture-cover-v01`);
    assert.equal(weddingTemplate.ok, true);
    assert.equal(weddingTemplate.template.category, "婚纱照");
    assert.match(weddingTemplate.template.prompt, /婚纱/);

    const fullCatalog = await fetchJson(`${baseUrl}/api/templates?full=1`);
    assert.equal(fullCatalog.ok, true);
    assert.equal(fullCatalog.total, templates.total);
    assert.ok(fullCatalog.templates[0]?.prompt);

    const sync = await fetchJson(`${baseUrl}/api/history/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ipA },
      body: JSON.stringify({
        history: [{
          id: historyTaskId,
          prompt: "IP isolated history check",
          params: { size: "auto", quality: "auto", outputFormat: "png", count: 1 },
          references: [],
          status: "succeeded",
          images: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="],
          createdAt: Date.now(),
          finishedAt: Date.now()
        }]
      })
    });
    assert.equal(sync.ok, true);
    assert.equal(sync.clientKey, clientA);

    const historyA = await fetchJson(`${baseUrl}/api/history`, { headers: { "X-Forwarded-For": ipA } });
    assert.equal(historyA.clientKey, clientA);
    const storedTask = historyA.history.find((item) => item.id === historyTaskId);
    assert.ok(storedTask, "client A should see its synced history task");
    assert.ok(storedTask.images[0].startsWith(`/generated-history/${clientA}/`), storedTask.images[0]);

    const historyB = await fetchJson(`${baseUrl}/api/history`, { headers: { "X-Forwarded-For": ipB } });
    assert.equal(historyB.clientKey, clientB);
    assert.equal(historyB.history.some((item) => item.id === historyTaskId), false, "client B must not see client A history");

    const missingApi = await fetch(`${baseUrl}/api/not-found`);
    assert.equal(missingApi.status, 404);
    assert.match(missingApi.headers.get("content-type") || "", /application\/json/);

    const readme = await fetchText(`${baseUrl}/README_zh.md`);
    assert.match(readme, /提示词|Prompt|模板/);
  } finally {
    if (successUpstream) successUpstream.close();
    child.kill("SIGTERM");
    await Promise.race([once(child, "exit"), delay(1500)]);
    if (child.exitCode === null) child.kill("SIGKILL");
    cleanupHistoryClient(clientA);
    cleanupHistoryClient(clientB);
    cleanupHistoryClient(explicitClient);
    if (accountClient) cleanupHistoryClient(accountClient);
    cleanupCreditClient(clientA);
    cleanupCreditClient(clientB);
    cleanupCreditClient(explicitClient);
    if (accountClient) cleanupCreditClient(accountClient);
    cleanupOrderClient(clientA);
    cleanupOrderClient(clientB);
    cleanupOrderClient(explicitClient);
    if (accountClient) cleanupOrderClient(accountClient);
    rmSync(authDir, { recursive: true, force: true });
  }

  assert.notEqual(child.exitCode, 1, output());
});

test("Node server logs upstream HTML generation failures", { skip: !existsSync(serverEntryPath) }, async () => {
  const port = await getOpenPort();
  const htmlTaskId = `html-upstream-${port}`;
  const htmlIp = `203.0.113.${port % 200}`;
  const htmlClient = historyClientKey(htmlIp);
  cleanupHistoryClient(htmlClient);
  cleanupCreditClient(htmlClient);
  cleanupOrderClient(htmlClient);
  const upstream = createHttpServer((request, response) => {
    if (request.url === "/v1/images/generations") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("<!doctype html><html><body><h1>proxy login</h1></body></html>");
      return;
    }
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { message: "not found" } }));
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const upstreamAddress = upstream.address();
  if (!upstreamAddress || typeof upstreamAddress === "string") throw new Error("Could not start fake upstream");
  const child = spawn(
    process.execPath,
    [serverEntryPath, "--host", "127.0.0.1", "--port", String(port)],
    { stdio: ["ignore", "pipe", "pipe"] }
  );
  const output = collectOutput(child);

  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForHttp(baseUrl, child, output);
    const recharge = await fetchJson(`${baseUrl}/api/credits/recharge`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": htmlIp },
      body: JSON.stringify({ packageId: "trial" })
    });
    assert.equal(recharge.ok, true);
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": htmlIp },
      body: JSON.stringify({
        taskId: htmlTaskId,
        prompt: "html upstream failure",
        settings: {
          apiUrl: `http://127.0.0.1:${upstreamAddress.port}/v1`,
          apiKey: "test-key-should-not-be-logged",
          apiMode: "images",
          modelId: "gpt-image-2",
          timeoutSeconds: 5
        },
        params: { size: "auto", quality: "auto", outputFormat: "png", count: 1 },
        references: []
      })
    });
    assert.equal(response.status, 502);
    const data = await response.json();
    assert.equal(data.ok, false);
    assert.match(data.message, /网页 HTML/);
    assert.match(data.requestId, /^gen-/);

    const logText = readFileSync(generationErrorLog, "utf8");
    const logLine = logText.split("\n").filter((line) => line.includes(htmlTaskId)).at(-1);
    assert.ok(logLine, "generation error log should contain the HTML task id");
    const log = JSON.parse(logLine);
    assert.equal(log.taskId, htmlTaskId);
    assert.equal(log.error.upstreamContentType.includes("text/html"), true);
    assert.match(log.error.upstreamBodySnippet, /proxy login/);
    assert.equal(JSON.stringify(log).includes("test-key-should-not-be-logged"), false);
    const creditsAfterFailure = await fetchJson(`${baseUrl}/api/credits`, { headers: { "X-Forwarded-For": htmlIp } });
    assert.equal(creditsAfterFailure.balance, 100, "failed generation must not spend credits");
    assert.equal(creditsAfterFailure.ledger.some((item) => item.type === "spend"), false);
  } finally {
    upstream.close();
    child.kill("SIGTERM");
    await Promise.race([once(child, "exit"), delay(1500)]);
    if (child.exitCode === null) child.kill("SIGKILL");
    cleanupHistoryClient(htmlClient);
    cleanupCreditClient(htmlClient);
    cleanupOrderClient(htmlClient);
  }

  assert.notEqual(child.exitCode, 1, output());
});

test("Node server only exposes onscreen auth codes on local hosts", { skip: !existsSync(serverEntryPath) }, async () => {
  const port = await getOpenPort();
  const authDir = mkdtempSync(join(tmpdir(), "inklens-auth-local-"));
  const child = spawn(
    process.execPath,
    [serverEntryPath, "--host", "127.0.0.1", "--port", String(port)],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        STRIPE_FAKE_MODE: "1",
        APP_BASE_URL: `http://127.0.0.1:${port}`,
        INKLENS_AUTH_DIR: authDir,
        INKLENS_SMTP_HOST: "",
        SMTP_HOST: "",
        IDENTITY_WORKFLOW_SMTP_HOST: ""
      }
    }
  );
  const output = collectOutput(child);

  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForHttp(baseUrl, child, output);

    const localVerification = await fetchJson(`${baseUrl}/api/auth/verification-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "email", account: `local-${port}@example.com` })
    });
    assert.equal(localVerification.ok, true);
    assert.equal(localVerification.delivery, "onscreen");
    assert.match(String(localVerification.code || ""), /^\d{6}$/);
    assert.match(localVerification.message, /本机模式/);

    const publicVerification = await fetch(`${baseUrl}/api/auth/verification-code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-Host": "img.inklens.art",
        "X-Forwarded-For": "198.51.100.23"
      },
      body: JSON.stringify({ type: "email", account: `public-${port}@example.com` })
    });
    assert.equal(publicVerification.status, 400);
    const publicJson = await publicVerification.json();
    assert.equal(publicJson.ok, false);
    assert.match(publicJson.message, /INKLENS_SMTP_HOST/);
  } finally {
    child.kill("SIGTERM");
    await Promise.race([once(child, "exit"), delay(1500)]);
    if (child.exitCode === null) child.kill("SIGKILL");
    rmSync(authDir, { recursive: true, force: true });
  }

  assert.notEqual(child.exitCode, 1, output());
});

function collectOutput(child) {
  let text = "";
  child.stdout.on("data", (chunk) => {
    text += chunk;
  });
  child.stderr.on("data", (chunk) => {
    text += chunk;
  });
  return () => text.trim();
}

async function getOpenPort() {
  const server = createNetServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  server.close();
  await once(server, "close");
  if (!address || typeof address === "string") throw new Error("Could not allocate a local port");
  return address.port;
}

async function waitForHttp(url, child, output) {
  const started = Date.now();
  while (Date.now() - started < 5000) {
    if (child.exitCode !== null) throw new Error(`Server exited before responding:\n${output()}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await delay(120);
    }
  }
  throw new Error(`Server did not respond at ${url}`);
}

async function fetchText(url) {
  const response = await fetch(url);
  assert.equal(response.ok, true, `${url} returned ${response.status}`);
  return await response.text();
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  assert.equal(response.ok, true, `${url} returned ${response.status}`);
  return await response.json();
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function historyClientKey(value) {
  const clean = String(value || "local")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return clean || "local";
}

function accountClientKey(userId) {
  return historyClientKey(`account-${userId}`);
}

function cleanupHistoryClient(clientKey) {
  rmSync(new URL(`../data/history/${clientKey}.json`, import.meta.url), { force: true });
  rmSync(new URL(`../data/generated-history/${clientKey}`, import.meta.url), { recursive: true, force: true });
}

function cleanupCreditClient(clientKey) {
  rmSync(new URL(`../data/credits/${clientKey}.json`, import.meta.url), { force: true });
}

function cleanupOrderClient(clientKey) {
  rmSync(new URL(`../data/credit-orders/${clientKey}.json`, import.meta.url), { force: true });
}
