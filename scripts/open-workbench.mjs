import { spawn, execFile } from "node:child_process";
import { openSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const host = "127.0.0.1";
const port = 4174;
const baseUrl = `http://${host}:${port}`;

if (!await appReady()) {
  await stopExistingListener();
  await startServer();
  await waitForApp();
}

await openWorkbench();
process.stdout.write("图片生成工作台已打开。\n");

async function appReady() {
  return await jsonOk("/api/health") && await jsonOk("/api/templates");
}

async function jsonOk(path) {
  try {
    const response = await fetch(`${baseUrl}${path}`, { headers: { Accept: "application/json" } });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("application/json")) return false;
    const json = await response.json();
    return json.ok !== false;
  } catch {
    return false;
  }
}

async function stopExistingListener() {
  if (process.platform !== "darwin") return;
  try {
    const { stdout } = await execFileAsync("lsof", ["-tiTCP:4174", "-sTCP:LISTEN"]);
    const pids = stdout.split(/\s+/).filter(Boolean);
    for (const pid of pids) process.kill(Number(pid), "SIGTERM");
    if (pids.length) await delay(600);
  } catch {
    // No listener or lsof unavailable.
  }
}

async function startServer() {
  await mkdir(join(root, "data", "logs"), { recursive: true });
  const out = openSync(join(root, "data", "logs", "workbench.log"), "a");
  const child = spawn(process.execPath, [
    join(root, "server", "index.mjs"),
    "--host",
    host,
    "--port",
    String(port)
  ], {
    cwd: root,
    detached: true,
    stdio: ["ignore", out, out]
  });
  child.unref();
}

async function waitForApp() {
  const started = Date.now();
  while (Date.now() - started < 10_000) {
    if (await appReady()) return;
    await delay(180);
  }
  throw new Error("工作台服务启动超时，请查看 data/logs/workbench.log");
}

async function openWorkbench() {
  if (process.platform === "darwin") {
    await execFileAsync("open", [baseUrl]);
    return;
  }
  process.stdout.write(`请在浏览器打开：${baseUrl}\n`);
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
