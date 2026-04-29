import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const serverEntry = new URL("../server/index.mjs", import.meta.url);
const serverEntryPath = fileURLToPath(serverEntry);

test("Node server serves the playground without a fixed port", { skip: !existsSync(serverEntryPath) }, async () => {
  const port = await getOpenPort();
  const child = spawn(
    process.execPath,
    [serverEntryPath, "--host", "127.0.0.1", "--port", String(port)],
    { stdio: ["ignore", "pipe", "pipe"] }
  );
  const output = collectOutput(child);

  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForHttp(baseUrl, child, output);
    const html = await fetchText(baseUrl);
    assert.match(html, /图片生成工作台|id="templatesPanel"/);

    const health = await fetchJson(`${baseUrl}/api/health`);
    assert.equal(health.ok, true);

    const templates = await fetchJson(`${baseUrl}/api/templates`);
    assert.equal(templates.ok, true);
    assert.ok(templates.total > 100);
    assert.ok(templates.templates[0]?.promptPreview);
    assert.equal("prompt" in templates.templates[0], false);

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

    const fullCatalog = await fetchJson(`${baseUrl}/api/templates?full=1`);
    assert.equal(fullCatalog.ok, true);
    assert.equal(fullCatalog.total, templates.total);
    assert.ok(fullCatalog.templates[0]?.prompt);

    const missingApi = await fetch(`${baseUrl}/api/not-found`);
    assert.equal(missingApi.status, 404);
    assert.match(missingApi.headers.get("content-type") || "", /application\/json/);

    const readme = await fetchText(`${baseUrl}/README_zh.md`);
    assert.match(readme, /提示词|Prompt|模板/);
  } finally {
    child.kill("SIGTERM");
    await Promise.race([once(child, "exit"), delay(1500)]);
    if (child.exitCode === null) child.kill("SIGKILL");
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
  const server = createServer();
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

async function fetchJson(url) {
  const response = await fetch(url);
  assert.equal(response.ok, true, `${url} returned ${response.status}`);
  return await response.json();
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
