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
    localStorage.removeItem("pic.native.studioOrder");
    localStorage.removeItem("pic.native.studioAdmin");
    localStorage.removeItem("pic.native.clientKey");
    localStorage.removeItem("pic.native.auth");
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  if (pageErrors.length) throw new Error(`${item.name}: page script error: ${pageErrors.join("; ")}`);
  await page.waitForSelector("body", { timeout: 15_000 });
  await expectText(page, ".primary-nav", "首页", `${item.name}: missing home menu label`);
  await expectText(page, ".primary-nav", "拍摄定制", `${item.name}: missing studio menu label`);
  await expectText(page, ".primary-nav", "图片创作", `${item.name}: missing create menu label`);
  await expectText(page, ".primary-nav", "我的作品", `${item.name}: missing history menu label`);
  await expectText(page, ".primary-nav", "登录", `${item.name}: missing register menu label`);
  await expectText(page, ".primary-nav", "我的积分", `${item.name}: missing credits menu label`);
  await expectNotText(page, ".primary-nav", "后台管理", `${item.name}: customer frontend should not expose admin menu label`);
  if (await page.locator(".primary-nav [data-tab='admin']").count()) throw new Error(`${item.name}: customer frontend should not expose admin primary tab`);
  await expectPrimaryTabs(page, item.name);
  await expectActivePrimaryTab(page, "home", `${item.name}: home primary tab should be active by default`);
  await expectVisible(page, "#homePanel", `${item.name}: home panel should be visible by default`);
  await expectText(page, "#homePanel", "让向往的生活，先在照片里发生", `${item.name}: home hero should lead with the fixed brand slogan`);
  await expectText(page, "#homePanel", "亲人同框", `${item.name}: home hero should expose reunion intent`);
  await expectText(page, "#homePanel", "把旧照片带回来", `${item.name}: home page should include old-photo repair purpose`);
  await expectVisible(page, "#homeStartStudioBtn", `${item.name}: home page should expose studio CTA`);
  await expectVisible(page, "#homeRepairPhotoBtn", `${item.name}: home page should expose old-photo repair CTA`);
  await expectHidden(page, ".trust-strip", `${item.name}: home should not show studio trust strip`);
  await expectHidden(page, "#secondaryNav", `${item.name}: home should not show a secondary menu`);
  await clickFirst(page, ".primary-nav [data-tab='studio']", `${item.name}: missing studio primary tab`);
  await expectVisible(page, ".trust-strip", `${item.name}: effect browser should show the customer result strip`);
  await expectVisible(page, "#secondaryNav", `${item.name}: customer studio should show the four function submenu`);
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
  await expectVisible(page, "#templateCollections", `${item.name}: template library should expose group collections`);
  await expectText(page, "#templateCollections", "全部分类", `${item.name}: template library should expose all categories shelf`);
  await expectText(page, "#templateCollections", "人像基准", `${item.name}: template library should expose portrait baseline group`);
  await expectText(page, "#templateCollections", "婚纱照", `${item.name}: template library should expose wedding category`);
  await expectText(page, "#templateCollections", "情侣照", `${item.name}: template library should expose couple category`);
  await expectText(page, "#templateCollections", "女生写真", `${item.name}: template library should expose portrait category`);
  await expectText(page, "#templateCollections", "产品/电商", `${item.name}: template library should expose commerce group`);
  await expectTemplateCollectionBackgrounds(page, item.name);
  await clickFirst(page, "#templateCollections [data-template-category='产品/电商']", `${item.name}: category card should be clickable`);
  await page.waitForFunction(() => document.querySelector("#categoryFilter")?.value === "产品/电商", null, { timeout: 5_000 });
  await page.waitForFunction(() => {
    const card = document.querySelector("#templateGrid .template-card");
    if (!card) return false;
    const top = card.getBoundingClientRect().top;
    return top >= 80 && top <= 320;
  }, null, { timeout: 15_000 }).catch(() => {
    throw new Error(`${item.name}: selecting a category card should jump to the first template detail card`);
  });
  await expectNotText(page, "#templateCollections", "趣味生图", `${item.name}: template library should no longer use fun-image grouping`);
  await expectNotText(page, "#templateCollections", "套图写真", `${item.name}: template library should no longer use set-photo grouping`);
  await expectNotText(page, "#templateCollections", "身份确认", `${item.name}: template library shelf should not expose identity confirmation`);
  await expectText(page, "#templatesPanel", "只看精选", `${item.name}: template library should expose featured toggle`);
  await expectVisible(page, "#templateCount", `${item.name}: template library should expose template count`);
  await expectVisible(page, "#templateGrid", `${item.name}: template library should expose template grid`);
  await clickFirst(page, "#templateGrid [data-use-template]", `${item.name}: template use action should be clickable`);
  await page.waitForFunction(() => {
    const panel = document.querySelector("#generatePanel");
    return panel && !panel.hidden;
  }, null, { timeout: 5_000 }).catch(() => {
    throw new Error(`${item.name}: template use action should open generate panel`);
  });
  await page.waitForFunction(() => (document.querySelector("#promptInput")?.value || "").length > 20, null, { timeout: 5_000 });
  await clickFirst(page, ".primary-nav [data-tab='credits']", `${item.name}: missing credits primary tab`);
  await clickFirst(page, "#secondaryNav [data-tab='credits'][data-anchor='overview']", `${item.name}: missing credits secondary tab`);
  await expectText(page, "#secondaryNav", "我的积分", `${item.name}: missing overview submenu`);
  await expectText(page, "#secondaryNav", "买积分", `${item.name}: missing recharge submenu`);
  await expectNotText(page, "#secondaryNav", "充值记录", `${item.name}: credit orders should live inside recharge`);
  await expectNotText(page, "#secondaryNav", "积分流水", `${item.name}: ledger should merge into overview`);
  await expectVisible(page, "#creditsPanel", `${item.name}: missing credits panel`);
  await expectVisible(page, "#creditOverviewView", `${item.name}: credits overview should be visible by default`);
  await expectText(page, "#creditOverviewView", "当前余额", `${item.name}: overview should use customer balance language`);
  await expectText(page, "#creditOverviewView", "够拍什么", `${item.name}: overview should explain current usage directly`);
  await expectText(page, "#creditOverviewView", "只写要求拍", `${item.name}: overview should translate balance into direct shots`);
  await expectText(page, "#creditOverviewView", "上传照片改", `${item.name}: overview should translate balance into edits`);
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
  await expectText(page, "#creditRechargeView", "登录后才能买积分", `${item.name}: recharge view should require login before payment`);
  await expectText(page, "#creditRechargeView", "登录购买", `${item.name}: package action should send guests to login`);
  await expectText(page, "#creditRechargeView", "适合：", `${item.name}: package cards should explain fit`);
  await expectText(page, "#creditRechargeView", "只写要求拍", `${item.name}: package cards should explain direct shot count`);
  await expectText(page, "#creditRechargeView", "上传照片改", `${item.name}: package cards should explain edit count`);
  await expectVisible(page, "#creditOrdersView", `${item.name}: orders block should be visible inside recharge view`);
  await expectText(page, "#creditRechargeView", "充值记录", `${item.name}: recharge view should include credit orders`);
  await expectText(page, "#creditRechargeView", "还没有充值记录", `${item.name}: missing customer order empty state`);
  await expectNotText(page, "#creditRechargeView", "套餐直达", `${item.name}: recharge view should not use slogan copy`);
  await expectNotText(page, "#creditRechargeView", "按时间倒序", `${item.name}: orders view should not expose backend sorting copy`);
  await clickFirst(page, "#creditRechargeView [data-recharge-package]", `${item.name}: login prerequisite button did not respond`);
  await expectVisible(page, "#registerPanel", `${item.name}: buying credits should send guests to login`);
  await expectText(page, "#registerPanel", "登录后继续创作", `${item.name}: login prerequisite should land on login panel`);
  await clickFirst(page, ".primary-nav [data-tab='history']", `${item.name}: missing history primary tab after wallet check`);
  await clickFirst(page, "#secondaryNav [data-tab='history'][data-history-mode='active']", `${item.name}: missing history secondary tab after wallet check`);
  await expectText(page, "#secondaryNav", "全部作品", `${item.name}: missing active history submenu`);
  await expectText(page, "#secondaryNav", "已删除", `${item.name}: missing deleted history submenu`);
  await expectVisible(page, "#historyPanel", `${item.name}: missing history panel`);
  await expectText(page, "#historyPanel", "我的作品", `${item.name}: missing history title`);
  await expectText(page, "#historyPanel", "已删除", `${item.name}: missing deleted history toggle`);
  await clickFirst(page, ".primary-nav [data-tab='studio']", `${item.name}: missing studio tab after wallet check`);
  await expectVisible(page, "#secondaryNav", `${item.name}: customer studio should keep the four function submenu visible`);
  await expectVisible(page, ".trust-strip", `${item.name}: effect browser should show customer result strip`);
  await expectVisible(page, "#studioPanel", `${item.name}: missing studio home`);
  await expectVisible(page, "#studioSampleSection", `${item.name}: sample set should be default studio view`);
  await expectHidden(page, "#studioCommand", `${item.name}: sample set should not show customer workflow shell`);
  await expectHidden(page, "#studioSceneRail", `${item.name}: sample set should not show side workflow rail`);
  await expectText(page, "#studioSampleSection", "把想要的生活，拍成看得见的作品", `${item.name}: effect page should lead with the life-oriented slogan`);
  await expectText(page, "#studioSampleSection", "婚纱照", `${item.name}: missing wedding sample direction`);
  await expectText(page, "#studioSampleSection", "效果分类", `${item.name}: effect page should start with effect categories`);
  await expectText(page, "#sampleSummary", "组 /", `${item.name}: sample summary should explain the one-screen grouped view`);
  await expectNotText(page, "#sampleSummary", "左侧子场景，右侧大图", `${item.name}: sample summary should not expose layout instructions`);
  await waitForStudioGroupCount(page, 4, `${item.name}: sample browser should show a grouped matrix`);
  await waitForStudioGalleryCount(page, 3, `${item.name}: sample browser should show the current group photos inline`);
  await clickFirst(page, "[data-studio-scene='couple']", `${item.name}: missing couple scene pack`);
  await expectHidden(page, ".studio-sample-modal", `${item.name}: scene click should stay on the same screen`);
  await expectText(page, "#sampleSummary", "情侣照", `${item.name}: scene selection did not update sample summary`);
  await waitForStudioGroupCount(page, 4, `${item.name}: selected scene should still show grouped samples`);
  await waitForStudioGalleryCount(page, 3, `${item.name}: selected scene should refresh inline photos`);
  if (item.width >= 1000) {
    await expectFlatScenePackGrid(page, item.name);
    await expectStudioSampleGroupScrollStable(page, item.name);
    await expectStudioSamplePortraitCrop(page, item.name);
    await expectStudioSampleColumnsAligned(page, item.name);
  }
  await clickFirst(page, "#samplePreviewPanel [data-studio-sample-group]", `${item.name}: missing inline sample group card`);
  await expectHidden(page, ".studio-sample-modal", `${item.name}: group click should not open modal`);
  await expectText(page, "#sampleSummary", "当前", `${item.name}: sample summary did not keep grouped focus`);
  await waitForStudioGalleryCount(page, 9, `${item.name}: group selection should keep the full 9-photo strip visible`);
  await clickFirst(page, "#samplePreviewPanel [data-studio-sample-photo]", `${item.name}: missing inline sample photo`);
  await expectHidden(page, ".studio-sample-modal", `${item.name}: photo click should not open modal`);
  await expectText(page, "#sampleSummary", "当前", `${item.name}: sample summary should stay in the one-screen view`);
  await clickFirst(page, "#samplePreviewPanel [data-studio-sample-zoom]", `${item.name}: missing sample zoom action`);
  await expectVisible(page, ".studio-sample-modal", `${item.name}: zoom should open the large sample preview`);
  await expectText(page, ".studio-sample-modal", "放大查看", `${item.name}: sample zoom modal should explain enlarged viewing`);
  await clickFirst(page, ".studio-sample-modal [data-studio-preview-step='1']", `${item.name}: missing next photo in zoom modal`);
  await expectVisible(page, ".studio-sample-modal-thumb.active", `${item.name}: zoom modal should keep active thumbnail`);
  await clickFirst(page, ".studio-sample-modal [data-close-modal]", `${item.name}: missing zoom modal close`);
  await expectHidden(page, ".studio-sample-modal", `${item.name}: zoom modal should close back to one-screen browser`);
  await page.evaluate(() => openStudioSection("submit"));
  await expectVisible(page, "#studioIdentitySection", `${item.name}: missing submit section`);
  await expectText(page, "#secondaryNav", "看效果", `${item.name}: studio submenu should use customer effect naming`);
  await expectText(page, "#secondaryNav", "提交资料", `${item.name}: missing submit submenu`);
  await expectText(page, "#secondaryNav", "制作状态", `${item.name}: missing status submenu`);
  await expectText(page, "#secondaryNav", "查看成片", `${item.name}: missing delivery submenu`);
  await expectHidden(page, "#studioCommand", `${item.name}: submit section should not keep the sample hero above the form`);
  await expectHidden(page, ".trust-strip", `${item.name}: submit section should not show sample/effect strip`);
  await expectText(page, "#studioIdentitySection", "选择组合，上传照片", `${item.name}: submit section should stay focused on customer materials`);
  await expectText(page, "#studioIdentitySection", "每人最多 9 张", `${item.name}: submit section should enforce per-person limit`);
  await expectText(page, "#studioIdentitySection", "拍摄组合", `${item.name}: submit section should use a compact combo selector`);
  await expectText(page, "#studioIdentitySection", "风格方向", `${item.name}: submit section should use a compact style selector`);
  await expectNotText(page, "#studioIdentitySection", "三张参考照", `${item.name}: submit section should not expose old three-view flow`);
  await page.setInputFiles("#studioReferenceInput", [
    join(process.cwd(), "public", "assets", "icon-192.png"),
    join(process.cwd(), "public", "assets", "studio-showcase-sample.png"),
    join(process.cwd(), "public", "assets", "mojing-share-card.png")
  ]);
  await expectVisible(page, "#registerPanel", `${item.name}: anonymous submit upload should require login`);
  await expectText(page, "#registerPanel", "登录后继续创作", `${item.name}: submit upload should land on login panel`);
  await clickFirst(page, ".primary-nav [data-tab='studio']", `${item.name}: missing studio tab after submit login gate`);
  await page.evaluate(() => openStudioSection("status"));
  await expectVisible(page, "#studioPackagesSection", `${item.name}: missing status section`);
  await expectHidden(page, "#studioCommand", `${item.name}: status section should not keep the sample hero above the status`);
  await expectHidden(page, ".trust-strip", `${item.name}: status section should not show sample/effect strip`);
  await expectText(page, "#studioPackagesSection", "订单状态清楚显示", `${item.name}: status section should stay customer-facing`);
  await expectText(page, "#studioPackagesSection", "客户资料和当前状态会显示在这里", `${item.name}: status section should show submitted content and state only`);
  await page.evaluate(() => openStudioSection("delivery"));
  await expectVisible(page, "#studioDeliverySection", `${item.name}: missing delivery section`);
  await expectText(page, "#studioDeliverySection", "这里只放正式交付结果", `${item.name}: delivery section should only show final results`);
  await expectHidden(page, "#adminPanel", `${item.name}: admin panel should stay hidden in customer flow`);
  await expectNotText(page, ".primary-nav", "后台管理", `${item.name}: customer frontend should keep admin out of primary nav`);
  if (await page.locator("#adminPanel").count()) throw new Error(`${item.name}: customer frontend should not include admin panel markup`);
  await clickFirst(page, ".primary-nav [data-tab='create']", `${item.name}: missing create tab before generate check`);
  await clickFirst(page, "#secondaryNav [data-tab='generate']", `${item.name}: missing generate image tab`);
  await expectText(page, "#generatePanel", "智能生图", `${item.name}: generate panel should expose 智能生图 copy`);
  await expectNotText(page, "#secondaryNav", "换背景", `${item.name}: generate submenu should not expose old mode buttons`);
  await expectText(page, "#generatePanel", "补充效果", `${item.name}: generate panel should show prompt supplements`);
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
    return document.querySelectorAll("#samplePreviewPanel [data-studio-gallery-item]").length >= minCount;
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

async function expectFlatScenePackGrid(page, label) {
  const metrics = await page.evaluate(() => {
    const grid = document.querySelector("#studioSampleSection .scene-pack-grid");
    if (!grid) return null;
    const style = getComputedStyle(grid);
    return {
      display: style.display,
      overflowX: style.overflowX,
      scrollWidth: grid.scrollWidth,
      clientWidth: grid.clientWidth
    };
  });
  if (!metrics || metrics.display !== "grid" || metrics.overflowX === "auto" || metrics.scrollWidth > metrics.clientWidth + 2) {
    throw new Error(`${label}: top template choices should be flat, not horizontally scrolling`);
  }
}

async function expectStudioSampleGroupScrollStable(page, label) {
  const result = await page.evaluate(async () => {
    const grid = document.querySelector("#studioSampleSection .sample-group-grid");
    const cards = [...document.querySelectorAll("#samplePreviewPanel [data-studio-sample-group]")];
    if (!grid || cards.length < 8) return { skipped: true };
    grid.scrollTop = grid.scrollHeight;
    const before = grid.scrollTop;
    cards.at(-2)?.click();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return {
      before,
      after: document.querySelector("#studioSampleSection .sample-group-grid")?.scrollTop || 0
    };
  });
  if (!result.skipped && Math.abs(result.after - result.before) > 2) {
    throw new Error(`${label}: sample group selection should not bounce the left list back to top`);
  }
}

async function expectStudioSamplePortraitCrop(page, label) {
  const metrics = await page.evaluate(() => {
    const ratio = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return rect.width / Math.max(1, rect.height);
    };
    const objectPosition = (selector) => {
      const element = document.querySelector(selector);
      return element ? getComputedStyle(element).objectPosition : "";
    };
    return {
      sceneCoverRatio: ratio("#studioSampleSection .scene-pack-cover"),
      groupImageRatio: ratio("#studioSampleSection .sample-group-card img"),
      stageRatio: ratio("#studioSampleSection .sample-group-stage"),
      thumbRatio: ratio("#studioSampleSection .sample-photo-card img"),
      groupImagePosition: objectPosition("#studioSampleSection .sample-group-card img"),
      stagePosition: objectPosition("#studioSampleSection .sample-group-stage img")
    };
  });
  const ratios = [metrics.sceneCoverRatio, metrics.groupImageRatio, metrics.stageRatio, metrics.thumbRatio].filter((item) => Number.isFinite(item));
  if (ratios.some((item) => item > 1.18)) {
    throw new Error(`${label}: sample images should be square/portrait-friendly, not wide strips`);
  }
  if (!metrics.groupImagePosition.includes("42%") || !metrics.stagePosition.includes("42%")) {
    throw new Error(`${label}: sample image crop should stay centered around faces`);
  }
}

async function expectStudioSampleColumnsAligned(page, label) {
  const metrics = await page.evaluate(() => {
    const box = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, height: rect.height };
    };
    return {
      groupGrid: box("#studioSampleSection .sample-group-grid"),
      detail: box("#studioSampleSection .sample-group-detail")
    };
  });
  if (!metrics.groupGrid || !metrics.detail) {
    throw new Error(`${label}: sample columns should both exist for alignment`);
  }
  const topDelta = Math.abs(metrics.groupGrid.top - metrics.detail.top);
  const bottomDelta = Math.abs(metrics.groupGrid.bottom - metrics.detail.bottom);
  if (topDelta > 2 || bottomDelta > 2) {
    throw new Error(`${label}: sample left list should align with the right preview column`);
  }
}

async function expectPrimaryTabs(page, label) {
  const tabs = await page.locator(".primary-nav [data-tab]").evaluateAll((items) => items.map((item) => ({
    tab: item.dataset.tab,
    text: item.textContent?.trim()
  })));
  const expected = [
    ["home", "首页"],
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

async function expectTemplateCollectionBackgrounds(page, label) {
  await page.waitForFunction(() => {
    const cards = Array.from(document.querySelectorAll("#templateCollections .template-collection-card"));
    if (cards.length < 20) return false;
    return cards.every((card) => {
      const image = card.querySelector("img");
      if (!image) return false;
      const target = image.dataset.originalSrc || image.getAttribute("src") || "";
      if (!target || target.startsWith("data:")) return false;
      if (new URL(target, location.href).origin !== location.origin) return false;
      const rect = card.getBoundingClientRect();
      const nearViewport = rect.bottom > -220 && rect.top < window.innerHeight + 220;
      if (!nearViewport) return true;
      const current = image.getAttribute("src") || "";
      return !current.startsWith("data:") && image.complete && image.naturalWidth > 20 && image.naturalHeight > 20;
    });
  }, null, { timeout: 15_000 }).catch(async () => {
    const details = await page.locator("#templateCollections .template-collection-card").evaluateAll((cards) => cards.map((card) => {
      const image = card.querySelector("img");
      const rect = card.getBoundingClientRect();
      return {
        label: card.querySelector("span")?.textContent?.trim() || "",
        src: image?.getAttribute("src") || "",
        target: image?.dataset.originalSrc || "",
        nearViewport: rect.bottom > -220 && rect.top < window.innerHeight + 220,
        loaded: Boolean(image?.complete && image.naturalWidth > 20 && image.naturalHeight > 20)
      };
    }));
    throw new Error(`${label}: template categories should have local lazy-load targets and loaded near-viewport images: ${JSON.stringify(details)}`);
  });
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
    const imageOne = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#f7efe3" />
            <stop offset="100%" stop-color="#d7e9f2" />
          </linearGradient>
        </defs>
        <rect width="1200" height="900" fill="url(#g)" />
        <rect x="120" y="140" width="360" height="260" rx="28" fill="#ffffff" fill-opacity="0.74" />
        <rect x="120" y="470" width="960" height="140" rx="28" fill="#ffffff" fill-opacity="0.72" />
        <circle cx="930" cy="230" r="120" fill="#7b5cff" fill-opacity="0.24" />
        <text x="150" y="562" font-size="72" font-family="Arial, sans-serif" fill="#2a2a2a">RESULT 1</text>
      </svg>
    `)}`;
    const imageTwo = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#f2f5ff" />
            <stop offset="100%" stop-color="#eef7ef" />
          </linearGradient>
        </defs>
        <rect width="1200" height="900" fill="url(#g)" />
        <rect x="110" y="130" width="980" height="180" rx="32" fill="#ffffff" fill-opacity="0.72" />
        <rect x="110" y="370" width="420" height="380" rx="32" fill="#ffffff" fill-opacity="0.68" />
        <rect x="590" y="370" width="500" height="380" rx="32" fill="#ffffff" fill-opacity="0.68" />
        <text x="150" y="246" font-size="64" font-family="Arial, sans-serif" fill="#263238">RESULT 2</text>
      </svg>
    `)}`;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        images: [imageOne, imageTwo],
        revisedPrompt: "default direct create visual check",
        creditCost: 40,
        creditUnitCost: 20,
        creditBalance: 460,
        historySaved: true
      })
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
  await expectText(page, "#generatePanel", "补充效果", "direct create: generate panel should show prompt supplement block");
  await expectText(page, "#generatePanel", "当前结果", "direct create: generate panel should expose result area");
  await page.fill("#promptInput", "default direct create visual check");
  await expectGenerateEnabled(page, "direct create: generate button stayed disabled");
  await clickFirst(page, "#generateBtn", "direct create: missing generate button");
  await page.waitForFunction(() => document.querySelector("#generateResultSection img"));
  await expectVisible(page, "#generateResultSection", "direct create: result panel missing");
  await expectVisible(page, "#generateResultSection img", "direct create: generated image missing");
  await expectText(page, "#generateResultSection", "当前结果", "direct create: result panel should expose the current result label");
  if (!capturedGenerate?.prompt?.includes("default direct create visual check")) throw new Error("direct create: prompt was not submitted");
  if (capturedGenerate?.settings?.apiUrl !== "https://img.inklens.art/v1") throw new Error("direct create: generate request did not carry the default API URL");
  if (capturedGenerate?.settings?.modelId !== "gpt-image-2") throw new Error("direct create: generate request did not carry the default image model");
  const screenshot = join(outDir, "direct-create-result.png");
  await page.screenshot({ path: screenshot, fullPage: true });
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
        images: ["/assets/icon-192.png"],
        createdAt: Date.now(),
        finishedAt: Date.now()
      }
    ]));
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  if (pageErrors.length) throw new Error(`image preview: page script error: ${pageErrors.join("; ")}`);
  await clickFirst(page, ".primary-nav [data-tab='history']", "image preview: missing history primary tab");
  await page.waitForFunction(() => document.querySelector("#historyList [data-preview-task='download-preview-task']") && document.querySelector("#historyList [data-download-task='download-preview-task']"), null, { timeout: 5_000 });
  await expectVisible(page, "#historyList [data-preview-task='download-preview-task']", "image preview: missing preview button");
  await expectVisible(page, "#historyList [data-download-task='download-preview-task']", "image preview: missing card download button");
  await clickFirst(page, "#historyList [data-preview-task='download-preview-task']", "image preview: preview click failed");
  await expectVisible(page, ".image-preview-modal", "image preview: modal did not open");
  await page.waitForSelector(".image-preview-frame img", { state: "visible", timeout: 5_000 });
  await expectVisible(page, ".image-preview-frame img", "image preview: modal image missing");
  const downloadPromise = page.waitForEvent("download");
  await clickFirst(page, "#imagePreviewDownload", "image preview: missing preview download button");
  const download = await downloadPromise;
  const suggested = download.suggestedFilename();
  if (!/^pic-\d{8}-\d{6}-1\.png$/.test(suggested)) throw new Error(`image preview: unexpected download filename ${suggested}`);
  await clickFirst(page, "#imagePreviewEdit", "image preview: missing preview edit button");
  await expectHidden(page, ".image-preview-modal", "image preview: modal did not close");
  await expectText(page, "#editModeState", "已上传 1 张照片", "image preview: edit mode did not activate");
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
  await page.waitForFunction(() => document.querySelector("#editModeState")?.textContent?.includes("已上传 1 张照片"));
  await expectText(page, "#editModeState", "已上传 1 张照片", "known upload: edit mode did not activate");
  await expectVisible(page, "#referenceList .reference-item img", "known upload: uploaded preview missing");
  await clickFirst(page, "[data-prompt-option='background']", "known upload: background option missing");
  await expectText(page, "#promptOptionPreview", "已加效果", "known upload: prompt option summary missing");
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
