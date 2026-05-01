import { mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "@playwright/test";

const url = process.env.VISUAL_CHECK_URL ?? "http://127.0.0.1:4174/";
const outDir = join(process.cwd(), "review", "screenshots");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const cases = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 }
];

for (const item of cases) {
  const page = await browser.newPage({ viewport: { width: item.width, height: item.height } });
  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  await mockEmptyHistory(page);
  await mockCredits(page);
  await page.addInitScript(() => {
    localStorage.removeItem("alexai-replica-settings");
    localStorage.removeItem("alexai-replica-tasks");
    localStorage.removeItem("pic.native.settings");
    localStorage.removeItem("pic.native.params");
    localStorage.removeItem("pic.native.history");
    localStorage.removeItem("pic.native.deletedHistory");
    localStorage.removeItem("pic.native.studio");
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  if (pageErrors.length) throw new Error(`${item.name}: page script error: ${pageErrors.join("; ")}`);
  await page.waitForSelector("body", { timeout: 15_000 });
  await expectVisibleAny(page, ["#studioPanel", "text=个人 AI 摄影棚"], `${item.name}: missing studio home`);
  await expectText(page, "#studioPanel", "数字底片", `${item.name}: missing identity baseline block`);
  await expectText(page, "#studioPanel", "婚纱照", `${item.name}: missing wedding scene pack`);
  await clickFirst(page, "[data-studio-scene='couple']", `${item.name}: missing couple scene pack`);
  await expectText(page, "#sampleSummary", "情侣照", `${item.name}: scene selection did not update sample summary`);
  await clickFirst(page, "[data-studio-sample='daily']", `${item.name}: missing studio sample direction`);
  await clickFirst(page, "[data-identity-status='已确认']", `${item.name}: missing identity confirmation action`);
  await clickFirst(page, "#studioGenerateBtn", `${item.name}: missing studio generate action`);
  await page.waitForFunction(() => {
    const input = document.querySelector("#promptInput");
    return input && input.value.includes("场景包：情侣照") && input.value.includes("样片方向：日常胶片");
  });
  await clickFirst(page, "[data-tab='studio']", `${item.name}: missing studio tab`);
  await expectVisibleAny(page, ["[data-template-panel]", "#templatesPanel", "text=模板库"], `${item.name}: missing template library`);
  await clickFirst(page, "[data-tab='templates']", `${item.name}: missing templates tab`);
  await page.waitForFunction(() => [...document.querySelectorAll("#categoryFilter option")].some((option) => option.value === "婚纱照"));
  await page.selectOption("#categoryFilter", "婚纱照");
  await page.waitForSelector("[data-use-template]", { timeout: 15_000 });
  await clickFirst(page, "[data-use-template]", `${item.name}: template action missing`);
  await page.waitForFunction(() => {
    const input = document.querySelector("#promptInput");
    return input && input.value.length > 20;
  });
  await clickFirstAny(page, ["[data-tab='generate']", "button:has-text('生成图片')"], `${item.name}: missing generate image tab`);
  await expectVisibleAny(page, ["#promptInput", "textarea.prompt-input"], `${item.name}: missing prompt input`);
  await expectVisibleAny(page, ["#generateButton", "#generateBtn", "#quickGenerate", "button:has-text('生成图片')", "button:has-text('生成')"], `${item.name}: missing generate image action`);
  await clickFirstAny(page, ["[data-modal='size']", "#openSizeBtn", ".field-btn", "button:has-text('尺寸')"], `${item.name}: missing size selector`);
  await expectVisibleAny(page, [".size-modal", ".modal:has-text('设置图像尺寸')"], `${item.name}: missing size modal`);
  await expectText(page, ".size-modal, .modal", "设置图像尺寸", `${item.name}: size modal title missing`);
  await expectVisible(page, ".size-tabs", `${item.name}: missing size tabs`);
  await closeModal(page);
  await expectHidden(page, ".size-modal, .modal:has-text('设置图像尺寸')", `${item.name}: size modal did not close`);
  const screenshot = join(outDir, `${item.name}-gptimage2-prompts.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  const metrics = await page.evaluate(() => {
    const overflows = [...document.querySelectorAll("body *")].filter((element) => {
      const htmlElement = element;
      return htmlElement.scrollWidth > htmlElement.clientWidth + 2;
    }).length;
    const input = document.querySelector("[data-input-bar]")?.getBoundingClientRect()
      ?? document.querySelector("#promptInput")?.getBoundingClientRect();
    const toolbar = document.querySelector(".task-toolbar")?.getBoundingClientRect();
    const title = document.querySelector(".brand")?.textContent
      ?? document.querySelector("h1")?.textContent
      ?? document.title;
    return {
      title,
      overflows,
      inputHeight: Math.round(input?.height ?? 0),
      toolbarHeight: Math.round(toolbar?.height ?? 0)
    };
  });
  if (!/墨境|AlexAI|GPT Image|图片生成|图像工作台|模板|摄影棚/.test(metrics.title)) throw new Error(`${item.name}: missing page title`);
  if (metrics.inputHeight <= 0) throw new Error(`${item.name}: prompt input is not visible`);
  if (metrics.inputHeight > (item.name === "mobile" ? 520 : 420)) throw new Error(`${item.name}: input area is too tall (${metrics.inputHeight}px)`);
  if (metrics.toolbarHeight > 0 && metrics.toolbarHeight > 54) throw new Error(`${item.name}: toolbar is too tall (${metrics.toolbarHeight}px)`);
  if (metrics.overflows > 4) throw new Error(`${item.name}: too many horizontal overflows (${metrics.overflows})`);
  const size = statSync(screenshot).size;
  if (size < 20_000) throw new Error(`${item.name}: screenshot looks empty`);
  await page.close();
  console.log(`${item.name} visual check passed: ${screenshot}`);
}

await verifySettingsSaveRecovery(browser, url);
await verifyKnownImageUpload(browser, url);
await verifyHtmlImageRejected(browser, url);
await verifyImagePreviewDownload(browser, url);
await verifyHistoryTrash(browser, url);
await browser.close();

console.log(`screenshots: ${dirname(join(outDir, "x"))}`);

async function expectVisible(page, selector, message) {
  const count = await page.locator(selector).count();
  if (!count) throw new Error(message);
  if (!await page.locator(selector).first().isVisible()) throw new Error(message);
}

async function expectVisibleAny(page, selectors, message) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.count() && await locator.isVisible()) return;
  }
  throw new Error(message);
}

async function expectHidden(page, selector, message) {
  if (await page.locator(selector).count() && await page.locator(selector).first().isVisible()) {
    throw new Error(message);
  }
}

async function expectText(page, selector, text, message) {
  const value = await page.locator(selector).first().textContent();
  if (!value?.includes(text)) throw new Error(message);
}

async function clickFirst(page, selector, message) {
  const locator = page.locator(selector).first();
  if (!await locator.count()) throw new Error(message);
  await locator.click();
}

async function clickFirstAny(page, selectors, message) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.count() && await locator.isVisible()) {
      await locator.click();
      return;
    }
  }
  throw new Error(message);
}

async function closeModal(page) {
  const closeButton = page.locator("[data-close-modal], .modal-close").first();
  if (await closeButton.count()) {
    await closeButton.click();
    return;
  }
  await page.keyboard.press("Escape");
}

async function verifySettingsSaveRecovery(browser, url) {
  const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  await mockEmptyHistory(page);
  await mockCredits(page);
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("pic.native.history", JSON.stringify([
      {
        id: "old-large-history",
        prompt: "old local image cache",
        status: "succeeded",
        images: [`data:image/png;base64,${"A".repeat(1200)}`],
        references: [{ id: "ref-1", name: "ref.png", dataUrl: `data:image/png;base64,${"B".repeat(1200)}` }],
        createdAt: Date.now()
      }
    ]));
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function patchedSetItem(key, value) {
      const currentHistory = this.getItem("pic.native.history") || "";
      if (key === "pic.native.settings" && currentHistory.includes("data:image")) {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      }
      return originalSetItem.call(this, key, value);
    };
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  if (pageErrors.length) throw new Error(`settings recovery: page script error: ${pageErrors.join("; ")}`);
  await clickFirst(page, "#openSettingsBtn", "settings recovery: missing settings button");
  await page.fill("#modalApiUrl", "https://alexai.work/v1");
  await page.fill("#modalApiKey", "test-key-local-visual-check");
  await page.fill("#modalTimeout", "360");
  await clickFirst(page, "#modalSaveBtn", "settings recovery: missing save button");
  await expectHidden(page, ".modal-card", "settings recovery: save did not close modal");
  await expectText(page, "#statusLine", "设置已保存", "settings recovery: status did not confirm save");
  const saved = await page.evaluate(() => ({
    settings: JSON.parse(localStorage.getItem("pic.native.settings") || "{}"),
    history: localStorage.getItem("pic.native.history") || ""
  }));
  if (saved.settings.apiUrl !== "https://alexai.work/v1") throw new Error("settings recovery: API URL was not saved exactly");
  if (saved.settings.apiKey !== "test-key-local-visual-check") throw new Error("settings recovery: API key was not saved");
  if (saved.settings.timeoutSeconds !== 360) throw new Error("settings recovery: timeout was not saved");
  if (saved.history.includes("data:image")) throw new Error("settings recovery: large history cache was not compacted");
  let capturedGenerateSettings = null;
  await page.route("**/api/generate", async (route) => {
    capturedGenerateSettings = JSON.parse(route.request().postData() || "{}").settings || null;
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, message: "visual check stop" })
    });
  });
  await clickFirst(page, "[data-tab='generate']", "settings recovery: missing generate tab");
  await page.fill("#promptInput", "visual check prompt");
  await page.waitForFunction(() => {
    const button = document.querySelector("#generateBtn");
    return button && !button.disabled && !button.textContent.includes("积分不足");
  });
  await clickFirst(page, "#generateBtn", "settings recovery: missing generate button");
  await page.waitForFunction(() => document.querySelector("#statusLine")?.textContent?.includes("visual check stop"));
  if (capturedGenerateSettings?.apiUrl !== "https://alexai.work/v1") throw new Error("settings recovery: generate request did not use saved API URL");
  if (capturedGenerateSettings?.apiKey !== "test-key-local-visual-check") throw new Error("settings recovery: generate request did not use saved API key");
  const historyText = await page.locator("#historyList").textContent();
  if (!historyText?.includes("接口已配置")) throw new Error("settings recovery: history did not show compact settings summary");
  if (historyText.includes("https://alexai.work/v1")) throw new Error("settings recovery: history exposed the API URL");
  if (historyText.includes("test-key-local-visual-check")) throw new Error("settings recovery: history leaked the API key");
  const statusText = await page.locator("#statusLine").textContent();
  if (statusText?.includes("https://alexai.work/v1")) throw new Error("settings recovery: status exposed the API URL");
  await page.close();
  console.log("settings save recovery passed");
}

async function verifyImagePreviewDownload(browser, url) {
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 960, height: 720 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  await page.route(/\/api\/history\/sync$/, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, saved: 1 }) });
  });
  await page.route(/\/api\/history(?:\?.*)?$/, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, history: [], total: 0 }) });
  });
  await mockCredits(page);
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("pic.native.history", JSON.stringify([
      {
        id: "download-preview-task",
        prompt: "preview download check",
        params: { size: "1024x1024", quality: "auto", outputFormat: "png", count: 1 },
        references: [],
        status: "succeeded",
        images: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="],
        createdAt: Date.now(),
        finishedAt: Date.now()
      }
    ]));
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  if (pageErrors.length) throw new Error(`image preview: page script error: ${pageErrors.join("; ")}`);
  await clickFirst(page, "[data-tab='generate']", "image preview: missing generate tab");
  await expectVisible(page, "[data-preview-task='download-preview-task']", "image preview: missing preview button");
  await expectVisible(page, "[data-download-task='download-preview-task']", "image preview: missing card download button");
  await clickFirst(page, "[data-preview-task='download-preview-task']", "image preview: preview click failed");
  await expectVisible(page, ".image-preview-modal", "image preview: modal did not open");
  await expectVisible(page, ".image-preview-frame img", "image preview: modal image missing");
  const downloadPromise = page.waitForEvent("download");
  await clickFirst(page, "#imagePreviewDownload", "image preview: missing preview download button");
  const download = await downloadPromise;
  const suggested = download.suggestedFilename();
  if (!/^pic-\d{8}-\d{6}-1\.png$/.test(suggested)) throw new Error(`image preview: unexpected download filename ${suggested}`);
  await clickFirst(page, "#imagePreviewEdit", "image preview: missing preview edit button");
  await expectHidden(page, ".image-preview-modal", "image preview: modal did not close");
  await expectText(page, "#editModeState", "编辑模式", "image preview: edit mode did not activate");
  await expectText(page, "#generateBtn", "生成编辑图", "image preview: generate button did not switch to edit mode");
  const promptValue = await page.locator("#promptInput").inputValue();
  if (!promptValue.includes("preview download check")) throw new Error("image preview: edit mode did not reuse source prompt");
  const referenceCount = await page.locator("#referenceList .reference-item img").count();
  if (referenceCount !== 1) throw new Error(`image preview: expected 1 loaded edit reference, got ${referenceCount}`);
  await context.close();
  console.log("image preview download and edit passed");
}

async function verifyKnownImageUpload(browser, url) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  await mockEmptyHistory(page);
  await mockCredits(page);
  let capturedGenerate = null;
  await page.route("**/api/generate", async (route) => {
    capturedGenerate = JSON.parse(route.request().postData() || "{}");
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, message: "visual upload stop" })
    });
  });
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("pic.native.settings", JSON.stringify({
      apiUrl: "https://alexai.work/v1",
      apiKey: "visual-upload-key",
      apiMode: "images",
      mainModelId: "gpt-5.5",
      modelId: "gpt-image-2",
      timeoutSeconds: 120
    }));
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  if (pageErrors.length) throw new Error(`known upload: page script error: ${pageErrors.join("; ")}`);
  await clickFirst(page, "[data-tab='generate']", "known upload: missing generate tab");
  await page.setInputFiles("#editImageInput", join(process.cwd(), "public/assets/mojing-icon-192.png"));
  await page.waitForFunction(() => document.querySelector("#editModeState")?.textContent?.includes("编辑模式"));
  await expectText(page, "#editModeState", "编辑模式", "known upload: edit mode did not activate");
  await expectVisible(page, "#referenceList .reference-item img", "known upload: uploaded preview missing");
  await page.fill("#promptInput", "known image upload visual check");
  await clickFirst(page, "#generateBtn", "known upload: missing generate button");
  await page.waitForFunction(() => document.querySelector("#statusLine")?.textContent?.includes("visual upload stop"));
  if (!capturedGenerate?.references?.[0]?.dataUrl?.startsWith("data:image/")) throw new Error("known upload: generate request did not include image data");
  if (!capturedGenerate.prompt?.includes("known image upload")) throw new Error("known upload: generate request prompt mismatch");
  await page.close();
  console.log("known image upload passed");
}

async function verifyHtmlImageRejected(browser, url) {
  const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  await mockEmptyHistory(page);
  await mockCredits(page);
  await page.route("**/api/generate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, images: ["<!doctype html><html><body><h1>not image</h1></body></html>"] })
    });
  });
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("pic.native.settings", JSON.stringify({
      apiUrl: "https://alexai.work/v1",
      apiKey: "visual-html-key",
      apiMode: "images",
      mainModelId: "gpt-5.5",
      modelId: "gpt-image-2",
      timeoutSeconds: 120
    }));
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  if (pageErrors.length) throw new Error(`html image reject: page script error: ${pageErrors.join("; ")}`);
  await clickFirst(page, "[data-tab='generate']", "html image reject: missing generate tab");
  await page.fill("#promptInput", "html image reject check");
  await clickFirst(page, "#generateBtn", "html image reject: missing generate button");
  await page.waitForFunction(() => document.querySelector("#statusLine")?.textContent?.includes("生成接口返回了 HTML"));
  const historyText = await page.locator("#historyList").textContent();
  if (!historyText?.includes("失败")) throw new Error("html image reject: history did not mark the task failed");
  if (await page.locator("#historyList img").count()) throw new Error("html image reject: HTML was rendered as an image");
  await page.close();
  console.log("html image rejection passed");
}

async function verifyHistoryTrash(browser, url) {
  const context = await browser.newContext({ viewport: { width: 960, height: 720 } });
  const page = await context.newPage();
  const task = {
    id: "trash-task",
    prompt: "trash check",
    params: { size: "auto", quality: "auto", outputFormat: "png", count: 1 },
    references: [],
    status: "failed",
    images: [],
    error: "trash check error",
    createdAt: Date.now(),
    finishedAt: Date.now()
  };
  let active = [task];
  let deleted = [];
  await page.route("**/api/history**", async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const method = request.method();
    const pathname = requestUrl.pathname;
    if (method === "POST" && pathname === "/api/history/sync") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, saved: 0 }) });
      return;
    }
    if (method === "GET" && pathname === "/api/history") {
      const list = requestUrl.searchParams.get("deleted") === "1" ? deleted : active;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, history: list, total: list.length }) });
      return;
    }
    if (method === "DELETE" && pathname === "/api/history/trash-task") {
      active = active.filter((item) => item.id !== "trash-task");
      deleted = [{ ...task, deletedAt: Date.now() }];
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, task: deleted[0] }) });
      return;
    }
    if (method === "POST" && pathname === "/api/history/trash-task/restore") {
      deleted = [];
      active = [task];
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, task }) });
      return;
    }
    await route.continue();
  });
  await mockCredits(page);
  await page.addInitScript(() => localStorage.clear());
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await clickFirst(page, "[data-tab='generate']", "history trash: missing generate tab");
  await expectVisible(page, "[data-delete-task='trash-task']", "history trash: active record missing");
  await clickFirst(page, "[data-delete-task='trash-task']", "history trash: delete failed");
  await expectHidden(page, "[data-delete-task='trash-task']", "history trash: deleted item stayed in active list");
  await clickFirst(page, "#deletedHistoryBtn", "history trash: missing deleted toggle");
  await expectVisible(page, "[data-restore-task='trash-task']", "history trash: deleted item missing");
  await page.reload({ waitUntil: "domcontentloaded" });
  await clickFirst(page, "[data-tab='generate']", "history trash: missing generate tab after reload");
  await expectHidden(page, "[data-delete-task='trash-task']", "history trash: deleted item returned to active list");
  await clickFirst(page, "#deletedHistoryBtn", "history trash: missing deleted toggle after reload");
  await expectVisible(page, "[data-restore-task='trash-task']", "history trash: deleted item missing after reload");
  await clickFirst(page, "[data-restore-task='trash-task']", "history trash: restore failed");
  await expectHidden(page, "[data-restore-task='trash-task']", "history trash: restored item stayed in deleted list");
  await clickFirst(page, "#deletedHistoryBtn", "history trash: missing return button");
  await expectVisible(page, "[data-delete-task='trash-task']", "history trash: restored item missing in active list");
  await context.close();
  console.log("history trash passed");
}

async function mockEmptyHistory(page) {
  await page.route("**/api/history**", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname === "/api/history/sync") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, saved: 0 }) });
      return;
    }
    if (requestUrl.pathname === "/api/history") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, history: [], total: 0 }) });
      return;
    }
    await route.continue();
  });
}

async function mockCredits(page, balance = 500) {
  await page.route("**/api/credits**", async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    if (request.method() === "POST" && requestUrl.pathname === "/api/credits/estimate") {
      const body = JSON.parse(request.postData() || "{}");
      const references = Array.isArray(body.references) ? body.references : [];
      const count = Math.max(1, Math.min(4, Math.round(Number(body.params?.count) || 1)));
      const unitCost = references.length ? 30 : 20;
      const estimatedCost = unitCost * count;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, unitCost, estimatedCost, balance, enough: balance >= estimatedCost, shortage: Math.max(0, estimatedCost - balance), packages: creditPackages() })
      });
      return;
    }
    if (request.method() === "POST" && requestUrl.pathname === "/api/credits/recharge") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, entry: { id: "visual-recharge", type: "recharge", title: "创作包", credits: 330, amountCny: 29.9, createdAt: new Date().toISOString() }, balance: balance + 330, ledger: [], packages: creditPackages() })
      });
      return;
    }
    if (request.method() === "GET" && requestUrl.pathname === "/api/credits") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, balance, ledger: [], packages: creditPackages(), updatedAt: new Date().toISOString() })
      });
      return;
    }
    await route.continue();
  });
}

function creditPackages() {
  return [
    { id: "trial", name: "试用包", credits: 100, bonus: 0, amountCny: 9.9, badge: "体验" },
    { id: "starter", name: "创作包", credits: 300, bonus: 30, amountCny: 29.9, badge: "常用" },
    { id: "studio", name: "工作室包", credits: 800, bonus: 120, amountCny: 79.9, badge: "推荐" },
    { id: "pro", name: "批量包", credits: 1800, bonus: 360, amountCny: 169, badge: "批量" }
  ];
}
