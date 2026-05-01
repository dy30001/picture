import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const serverEntry = new URL("../identity-workflow/server.mjs", import.meta.url);
const serverEntryPath = fileURLToPath(serverEntry);

test("identity workflow runs as a separate local program", { skip: !existsSync(serverEntryPath) }, async () => {
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
    const appJs = await fetchText(`${baseUrl}/app.js`);
    assert.match(html, /多场景模板样片台/);
    assert.match(html, /id="sceneRail"/);
    assert.match(appJs, /sceneSampleLabel/);
    assert.match(html, /id="wardrobeGrid"/);
    assert.match(html, /按场景选衣服/);
    assert.match(html, /id="generateSceneBtn"/);
    assert.match(html, /本场景 9 张/);
    assert.match(html, /全场景 10 线程/);
    assert.match(appJs, /闺蜜照/);
    assert.match(appJs, /闺蜜婚纱/);
    assert.match(appJs, /旅游照/);
    assert.match(appJs, /地标打卡照/);
    assert.match(appJs, /儿童10岁照/);
    assert.match(appJs, /wardrobeLibrary/);
    assert.match(appJs, /buildWardrobeLibrary/);
    assert.match(appJs, /accelerateGeneration/);
    assert.match(html, /data-tab="recognition"/);
    assert.match(html, /data-tab="delivery"/);
    assert.match(html, /模板样片/);
    assert.match(html, /交付成片/);
    assert.match(html, /成片会显示在这里，不显示模板样片。/);
    assert.match(html, /id="imageViewer"/);
    assert.match(html, /id="thumbGrid"/);
    assert.match(html, /id="lightbox"/);
    assert.match(html, /id="viewerZoomBtn"/);
    assert.match(html, /id="lightboxZoomLabel"/);
    assert.match(html, /写真场景/);
    assert.match(html, /id="heroImageMain"/);
    assert.doesNotMatch(html, /source of truth|face-lock|自动检测待接入|IDENTITY CUT/);
    assert.doesNotMatch(html, /模板库/);

    const health = await fetchJson(`${baseUrl}/api/health`);
    assert.equal(health.ok, true);
    assert.equal(health.service, "identity-workflow");

    const status = await fetchJson(`${baseUrl}/api/workflow/status`);
    assert.equal(status.ok, true);
    assert.equal(status.workflow.identityBaseline.status, "accepted");
    assert.equal(status.workflow.identityBaseline.sourcePolicy, "以当前场景素材为准。");
    assert.equal(status.workflow.activeGeneration, null);
    assert.ok(status.workflow.batches.length >= 9);
    assert.equal(typeof status.workflow.totals.final4k, "number");
    assert.equal(typeof status.workflow.totals.chengpin, "number");
    assert.ok(status.workflow.batches[0].images.length > 0);
    assert.match(status.workflow.batches[0].images[0].url, /^\/final_4k\/|^\/chengpin\//);

    const jobs = await fetchJson(`${baseUrl}/api/generation/jobs`);
    assert.equal(jobs.ok, true);
    assert.deepEqual(jobs.jobs, []);
  } finally {
    child.kill("SIGTERM");
    await Promise.race([once(child, "exit"), delay(1500)]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }

  assert.notEqual(child.exitCode, 1, output());
});

function collectOutput(child: ReturnType<typeof spawn>): () => string {
  let text = "";
  child.stdout?.on("data", (chunk) => {
    text += chunk;
  });
  child.stderr?.on("data", (chunk) => {
    text += chunk;
  });
  return () => text.trim();
}

async function getOpenPort(): Promise<number> {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  server.close();
  await once(server, "close");
  if (!address || typeof address === "string") throw new Error("Could not allocate a local port");
  return address.port;
}

async function waitForHttp(url: string, child: ReturnType<typeof spawn>, output: () => string): Promise<void> {
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

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  assert.equal(response.ok, true, `${url} returned ${response.status}`);
  return await response.text();
}

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url);
  assert.equal(response.ok, true, `${url} returned ${response.status}`);
  return await response.json();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
