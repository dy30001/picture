import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canGenerate,
  completeTask,
  createMockTask,
  createPendingTask,
  defaultParams,
  defaultSettings,
  failTask,
  filterTasks,
  normalizePrompt,
  updateParams
} from "../src/playground";
import { buildImagesGenerationBody, buildResponsesBody, normalizeApiBaseUrl } from "../src/openaiImageApi";
import { filterPromptTemplates, parsePromptTemplates, promptTemplateCategories } from "../src/promptTemplates";

test("normalizes prompts and blocks missing API key", () => {
  assert.equal(normalizePrompt("  生成海报  \n\n\n  高清  "), "生成海报\n\n  高清");
  assert.deepEqual(canGenerate("生成图片", defaultSettings), { ok: false, reason: "请先配置 API" });
  assert.deepEqual(canGenerate("   ", { ...defaultSettings, apiKey: "test-key" }), { ok: false, reason: "请输入提示词" });
});

test("clamps parameter values", () => {
  const params = updateParams(defaultParams, { count: 9, compression: 140 });
  assert.equal(params.count, 4);
  assert.equal(params.compression, 100);
});

test("creates and filters mock tasks", () => {
  const task = createMockTask("A clean poster", { ...defaultParams, count: 2 }, [], 1000);
  const other = { ...task, id: "failed", status: "failed" as const, favorite: true, prompt: "broken" };
  assert.equal(task.outputImages.length, 2);
  assert.equal(filterTasks([task, other], "succeeded", false, "poster").length, 1);
  assert.equal(filterTasks([task, other], "all", true, "").length, 1);
});

test("builds Images API generation payload", () => {
  const body = buildImagesGenerationBody(
    { ...defaultSettings, apiKey: "test-key", mainModelId: "gpt-5.5", modelId: "gpt-image-2" },
    "Draw a clean UI",
    { ...defaultParams, size: "1024x1024", outputFormat: "webp", compression: 70, count: 2 }
  );
  assert.equal(body.model, "gpt-image-2");
  assert.equal(body.prompt, "Draw a clean UI");
  assert.equal(body.output_format, "webp");
  assert.equal(body.output_compression, 70);
  assert.equal(body.n, 2);
});

test("normalizes OpenAI-compatible API base URLs", () => {
  assert.equal(normalizeApiBaseUrl("https://api.openai.com"), "https://api.openai.com/v1");
  assert.equal(normalizeApiBaseUrl("https://api.openai.com/"), "https://api.openai.com/v1");
  assert.equal(normalizeApiBaseUrl("https://api.openai.com/v1/"), "https://api.openai.com/v1");
  assert.equal(normalizeApiBaseUrl("https://api.openai.com/v1/images/generations"), "https://api.openai.com/v1");
  assert.equal(normalizeApiBaseUrl("https://alexai.work/v1"), "https://alexai.work/v1");
  assert.equal(normalizeApiBaseUrl("image.alexai.work"), "https://image.alexai.work/v1");
  assert.equal(normalizeApiBaseUrl("https://api.openai.com/v1/models?x=1"), "https://api.openai.com/v1");
});

test("builds Responses API image_generation payload", () => {
  const body = buildResponsesBody(
    { ...defaultSettings, apiMode: "responses", mainModelId: "gpt-5.5", modelId: "gpt-image-2", toolName: "image_generation" },
    "Generate a product poster",
    defaultParams,
    [{ id: "1", name: "ref.png", dataUrl: "data:image/png;base64,AAAA", mask: false }]
  );
  assert.equal(body.model, "gpt-5.5");
  assert.deepEqual(body.tool_choice, { type: "image_generation" });
  const tools = body.tools as Array<Record<string, unknown>>;
  assert.equal(tools[0]?.type, "image_generation");
  assert.equal(tools[0]?.action, "edit");
});

test("parses deployed Chinese prompt templates", () => {
  const markdown = readFileSync(new URL("../public/README_zh.md", import.meta.url), "utf8");
  const templates = parsePromptTemplates(markdown);
  assert.ok(templates.length >= 100);
  assert.equal(templates[0]?.featured, true);
  assert.ok(templates[0]?.title.includes("VR"));
  assert.ok(templates[0]?.prompt.includes("VR"));
  assert.ok(filterPromptTemplates(templates, "电商", "all").length > 0);
  assert.ok(promptTemplateCategories(templates).length > 0);
  assert.ok(filterPromptTemplates(templates, "", "featured").every((template) => template.featured));
});

test("transitions pending task to completed or failed", () => {
  const pending = createPendingTask("Draw a poster", defaultParams, [], 1000);
  const done = completeTask(pending, ["data:image/png;base64,AAAA"], "revised", 2000);
  const failed = failTask(pending, "bad request", 2000);
  assert.equal(pending.status, "running");
  assert.equal(done.status, "succeeded");
  assert.equal(done.revisedPrompt, "revised");
  assert.equal(failed.status, "failed");
  assert.equal(failed.error, "bad request");
});
