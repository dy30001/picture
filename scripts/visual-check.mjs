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
  await expectText(page, ".primary-nav", "登录", `${item.name}: missing register menu label`);
  await expectText(page, ".primary-nav", "我的积分", `${item.name}: missing credits menu label`);
  await expectText(page, ".trust-strip", "样片定调", `${item.name}: missing trust strip`);
  await expectText(page, ".trust-strip", "像本人", `${item.name}: missing identity trust item`);
  await expectText(page, ".trust-strip", "出图不乱扣", `${item.name}: missing credit trust item`);
  await expectNotText(page, ".trust-strip", "墨境正式服务", `${item.name}: trust strip should not use old service copy`);
  await expectNotText(page, ".trust-strip", "参考照不公开展示", `${item.name}: trust strip should not expose privacy copy`);
  await expectPrimaryTabs(page, item.name);
  await expectText(page, "#secondaryNav", "样片集", `${item.name}: missing sample-set submenu`);
  await expectText(page, "#secondaryNav", "生图", `${item.name}: missing generation flow submenu`);
  await expectText(page, "#secondaryNav", "选模板", `${item.name}: missing template-pick submenu`);
  await clickFirst(page, ".primary-nav [data-tab='history']", `${item.name}: missing history primary tab`);
  await expectText(page, "#secondaryNav", "全部作品", `${item.name}: history menu should expose active entry`);
  await expectText(page, "#secondaryNav", "已删除", `${item.name}: history menu should expose deleted entry`);
  await expectVisible(page, "#historyPanel", `${item.name}: history view should default to history panel`);
  await clickFirst(page, ".primary-nav [data-tab='register']", `${item.name}: missing register primary tab`);
  await expectActivePrimaryTab(page, "register", `${item.name}: login primary tab should stay active`);
  await expectHidden(page, "#secondaryNav", `${item.name}: login view should hide secondary nav`);
  await expectVisible(page, ".topbar-actions", `${item.name}: register view should keep app navigation`);
  await expectVisible(page, "#registerPanel", `${item.name}: missing register panel`);
  await expectText(page, "#registerPanel", "登录后继续创作", `${item.name}: login panel should lead with login`);
  await expectText(page, "#registerPanel", "邮箱登录", `${item.name}: login form should be email-first`);
  await expectText(page, "#registerPanel", "立即登录", `${item.name}: login action should be primary`);
  await expectText(page, "#registerPanel", "还没有账号？创建一个", `${item.name}: login panel should expose register link`);
  await expectNotText(page, "#registerPanel", "用户名", `${item.name}: register step should not ask for username up front`);
  await expectNotText(page, "#registerPanel", "第 1 步", `${item.name}: register panel should stay minimal`);
  await expectHidden(page, "#registerCodeField", `${item.name}: login should not show verification code field`);
  await clickFirst(page, "#authModeRegisterBtn", `${item.name}: register mode button did not switch`);
  await expectText(page, "#registerPanel", "创建你的账号", `${item.name}: register panel title should explain the action`);
  await expectText(page, "#registerPanel", "创建账号", `${item.name}: register form should switch to account creation`);
  await expectText(page, "#registerPanel", "继续", `${item.name}: register should advance to verification`);
  await expectText(page, "#registerPanel", "已有账号？去登录", `${item.name}: register panel should allow returning to login`);
  await expectHidden(page, "#registerCodeField", `${item.name}: register first step should not show verification code field`);
  await clickFirst(page, "#authModeLoginBtn", `${item.name}: login mode button did not switch back`);
  await expectText(page, "#registerPanel", "登录后继续创作", `${item.name}: login copy should restore after switching back`);
  await expectNotText(page, "#registerPanel", "去连接设置", `${item.name}: register panel should not expose connection settings shortcut`);
  await clickFirst(page, ".primary-nav [data-tab='create']", `${item.name}: missing create primary tab`);
  await expectText(page, "#secondaryNav", "模板库", `${item.name}: missing templates submenu`);
  await expectText(page, "#secondaryNav", "智能生图", `${item.name}: missing generate submenu`);
  await expectNotText(page, "#secondaryNav", "测试连接", `${item.name}: create submenu should not expose test connection`);
  await expectText(page, "#templatesPanel", "精选优先", `${item.name}: template library should expose featured toggle`);
  await expectVisible(page, "#templateCount", `${item.name}: template library should expose template count`);
  await expectVisible(page, "#templateGrid", `${item.name}: template library should expose template grid`);
  await clickFirst(page, ".primary-nav [data-tab='credits']", `${item.name}: missing credits primary tab`);
  await clickFirst(page, "#secondaryNav [data-tab='credits'][data-anchor='overview']", `${item.name}: missing credits secondary tab`);
  await expectText(page, "#secondaryNav", "我的积分", `${item.name}: missing overview submenu`);
  await expectText(page, "#secondaryNav", "买积分", `${item.name}: missing recharge submenu`);
  await expectNotText(page, "#secondaryNav", "充值记录", `${item.name}: credit orders should live inside recharge`);
  await expectNotText(page, "#secondaryNav", "积分流水", `${item.name}: ledger should merge into overview`);
  await expectVisible(page, "#creditsPanel", `${item.name}: missing credits panel`);
  await expectVisible(page, "#creditOverviewView", `${item.name}: credits overview should be visible by default`);
  await expectText(page, "#creditOverviewView", "当前余额", `${item.name}: overview should use customer balance language`);
  await expectText(page, "#creditOverviewView", "只按成功出图扣", `${item.name}: overview should explain spend rule directly`);
  await expectText(page, "#creditOverviewView", "只写要求拍一张：20 积分", `${item.name}: pricing should explain direct generation`);
  await expectText(page, "#creditOverviewView", "上传照片照着改：30 积分", `${item.name}: pricing should explain reference image edits`);
  await expectText(page, "#creditOverviewView", "要更大图：2K +20，4K +60", `${item.name}: pricing should explain large delivery`);
  await expectText(page, "#creditOverviewView", "积分明细", `${item.name}: ledger should be merged into overview`);
  await expectText(page, "#creditOverviewView", "还没有积分明细", `${item.name}: merged ledger empty state should stay in overview`);
  await expectText(page, "#creditOverviewView", "去买积分", `${item.name}: overview should include purchase action`);
  await expectNotText(page, "#creditOverviewView", "先看余额", `${item.name}: overview should not instruct customer to inspect balance`);
  await expectNotText(page, "#creditOverviewView", "怎么扣", `${item.name}: overview should not use internal guide copy`);
  await expectHidden(page, "#creditRechargeView", `${item.name}: recharge view should stay hidden before click`);
  await clickFirst(page, "#secondaryNav [data-anchor='packages']", `${item.name}: recharge submenu did not focus credits`);
  await expectVisible(page, "#creditRechargeView", `${item.name}: recharge view should be visible after click`);
  await expectHidden(page, "#creditOverviewView", `${item.name}: overview should hide when recharge view opens`);
  await expectText(page, "#creditRechargeView", "选择套餐", `${item.name}: recharge view should start with package choice`);
  await expectVisible(page, "#creditOrdersView", `${item.name}: orders block should be visible inside recharge view`);
  await expectText(page, "#creditRechargeView", "充值记录", `${item.name}: recharge view should include credit orders`);
  await expectText(page, "#creditRechargeView", "还没有充值记录", `${item.name}: missing customer order empty state`);
  await expectNotText(page, "#creditRechargeView", "套餐直达", `${item.name}: recharge view should not use slogan copy`);
  await expectNotText(page, "#creditRechargeView", "按时间倒序", `${item.name}: orders view should not expose backend sorting copy`);
  await clickFirst(page, ".primary-nav [data-tab='history']", `${item.name}: missing history primary tab after wallet check`);
  await clickFirst(page, "#secondaryNav [data-tab='history'][data-history-mode='active']", `${item.name}: missing history secondary tab after wallet check`);
  await expectText(page, "#secondaryNav", "全部作品", `${item.name}: missing active history submenu`);
  await expectText(page, "#secondaryNav", "已删除", `${item.name}: missing deleted history submenu`);
  await expectVisible(page, "#historyPanel", `${item.name}: missing history panel`);
  await expectText(page, "#historyPanel", "我的作品", `${item.name}: missing history title`);
  await expectText(page, "#historyPanel", "已删除", `${item.name}: missing deleted history toggle`);
  await clickFirst(page, ".primary-nav [data-tab='studio']", `${item.name}: missing studio tab after wallet check`);
  await expectText(page, "#secondaryNav", "样片集", `${item.name}: missing sample-set submenu`);
  await expectText(page, "#secondaryNav", "生图", `${item.name}: missing workflow submenu`);
  await expectText(page, "#secondaryNav", "身份确认", `${item.name}: missing identity submenu`);
  await expectVisible(page, "#studioPanel", `${item.name}: missing studio home`);
  await expectVisible(page, "#studioSampleSection", `${item.name}: sample set should be default studio view`);
  await expectText(page, "#studioSampleSection", "样片定调，风格一眼定", `${item.name}: missing sample-set title`);
  await expectHidden(page, "#studioCommand", `${item.name}: sample set should not show generation flow by default`);
  await clickFirst(page, "#secondaryNav [data-anchor='flow']", `${item.name}: missing generation flow submenu click`);
  await expectVisible(page, "#studioCommand", `${item.name}: generation flow should open command panel`);
  await expectText(page, "#studioCommand", "三张参考照，锁定身份与风格", `${item.name}: flow view should describe generation steps`);
  await expectAnyText(page, "#studioWorkOrderEyebrow", ["身份锁定"], `${item.name}: missing current workflow eyebrow`);
  await expectText(page, "#studioCurrentStep", "传三张图", `${item.name}: missing first generation step`);
  await expectHidden(page, "#studioStageList", `${item.name}: flow view should not show stage detail panels`);
  await clickFirst(page, "#secondaryNav [data-anchor='sample']", `${item.name}: missing sample submenu click`);
  await expectVisible(page, "#studioSampleSection", `${item.name}: missing sample section`);
  await expectText(page, "#studioSampleSection", "婚纱照", `${item.name}: missing wedding sample direction`);
  await expectText(page, "#studioSampleSection", "01 选大场景", `${item.name}: sample set should start with scene picking`);
  await expectText(page, "#sampleSummary", "组 /", `${item.name}: sample summary should explain the one-screen grouped view`);
  await waitForStudioGroupCount(page, 4, `${item.name}: sample browser should show a grouped matrix`);
  await waitForStudioGalleryCount(page, 3, `${item.name}: sample browser should show the current group photos inline`);
  await clickFirst(page, "[data-studio-scene='couple']", `${item.name}: missing couple scene pack`);
  await expectHidden(page, ".studio-sample-modal", `${item.name}: scene click should stay on the same screen`);
  await expectText(page, "#sampleSummary", "情侣照", `${item.name}: scene selection did not update sample summary`);
  await waitForStudioGroupCount(page, 4, `${item.name}: selected scene should still show grouped samples`);
  await waitForStudioGalleryCount(page, 3, `${item.name}: selected scene should refresh inline photos`);
  await clickFirst(page, "#samplePreviewPanel [data-studio-sample-group]", `${item.name}: missing inline sample group card`);
  await expectHidden(page, ".studio-sample-modal", `${item.name}: group click should not open modal`);
  await expectText(page, "#sampleSummary", "当前", `${item.name}: sample summary did not keep grouped focus`);
  await waitForStudioGalleryCount(page, 3, `${item.name}: group selection should keep inline photos visible`);
  await clickFirst(page, "#sampleDirectionList [data-studio-sample-photo]", `${item.name}: missing inline sample photo`);
  await expectHidden(page, ".studio-sample-modal", `${item.name}: photo click should not open modal`);
  await expectText(page, "#sampleSummary", "当前", `${item.name}: sample summary should stay in the one-screen view`);
  await clickFirst(page, "#openGenerationFlowBtn", `${item.name}: missing start-generation button`);
  await expectVisible(page, "#studioCommand", `${item.name}: start-generation button should open generation flow`);
  await clickFirst(page, "#secondaryNav [data-anchor='identity']", `${item.name}: missing identity submenu click`);
  await expectVisible(page, "#studioIdentitySection", `${item.name}: missing identity section`);
  await expectText(page, "#studioIdentitySection", "三张参考照，锁定像本人", `${item.name}: missing identity baseline block`);
  await page.setInputFiles("#studioReferenceInput", [
    join(process.cwd(), "public", "assets", "icon-192.png"),
    join(process.cwd(), "public", "assets", "studio-showcase-sample.png"),
    join(process.cwd(), "public", "assets", "mojing-share-card.png")
  ]);
  await expectText(page, "#identitySummary", "已传满 3/3 张", `${item.name}: identity upload count did not update`);
  await expectText(page, "#identityStatusChip", "待生成", `${item.name}: identity status should become pending generation`);
  await clickFirst(page, "#confirmIdentityBtn", `${item.name}: missing three-view generation action`);
  await expectText(page, "#identityStatusChip", "待确认", `${item.name}: three-view generation did not move to confirmation`);
  await clickFirst(page, "#confirmIdentityBtn", `${item.name}: missing three-view confirm action`);
  await expectText(page, "#identityStatusChip", "已确认", `${item.name}: identity confirmation did not complete`);
  await clickFirst(page, "#secondaryNav [data-anchor='packages']", `${item.name}: missing template submenu click`);
  await expectVisible(page, "#studioPackagesSection", `${item.name}: missing template section`);
  await expectText(page, "#studioPackagesSection", "模板定调", `${item.name}: missing template stage title`);
  await expectText(page, "#studioTemplateCard", "模板待选", `${item.name}: template summary should start empty`);
  await clickFirst(page, "#openTemplateLibraryBtn", `${item.name}: missing template library entry`);
  await expectVisible(page, "#templatesPanel", `${item.name}: missing template library panel`);
  await expectActivePrimaryTab(page, "create", `${item.name}: template library should move under image creation primary menu`);
  await expectNotText(page, "#secondaryNav", "连接设置", `${item.name}: template flow should stay direct without connection settings`);
  await expectNotText(page, "#secondaryNav", "测试连接", `${item.name}: template flow should stay direct without test connection`);
  await page.waitForFunction(() => document.querySelector("#categoryFilter")?.value === "情侣照");
  await page.waitForSelector("[data-use-template]", { timeout: 15_000 });
  await clickFirst(page, "[data-use-template]", `${item.name}: template action missing`);
  await page.waitForFunction(() => {
    const delivery = document.querySelector("#studioDeliverySection");
    const name = document.querySelector("#studioTemplateName")?.textContent || "";
    return delivery && !delivery.hidden && !name.includes("模板待选");
  }, null, { timeout: 15_000 });
  await expectVisible(page, "#studioDeliverySection", `${item.name}: template selection should return to delivery step`);
  await expectNotText(page, "#studioTemplateName", "模板待选", `${item.name}: selected template name did not persist`);
  await page.waitForFunction(() => {
    const button = document.querySelector("#studioGenerateBtn");
    return button && !button.disabled && button.textContent.includes("开拍成片");
  });
  await clickFirst(page, "#studioGenerateBtn", `${item.name}: missing studio generate action`);
  await page.waitForFunction(() => {
    const input = document.querySelector("#promptInput");
    return input
      && input.value.includes("模板名称：")
      && input.value.includes("可选样片参考：情侣照")
      && input.value.includes("样片组参考：")
      && (input.value.includes("情侣旅行") || input.value.includes("旅行同行"));
  });
  await clickFirst(page, "#secondaryNav [data-tab='generate']", `${item.name}: missing generate image tab`);
  await expectText(page, "#generatePanel", "智能生图", `${item.name}: generate panel should expose 智能生图 copy`);
  await expectNotText(page, "#secondaryNav", "换背景", `${item.name}: generate submenu should not expose old mode buttons`);
  await expectText(page, "#generatePanel", "可选功能", `${item.name}: generate panel should explain prompt options inline`);
  await expectVisibleAny(page, ["#promptInput", "textarea.prompt-input"], `${item.name}: missing prompt input`);
  await expectVisibleAny(page, ["#generateButton", "#generateBtn", "#quickGenerate", "button:has-text('生成图片')", "button:has-text('生成')"], `${item.name}: missing generate image action`);
  await clickFirstAny(page, ["[data-modal='size']", "#openSizeBtn", ".field-btn", "button:has-text('尺寸')"], `${item.name}: missing size selector`);
  await expectVisibleAny(page, [".size-modal", ".modal:has-text('设置图像尺寸')"], `${item.name}: missing size modal`);
  await expectText(page, ".size-modal, .modal", "设置图像尺寸", `${item.name}: size modal title missing`);
  await expectVisible(page, ".size-tabs", `${item.name}: missing size tabs`);
  await closeModal(page);
  await expectHidden(page, ".size-modal, .modal:has-text('设置图像尺寸')", `${item.name}: size modal did not close`);
  await clickFirst(page, ".primary-nav [data-tab='history']", `${item.name}: missing history tab before screenshot`);
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

async function waitForStudioGalleryCount(page, minimum, message) {
  await page.waitForFunction((minCount) => {
    return document.querySelectorAll("#sampleDirectionList [data-studio-gallery-item]").length >= minCount;
  }, minimum, { timeout: 15_000 }).catch(() => {
    throw new Error(message);
  });
}

async function waitForStudioGroupCount(page, minimum, message) {
  await page.waitForFunction((minCount) => {
    return document.querySelectorAll("#samplePreviewPanel [data-studio-sample-group]").length >= minCount;
  }, minimum, { timeout: 15_000 }).catch(() => {
    throw new Error(message);
  });
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
    ["register", "登录"],
    ["credits", "我的积分"]
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
  const layout = await page.locator(".primary-nav [data-tab]").evaluateAll((items) => items.map((item) => {
    const rect = item.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width };
  }));
  const topSpread = Math.max(...layout.map((item) => item.top)) - Math.min(...layout.map((item) => item.top));
  if (topSpread > 4) throw new Error(`${label}: primary menus should stay on one horizontal row`);
  for (let index = 1; index < layout.length; index += 1) {
    if (layout[index].left <= layout[index - 1].left) throw new Error(`${label}: primary menus should be ordered left to right`);
    if (layout[index].width < 44) throw new Error(`${label}: primary menu ${index + 1} is too narrow`);
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
  await page.waitForFunction(
    ({ selector: currentSelector, text: expectedText }) => {
      const value = document.querySelector(currentSelector)?.textContent || "";
      const normalizedValue = value.replace(/\s+/g, " ").trim();
      const normalizedExpected = String(expectedText || "").replace(/\s+/g, " ").trim();
      return normalizedValue.includes(normalizedExpected);
    },
    { selector, text },
    { timeout: 5_000 }
  ).catch(() => {
    throw new Error(message);
  });
}

async function expectNotText(page, selector, text, message) {
  const value = await page.locator(selector).first().textContent();
  if (value?.includes(text)) throw new Error(message);
}

async function expectAnyText(page, selector, texts, message) {
  await page.waitForFunction(
    ({ selector: currentSelector, options }) => {
      const value = document.querySelector(currentSelector)?.textContent || "";
      return options.some((item) => value.includes(item));
    },
    { selector, options: texts },
    { timeout: 5_000 }
  ).catch(() => {
    throw new Error(message);
  });
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
  await expectNotText(page, "#secondaryNav", "换背景", "direct create: create submenu should keep prompt options inside panel");
  await expectNotText(page, "#secondaryNav", "连接设置", "direct create: create submenu should not expose connection settings");
  await expectNotText(page, "#secondaryNav", "测试连接", "direct create: create submenu should not expose test connection");
  await clickFirst(page, "#secondaryNav [data-tab='generate']", "direct create: missing generate submenu");
  await expectVisible(page, "#generatePanel", "direct create: generate panel missing");
  await expectText(page, "#generatePanel", "可选功能", "direct create: generate panel should show prompt option block");
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
  await clickFirst(page, ".primary-nav [data-tab='history']", "image preview: missing history primary tab");
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
  await expectText(page, "#editModeState", "已载入 1 张", "image preview: edit mode did not activate");
  await expectText(page, "#generateBtn", "开始编辑", "image preview: generate button did not switch to edit mode");
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
  await page.setInputFiles("#editImageInput", join(process.cwd(), "public/assets/icon-192.png"));
  await page.waitForFunction(() => document.querySelector("#editModeState")?.textContent?.includes("已载入 1 张"));
  await expectText(page, "#editModeState", "已载入 1 张", "known upload: edit mode did not activate");
  await expectVisible(page, "#referenceList .reference-item img", "known upload: uploaded preview missing");
  await clickFirst(page, "[data-prompt-option='background']", "known upload: background option missing");
  await expectText(page, "#promptOptionPreview", "附加效果", "known upload: prompt option summary missing");
  await page.fill("#promptInput", "known image upload visual check");
  await expectGenerateEnabled(page, "known upload: generate button stayed disabled");
  await clickFirst(page, "#generateBtn", "known upload: missing generate button");
  await page.waitForFunction(() => document.querySelector("#statusLine")?.textContent?.includes("visual upload stop"));
  if (!capturedGenerate?.references?.[0]?.dataUrl?.startsWith("data:image/")) throw new Error("known upload: generate request did not include image data");
  if (!capturedGenerate.prompt?.includes("known image upload")) throw new Error("known upload: generate request prompt mismatch");
  if (!capturedGenerate.prompt?.includes("换背景要求")) throw new Error("known upload: prompt option was not appended to generate request");
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
  await clickFirst(page, ".primary-nav [data-tab='history']", "html image reject: missing history primary tab");
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
  await clickFirst(page, ".primary-nav [data-tab='history']", "history trash: missing history primary tab");
  await expectVisible(page, "[data-delete-task='trash-task']", "history trash: active record missing");
  await clickFirst(page, "[data-delete-task='trash-task']", "history trash: delete failed");
  await expectHidden(page, "[data-delete-task='trash-task']", "history trash: deleted item stayed in active list");
  await clickFirst(page, "#deletedHistoryBtn", "history trash: missing deleted toggle");
  await expectVisible(page, "[data-restore-task='trash-task']", "history trash: deleted item missing");
  await page.reload({ waitUntil: "domcontentloaded" });
  await clickFirst(page, ".primary-nav [data-tab='history']", "history trash: missing history primary tab after reload");
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
