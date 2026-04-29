import express from "express";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createTemplateStore } from "./template-store.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");
const dataDir = join(root, "data");
const historyImageDir = join(dataDir, "generated-history");
const historyStoreFile = join(dataDir, "history.json");
const templateStore = createTemplateStore({ publicDir });
const defaultSettings = {
  apiUrl: "https://api.openai.com/v1",
  apiKey: "",
  codexCli: false,
  apiMode: "images",
  mainModelId: "gpt-5.5",
  modelId: "gpt-image-2",
  toolName: "image_generation",
  timeoutSeconds: 120
};

const app = express();
app.use((_request, response, next) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  next();
});
app.use(express.json({ limit: "30mb" }));
app.use("/generated-history", express.static(historyImageDir));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "gpt-image-node", time: new Date().toISOString() });
});

app.get("/api/templates", async (request, response) => {
  try {
    const full = request.query?.full === "1" || request.query?.full === "true";
    const catalog = await templateStore.catalog({ full });
    response.json({ ok: true, ...catalog });
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

app.post("/api/generate", async (request, response) => {
  const settings = sanitizeSettings(request.body?.settings);
  const prompt = String(request.body?.prompt || "").trim();
  const params = sanitizeParams(request.body?.params);
  const references = Array.isArray(request.body?.references) ? request.body.references : [];
  const taskId = safeId(request.body?.taskId || request.body?.id || `task-${Date.now().toString(36)}`);
  const createdAt = safeDate(request.body?.createdAt, new Date());
  if (!settings.apiKey.trim()) {
    response.status(400).json({ ok: false, message: "请先配置 API" });
    return;
  }
  if (!prompt) {
    response.status(400).json({ ok: false, message: "请输入提示词" });
    return;
  }
  try {
    const result = await generateOpenAIImage(settings, prompt, params, references);
    const images = await persistHistoryImages(result.images, taskId, params.outputFormat);
    const task = {
      id: taskId,
      prompt,
      params,
      references: historyReferences(references),
      status: "succeeded",
      images,
      error: "",
      revisedPrompt: result.revisedPrompt || "",
      createdAt: createdAt.getTime(),
      finishedAt: Date.now()
    };
    const historySaved = await saveHistoryTaskSafely(task);
    response.json({ ok: true, ...result, images, historySaved });
  } catch (error) {
    const message = errorMessage(error);
    await saveHistoryTaskSafely({
      id: taskId,
      prompt,
      params,
      references: historyReferences(references),
      status: "failed",
      images: [],
      error: message,
      revisedPrompt: "",
      createdAt: createdAt.getTime(),
      finishedAt: Date.now()
    });
    response.status(502).json({ ok: false, message });
  }
});

app.get("/api/history", async (request, response) => {
  try {
    const limit = clampNumber(Number(request.query?.limit) || 80, 1, 200);
    const deleted = request.query?.deleted === "1" || request.query?.deleted === "true";
    const history = await listHistoryTasks(limit, deleted);
    response.json({ ok: true, history, total: history.length });
  } catch (error) {
    response.status(503).json({ ok: false, message: errorMessage(error), history: [] });
  }
});

app.post("/api/history/sync", async (request, response) => {
  try {
    const history = Array.isArray(request.body?.history) ? request.body.history.slice(0, 80) : [];
    let saved = 0;
    for (const task of history) {
      if (!task?.id || !task?.prompt) continue;
      await saveHistoryTask(normalizeClientHistoryTask(task));
      saved += 1;
    }
    response.json({ ok: true, saved });
  } catch (error) {
    response.status(503).json({ ok: false, message: errorMessage(error), saved: 0 });
  }
});

app.delete("/api/history/:id", async (request, response) => {
  try {
    const task = await softDeleteHistoryTask(request.params.id);
    response.json({ ok: true, task });
  } catch (error) {
    response.status(503).json({ ok: false, message: errorMessage(error) });
  }
});

app.post("/api/history/:id/restore", async (request, response) => {
  try {
    const task = await restoreHistoryTask(request.params.id);
    response.json({ ok: true, task });
  } catch (error) {
    response.status(503).json({ ok: false, message: errorMessage(error) });
  }
});

app.delete("/api/history/:id/permanent", async (request, response) => {
  try {
    await deleteHistoryTaskPermanently(request.params.id);
    response.json({ ok: true });
  } catch (error) {
    response.status(503).json({ ok: false, message: errorMessage(error) });
  }
});

app.delete("/api/history", async (request, response) => {
  try {
    const deleted = request.query?.deleted === "1" || request.query?.deleted === "true";
    const count = deleted ? await clearDeletedHistoryTasks() : await softDeleteAllHistoryTasks();
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
  const next = { host: "127.0.0.1", port: 4174 };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--host" && args[index + 1]) next.host = args[index + 1];
    if (args[index] === "--port" && args[index + 1]) next.port = Number(args[index + 1]) || 4174;
  }
  return next;
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
      throw new Error("接口返回了网页 HTML，不是 JSON。请确认 API URL 使用 OpenAI 兼容地址，例如 https://api.openai.com/v1");
    }
    throw new Error(text.slice(0, 300));
  }
}

function assertOk(response, json) {
  if (response.ok && !json.error) return;
  throw new Error(json.error?.message ?? `${response.status} ${response.statusText}`);
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

async function persistHistoryImages(images, taskId, format) {
  await mkdir(historyImageDir, { recursive: true });
  const saved = [];
  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    if (typeof image !== "string") continue;
    const parsed = parseDataImage(image, format);
    if (!parsed) {
      saved.push(image);
      continue;
    }
    const filename = `${safeId(taskId)}-${index + 1}.${parsed.extension}`;
    await writeFile(join(historyImageDir, filename), parsed.buffer);
    saved.push(`/generated-history/${filename}`);
  }
  return saved;
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
    createdAt: safeDate(task.createdAt, new Date()).getTime(),
    finishedAt: task.finishedAt ? safeDate(task.finishedAt, new Date()).getTime() : null
  };
}

async function saveHistoryTaskSafely(task) {
  try {
    await saveHistoryTask(task);
    return true;
  } catch (error) {
    process.stderr.write(`history save failed: ${errorMessage(error)}\n`);
    return false;
  }
}

async function saveHistoryTask(task) {
  const params = sanitizeParams(task.params);
  const images = await persistHistoryImages(Array.isArray(task.images) ? task.images : [], task.id, params.outputFormat);
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
  });
}

async function listHistoryTasks(limit, deleted = false) {
  const history = await readHistoryStore();
  return history
    .filter((task) => deleted ? task.deletedAt : !task.deletedAt)
    .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0))
    .slice(0, clampNumber(Number(limit) || 80, 1, 200));
}

async function softDeleteHistoryTask(id) {
  const safeTaskId = safeId(id);
  return mutateHistoryStore((history) => {
    const task = history.find((item) => item.id === safeTaskId);
    if (!task) return null;
    task.deletedAt = Date.now();
    return task;
  });
}

async function restoreHistoryTask(id) {
  const safeTaskId = safeId(id);
  return mutateHistoryStore((history) => {
    const task = history.find((item) => item.id === safeTaskId);
    if (!task) return null;
    task.deletedAt = null;
    return task;
  });
}

async function softDeleteAllHistoryTasks() {
  return mutateHistoryStore((history) => {
    const now = Date.now();
    let count = 0;
    for (const task of history) {
      if (task.deletedAt) continue;
      task.deletedAt = now;
      count += 1;
    }
    return count;
  });
}

async function deleteHistoryTaskPermanently(id) {
  const safeTaskId = safeId(id);
  const images = await mutateHistoryStore((history) => {
    const index = history.findIndex((item) => item.id === safeTaskId);
    if (index < 0) return [];
    const [task] = history.splice(index, 1);
    return task.images;
  });
  await removeHistoryImages(images);
}

async function clearDeletedHistoryTasks() {
  const { count, images } = await mutateHistoryStore((history) => {
    const deleted = history.filter((task) => task.deletedAt);
    const active = history.filter((task) => !task.deletedAt);
    history.splice(0, history.length, ...active);
    return { count: deleted.length, images: deleted.flatMap((task) => task.images) };
  });
  await removeHistoryImages(images);
  return count;
}

async function removeHistoryImages(images) {
  for (const image of Array.isArray(images) ? images : []) {
    const relative = String(image || "");
    if (!relative.startsWith("/generated-history/")) continue;
    const filename = relative.slice("/generated-history/".length).split(/[?#]/)[0];
    if (!filename || filename.includes("/") || filename.includes("\\")) continue;
    await rm(join(historyImageDir, filename), { force: true });
  }
}

let historyReadyPromise;
let historyWriteQueue = Promise.resolve();

function ensureHistoryStore() {
  if (!historyReadyPromise) historyReadyPromise = initializeHistoryStore();
  return historyReadyPromise;
}

async function initializeHistoryStore() {
  await mkdir(dataDir, { recursive: true });
  await mkdir(historyImageDir, { recursive: true });
  try {
    await access(historyStoreFile);
  } catch {
    await writeFile(historyStoreFile, "[]\n");
  }
}

async function readHistoryStore() {
  await ensureHistoryStore();
  try {
    const text = await readFile(historyStoreFile, "utf8");
    const parsed = JSON.parse(text || "[]");
    return Array.isArray(parsed) ? parsed.map(normalizeHistoryRecord) : [];
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function writeHistoryStore(history) {
  await ensureHistoryStore();
  await writeFile(historyStoreFile, `${JSON.stringify(history.map(normalizeHistoryRecord), null, 2)}\n`);
}

function mutateHistoryStore(mutator) {
  const run = historyWriteQueue.then(async () => {
    const history = await readHistoryStore();
    const result = await mutator(history);
    trimHistoryStore(history);
    await writeHistoryStore(history);
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

function safeDate(value, fallback) {
  const date = value ? new Date(value) : fallback;
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function safeId(value) {
  const clean = String(value || "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
  return clean || `task-${Date.now().toString(36)}`;
}

function normalizeApiBaseUrl(value) {
  const trimmed = value.trim() || "https://api.openai.com/v1";
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
