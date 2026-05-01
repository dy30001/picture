import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const serverEntry = new URL("../server/index.mjs", import.meta.url);
const serverEntryPath = fileURLToPath(serverEntry);
const generationErrorLog = new URL("../data/logs/generation-errors.ndjson", import.meta.url);

test("Node server serves the playground without a fixed port", { skip: !existsSync(serverEntryPath) }, async () => {
  const port = await getOpenPort();
  const child = spawn(
    process.execPath,
    [serverEntryPath, "--host", "127.0.0.1", "--port", String(port)],
    { stdio: ["ignore", "pipe", "pipe"] }
  );
  const output = collectOutput(child);
  const ipA = `2001:db8::${port.toString(16)}`;
  const ipB = `2001:db8::${(port + 1).toString(16)}`;
  const clientA = historyClientKey(ipA);
  const clientB = historyClientKey(ipB);
  const historyTaskId = `ip-history-${port}`;
  cleanupHistoryClient(clientA);
  cleanupHistoryClient(clientB);
  cleanupCreditClient(clientA);
  cleanupCreditClient(clientB);

  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForHttp(baseUrl, child, output);
    const html = await fetchText(baseUrl);
    assert.match(html, /图片生成工作台|id="templatesPanel"/);
    assert.match(html, /data-tab="studio"/);
    assert.match(html, /id="studioPanel"/);
    assert.match(html, /婚纱照/);

    const health = await fetchJson(`${baseUrl}/api/health`);
    assert.equal(health.ok, true);

    const initialCredits = await fetchJson(`${baseUrl}/api/credits`, { headers: { "X-Forwarded-For": ipA } });
    assert.equal(initialCredits.ok, true);
    assert.equal(initialCredits.clientKey, clientA);
    assert.equal(initialCredits.balance, 0);
    assert.ok(initialCredits.packages.some((item) => item.id === "starter"));

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

    const creditsB = await fetchJson(`${baseUrl}/api/credits`, { headers: { "X-Forwarded-For": ipB } });
    assert.equal(creditsB.clientKey, clientB);
    assert.equal(creditsB.balance, 0, "client B must not see client A credits");

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
    child.kill("SIGTERM");
    await Promise.race([once(child, "exit"), delay(1500)]);
    if (child.exitCode === null) child.kill("SIGKILL");
    cleanupHistoryClient(clientA);
    cleanupHistoryClient(clientB);
    cleanupCreditClient(clientA);
    cleanupCreditClient(clientB);
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
  } finally {
    upstream.close();
    child.kill("SIGTERM");
    await Promise.race([once(child, "exit"), delay(1500)]);
    if (child.exitCode === null) child.kill("SIGKILL");
    cleanupHistoryClient(htmlClient);
    cleanupCreditClient(htmlClient);
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

function cleanupHistoryClient(clientKey) {
  rmSync(new URL(`../data/history/${clientKey}.json`, import.meta.url), { force: true });
  rmSync(new URL(`../data/generated-history/${clientKey}`, import.meta.url), { recursive: true, force: true });
}

function cleanupCreditClient(clientKey) {
  rmSync(new URL(`../data/credits/${clientKey}.json`, import.meta.url), { force: true });
}
