import { mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "@playwright/test";

const url = process.env.VISUAL_CHECK_URL ?? "http://127.0.0.1:9999/";
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
    localStorage.removeItem("pic.native.clientKey");
    localStorage.removeItem("pic.native.auth");
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  if (pageErrors.length) throw new Error(`${item.name}: page script error: ${pageErrors.join("; ")}`);
  await page.waitForSelector("body", { timeout: 15_000 });
  await expectText(page, ".primary-nav", "拍摄定制", `${item.name}: missing studio menu label`);
  await expectText(page, ".primary-nav", "图片创作", `${item.name}: missing create menu label`);
  await expectText(page, ".primary-nav", "我的作品", `${item.name}: missing history menu label`);
  await expectText(page, ".primary-nav", "账户权益", `${item.name}: missing account menu label`);
  await expectText(page, ".primary-nav", "注册开通", `${item.name}: missing register menu label`);
  await expectPrimaryTabs(page, item.name);
  await expectText(page, "#secondaryNav", "场景套餐", `${item.name}: missing scene-pack submenu`);
  await expectText(page, "#secondaryNav", "成片交付", `${item.name}: missing delivery submenu`);
  await clickFirst(page, ".primary-nav [data-tab='register']", `${item.name}: register primary menu did not open`);
  await expectText(page, "#secondaryNav", "注册", `${item.name}: missing register submenu`);
  await expectText(page, "#secondaryNav", "登录", `${item.name}: missing login submenu`);
  await expectNotText(page, "#secondaryNav", "连接设置", `${item.name}: register submenu should not expose connection settings`);
  await clickFirst(page, "#secondaryNav [data-auth-view='login']", `${item.name}: login submenu did not switch`);
  await expectVisible(page, "#registerPanel", `${item.name}: missing register panel`);
  await expectText(page, "#registerPanel", "立即登录", `${item.name}: missing login action`);
  await expectNotText(page, "#registerPanel", "去连接设置", `${item.name}: register panel should not expose connection settings shortcut`);
  await clickFirst(page, ".primary-nav [data-tab='create']", `${item.name}: missing create tab before credits`);
  await expectText(page, "#secondaryNav", "模板库", `${item.name}: missing templates submenu`);
  await expectText(page, "#secondaryNav", "智能生图", `${item.name}: missing generate submenu`);
  await expectNotText(page, "#secondaryNav", "连接设置", `${item.name}: create submenu should not expose connection settings`);
  await expectNotText(page, "#secondaryNav", "测试连接", `${item.name}: create submenu should not expose test connection`);
  await clickFirst(page, ".primary-nav [data-tab='credits']", `${item.name}: credits primary menu did not open`);
  await expectText(page, "#secondaryNav", "充值中心", `${item.name}: missing recharge submenu`);
  await clickFirst(page, "#secondaryNav [data-anchor='packages']", `${item.name}: recharge submenu did not focus credits`);
  await expectVisible(page, "#creditsPanel", `${item.name}: missing credits panel`);
  await expectText(page, "#creditsPanel", "充值中心", `${item.name}: missing recharge center`);
  await clickFirst(page, ".primary-nav [data-tab='history']", `${item.name}: missing history primary menu`);
  await expectText(page, "#secondaryNav", "全部作品", `${item.name}: missing active history submenu`);
  await expectText(page, "#secondaryNav", "已删除", `${item.name}: missing deleted history submenu`);
  await clickFirst(page, ".primary-nav [data-tab='studio']", `${item.name}: missing studio tab after wallet check`);
  await expectText(page, "#secondaryNav", "拍摄流程", `${item.name}: missing workflow submenu`);
  await expectText(page, "#secondaryNav", "数字底片", `${item.name}: missing identity submenu`);
  await expectVisible(page, "#studioPanel", `${item.name}: missing studio home`);
  await expectAnyText(page, "#studioPanel", ["商业服务分区", "客户下单分区"], `${item.name}: missing commercial service sections`);
  await expectText(page, "#studioWorkOrder", "当前下一步", `${item.name}: missing current workflow status`);
  await expectText(page, "#studioPanel", "数字底片", `${item.name}: missing identity baseline block`);
  await expectText(page, "#studioPanel", "婚纱照", `${item.name}: missing wedding scene pack`);
  await clickFirst(page, "[data-studio-scene='couple']", `${item.name}: missing couple scene pack`);
  await expectText(page, "#sampleSummary", "情侣照", `${item.name}: scene selection did not update sample summary`);
  await clickFirst(page, "[data-studio-sample='daily']", `${item.name}: missing studio sample direction`);
  await clickFirst(page, "[data-identity-status='已确认']", `${item.name}: missing identity confirmation action`);
  await expectText(page, "#samplePreviewPanel", "样片预览", `${item.name}: missing sample preview panel`);
  await expectText(page, "#studioWorkOrder", "看样片", `${item.name}: workflow status did not reach sample preview`);
  await clickFirst(page, "#studioNextActionBtn", `${item.name}: missing studio preview action`);
  await expectVisible(page, ".studio-sample-modal", `${item.name}: sample preview modal did not open`);
  await page.waitForSelector("#studioSampleModalImage", { state: "visible", timeout: 15_000 }).catch(() => {
    throw new Error(`${item.name}: sample preview image missing`);
  });
  await closeModal(page);
  await page.waitForFunction(() => {
    const button = document.querySelector("#studioGenerateBtn");
    return button && !button.disabled && button.textContent.includes("用样片方向生成");
  });
  await clickFirst(page, "#studioGenerateBtn", `${item.name}: missing studio generate action`);
  await page.waitForFunction(() => {
    const input = document.querySelector("#promptInput");
    return input && input.value.includes("场景包：情侣照") && input.value.includes("样片方向：日常胶片");
  });
  await clickFirst(page, ".primary-nav [data-tab='studio']", `${item.name}: missing studio tab`);
  await clickFirst(page, "#openTemplateLibraryBtn", `${item.name}: missing template library entry`);
  await expectVisible(page, "#templatesPanel", `${item.name}: missing template library panel`);
  await expectActivePrimaryTab(page, "create", `${item.name}: template library should move under image creation primary menu`);
  await expectText(page, "#secondaryNav", "模板库", `${item.name}: missing template submenu`);
  await expectText(page, "#secondaryNav", "智能生图", `${item.name}: missing generate submenu`);
  await expectNotText(page, "#secondaryNav", "连接设置", `${item.name}: template flow should stay direct without connection settings`);
  await expectNotText(page, "#secondaryNav", "测试连接", `${item.name}: template flow should stay direct without test connection`);
  await page.waitForFunction(() => [...document.querySelectorAll("#categoryFilter option")].some((option) => option.value === "婚纱照"));
  await page.selectOption("#categoryFilter", "婚纱照");
  await page.waitForSelector("[data-use-template]", { timeout: 15_000 });
  await clickFirst(page, "[data-use-template]", `${item.name}: template action missing`);
  await page.waitForFunction(() => {
    const input = document.querySelector("#promptInput");
    return input && input.value.length > 20;
  });
  await clickFirst(page, "#secondaryNav [data-tab='generate']", `${item.name}: missing generate image tab`);
  await expectVisibleAny(page, ["#promptInput", "textarea.prompt-input"], `${item.name}: missing prompt input`);
  await expectVisibleAny(page, ["#generateButton", "#generateBtn", "#quickGenerate", "button:has-text('生成图片')", "button:has-text('生成')"], `${item.name}: missing generate image action`);
  await clickFirstAny(page, ["[data-modal='size']", "#openSizeBtn", ".field-btn", "button:has-text('尺寸')"], `${item.name}: missing size selector`);
  await expectVisibleAny(page, [".size-modal", ".modal:has-text('设置图像尺寸')"], `${item.name}: missing size modal`);
  await expectText(page, ".size-modal, .modal", "设置图像尺寸", `${item.name}: size modal title missing`);
  await expectVisible(page, ".size-tabs", `${item.name}: missing size tabs`);
  await closeModal(page);
  await expectHidden(page, ".size-modal, .modal:has-text('设置图像尺寸')", `${item.name}: size modal did not close`);
  await clickFirst(page, ".primary-nav [data-tab='create']", `${item.name}: missing create tab before history check`);
  await clickFirst(page, ".primary-nav [data-tab='history']", `${item.name}: missing history primary menu`);
  await expectVisible(page, "#historyPanel", `${item.name}: missing history panel`);
  const screenshot = join(outDir, `${item.name}-gptimage2-prompts.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  await clickFirst(page, ".primary-nav [data-tab='create']", `${item.name}: missing create tab after history check`);
  await clickFirst(page, "#secondaryNav [data-tab='generate']", `${item.name}: missing generate tab after history check`);
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
  if (!/墨境|AlexAI|GPT Image|图片生成|图像工作台|模板|摄影棚|Inklens/.test(metrics.title)) throw new Error(`${item.name}: missing page title`);
  if (metrics.inputHeight <= 0) throw new Error(`${item.name}: prompt input is not visible`);
  if (metrics.inputHeight > (item.name === "mobile" ? 520 : 480)) throw new Error(`${item.name}: input area is too tall (${metrics.inputHeight}px)`);
  if (metrics.toolbarHeight > 0 && metrics.toolbarHeight > 54) throw new Error(`${item.name}: toolbar is too tall (${metrics.toolbarHeight}px)`);
  if (metrics.overflows > 12) throw new Error(`${item.name}: too many horizontal overflows (${metrics.overflows})`);
  const size = statSync(screenshot).size;
  if (size < 20_000) throw new Error(`${item.name}: screenshot looks empty`);
  await page.close();
  console.log(`${item.name} visual check passed: ${screenshot}`);
}

await verifyDirectCreatePath(browser, url);
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

async function expectPrimaryTabs(page, label) {
  const tabs = await page.locator(".primary-nav [data-tab]").evaluateAll((items) => items.map((item) => ({
    tab: item.dataset.tab,
    text: item.textContent?.trim()
  })));
  const expected = [
    ["studio", "拍摄定制"],
    ["create", "图片创作"],
    ["history", "我的作品"],
    ["register", "注册开通"],
    ["credits", "账户权益"]
  ];
  if (tabs.length !== expected.length) {
    throw new Error(`${label}: expected ${expected.length} primary menus, got ${tabs.length}`);
  }
  expected.forEach(([tab, text], index) => {
    const item = tabs[index];
    if (!item || item.tab !== tab || !item.text?.includes(text)) {
      throw new Error(`${label}: primary menu order mismatch at ${index + 1}, expected ${text}`);
    }
  });
  for (const [tab, text] of expected) {
    if (!tabs.some((item) => item.tab === tab && item.text?.includes(text))) {
      throw new Error(`${label}: missing primary menu ${text}`);
    }
  }
  const unexpected = tabs.filter((item) => !expected.some(([tab]) => tab === item.tab));
  if (unexpected.length) throw new Error(`${label}: unexpected primary menus ${unexpected.map((item) => item.tab).join(", ")}`);
  if (tabs.some((item) => item.tab === "templates" || item.tab === "generate" || item.tab === "creatorSettings")) {
    throw new Error(`${label}: creation submenus must not be primary menus`);
  }
}

async function expectActivePrimaryTab(page, tab, message) {
  const active = await page.locator(`.primary-nav [data-tab='${tab}']`).first().evaluate((element) => element.classList.contains("active"));
  if (!active) throw new Error(message);
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

async function expectNotText(page, selector, text, message) {
  const value = await page.locator(selector).first().textContent();
  if (value?.includes(text)) throw new Error(message);
}

async function expectAnyText(page, selector, texts, message) {
  const value = await page.locator(selector).first().textContent();
  if (!texts.some((text) => value?.includes(text))) throw new Error(message);
}

async function expectGenerateEnabled(page, message) {
  await page.waitForFunction(() => {
    const button = document.querySelector("#generateBtn");
    return button && !button.disabled && !button.textContent.includes("积分不足");
  }, null, { timeout: 15_000 }).catch(() => {
    throw new Error(message);
  });
}

async function clickFirst(page, selector, message) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const locator = page.locator(selector).first();
    if (!await locator.count()) throw new Error(message);
    try {
      await locator.scrollIntoViewIfNeeded();
      await locator.click();
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await page.waitForTimeout(120);
    }
  }
}

async function clickFirstAny(page, selectors, message) {
  for (const selector of selectors) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const locator = page.locator(selector).first();
      if (await locator.count() && await locator.isVisible()) {
        try {
          await locator.scrollIntoViewIfNeeded();
          await locator.click();
          return;
        } catch (error) {
          if (attempt === 2) throw error;
          await page.waitForTimeout(120);
          continue;
        }
      }
    }
  }
  throw new Error(message);
}

async function closeModal(page) {
  const closeButton = page.locator("[data-close-modal], .modal-close").first();
  if (await closeButton.count()) {
    try {
      await closeButton.click({ force: true });
      return;
    } catch {
      // Fall through to Escape when the close button is covered by sticky UI.
    }
  }
  await page.keyboard.press("Escape");
}

async function verifyDirectCreatePath(browser, url) {
  const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  await mockEmptyHistory(page);
  await mockCredits(page);
  await page.addInitScript(() => localStorage.clear());
  let capturedGenerate = null;
  await page.route("**/api/generate", async (route) => {
    capturedGenerate = JSON.parse(route.request().postData() || "{}");
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, message: "visual direct create stop" })
    });
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  if (pageErrors.length) throw new Error(`direct create: page script error: ${pageErrors.join("; ")}`);
  await clickFirst(page, ".primary-nav [data-tab='create']", "direct create: missing create tab");
  await expectText(page, "#secondaryNav", "模板库", "direct create: missing template submenu");
  await expectText(page, "#secondaryNav", "智能生图", "direct create: missing generate submenu");
  await expectNotText(page, "#secondaryNav", "连接设置", "direct create: create submenu should not expose connection settings");
  await expectNotText(page, "#secondaryNav", "测试连接", "direct create: create submenu should not expose test connection");
  await clickFirst(page, "#secondaryNav [data-tab='generate']", "direct create: missing generate submenu");
  await expectVisible(page, "#generatePanel", "direct create: generate panel missing");
  await page.fill("#promptInput", "default direct create visual check");
  await expectGenerateEnabled(page, "direct create: generate button stayed disabled");
  await clickFirst(page, "#generateBtn", "direct create: missing generate button");
  await page.waitForFunction(() => document.querySelector("#statusLine")?.textContent?.includes("visual direct create stop"));
  if (!capturedGenerate?.prompt?.includes("default direct create visual check")) throw new Error("direct create: prompt was not submitted");
  if (capturedGenerate?.settings?.apiUrl !== "https://img.inklens.art/v1") throw new Error("direct create: generate request did not carry the default API URL");
  if (capturedGenerate?.settings?.modelId !== "gpt-image-2") throw new Error("direct create: generate request did not carry the default image model");
  await page.close();
  console.log("default direct create path passed");
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
  await clickFirst(page, ".primary-nav [data-tab='create']", "image preview: missing create tab");
  await clickFirst(page, ".primary-nav [data-tab='history']", "image preview: missing history primary menu");
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
  await clickFirst(page, ".primary-nav [data-tab='create']", "known upload: missing create tab");
  await clickFirst(page, "#secondaryNav [data-tab='generate']", "known upload: missing generate submenu");
  await page.setInputFiles("#editImageInput", join(process.cwd(), "public/assets/mojing-icon-192.png"));
  await page.waitForFunction(() => document.querySelector("#editModeState")?.textContent?.includes("编辑模式"));
  await expectText(page, "#editModeState", "编辑模式", "known upload: edit mode did not activate");
  await expectVisible(page, "#referenceList .reference-item img", "known upload: uploaded preview missing");
  await page.fill("#promptInput", "known image upload visual check");
  await expectGenerateEnabled(page, "known upload: generate button stayed disabled");
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
  await clickFirst(page, ".primary-nav [data-tab='create']", "html image reject: missing create tab");
  await clickFirst(page, "#secondaryNav [data-tab='generate']", "html image reject: missing generate submenu");
  await page.fill("#promptInput", "html image reject check");
  await expectGenerateEnabled(page, "html image reject: generate button stayed disabled");
  await clickFirst(page, "#generateBtn", "html image reject: missing generate button");
  await page.waitForFunction(() => document.querySelector("#statusLine")?.textContent?.includes("生成接口返回了 HTML"));
  await clickFirst(page, ".primary-nav [data-tab='history']", "html image reject: missing history primary menu");
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
  await clickFirst(page, ".primary-nav [data-tab='create']", "history trash: missing create tab");
  await clickFirst(page, ".primary-nav [data-tab='history']", "history trash: missing history primary menu");
  await expectVisible(page, "[data-delete-task='trash-task']", "history trash: active record missing");
  await clickFirst(page, "[data-delete-task='trash-task']", "history trash: delete failed");
  await expectHidden(page, "[data-delete-task='trash-task']", "history trash: deleted item stayed in active list");
  await clickFirst(page, "#deletedHistoryBtn", "history trash: missing deleted toggle");
  await expectVisible(page, "[data-restore-task='trash-task']", "history trash: deleted item missing");
  await page.reload({ waitUntil: "domcontentloaded" });
  await clickFirst(page, ".primary-nav [data-tab='create']", "history trash: missing create tab after reload");
  await clickFirst(page, ".primary-nav [data-tab='history']", "history trash: missing history primary menu after reload");
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
