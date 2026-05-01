const keys = {
  settings: "pic.native.settings",
  params: "pic.native.params",
  history: "pic.native.history",
  deletedHistory: "pic.native.deletedHistory",
  studio: "pic.native.studio"
};

const appVersion = "20260502-personal-studio";
const legacyHistoryKeys = ["alexai-replica-tasks", "gpt-image-node-tasks"];
const referenceImageLimits = {
  maxEdge: 2048,
  maxBytes: 18 * 1024 * 1024,
  jpegQuality: 0.9
};

const defaults = {
  settings: { apiUrl: "https://alexai.work/v1", apiKey: "", apiMode: "images", mainModelId: "gpt-5.5", modelId: "gpt-image-2", timeoutSeconds: 120 },
  params: { size: "auto", quality: "auto", outputFormat: "png", count: 1 },
  studio: { selectedSceneId: "wedding", identityStatus: "待上传", selectedSampleId: "", referenceCount: 0, deliveryReadyCount: 0 },
  credits: { balance: 0, ledger: [], packages: [], updatedAt: "" }
};

const studioFlow = [
  { key: "scene", title: "选场景", note: "婚纱、情侣、闺蜜等" },
  { key: "identity", title: "数字底片", note: "先确认像本人" },
  { key: "sample", title: "样片方向", note: "选 1-3 个风格" },
  { key: "batch", title: "批量成片", note: "确认后再生成" },
  { key: "delivery", title: "交付", note: "只放最终可用图" }
];

const scenePacks = [
  {
    id: "wedding",
    name: "婚纱照",
    audience: "新人、纪念日、婚登照",
    people: "双人",
    recommendedShots: "24-36 张",
    status: "优先",
    samples: [
      { id: "chinese", title: "中式礼服", tags: "秀禾、旗袍、红金仪式感", query: "中式婚礼 写真 情侣", prompt: "以已确认的两位数字底片为身份锚点，生成一组中式婚礼写真样片。新娘穿高级秀禾或旗袍，新郎穿合身中式礼服，红金配色克制，脸部清晰像本人，真实皮肤质感，姿态自然，不要影楼站桩，不要夸张磨皮。" },
      { id: "travel", title: "旅拍大片", tags: "目的地、自然互动、电影感", query: "婚纱 旅拍 情侣", prompt: "以已确认的情侣数字底片为身份锚点，生成目的地婚纱旅拍样片。真实旅拍光线，自然牵手互动，婚纱材质高级，地标背景可信，脸部清晰像本人，避免游客打卡感和假背景。" },
      { id: "registry", title: "婚登照", tags: "干净、亲密、可分享", query: "婚登照 情侣 写真", prompt: "以两位数字底片为身份锚点，生成干净高级的婚登纪念照样片。浅色背景，亲密但克制的双人构图，服装整洁，五官清晰像本人，适合社交分享，不要证件照僵硬感。" }
    ]
  },
  {
    id: "couple",
    name: "情侣照",
    audience: "情侣、纪念日、旅行记录",
    people: "双人",
    recommendedShots: "18-30 张",
    status: "可用",
    samples: [
      { id: "daily", title: "日常胶片", tags: "街拍、松弛、真实关系", query: "情侣 日常 胶片", prompt: "以两位数字底片为身份锚点，生成情侣日常胶片写真样片。城市街头或咖啡馆环境，自然说笑互动，色彩柔和，脸部像本人，关系亲密但不摆拍。" },
      { id: "travel", title: "旅行同行", tags: "牵手、远景、目的地", query: "情侣 旅行 写真", prompt: "以情侣数字底片为身份锚点，生成旅行情侣写真样片。两人并肩或牵手走在目的地街道，背景真实，服装协调，脸部清晰，避免网红打卡姿势。" },
      { id: "cinema", title: "电影情绪", tags: "夜景、眼神、故事感", query: "情侣 电影感 写真", prompt: "以两位数字底片为身份锚点，生成电影感情侣写真样片。低饱和城市夜景或室内窗光，眼神自然，有安静故事感，脸像本人，避免夸张亲吻和戏剧化表情。" }
    ]
  },
  {
    id: "friends",
    name: "闺蜜照",
    audience: "好友、生日、旅行合照",
    people: "双人/多人",
    recommendedShots: "12-24 张",
    status: "可用",
    samples: [
      { id: "studio", title: "棚拍合照", tags: "干净、亲密、杂志感", query: "闺蜜照 棚拍 写真", prompt: "以已确认的闺蜜数字底片为身份锚点，生成棚拍闺蜜写真样片。两人亲密朋友关系，自然靠近但不僵硬，服装同系列但不完全相同，脸部各自像本人，不串脸。" },
      { id: "street", title: "城市街拍", tags: "走路、说笑、轻纪实", query: "闺蜜照 街拍", prompt: "以闺蜜数字底片为身份锚点，生成城市街拍闺蜜写真样片。两人边走边笑，动作自然，有轻纪实感，背景有生活气，脸部清晰且身份不混淆。" },
      { id: "birthday", title: "生日派对", tags: "庆祝、蛋糕、温暖", query: "闺蜜 生日 写真", prompt: "以闺蜜数字底片为身份锚点，生成生日纪念写真样片。小型派对场景，蛋糕、花束和暖光，情绪真实，五官像本人，避免过度装饰和廉价影棚感。" }
    ]
  },
  {
    id: "child10",
    name: "儿童 10 岁照",
    audience: "成长纪念、生日、亲子",
    people: "单人/亲子",
    recommendedShots: "12-24 张",
    status: "可用",
    samples: [
      { id: "campus", title: "校园成长", tags: "书包、操场、自然笑容", query: "10岁 儿童 写真 校园", prompt: "以儿童数字底片为身份锚点，生成 10 岁成长纪念样片。校园或操场环境，自然笑容，服装干净，年龄感准确，脸像本人，不要成人化妆容。" },
      { id: "birthday", title: "生日纪念", tags: "蛋糕、家庭、明亮", query: "儿童 生日 写真", prompt: "以儿童数字底片为身份锚点，生成 10 岁生日纪念写真样片。明亮室内或户外，蛋糕和气球克制点缀，孩子表情自然，身份像本人，画面温暖不幼稚。" },
      { id: "outdoor", title: "户外奔跑", tags: "草地、阳光、活力", query: "儿童 户外 写真", prompt: "以儿童数字底片为身份锚点，生成户外成长写真样片。自然阳光、草地或公园，轻跑或回头笑，脸部清晰，动作真实，避免夸张童话滤镜。" }
    ]
  },
  {
    id: "portrait",
    name: "女生写真",
    audience: "个人形象、生日、社交头像",
    people: "单人",
    recommendedShots: "12-24 张",
    status: "可用",
    samples: [
      { id: "french", title: "法式胶片", tags: "慵懒、自然、轻复古", query: "女生写真 法式 胶片", prompt: "以已确认的单人数字底片为身份锚点，生成法式胶片女生写真样片。自然妆发，轻复古服装，窗边或街角光线，脸像本人，皮肤真实，不要网红过度磨皮。" },
      { id: "magazine", title: "杂志肖像", tags: "高级、干净、强质感", query: "女生写真 杂志 肖像", prompt: "以单人数字底片为身份锚点，生成高级杂志肖像样片。干净背景，精致但不过度的妆发，五官清晰像本人，构图克制，避免塑料皮肤和夸张脸型。" },
      { id: "guofeng", title: "轻国风", tags: "中式、素雅、东方气质", query: "女生写真 国风", prompt: "以单人数字底片为身份锚点，生成轻国风女生写真样片。素雅中式服装或改良旗袍，浅色背景，东方气质克制，脸像本人，不要戏服化和夸张古装。" }
    ]
  },
  {
    id: "senior",
    name: "夕阳红",
    audience: "父母纪念照、双人合照、家庭",
    people: "双人/家庭",
    recommendedShots: "18-30 张",
    status: "可用",
    samples: [
      { id: "anniversary", title: "纪念合照", tags: "端庄、温暖、真实", query: "夕阳红 纪念照", prompt: "以两位长辈数字底片为身份锚点，生成夕阳红纪念合照样片。端庄温暖的室内或园林环境，表情自然，年龄感真实，脸像本人，不要过度年轻化。" },
      { id: "travel", title: "旅行留念", tags: "景点、牵手、轻松", query: "夕阳红 旅行 写真", prompt: "以长辈数字底片为身份锚点，生成旅行纪念写真样片。两人自然站立或牵手，背景是可信的旅行地点，服装得体，脸部清晰，避免假景区背景。" },
      { id: "qipao", title: "旗袍礼服", tags: "中式、仪式、优雅", query: "夕阳红 旗袍 写真", prompt: "以长辈数字底片为身份锚点，生成中式旗袍礼服纪念照样片。服装高级合身，光线柔和，人物端庄亲切，年龄感准确，脸像本人，不要过度美颜。" }
    ]
  }
];

const state = {
  tab: "studio",
  templates: [],
  query: "",
  category: "all",
  featuredOnly: false,
  limit: 24,
  prompt: "",
  settings: applyQuerySettings(loadSettings()),
  params: readStore(keys.params, defaults.params),
  references: [],
  historyMode: "active",
  history: normalizeStoredHistory(readStore(keys.history, [])),
  deletedHistory: normalizeStoredHistory(readStore(keys.deletedHistory, [])),
  studio: normalizeStudio(readStore(keys.studio, defaults.studio)),
  credits: { ...defaults.credits },
  creditEstimate: null,
  creditEstimateError: ""
};

const dom = {};
let generationTimerId = 0;
let creditEstimateTimerId = 0;
let generationRunning = false;

document.addEventListener("DOMContentLoaded", () => {
  for (const id of [
    "statusLine", "studioPanel", "studioStartBtn", "studioFlow", "scenePackGrid", "openTemplateLibraryBtn", "identitySummary",
    "identityStatusChip", "identityCheckGrid", "studioReferenceInput", "confirmIdentityBtn", "sampleSummary", "sampleDirectionList",
    "deliverySceneCount", "deliverySampleCount", "deliveryReadyCount", "studioGenerateBtn", "templatesPanel", "generatePanel", "templateSearch", "categoryFilter", "featuredOnly",
    "templateGrid", "templateCount", "templateHint", "loadMoreBtn", "promptInput", "qualitySelect",
    "formatSelect", "countInput", "sizeInput", "editImageInput", "editModeState", "referenceInput", "referenceList", "generateBtn",
    "generationTimer", "historyList", "historyCount", "clearHistoryBtn", "deletedHistoryBtn", "openSettingsBtn", "testConnectionBtn",
    "openSizeBtn", "creditCostBar", "creditCostStatus", "creditRechargeShortcut", "openCreditsBtn", "topCreditBalance", "creditsPanel", "creditRefreshBtn", "creditUpdatedAt", "creditBalance",
    "creditStatus", "creditPackages", "creditLedger", "creditLedgerCount", "modalRoot"
  ]) dom[id] = document.getElementById(id);
  dom.tabs = Array.from(document.querySelectorAll(".tab"));
  bindEvents();
  syncControls();
  renderAll();
  loadTemplates();
  void loadPersistentHistory();
  void loadCredits();
});

function bindEvents() {
  dom.tabs.forEach((tab) => tab.addEventListener("click", () => switchTab(tab.dataset.tab)));
  dom.studioStartBtn.addEventListener("click", () => dom.scenePackGrid.scrollIntoView({ behavior: "smooth", block: "start" }));
  dom.openTemplateLibraryBtn.addEventListener("click", () => switchTab("templates"));
  dom.studioReferenceInput.addEventListener("change", () => addStudioReferences(dom.studioReferenceInput));
  dom.confirmIdentityBtn.addEventListener("click", () => saveStudio({ identityStatus: "已确认" }));
  dom.studioGenerateBtn.addEventListener("click", () => useStudioSample());
  dom.templateSearch.addEventListener("input", () => {
    state.query = dom.templateSearch.value;
    state.limit = 24;
    renderTemplates();
  });
  dom.categoryFilter.addEventListener("change", () => {
    state.category = dom.categoryFilter.value;
    state.limit = 24;
    renderTemplates();
  });
  dom.featuredOnly.addEventListener("change", () => {
    state.featuredOnly = dom.featuredOnly.checked;
    state.limit = 24;
    renderTemplates();
  });
  dom.loadMoreBtn.addEventListener("click", () => {
    state.limit += 24;
    renderTemplates();
  });
  dom.promptInput.addEventListener("input", () => {
    state.prompt = dom.promptInput.value;
  });
  dom.qualitySelect.addEventListener("change", () => saveParams({ quality: dom.qualitySelect.value }));
  dom.formatSelect.addEventListener("change", () => saveParams({ outputFormat: dom.formatSelect.value }));
  dom.countInput.addEventListener("input", () => saveParams({ count: clamp(Number(dom.countInput.value), 1, 4) }));
  dom.editImageInput.addEventListener("change", () => void addReferences(dom.editImageInput, { replace: true, source: "edit" }));
  dom.referenceInput.addEventListener("change", () => void addReferences(dom.referenceInput, { source: "reference" }));
  dom.generateBtn.addEventListener("click", () => void generateImage());
  dom.clearHistoryBtn.addEventListener("click", clearHistory);
  dom.deletedHistoryBtn.addEventListener("click", toggleDeletedHistory);
  dom.openSettingsBtn.addEventListener("click", openSettings);
  dom.testConnectionBtn.addEventListener("click", () => void testConnection());
  dom.openSizeBtn.addEventListener("click", openSize);
  dom.creditRechargeShortcut.addEventListener("click", () => switchTab("credits"));
  dom.openCreditsBtn.addEventListener("click", () => switchTab("credits"));
  dom.creditRefreshBtn.addEventListener("click", () => void loadCredits({ announce: true }));
}

async function loadTemplates() {
  status("模板读取中");
  try {
    const response = await fetch("/api/templates", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    state.templates = normalizeTemplates(await response.json());
    renderCategories();
    renderTemplates();
    status(`已读取 ${state.templates.length} 个模板`);
  } catch (error) {
    state.templates = [];
    renderCategories();
    renderTemplates(errorMessage(error));
    status("模板读取失败");
  }
}

function normalizeTemplates(data) {
  const list = Array.isArray(data) ? data : data.templates || data.data || data.items || [];
  return list.map((item, index) => {
    const prompt = String(item.prompt || item.content || item.text || "");
    const promptPreview = String(item.promptPreview || item.preview || prompt || "");
    const template = {
      id: String(item.id || item.slug || `tpl-${index + 1}`),
      title: String(item.title || item.name || `模板 ${index + 1}`),
      category: String(item.category || item.type || "未分类"),
      description: String(item.description || item.summary || ""),
      prompt,
      promptPreview,
      promptLength: Number(item.promptLength) || prompt.length || promptPreview.length,
      imageUrl: String(item.imageUrl || item.image || item.thumbnail || ""),
      featured: Boolean(item.featured || item.isFeatured || item.recommended),
      language: String(item.language || "")
    };
    return { ...template, searchText: templateSearchText(template) };
  }).filter((item) => item.id && item.title);
}

function templateSearchText(item) {
  return [
    item.title,
    item.category,
    item.description,
    item.language,
    item.prompt || item.promptPreview
  ].join(" ").toLowerCase();
}

function renderAll() {
  renderStudio();
  renderTabs();
  renderCategories();
  renderTemplates();
  renderReferences();
  renderHistory();
  renderCredits();
}

function renderTabs() {
  dom.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === state.tab));
  dom.studioPanel.hidden = state.tab !== "studio";
  dom.templatesPanel.hidden = state.tab !== "templates";
  dom.generatePanel.hidden = state.tab !== "generate";
  dom.creditsPanel.hidden = state.tab !== "credits";
  dom.studioPanel.classList.toggle("active", state.tab === "studio");
  dom.templatesPanel.classList.toggle("active", state.tab === "templates");
  dom.generatePanel.classList.toggle("active", state.tab === "generate");
  dom.creditsPanel.classList.toggle("active", state.tab === "credits");
}

function renderStudio() {
  const scene = selectedStudioScene();
  const sample = selectedStudioSample(scene);
  const identityReady = state.studio.identityStatus === "已确认";
  dom.studioFlow.innerHTML = studioFlow.map((step, index) => studioFlowStep(step, index, scene, sample, identityReady)).join("");
  dom.scenePackGrid.innerHTML = scenePacks.map((item) => scenePackCard(item)).join("");
  dom.scenePackGrid.querySelectorAll("[data-studio-scene]").forEach((button) => {
    button.addEventListener("click", () => saveStudio({ selectedSceneId: button.dataset.studioScene, selectedSampleId: "" }));
  });
  dom.identitySummary.textContent = `${state.studio.referenceCount || 0} 张参考照 · ${identityHelpText(state.studio.identityStatus)}`;
  dom.identityStatusChip.textContent = state.studio.identityStatus;
  dom.identityStatusChip.className = `status-chip ${identityReady ? "ready" : state.studio.identityStatus === "需返修" ? "danger" : "pending"}`;
  dom.identityCheckGrid.innerHTML = identityChecks(identityReady).map((item) => `
    <button class="identity-check ${item.active ? "active" : ""}" data-identity-status="${attr(item.status)}" type="button">
      <strong>${esc(item.status)}</strong>
      <span>${esc(item.note)}</span>
    </button>`).join("");
  dom.identityCheckGrid.querySelectorAll("[data-identity-status]").forEach((button) => {
    button.addEventListener("click", () => saveStudio({ identityStatus: button.dataset.identityStatus }));
  });
  dom.sampleSummary.textContent = `${scene.name} · 推荐 ${scene.samples.length} 个样片方向`;
  dom.sampleDirectionList.innerHTML = scene.samples.map((item) => sampleDirectionCard(scene, item)).join("");
  dom.sampleDirectionList.querySelectorAll("[data-studio-sample]").forEach((button) => {
    button.addEventListener("click", () => saveStudio({ selectedSampleId: button.dataset.studioSample }));
  });
  dom.deliverySceneCount.textContent = scene ? "1" : "0";
  dom.deliverySampleCount.textContent = sample ? "1" : "0";
  dom.deliveryReadyCount.textContent = identityReady && sample ? String(scene.recommendedShots.match(/\d+/)?.[0] || 0) : "0";
  dom.studioGenerateBtn.disabled = !(identityReady && sample);
  dom.studioGenerateBtn.textContent = identityReady && sample ? "用样片方向生成" : "先确认底片和样片";
}

function studioFlowStep(step, index, scene, sample, identityReady) {
  const activeIndex = sample && identityReady ? 3 : identityReady ? 2 : scene ? 1 : 0;
  const complete = index < activeIndex;
  const active = index === activeIndex;
  return `
    <article class="studio-flow-step ${complete ? "complete" : ""} ${active ? "active" : ""}">
      <strong>${index + 1}. ${esc(step.title)}</strong>
      <span>${esc(step.note)}</span>
    </article>`;
}

function scenePackCard(scene) {
  const selected = scene.id === state.studio.selectedSceneId;
  return `
    <article class="scene-pack-card ${selected ? "selected" : ""}">
      <div class="scene-pack-head">
        <span>${esc(scene.people)}</span>
        <em>${esc(scene.status)}</em>
      </div>
      <h3>${esc(scene.name)}</h3>
      <p>${esc(scene.audience)}</p>
      <div class="scene-pack-meta">
        <span>${esc(scene.recommendedShots)}</span>
        <span>${scene.samples.length} 个样片方向</span>
      </div>
      <button class="${selected ? "primary-btn" : "ghost-btn"} small" data-studio-scene="${attr(scene.id)}" type="button">${selected ? "当前场景" : "选择场景"}</button>
    </article>`;
}

function sampleDirectionCard(scene, sample) {
  const selected = sample.id === state.studio.selectedSampleId;
  return `
    <article class="sample-direction-card ${selected ? "selected" : ""}">
      <div>
        <strong>${esc(sample.title)}</strong>
        <span>${esc(sample.tags)}</span>
      </div>
      <button class="${selected ? "primary-btn" : "ghost-btn"} small" data-studio-sample="${attr(sample.id)}" type="button">${selected ? "已选" : "选择"}</button>
    </article>`;
}

function addStudioReferences(input) {
  const count = Array.from(input?.files || []).filter((file) => file?.type?.startsWith("image/")).length;
  if (!count) return;
  saveStudio({ referenceCount: (state.studio.referenceCount || 0) + count, identityStatus: "待确认" });
  status(`已记录 ${count} 张参考照，下一步确认数字底片`);
  input.value = "";
}

function useStudioSample() {
  const scene = selectedStudioScene();
  const sample = selectedStudioSample(scene);
  if (state.studio.identityStatus !== "已确认" || !sample) {
    status("先确认数字底片并选择样片方向");
    return;
  }
  state.prompt = buildStudioPrompt(scene, sample);
  dom.promptInput.value = state.prompt;
  switchTab("generate");
  dom.promptInput.focus();
  status(`已填入 ${scene.name} · ${sample.title} 样片方向`);
}

function buildStudioPrompt(scene, sample) {
  return [
    `场景包：${scene.name}`,
    `样片方向：${sample.title}`,
    `身份要求：使用已确认的数字底片作为唯一身份锚点，脸部必须像本人，年龄感、脸型、眼睛、鼻子、嘴型和气质不能明显漂移。`,
    `交付目标：先生成小批样片，便于客户确认风格；画面要像真实摄影棚/旅拍交付图，不要像普通 AI 拼贴。`,
    `画面提示：${sample.prompt}`,
    `质量约束：真实皮肤质感，手部自然，服装合身，背景可信，构图紧凑高级。`,
    `负面约束：不要过度磨皮，不要塑料皮肤，不要影楼站桩，不要假背景，不要五官漂移，不要多人串脸。`
  ].join("\n\n");
}

function selectedStudioScene() {
  return scenePacks.find((item) => item.id === state.studio.selectedSceneId) || scenePacks[0];
}

function selectedStudioSample(scene = selectedStudioScene()) {
  return scene.samples.find((item) => item.id === state.studio.selectedSampleId) || null;
}

function saveStudio(patch) {
  state.studio = normalizeStudio({ ...state.studio, ...patch });
  tryWriteStore(keys.studio, state.studio);
  renderStudio();
}

function normalizeStudio(value) {
  const source = value && typeof value === "object" ? value : {};
  const selectedSceneId = scenePacks.some((item) => item.id === source.selectedSceneId) ? source.selectedSceneId : defaults.studio.selectedSceneId;
  const scene = scenePacks.find((item) => item.id === selectedSceneId) || scenePacks[0];
  const selectedSampleId = scene.samples.some((item) => item.id === source.selectedSampleId) ? source.selectedSampleId : "";
  const identityStatuses = ["待上传", "待生成", "待确认", "已确认", "需返修"];
  return {
    selectedSceneId,
    identityStatus: identityStatuses.includes(source.identityStatus) ? source.identityStatus : defaults.studio.identityStatus,
    selectedSampleId,
    referenceCount: clamp(Number(source.referenceCount || 0), 0, 99),
    deliveryReadyCount: clamp(Number(source.deliveryReadyCount || 0), 0, 999)
  };
}

function identityHelpText(statusValue) {
  return {
    "待上传": "先上传正脸、半身和全身参考照",
    "待生成": "参考照已准备，待生成三视图",
    "待确认": "三视图或底片样张需要确认",
    "已确认": "可进入样片方向和批量成片",
    "需返修": "身份不像或比例异常，需要重做"
  }[statusValue] || "待上传参考照";
}

function identityChecks(identityReady) {
  return [
    { status: "待上传", note: "还没有参考照", active: state.studio.identityStatus === "待上传" },
    { status: "待确认", note: "检查是否像本人", active: state.studio.identityStatus === "待确认" },
    { status: "已确认", note: identityReady ? "可生成样片" : "通过后再成片", active: state.studio.identityStatus === "已确认" },
    { status: "需返修", note: "脸不像或串脸", active: state.studio.identityStatus === "需返修" }
  ];
}

function renderCategories() {
  const counts = categoryCounts(state.templates);
  const categories = [...counts.keys()].sort((a, b) => a.localeCompare(b, "zh-CN"));
  dom.categoryFilter.innerHTML = `<option value="all">全部分类 (${state.templates.length})</option>${categories.map((item) => `<option value="${esc(item)}">${esc(item)} (${counts.get(item) || 0})</option>`).join("")}`;
  if (!categories.includes(state.category)) state.category = "all";
  dom.categoryFilter.value = state.category;
}

function categoryCounts(templates) {
  const counts = new Map();
  for (const item of templates) counts.set(item.category, (counts.get(item.category) || 0) + 1);
  return counts;
}

function renderTemplates(error = "") {
  const filtered = filterTemplates();
  const visible = filtered.slice(0, state.limit);
  dom.templateCount.textContent = `${filtered.length} / ${state.templates.length} 个模板`;
  dom.templateHint.textContent = state.featuredOnly ? "当前只显示精选模板" : "支持搜索、分类和精选筛选";
  dom.loadMoreBtn.hidden = filtered.length <= visible.length;
  if (error) {
    dom.templateGrid.innerHTML = empty(`模板读取失败：${error}`);
    return;
  }
  if (!state.templates.length) {
    dom.templateGrid.innerHTML = empty("暂无模板数据");
    return;
  }
  if (!visible.length) {
    dom.templateGrid.innerHTML = empty("没有匹配模板");
    return;
  }
  dom.templateGrid.innerHTML = visible.map(templateCard).join("");
  dom.templateGrid.querySelectorAll("[data-use-template]").forEach((button) => {
    button.addEventListener("click", () => void useTemplate(button.dataset.useTemplate));
  });
  hydrateTemplateImages();
}

function filterTemplates() {
  const keyword = state.query.trim().toLowerCase();
  return state.templates.filter((item) => {
    if (state.category !== "all" && item.category !== state.category) return false;
    if (state.featuredOnly && !item.featured) return false;
    if (!keyword) return true;
    return item.searchText.includes(keyword);
  });
}

function templateCard(item) {
  const fallback = templateFallbackImage(item);
  const source = templateRemoteImage(item.imageUrl);
  const imageSource = source || fallback;
  const image = `<img src="${attr(imageSource)}" data-fallback="${attr(fallback)}" ${source ? `data-real-image="true"` : ""} alt="${attr(item.title)}" loading="lazy" referrerpolicy="no-referrer" />`;
  const promptPreview = item.promptPreview || item.prompt || "点击使用该提示词模板";
  return `
    <article class="template-card">
      <div class="template-thumb" style="--template-fallback: url('${attr(fallback)}')">${image}</div>
      <div class="template-body">
        <div class="meta-row"><span>${esc(item.category)}</span>${item.featured ? "<span>精选</span>" : ""}${item.language ? `<span>${esc(item.language)}</span>` : ""}</div>
        <h3>${esc(item.title)}</h3>
        <p>${esc(item.description || "点击使用该提示词模板")}</p>
        <pre>${esc(promptPreview)}</pre>
        <button class="primary-btn small" data-use-template="${attr(item.id)}" type="button">使用模板</button>
      </div>
    </article>`;
}

function hydrateTemplateImages() {
  dom.templateGrid.querySelectorAll(".template-thumb img").forEach((img) => {
    const markLoaded = () => img.classList.add("loaded");
    if (img.complete && img.naturalWidth > 0) markLoaded();
    img.addEventListener("load", markLoaded, { once: true });
    img.addEventListener("error", () => {
      if (img.dataset.fallback && img.src !== img.dataset.fallback) {
        img.removeAttribute("data-real-image");
        img.src = img.dataset.fallback;
      }
      markLoaded();
    }, { once: true });
  });
}

function templateRemoteImage(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "cms-assets.youmind.com") {
      return `https://wsrv.nl/?url=${encodeURIComponent(parsed.toString())}&w=720&output=webp`;
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

function templateFallbackImage(item) {
  const palettes = [
    ["#f7efe3", "#9f2f27", "#2f7b68", "#d8a33e"],
    ["#eef7f2", "#1f6f61", "#a93127", "#d9b86c"],
    ["#f3f6fb", "#315f9d", "#b8472d", "#d6a94e"],
    ["#fff3ec", "#bd3b2d", "#196f74", "#efb052"],
    ["#f4efe7", "#654a35", "#b02f24", "#386b5a"]
  ];
  const [bg, main, accent, gold] = palettes[hashText(`${item.category}-${item.title}`) % palettes.length];
  const category = svgText(item.category || "GPT Image 2").slice(0, 18);
  const title = svgText(item.title || "Prompt Template").slice(0, 28);
  const key = `${item.category || ""} ${item.title || ""}`;
  const motif = templateFallbackMotif(key, main, accent, gold);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 600">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${bg}"/>
          <stop offset=".58" stop-color="#fffaf0"/>
          <stop offset="1" stop-color="#e6efe7"/>
        </linearGradient>
        <radialGradient id="sun" cx=".75" cy=".18" r=".38">
          <stop offset="0" stop-color="${gold}" stop-opacity=".55"/>
          <stop offset="1" stop-color="${gold}" stop-opacity="0"/>
        </radialGradient>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#1f2937" flood-opacity=".18"/>
        </filter>
      </defs>
      <rect width="960" height="600" fill="url(#bg)"/>
      <rect width="960" height="600" fill="url(#sun)"/>
      <path d="M-40 470C120 400 224 380 370 414c150 35 255 30 404-50 84-45 156-58 230-46v282H-40Z" fill="${main}" opacity=".13"/>
      <path d="M0 508c128-70 232-92 357-42 114 46 210 38 330-20 100-48 184-44 273-10v164H0Z" fill="${accent}" opacity=".12"/>
      ${motif}
      <rect x="54" y="430" width="852" height="112" rx="24" fill="#ffffff" opacity=".84" filter="url(#soft)"/>
      <rect x="86" y="462" width="178" height="30" rx="15" fill="${accent}" opacity=".92"/>
      <text x="112" y="484" font-family="Arial, sans-serif" font-size="18" font-weight="800" fill="#ffffff">${category}</text>
      <text x="86" y="528" font-family="Arial, sans-serif" font-size="35" font-weight="800" fill="#172033">${title}</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function templateFallbackMotif(value, main, accent, gold) {
  if (/产品|电商|护肤|香水|包装|商品/i.test(value)) {
    return `
      <g filter="url(#soft)">
        <ellipse cx="650" cy="382" rx="190" ry="34" fill="#172033" opacity=".12"/>
        <rect x="574" y="172" width="118" height="228" rx="34" fill="#ffffff" opacity=".96"/>
        <rect x="598" y="126" width="70" height="58" rx="18" fill="${gold}" opacity=".88"/>
        <rect x="594" y="248" width="78" height="20" rx="10" fill="${main}" opacity=".88"/>
        <rect x="612" y="282" width="42" height="10" rx="5" fill="${accent}" opacity=".45"/>
        <path d="M418 370c90-124 210-172 358-138 18 4 30 20 28 38-9 82-113 138-255 145-58 3-104-9-131-45Z" fill="${accent}" opacity=".32"/>
      </g>`;
  }
  if (/UI|App|界面|仪表|直播|网页/i.test(value)) {
    return `
      <g filter="url(#soft)">
        <rect x="170" y="112" width="620" height="310" rx="30" fill="#ffffff" opacity=".92"/>
        <rect x="200" y="148" width="560" height="54" rx="16" fill="${main}" opacity=".9"/>
        <rect x="218" y="232" width="154" height="138" rx="18" fill="${accent}" opacity=".2"/>
        <rect x="402" y="232" width="330" height="42" rx="14" fill="${gold}" opacity=".36"/>
        <rect x="402" y="296" width="252" height="28" rx="14" fill="${main}" opacity=".18"/>
        <rect x="402" y="344" width="296" height="28" rx="14" fill="${main}" opacity=".12"/>
        <circle cx="226" cy="175" r="8" fill="#fffaf0"/><circle cx="250" cy="175" r="8" fill="#fffaf0"/><circle cx="274" cy="175" r="8" fill="#fffaf0"/>
      </g>`;
  }
  if (/信息图|图表|报告|地图|指南|流程/i.test(value)) {
    return `
      <g filter="url(#soft)">
        <rect x="136" y="96" width="688" height="318" rx="30" fill="#ffffff" opacity=".9"/>
        <circle cx="278" cy="242" r="84" fill="${main}" opacity=".16"/>
        <path d="M278 158a84 84 0 1 1-66 136l66-52Z" fill="${accent}" opacity=".78"/>
        <path d="M278 158a84 84 0 0 1 78 54l-78 30Z" fill="${gold}" opacity=".72"/>
        <rect x="442" y="164" width="250" height="28" rx="14" fill="${main}" opacity=".24"/>
        <rect x="442" y="220" width="330" height="28" rx="14" fill="${accent}" opacity=".18"/>
        <rect x="442" y="276" width="194" height="28" rx="14" fill="${gold}" opacity=".34"/>
        <path d="M160 384h616" stroke="${main}" stroke-width="3" opacity=".18"/>
      </g>`;
  }
  if (/头像|人物|写真|肖像|汉服|角色/i.test(value)) {
    return `
      <g filter="url(#soft)">
        <circle cx="474" cy="238" r="132" fill="${gold}" opacity=".22"/>
        <circle cx="474" cy="206" r="58" fill="${main}" opacity=".7"/>
        <path d="M340 394c26-92 92-142 134-142s108 50 134 142H340Z" fill="${accent}" opacity=".74"/>
        <path d="M310 180c108-88 248-88 356 0" fill="none" stroke="${main}" stroke-width="24" stroke-linecap="round" opacity=".18"/>
        <circle cx="608" cy="148" r="28" fill="#fffaf0" opacity=".8"/>
      </g>`;
  }
  if (/食物|餐|美食|菜单|咖啡/i.test(value)) {
    return `
      <g filter="url(#soft)">
        <circle cx="510" cy="266" r="145" fill="#ffffff" opacity=".9"/>
        <circle cx="510" cy="266" r="108" fill="${gold}" opacity=".34"/>
        <path d="M438 286c44-42 96-52 154-26" fill="none" stroke="${main}" stroke-width="28" stroke-linecap="round" opacity=".62"/>
        <circle cx="448" cy="224" r="26" fill="${accent}" opacity=".74"/>
        <circle cx="570" cy="318" r="22" fill="${accent}" opacity=".54"/>
        <path d="M258 140v250M288 140v250M318 140v250" stroke="${main}" stroke-width="12" stroke-linecap="round" opacity=".28"/>
      </g>`;
  }
  return `
    <g filter="url(#soft)">
      <circle cx="706" cy="156" r="72" fill="${gold}" opacity=".45"/>
      <path d="M132 368 312 188l112 126 84-72 318 126H132Z" fill="${main}" opacity=".64"/>
      <path d="M96 384 274 244l126 92 96-78 356 126H96Z" fill="${accent}" opacity=".42"/>
      <path d="M178 150c72-34 134-34 188 0s116 34 188 0" fill="none" stroke="${gold}" stroke-width="18" stroke-linecap="round" opacity=".36"/>
      <rect x="138" y="106" width="258" height="72" rx="22" fill="#ffffff" opacity=".58"/>
    </g>`;
}

function hashText(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  return Math.abs(hash);
}

function svgText(value) {
  return String(value).replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char]));
}

async function useTemplate(id) {
  const item = state.templates.find((template) => template.id === id);
  if (!item) return;
  status(item.prompt ? `已填入模板：${item.title}` : "模板详情读取中");
  try {
    await ensureTemplatePrompt(item);
  } catch (error) {
    status(`模板详情读取失败：${errorMessage(error)}`);
    return;
  }
  state.prompt = item.prompt;
  dom.promptInput.value = item.prompt;
  switchTab("generate");
  dom.promptInput.focus();
  status(`已填入模板：${item.title}`);
}

async function ensureTemplatePrompt(item) {
  if (item.prompt) return item;
  const response = await fetch(`/api/templates/${encodeURIComponent(item.id)}`, { headers: { Accept: "application/json" } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.message || `${response.status} ${response.statusText}`);
  const [template] = normalizeTemplates({ templates: [data.template || data] });
  if (!template?.prompt) throw new Error("模板详情为空");
  Object.assign(item, template);
  return item;
}

function switchTab(tab) {
  state.tab = tab;
  renderTabs();
}

function syncControls() {
  dom.promptInput.value = state.prompt;
  dom.qualitySelect.value = state.params.quality;
  dom.formatSelect.value = state.params.outputFormat;
  dom.countInput.value = String(state.params.count);
  dom.sizeInput.value = state.params.size;
  queueCreditEstimate();
}

function saveParams(patch) {
  state.params = { ...state.params, ...patch, count: clamp(Number({ ...state.params, ...patch }.count), 1, 4) };
  tryWriteStore(keys.params, state.params);
  syncControls();
}

async function addReferences(input = dom.referenceInput, options = {}) {
  const files = Array.from(input?.files || []);
  if (!files.length) return;
  try {
    status("图片读取中");
    const refs = await Promise.all(files.map((file) => readReferenceFile(file, options.source || "reference")));
    state.references = options.replace ? refs : [...state.references, ...refs];
    renderReferences();
    queueCreditEstimate();
    status(options.replace ? `已载入编辑原图：${refs[0]?.name || "图片"}` : `已追加 ${refs.length} 张参考/编辑图`);
  } catch (error) {
    status(`图片上传失败：${errorMessage(error)}`);
  } finally {
    input.value = "";
  }
}

async function readReferenceFile(file, source = "reference") {
  if (!file?.type?.startsWith("image/")) throw new Error("请选择图片文件");
  const normalized = await normalizeReferenceImage(file);
  return {
    id: newReferenceId(),
    name: normalized.name,
    source,
    dataUrl: normalized.dataUrl,
    note: normalized.note
  };
}

async function normalizeReferenceImage(file) {
  const originalType = String(file.type || "").toLowerCase();
  const originalDataUrl = await readFileAsDataUrl(file);
  const supportedOriginal = ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(originalType);
  const decoded = await decodeImageFile(file).catch(() => null);
  if (!decoded) {
    if (!supportedOriginal) throw new Error("该格式无法在浏览器中读取，请换成 JPG、PNG 或 WebP");
    if (file.size > referenceImageLimits.maxBytes) throw new Error("图片过大，请先压缩到 18MB 以内");
    return { name: file.name || "reference.png", dataUrl: originalDataUrl, note: humanBytes(file.size) };
  }
  const { image, width, height, cleanup } = decoded;
  try {
    const needsResize = Math.max(width, height) > referenceImageLimits.maxEdge;
    const needsConvert = !supportedOriginal || file.size > referenceImageLimits.maxBytes;
    if (!needsResize && !needsConvert) {
      return { name: file.name || "reference.png", dataUrl: originalDataUrl, note: `${width}×${height} · ${humanBytes(file.size)}` };
    }
    const scale = Math.min(1, referenceImageLimits.maxEdge / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const dataUrl = await imageToJpegDataUrl(image, targetWidth, targetHeight);
    if (dataUrlBytes(dataUrl) > referenceImageLimits.maxBytes) throw new Error("图片压缩后仍然过大，请换一张更小的图");
    return {
      name: replaceImageExtension(file.name || "reference", "jpg"),
      dataUrl,
      note: `已优化 ${targetWidth}×${targetHeight} · ${humanBytes(dataUrlBytes(dataUrl))}`
    };
  } finally {
    cleanup();
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function decodeImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    const cleanup = () => URL.revokeObjectURL(url);
    image.onload = () => resolve({ image, width: image.naturalWidth || image.width, height: image.naturalHeight || image.height, cleanup });
    image.onerror = () => {
      cleanup();
      reject(new Error("图片读取失败"));
    };
    image.src = url;
  });
}

function imageToJpegDataUrl(image, width, height) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      reject(new Error("浏览器无法处理该图片"));
      return;
    }
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("图片压缩失败"));
        return;
      }
      blobToDataUrl(blob).then(resolve, reject);
    }, "image/jpeg", referenceImageLimits.jpegQuality);
  });
}

function renderReferences() {
  renderEditState();
  if (!state.references.length) {
    dom.referenceList.innerHTML = `<div class="empty-inline">尚未上传参考/编辑图</div>`;
    return;
  }
  dom.referenceList.innerHTML = state.references.map((item) => `
    <article class="reference-item">
      ${item.dataUrl ? `<img src="${attr(item.dataUrl)}" alt="${attr(item.name)}" />` : `<div class="reference-missing">图</div>`}
      <div class="reference-info"><span>${esc(item.name)}</span>${item.note ? `<small>${esc(item.note)}</small>` : ""}</div>
      <button type="button" data-remove-reference="${attr(item.id)}">移除</button>
    </article>`).join("");
  dom.referenceList.querySelectorAll("[data-remove-reference]").forEach((button) => {
    button.addEventListener("click", () => {
      state.references = state.references.filter((item) => item.id !== button.dataset.removeReference);
      renderReferences();
      queueCreditEstimate();
    });
  });
}

function renderEditState() {
  const activeCount = activeReferences().length;
  if (dom.editModeState) {
    dom.editModeState.textContent = activeCount ? `编辑模式 · 已载入 ${activeCount} 张图` : "生成模式 · 上传原图后进入编辑";
  }
  renderCreditEstimate();
}

function activeReferences() {
  return state.references
    .filter((item) => typeof item?.dataUrl === "string" && item.dataUrl.startsWith("data:image/"))
    .map((item) => ({ id: item.id || newReferenceId(), name: item.name || "reference.png", source: item.source || "reference", dataUrl: item.dataUrl }));
}

function newReferenceId() {
  return `ref-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function dataUrlBytes(dataUrl) {
  const base64 = String(dataUrl).split(",", 2)[1] || "";
  return Math.floor((base64.length * 3) / 4);
}

function humanBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)}MB`;
}

function replaceImageExtension(name, extension) {
  const clean = String(name || "reference").replace(/\.[a-z0-9]+$/i, "");
  return `${clean || "reference"}.${extension}`;
}

async function generateImage() {
  if (isCreditBlocked()) {
    status(state.creditEstimate?.shortage ? `积分不足，还差 ${formatCredits(state.creditEstimate.shortage)}` : "积分状态未就绪");
    switchTab("credits");
    return;
  }
  const prompt = state.prompt.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!prompt) {
    status("请输入提示词");
    dom.promptInput.focus();
    return;
  }
  const references = activeReferences();
  const task = { id: `task-${Date.now().toString(36)}`, prompt, params: { ...state.params }, references: [...references], settingsSummary: settingsSummary(state.settings), status: "running", createdAt: Date.now(), images: [], error: "" };
  state.history.unshift(task);
  persistHistory();
  renderHistory();
  startGenerationTimer(task);
  const estimateText = state.creditEstimate?.estimatedCost ? `，预计 ${formatCredits(state.creditEstimate.estimatedCost)}` : "";
  status(`${references.length ? "编辑" : "生成"}请求已提交：${task.settingsSummary}${estimateText}，耗时 00:00`);
  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, createdAt: task.createdAt, prompt, settings: state.settings, params: state.params, references })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const suffix = data.requestId ? `（错误编号：${data.requestId}）` : "";
      throw new Error(`${data.message || data.error || `${response.status} ${response.statusText}`}${suffix}`);
    }
    task.images = normalizeImages(data);
    task.revisedPrompt = data.revisedPrompt || data.revised_prompt || "";
    task.creditCost = Math.max(0, Number(data.creditCost) || 0);
    task.creditUnitCost = Math.max(0, Number(data.creditUnitCost) || 0);
    task.creditLedgerId = String(data.creditLedgerId || "");
    task.status = "succeeded";
    if (Number.isFinite(Number(data.creditBalance))) {
      state.credits.balance = Math.max(0, Number(data.creditBalance) || 0);
      renderCredits();
      queueCreditEstimate();
    } else {
      void loadCredits();
    }
    const creditText = task.creditCost ? `，扣费 ${formatCredits(task.creditCost)}` : "";
    status(task.images.length ? `生成完成：${task.images.length} 张${creditText}，耗时 ${formatElapsed(task)}${data.historySaved === false ? "，历史未入库" : ""}` : `生成完成，但未返回图片，耗时 ${formatElapsed(task)}`);
  } catch (error) {
    task.status = "failed";
    task.error = errorMessage(error);
    void loadCredits();
    status(`生成失败：${task.error}，耗时 ${formatElapsed(task)}`);
  } finally {
    task.finishedAt = Date.now();
    stopGenerationTimer(task);
    persistHistory();
    renderHistory();
  }
}

function normalizeImages(data) {
  const raw = data.images || data.outputImages || data.urls || data.data || data.image || [];
  const images = (Array.isArray(raw) ? raw : [raw]).flatMap((item) => {
    if (typeof item === "string") return [item];
    if (item?.url) return [item.url];
    if (item?.image) return [item.image];
    if (item?.b64_json) return [`data:image/png;base64,${item.b64_json}`];
    return [];
  });
  const invalid = images.find((image) => looksLikeHtmlOutput(image));
  if (invalid) throw new Error(`生成接口返回了 HTML，不是图片：${String(invalid).slice(0, 80)}`);
  return images.filter(Boolean);
}

function looksLikeHtmlOutput(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return false;
  if (text.startsWith("<!doctype html") || text.startsWith("<html") || text.startsWith("<body") || text.startsWith("<h1")) return true;
  if (text.startsWith("data:text/html")) return true;
  try {
    const url = new URL(text, window.location.href);
    return /\.(?:html?|xhtml)$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function renderHistory() {
  const deletedMode = state.historyMode === "deleted";
  const list = currentHistoryList();
  dom.historyCount.textContent = `${list.length} 条${deletedMode ? "已删除" : ""}`;
  dom.clearHistoryBtn.textContent = deletedMode ? "清空已删除" : "清空";
  dom.deletedHistoryBtn.textContent = deletedMode ? "返回" : "已删除";
  if (!list.length) {
    dom.historyList.innerHTML = empty(deletedMode ? "暂无已删除记录" : "暂无生成记录");
    return;
  }
  dom.historyList.innerHTML = list.map(historyCard).join("");
  dom.historyList.querySelectorAll("[data-preview-task]").forEach((button) => {
    button.addEventListener("click", () => openImagePreview(button.dataset.previewTask, Number(button.dataset.previewIndex) || 0));
  });
  dom.historyList.querySelectorAll("[data-download-task]").forEach((button) => {
    button.addEventListener("click", () => downloadTaskImage(button.dataset.downloadTask, Number(button.dataset.downloadIndex) || 0));
  });
  dom.historyList.querySelectorAll("[data-edit-task]").forEach((button) => {
    button.addEventListener("click", () => void editTask(button.dataset.editTask, Number(button.dataset.editIndex) || 0));
  });
  dom.historyList.querySelectorAll("[data-reuse-task]").forEach((button) => button.addEventListener("click", () => reuseTask(button.dataset.reuseTask)));
  dom.historyList.querySelectorAll("[data-delete-task]").forEach((button) => button.addEventListener("click", () => deleteTask(button.dataset.deleteTask)));
  dom.historyList.querySelectorAll("[data-restore-task]").forEach((button) => button.addEventListener("click", () => restoreTask(button.dataset.restoreTask)));
  dom.historyList.querySelectorAll("[data-purge-task]").forEach((button) => button.addEventListener("click", () => purgeTask(button.dataset.purgeTask)));
}

function currentHistoryList() {
  return state.historyMode === "deleted" ? state.deletedHistory : state.history;
}

function startGenerationTimer(task) {
  stopGenerationTimer();
  generationRunning = true;
  dom.generateBtn.disabled = true;
  dom.generateBtn.textContent = "生成中";
  updateGenerationTimer(task);
  generationTimerId = window.setInterval(() => updateGenerationTimer(task), 1000);
}

function stopGenerationTimer(task) {
  if (generationTimerId) {
    window.clearInterval(generationTimerId);
    generationTimerId = 0;
  }
  if (task) updateGenerationTimer(task);
  generationRunning = false;
  if (dom.generateBtn) {
    renderEditState();
  }
}

function updateGenerationTimer(task) {
  if (dom.generationTimer) dom.generationTimer.textContent = formatElapsed(task);
  document.querySelectorAll("[data-elapsed-task]").forEach((item) => {
    const target = state.history.find((taskItem) => taskItem.id === item.dataset.elapsedTask);
    if (target) item.textContent = `耗时 ${formatElapsed(target)}`;
  });
}

async function loadPersistentHistory() {
  try {
    if (state.history.length) {
      await fetch("/api/history/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: state.history })
      });
    }
    const response = await fetch("/api/history", { headers: { Accept: "application/json" } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.message || `${response.status} ${response.statusText}`);
    mergeHistory(Array.isArray(data.history) ? data.history : []);
    await loadDeletedHistory();
    status(state.history.length ? `历史已同步：${state.history.length} 条` : dom.statusLine.textContent);
  } catch (error) {
    status(`历史同步失败：${errorMessage(error)}`);
  }
}

async function loadDeletedHistory() {
  const response = await fetch("/api/history?deleted=1", { headers: { Accept: "application/json" } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.message || `${response.status} ${response.statusText}`);
  mergeDeletedHistory(Array.isArray(data.history) ? data.history : []);
}

function mergeHistory(serverHistory) {
  const byId = new Map();
  for (const task of state.history) byId.set(task.id, normalizeHistoryTask(task));
  for (const task of serverHistory) byId.set(task.id, normalizeHistoryTask(task));
  state.history = [...byId.values()]
    .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0))
    .slice(0, 50);
  const deletedIds = new Set(state.deletedHistory.map((task) => task.id));
  state.history = state.history.filter((task) => !deletedIds.has(task.id));
  persistHistory();
  renderHistory();
}

function mergeDeletedHistory(serverHistory) {
  const byId = new Map();
  for (const task of state.deletedHistory) byId.set(task.id, normalizeHistoryTask({ ...task, deletedAt: task.deletedAt || Date.now() }));
  for (const task of serverHistory) byId.set(task.id, normalizeHistoryTask(task));
  state.deletedHistory = [...byId.values()]
    .sort((left, right) => Number(right.deletedAt || right.createdAt || 0) - Number(left.deletedAt || left.createdAt || 0))
    .slice(0, 100);
  const deletedIds = new Set(state.deletedHistory.map((task) => task.id));
  state.history = state.history.filter((task) => !deletedIds.has(task.id));
  persistHistory();
  persistDeletedHistory();
  renderHistory();
}

function normalizeHistoryTask(task) {
  return {
    id: String(task.id || `task-${Date.now().toString(36)}`),
    prompt: String(task.prompt || ""),
    params: { ...defaults.params, ...(task.params || {}) },
    references: Array.isArray(task.references) ? task.references : [],
    settingsSummary: String(task.settingsSummary || task.settingsSnapshot || ""),
    status: ["running", "succeeded", "failed"].includes(task.status) ? task.status : "succeeded",
    images: Array.isArray(task.images) ? task.images : [],
    error: String(task.error || ""),
    revisedPrompt: String(task.revisedPrompt || ""),
    creditCost: Math.max(0, Number(task.creditCost) || 0),
    creditUnitCost: Math.max(0, Number(task.creditUnitCost) || 0),
    creditLedgerId: String(task.creditLedgerId || ""),
    createdAt: Number(task.createdAt) || Date.now(),
    finishedAt: task.finishedAt ? Number(task.finishedAt) : null,
    deletedAt: task.deletedAt ? Number(task.deletedAt) : null
  };
}

function normalizeStoredHistory(history) {
  return (Array.isArray(history) ? history : [])
    .map(normalizeHistoryTask)
    .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0))
    .slice(0, 50);
}

function historyCard(task) {
  const deletedMode = state.historyMode === "deleted";
  const image = task.images?.[0]
    ? `<button class="image-preview-btn" data-preview-task="${attr(task.id)}" data-preview-index="0" type="button" aria-label="预览图片"><img src="${attr(task.images[0])}" alt="${attr(task.prompt)}" /><span>点击放大</span></button>`
    : `<div class="history-placeholder">${task.status === "running" ? "生成中" : "无图片"}</div>`;
  const settingsPart = task.settingsSummary ? `${esc(task.settingsSummary)} · ` : "";
  const creditPart = task.creditCost ? ` · ${esc(formatCredits(task.creditCost))}` : "";
  const saveButton = task.images?.[0] ? `<button type="button" data-download-task="${attr(task.id)}" data-download-index="0">保存</button>` : "";
  const editButton = task.images?.[0] ? `<button type="button" data-edit-task="${attr(task.id)}" data-edit-index="0">编辑</button>` : "";
  const activeActions = `${saveButton}${editButton}<button type="button" data-reuse-task="${attr(task.id)}">复用</button><button type="button" data-delete-task="${attr(task.id)}">删除</button>`;
  const deletedActions = `<button type="button" data-restore-task="${attr(task.id)}">恢复</button><button type="button" data-purge-task="${attr(task.id)}">清除</button>`;
  return `
    <article class="history-card ${attr(task.status)}">
      <div class="history-image">${image}</div>
      <div class="history-body">
        <div class="meta-row"><span>${task.status === "succeeded" ? "成功" : task.status === "failed" ? "失败" : "生成中"}</span><span data-elapsed-task="${attr(task.id)}">耗时 ${formatElapsed(task)}</span><span>${time(task.createdAt)}</span></div>
        <p>${esc(task.error || task.prompt)}</p>
        <small>${settingsPart}${esc(task.params.size)} · ${esc(task.params.quality)} · ${esc(task.params.outputFormat)} · ${task.params.count} 张${creditPart}</small>
        <div class="row-actions">${deletedMode ? deletedActions : activeActions}</div>
      </div>
    </article>`;
}

function openImagePreview(taskId, imageIndex = 0) {
  const task = findHistoryTask(taskId);
  const image = task?.images?.[imageIndex];
  if (!task || !image) return;
  openModal(`
    <section class="modal-card image-preview-modal">
      <div class="section-head compact">
        <div><h2>图片预览</h2><p>${esc(task.params.size)} · ${esc(task.params.outputFormat)} · 第 ${imageIndex + 1} 张</p></div>
        <button class="icon-btn" data-close-modal type="button">×</button>
      </div>
      <div class="image-preview-frame"><img src="${attr(image)}" alt="${attr(task.prompt)}" /></div>
      <div class="modal-actions image-preview-actions">
        <button class="ghost-btn" data-close-modal type="button">关闭</button>
        <button class="ghost-btn" id="imagePreviewEdit" type="button">编辑这张</button>
        <button class="primary-btn" id="imagePreviewDownload" type="button">保存</button>
      </div>
    </section>`);
  document.getElementById("imagePreviewDownload")?.addEventListener("click", () => downloadTaskImage(task.id, imageIndex));
  document.getElementById("imagePreviewEdit")?.addEventListener("click", () => {
    closeModal();
    void editTask(task.id, imageIndex);
  });
}

function downloadTaskImage(taskId, imageIndex = 0) {
  const task = findHistoryTask(taskId);
  const image = task?.images?.[imageIndex];
  if (!task || !image) return;
  triggerDownload(image, imageFilename(task, image, imageIndex));
  status("图片已发送到下载");
}

function triggerDownload(href, filename) {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function editTask(id, imageIndex = 0) {
  const task = state.history.find((item) => item.id === id);
  const image = task?.images?.[imageIndex];
  if (!task || !image) {
    status("这条历史没有可编辑的图片");
    return;
  }
  try {
    const reference = await imageToReference(image, task, imageIndex);
    state.prompt = task.revisedPrompt || task.prompt;
    state.params = { ...task.params };
    state.references = [reference];
    tryWriteStore(keys.params, state.params);
    syncControls();
    renderReferences();
    switchTab("generate");
    dom.promptInput.focus();
    status("已载入历史图片，可修改 Prompt 后二次编辑");
  } catch (error) {
    status(`载入编辑图片失败：${errorMessage(error)}`);
  }
}

async function imageToReference(image, task, imageIndex = 0) {
  const dataUrl = String(image).startsWith("data:image/") ? String(image) : await fetchImageAsDataUrl(image);
  return {
    id: newReferenceId(),
    name: imageFilename(task, image, imageIndex),
    source: "history",
    dataUrl
  };
}

async function fetchImageAsDataUrl(image) {
  const response = await fetch(image);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const blob = await response.blob();
  return await blobToDataUrl(blob);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function imageFilename(task, image, imageIndex) {
  const extension = imageExtension(image, task.params.outputFormat);
  const stamp = timeFilename(task.createdAt || Date.now());
  return `pic-${stamp}-${imageIndex + 1}.${extension}`;
}

function imageExtension(image, fallback = "png") {
  const mime = String(image).match(/^data:image\/([a-zA-Z0-9.+-]+);/)?.[1];
  if (mime) return mime === "jpeg" ? "jpg" : mime.replace(/[^a-z0-9]/gi, "");
  const path = String(image).split("?")[0].split("#")[0];
  const extension = path.match(/\.([a-zA-Z0-9]+)$/)?.[1];
  return (extension || fallback || "png").replace(/[^a-z0-9]/gi, "") || "png";
}

function timeFilename(value) {
  const date = new Date(value);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const pad = (number) => String(number).padStart(2, "0");
  return `${safeDate.getFullYear()}${pad(safeDate.getMonth() + 1)}${pad(safeDate.getDate())}-${pad(safeDate.getHours())}${pad(safeDate.getMinutes())}${pad(safeDate.getSeconds())}`;
}

function findHistoryTask(id) {
  return state.history.find((item) => item.id === id) || state.deletedHistory.find((item) => item.id === id);
}

function reuseTask(id) {
  const task = state.history.find((item) => item.id === id);
  if (!task) return;
  state.prompt = task.prompt;
  state.params = { ...task.params };
  state.references = task.references || [];
  tryWriteStore(keys.params, state.params);
  syncControls();
  renderReferences();
  switchTab("generate");
  status("已复用历史记录");
}

function deleteTask(id) {
  const task = state.history.find((item) => item.id === id);
  if (!task) return;
  state.history = state.history.filter((item) => item.id !== id);
  state.deletedHistory = [{ ...task, deletedAt: Date.now() }, ...state.deletedHistory.filter((item) => item.id !== id)].slice(0, 100);
  persistHistory();
  persistDeletedHistory();
  renderHistory();
  status("已移到已删除");
  void fetch(`/api/history/${encodeURIComponent(id)}`, { method: "DELETE" })
    .then((response) => {
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    })
    .catch((error) => status(`已本机删除，服务端同步失败：${errorMessage(error)}`));
}

function clearHistory() {
  if (state.historyMode === "deleted") {
    state.deletedHistory = [];
    persistDeletedHistory();
    renderHistory();
    status("已删除记录已清空");
    void fetch("/api/history?deleted=1", { method: "DELETE" })
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      })
      .catch((error) => status(`本机已清空，服务端同步失败：${errorMessage(error)}`));
    return;
  }
  if (!state.history.length) return;
  const now = Date.now();
  state.deletedHistory = [
    ...state.history.map((task) => ({ ...task, deletedAt: now })),
    ...state.deletedHistory
  ].slice(0, 100);
  state.history = [];
  persistHistory();
  persistDeletedHistory();
  renderHistory();
  status("历史记录已移到已删除");
  void fetch("/api/history", { method: "DELETE" })
    .then((response) => {
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    })
    .catch((error) => status(`已本机清空，服务端同步失败：${errorMessage(error)}`));
}

function restoreTask(id) {
  const task = state.deletedHistory.find((item) => item.id === id);
  if (!task) return;
  const restored = { ...task, deletedAt: null };
  state.deletedHistory = state.deletedHistory.filter((item) => item.id !== id);
  state.history = [restored, ...state.history.filter((item) => item.id !== id)]
    .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0))
    .slice(0, 50);
  persistHistory();
  persistDeletedHistory();
  renderHistory();
  status("已恢复到历史记录");
  void fetch(`/api/history/${encodeURIComponent(id)}/restore`, { method: "POST" })
    .then((response) => {
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    })
    .catch((error) => status(`已本机恢复，服务端同步失败：${errorMessage(error)}`));
}

function purgeTask(id) {
  state.deletedHistory = state.deletedHistory.filter((item) => item.id !== id);
  persistDeletedHistory();
  renderHistory();
  status("已清除记录");
  void fetch(`/api/history/${encodeURIComponent(id)}/permanent`, { method: "DELETE" })
    .then((response) => {
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    })
    .catch((error) => status(`本机已清除，服务端同步失败：${errorMessage(error)}`));
}

function toggleDeletedHistory() {
  state.historyMode = state.historyMode === "deleted" ? "active" : "deleted";
  renderHistory();
}

async function loadCredits(options = {}) {
  try {
    const response = await fetch("/api/credits", { headers: { Accept: "application/json" } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.message || `${response.status} ${response.statusText}`);
    state.credits = normalizeCredits(data);
    renderCredits();
    queueCreditEstimate();
    if (options.announce) status(`积分已刷新：${formatCredits(state.credits.balance)}`);
  } catch (error) {
    renderCreditError(errorMessage(error));
    if (options.announce) status(`积分读取失败：${errorMessage(error)}`);
  }
}

function normalizeCredits(data) {
  return {
    balance: Math.max(0, Number(data?.balance) || 0),
    ledger: Array.isArray(data?.ledger) ? data.ledger.map(normalizeCreditEntry).filter(Boolean) : [],
    packages: Array.isArray(data?.packages) ? data.packages.map(normalizeCreditPackage).filter(Boolean) : [],
    updatedAt: String(data?.updatedAt || "")
  };
}

function normalizeCreditPackage(item) {
  if (!item?.id) return null;
  return {
    id: String(item.id),
    name: String(item.name || item.id),
    credits: Math.max(0, Number(item.credits) || 0),
    bonus: Math.max(0, Number(item.bonus) || 0),
    amountCny: Math.max(0, Number(item.amountCny) || 0),
    badge: String(item.badge || "")
  };
}

function normalizeCreditEntry(item) {
  if (!item?.id) return null;
  return {
    id: String(item.id),
    type: String(item.type || "recharge"),
    title: String(item.title || "积分变动"),
    credits: Number(item.credits) || 0,
    amountCny: Number(item.amountCny) || 0,
    status: String(item.status || "succeeded"),
    createdAt: String(item.createdAt || "")
  };
}

function renderCredits() {
  if (!dom.creditBalance) return;
  dom.topCreditBalance.textContent = `${formatCredits(state.credits.balance)}`;
  dom.creditBalance.textContent = formatCredits(state.credits.balance);
  dom.creditStatus.textContent = state.credits.balance > 0 ? "生成成功后按实际出图扣费" : "当前还没有积分";
  dom.creditUpdatedAt.textContent = state.credits.updatedAt ? `更新于 ${formatCreditTime(state.credits.updatedAt)}` : "本地账本";
  renderCreditPackages();
  renderCreditLedger();
  renderCreditEstimate();
}

function queueCreditEstimate() {
  if (!dom.creditCostStatus) return;
  window.clearTimeout(creditEstimateTimerId);
  creditEstimateTimerId = window.setTimeout(() => void loadCreditEstimate(), 120);
}

async function loadCreditEstimate() {
  try {
    const response = await fetch("/api/credits/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ params: state.params, references: activeReferences() })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.message || `${response.status} ${response.statusText}`);
    state.creditEstimate = normalizeCreditEstimate(data);
    state.creditEstimateError = "";
    if (Number.isFinite(Number(data.balance))) state.credits.balance = Math.max(0, Number(data.balance) || 0);
    renderCredits();
  } catch (error) {
    state.creditEstimate = null;
    state.creditEstimateError = errorMessage(error);
    renderCreditEstimate();
  }
}

function normalizeCreditEstimate(data) {
  return {
    unitCost: Math.max(0, Number(data?.unitCost) || 0),
    estimatedCost: Math.max(0, Number(data?.estimatedCost) || 0),
    balance: Math.max(0, Number(data?.balance) || 0),
    enough: Boolean(data?.enough),
    shortage: Math.max(0, Number(data?.shortage) || 0),
    referenceCount: Math.max(0, Number(data?.referenceCount) || 0)
  };
}

function renderCreditEstimate() {
  if (!dom.creditCostStatus) return;
  const estimate = state.creditEstimate;
  if (state.creditEstimateError) {
    dom.creditCostStatus.textContent = `积分预估失败`;
    dom.creditCostBar.classList.add("warning");
  } else if (!estimate) {
    dom.creditCostStatus.textContent = "读取中";
    dom.creditCostBar.classList.remove("warning");
  } else {
    const shortage = estimate.shortage ? ` · 还差 ${formatCredits(estimate.shortage)}` : "";
    dom.creditCostStatus.textContent = `${formatCredits(estimate.estimatedCost)} · 余额 ${formatCredits(estimate.balance)}${shortage}`;
    dom.creditCostBar.classList.toggle("warning", !estimate.enough);
  }
  if (!generationRunning && dom.generateBtn) {
    const activeCount = activeReferences().length;
    dom.generateBtn.disabled = isCreditBlocked();
    dom.generateBtn.textContent = isCreditBlocked() ? "积分不足" : activeCount ? "生成编辑图" : "生成";
  }
}

function isCreditBlocked() {
  if (!state.creditEstimate) return true;
  return !state.creditEstimate.enough;
}

function renderCreditPackages() {
  if (!state.credits.packages.length) {
    dom.creditPackages.innerHTML = empty("暂无充值档位");
    return;
  }
  dom.creditPackages.innerHTML = state.credits.packages.map(creditPackageCard).join("");
  dom.creditPackages.querySelectorAll("[data-recharge-package]").forEach((button) => {
    button.addEventListener("click", () => void rechargeCredits(button.dataset.rechargePackage));
  });
}

function creditPackageCard(item) {
  const total = item.credits + item.bonus;
  return `
    <article class="credit-package-card">
      <div class="credit-package-head">
        <div><span>${esc(item.name)}</span><strong>${esc(formatCredits(total))}</strong></div>
        ${item.badge ? `<em>${esc(item.badge)}</em>` : ""}
      </div>
      <p>基础 ${esc(formatCredits(item.credits))}${item.bonus ? ` · 赠送 ${esc(formatCredits(item.bonus))}` : ""}</p>
      <button class="primary-btn small" data-recharge-package="${attr(item.id)}" type="button">¥${esc(formatMoney(item.amountCny))} 充值</button>
    </article>`;
}

function renderCreditLedger() {
  const ledger = state.credits.ledger.slice(0, 8);
  dom.creditLedgerCount.textContent = `${state.credits.ledger.length} 条`;
  if (!ledger.length) {
    dom.creditLedger.innerHTML = empty("暂无积分记录");
    return;
  }
  dom.creditLedger.innerHTML = ledger.map((item) => `
    <article class="credit-ledger-item">
      <div>
        <strong>${esc(item.title)}</strong>
        <span>${esc(formatCreditTime(item.createdAt))} · ¥${esc(formatMoney(item.amountCny))}</span>
      </div>
      <em class="${item.credits >= 0 ? "positive" : "negative"}">${item.credits >= 0 ? "+" : ""}${esc(formatCredits(item.credits))}</em>
    </article>`).join("");
}

function renderCreditError(message) {
  if (dom.topCreditBalance) dom.topCreditBalance.textContent = "读取失败";
  if (dom.creditStatus) dom.creditStatus.textContent = message;
  if (dom.creditPackages) dom.creditPackages.innerHTML = empty("充值档位读取失败");
  if (dom.creditLedger) dom.creditLedger.innerHTML = empty("积分记录读取失败");
}

async function rechargeCredits(packageId) {
  const selected = state.credits.packages.find((item) => item.id === packageId);
  if (!selected) return;
  status(`充值处理中：${selected.name}`);
  try {
    setRechargeButtonsDisabled(true);
    const response = await fetch("/api/credits/recharge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.message || `${response.status} ${response.statusText}`);
    state.credits = normalizeCredits(data);
    renderCredits();
    queueCreditEstimate();
    status(`充值成功：+${formatCredits(data.entry?.credits || 0)}，当前 ${formatCredits(state.credits.balance)}`);
  } catch (error) {
    status(`充值失败：${errorMessage(error)}`);
  } finally {
    setRechargeButtonsDisabled(false);
  }
}

function setRechargeButtonsDisabled(disabled) {
  dom.creditPackages?.querySelectorAll("[data-recharge-package]").forEach((button) => {
    button.disabled = disabled;
  });
}

async function testConnection() {
  const summary = settingsSummary(state.settings);
  status(`连接测试中：${summary}`);
  try {
    const response = await fetch("/api/test-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: state.settings })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.message || data.error || `${response.status} ${response.statusText}`);
    status(`${data.message || "连接成功"}：${summary}`);
  } catch (error) {
    status(`连接失败：${summary}：${errorMessage(error)}`);
  }
}

function openSettings() {
  openModal(`
    <section class="modal-card">
      <div class="section-head compact"><div><h2>设置</h2><p>保存在本机 localStorage · ${esc(appVersion)}</p></div><button class="icon-btn" data-close-modal type="button">×</button></div>
      <div class="settings-form">
        <label><span>API URL</span><input id="modalApiUrl" value="${attr(state.settings.apiUrl)}" placeholder="https://alexai.work/v1" /></label>
        <label><span>API Key</span><input id="modalApiKey" value="${attr(state.settings.apiKey)}" type="password" placeholder="不会硬编码，仅本机保存" /></label>
        <div class="settings-help">没有 Key？<a href="https://alexai.work/register?aff=6019d650" target="_blank" rel="noreferrer">注册获取 Key</a></div>
        <label><span>接口模式</span><select id="modalApiMode"><option value="images">images</option><option value="responses">responses</option></select></label>
        <label><span>主模型</span><input id="modalMainModelId" value="${attr(state.settings.mainModelId || defaults.settings.mainModelId)}" /></label>
        <label><span>图像模型</span><input id="modalModelId" value="${attr(state.settings.modelId)}" /></label>
        <label><span>超时秒数</span><input id="modalTimeout" type="number" min="1" value="${attr(String(state.settings.timeoutSeconds))}" /></label>
        <div class="settings-current" id="settingsCurrent">${esc(settingsSummary(state.settings))}</div>
      </div>
      <div class="modal-actions settings-actions">
        <span class="settings-save-hint" id="settingsSaveHint" aria-live="polite"></span>
        <button class="ghost-btn" id="modalTestBtn" type="button">测试连接</button>
        <button class="primary-btn" id="modalSaveBtn" type="button">保存</button>
      </div>
    </section>`);
  document.getElementById("modalApiMode").value = state.settings.apiMode;
  document.getElementById("modalSaveBtn").addEventListener("click", (event) => {
    event.preventDefault();
    saveSettings({ close: true });
  });
  document.getElementById("modalTestBtn").addEventListener("click", (event) => {
    event.preventDefault();
    saveSettings({ close: false });
    void testConnection();
  });
}

function saveSettings(options = {}) {
  const close = typeof options === "boolean" ? options : Boolean(options.close);
  const nextSettings = {
    apiUrl: normalizeApiBaseUrl(document.getElementById("modalApiUrl").value.trim()),
    apiKey: document.getElementById("modalApiKey").value.trim(),
    apiMode: document.getElementById("modalApiMode").value,
    mainModelId: document.getElementById("modalMainModelId").value.trim() || "gpt-5.5",
    modelId: document.getElementById("modalModelId").value.trim() || "gpt-image-2",
    timeoutSeconds: Math.max(1, Number(document.getElementById("modalTimeout").value) || 120)
  };
  try {
    const recovered = writeStoreWithRecovery(keys.settings, nextSettings);
    const saved = readStore(keys.settings, defaults.settings);
    if (saved.apiUrl !== nextSettings.apiUrl || saved.apiKey !== nextSettings.apiKey) throw new Error("本机存储校验失败");
    state.settings = nextSettings;
    const summary = settingsSummary(nextSettings);
    const current = document.getElementById("settingsCurrent");
    if (current) current.textContent = summary;
    const hint = document.getElementById("settingsSaveHint");
    if (hint) hint.textContent = recovered ? "已保存，已清理过大的本机历史缓存" : "已保存";
    if (close) closeModal();
    status(`设置已保存：${summary}`);
    return true;
  } catch (error) {
    const hint = document.getElementById("settingsSaveHint");
    if (hint) hint.textContent = `保存失败：${errorMessage(error)}`;
    status(`设置保存失败：${errorMessage(error)}`);
    return false;
  }
}

function openSize() {
  const draft = createSizeDraft(state.params.size);
  renderSizeModal(draft);
}

function renderSizeModal(draft) {
  const resolved = resolveSizeDraft(draft);
  openModal(`
    <section class="modal-card small-modal size-modal">
      <div class="section-head compact">
        <div><h2>设置图像尺寸</h2><p>当前：${esc(state.params.size)}</p></div>
        <button class="icon-btn" data-close-modal type="button">×</button>
      </div>
      <div class="size-tabs">
        ${sizeTab(draft, "auto", "自动")}
        ${sizeTab(draft, "ratio", "按比例")}
        ${sizeTab(draft, "custom", "自定义宽高")}
      </div>
      ${draft.mode === "auto" ? `<div class="size-panel"><div class="empty-inline size-auto">自动匹配模型最佳尺寸</div></div>` : ""}
      ${draft.mode === "ratio" ? ratioSizePanel(draft) : ""}
      ${draft.mode === "custom" ? customSizePanel(draft) : ""}
      <div class="size-result"><span>将使用</span><strong>${esc(resolved)}</strong></div>
      <div class="size-actions">
        <button class="ghost-btn" data-close-modal type="button">取消</button>
        <button class="primary-btn" id="confirmSizeBtn" type="button">确定</button>
      </div>
    </section>`);
  bindSizeModal(draft);
}

function bindSizeModal(draft) {
  document.querySelectorAll("[data-size-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.sizeMode;
      renderSizeModal({ ...draft, mode, ...sizeDraftDefaultsForMode(mode, draft) });
    });
  });
  document.querySelectorAll("[data-size-base]").forEach((button) => {
    button.addEventListener("click", () => renderSizeModal({ ...draft, base: Number(button.dataset.sizeBase) || 1024 }));
  });
  document.querySelectorAll("[data-size-ratio]").forEach((button) => {
    button.addEventListener("click", () => renderSizeModal({ ...draft, ratio: button.dataset.sizeRatio || "1:1" }));
  });
  document.getElementById("customWidth")?.addEventListener("input", (event) => {
    renderSizeModal({ ...draft, customWidth: event.target.value });
  });
  document.getElementById("customHeight")?.addEventListener("input", (event) => {
    renderSizeModal({ ...draft, customHeight: event.target.value });
  });
  document.getElementById("confirmSizeBtn").addEventListener("click", () => {
    saveParams({ size: resolveSizeDraft(draft) });
    closeModal();
  });
}

function sizeTab(draft, mode, label) {
  return `<button class="size-tab ${draft.mode === mode ? "active" : ""}" data-size-mode="${mode}" type="button">${label}</button>`;
}

function ratioSizePanel(draft) {
  return `
    <div class="size-panel">
      <h3>基准分辨率</h3>
      <div class="size-base-grid">
        ${[[1024, "1K"], [2048, "2K"], [3840, "4K"]].map(([value, label]) => `<button class="size-choice ${draft.base === value ? "active" : ""}" data-size-base="${value}" type="button">${label}</button>`).join("")}
      </div>
      <h3>图像比例</h3>
      <div class="size-ratio-grid">
        ${sizeRatios.map((ratio) => `<button class="size-choice ${draft.ratio === ratio ? "active" : ""}" data-size-ratio="${ratio}" type="button">${ratio}</button>`).join("")}
      </div>
      <button class="size-wide-choice" data-size-mode="custom" type="button">自定义比例</button>
    </div>`;
}

function customSizePanel(draft) {
  return `
    <div class="size-panel">
      <h3>输入具体像素值</h3>
      <div class="custom-size-grid">
        <label><span>宽度 (Width)</span><input id="customWidth" value="${esc(draft.customWidth)}" inputmode="numeric" /></label>
        <span class="custom-times">×</span>
        <label><span>高度 (Height)</span><input id="customHeight" value="${esc(draft.customHeight)}" inputmode="numeric" /></label>
      </div>
      <div class="size-limit-note">由于模型限制，最终输出会自动规整到合法尺寸：宽高均为 16 的倍数，最大边长 3840px，宽高比不超过 3:1，总像素限制为 655360-8294400。</div>
    </div>`;
}

function openModal(html) {
  dom.modalRoot.innerHTML = html;
  dom.modalRoot.hidden = false;
  dom.modalRoot.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", closeModal));
}

function closeModal() {
  dom.modalRoot.hidden = true;
  dom.modalRoot.innerHTML = "";
}

function persistHistory() {
  state.history = state.history.slice(0, 50);
  tryWriteStore(keys.history, compactHistoryForStorage(state.history));
}

function persistDeletedHistory() {
  state.deletedHistory = state.deletedHistory.slice(0, 100);
  tryWriteStore(keys.deletedHistory, compactHistoryForStorage(state.deletedHistory));
}

function readStore(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    if (!value) return clone(fallback);
    const parsed = JSON.parse(value);
    return Array.isArray(fallback) ? Array.isArray(parsed) ? parsed : clone(fallback) : { ...fallback, ...parsed };
  } catch {
    return clone(fallback);
  }
}

function loadSettings() {
  const current = normalizeSettings(readStore(keys.settings, defaults.settings));
  if (current.apiKey || current.apiUrl) {
    tryWriteStore(keys.settings, current);
    return current;
  }
  for (const legacyKey of ["alexai-replica-settings", "gpt-image-node-settings"]) {
    const legacy = normalizeSettings(readStore(legacyKey, defaults.settings));
    if (legacy.apiKey || legacy.apiUrl) {
      const next = { ...defaults.settings, ...legacy };
      tryWriteStore(keys.settings, next);
      return next;
    }
  }
  return current;
}

function normalizeSettings(value) {
  const settings = { ...defaults.settings, ...(value && typeof value === "object" ? value : {}) };
  return {
    ...settings,
    apiUrl: normalizeApiBaseUrl(settings.apiUrl),
    apiMode: settings.apiMode === "responses" ? "responses" : "images",
    mainModelId: String(settings.mainModelId || defaults.settings.mainModelId),
    modelId: String(settings.modelId || defaults.settings.modelId),
    timeoutSeconds: Math.max(1, Number(settings.timeoutSeconds) || defaults.settings.timeoutSeconds)
  };
}

function settingsSummary(settings) {
  const apiKey = String(settings?.apiKey || "").trim();
  return apiKey ? `接口已配置 · Key #${keyFingerprint(apiKey)}` : "接口未配置";
}

function keyFingerprint(value) {
  return hashText(value).toString(16).padStart(6, "0").slice(-6);
}

function applyQuerySettings(settings) {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("apiUrl") && !params.has("apiKey") && !params.has("apiMode") && !params.has("mainModelId") && !params.has("modelId")) return settings;
  const next = {
    ...settings,
    apiUrl: normalizeApiBaseUrl(params.get("apiUrl")?.trim() || settings.apiUrl || defaults.settings.apiUrl),
    apiKey: params.get("apiKey")?.trim() || settings.apiKey,
    apiMode: params.get("apiMode") === "responses" ? "responses" : settings.apiMode,
    mainModelId: params.get("mainModelId")?.trim() || settings.mainModelId || defaults.settings.mainModelId,
    modelId: params.get("modelId")?.trim() || settings.modelId
  };
  tryWriteStore(keys.settings, next);
  params.delete("apiUrl");
  params.delete("apiKey");
  params.delete("apiMode");
  params.delete("mainModelId");
  params.delete("modelId");
  window.history.replaceState(null, "", `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`);
  return next;
}

function normalizeApiBaseUrl(value) {
  const trimmed = String(value || defaults.settings.apiUrl || "https://alexai.work/v1").trim();
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

const sizeRatios = ["1:1", "3:2", "2:3", "16:9", "9:16", "4:3", "3:4", "21:9"];

function createSizeDraft(size) {
  const match = String(size).match(/^(\d+)x(\d+)$/i);
  if (!match) return { mode: "auto", base: 1024, ratio: "1:1", customWidth: "1024", customHeight: "1024" };
  const width = Number(match[1]) || 1024;
  const height = Number(match[2]) || 1024;
  return {
    mode: "custom",
    base: nearestSizeBase(Math.max(width, height)),
    ratio: closestKnownRatio(width, height),
    customWidth: String(width),
    customHeight: String(height)
  };
}

function sizeDraftDefaultsForMode(mode, current) {
  if (mode === "custom") {
    const resolved = current.mode === "custom" ? resolveSizeDraft(current) : ratioSize(current.base, current.ratio);
    const [width, height] = resolved.split("x");
    return { customWidth: width || "1024", customHeight: height || "1024" };
  }
  if (mode === "ratio") return { ratio: current.ratio || "1:1", base: current.base || 1024 };
  return {};
}

function resolveSizeDraft(draft) {
  if (draft.mode === "auto") return "auto";
  if (draft.mode === "ratio") return ratioSize(draft.base, draft.ratio);
  return normalizeDimensions(Number(draft.customWidth) || 1024, Number(draft.customHeight) || 1024);
}

function ratioSize(base, ratio) {
  const [wide = 1, tall = 1] = ratio.split(":").map((value) => Number(value) || 1);
  if (wide >= tall) return normalizeDimensions(base, base * tall / wide);
  return normalizeDimensions(base * wide / tall, base);
}

function normalizeDimensions(rawWidth, rawHeight) {
  const minPixels = 655360;
  const maxPixels = 8294400;
  let width = Math.max(16, rawWidth);
  let height = Math.max(16, rawHeight);
  const longest = Math.max(width, height);
  if (longest > 3840) {
    const scale = 3840 / longest;
    width *= scale;
    height *= scale;
  }
  const ratio = Math.max(width, height) / Math.min(width, height);
  if (ratio > 3) {
    if (width > height) height = width / 3;
    else width = height / 3;
  }
  let pixels = width * height;
  if (pixels < minPixels) {
    const scale = Math.sqrt(minPixels / pixels);
    width *= scale;
    height *= scale;
  }
  pixels = width * height;
  if (pixels > maxPixels) {
    const scale = Math.sqrt(maxPixels / pixels);
    width *= scale;
    height *= scale;
  }
  return `${roundToMultiple(width, 16)}x${roundToMultiple(height, 16)}`;
}

function roundToMultiple(value, multiple) {
  return Math.min(3840, Math.max(16, Math.round(value / multiple) * multiple));
}

function nearestSizeBase(value) {
  return [1024, 2048, 3840].reduce((best, base) => Math.abs(base - value) < Math.abs(best - value) ? base : best, 1024);
}

function closestKnownRatio(width, height) {
  const actual = width / height;
  return sizeRatios.reduce((best, ratio) => {
    const [wide = 1, tall = 1] = ratio.split(":").map((value) => Number(value) || 1);
    const score = Math.abs(wide / tall - actual);
    const bestParts = best.split(":").map((value) => Number(value) || 1);
    return score < Math.abs(bestParts[0] / bestParts[1] - actual) ? ratio : best;
  }, "1:1");
}

function writeStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function tryWriteStore(key, value) {
  try {
    return writeStoreWithRecovery(key, value);
  } catch (error) {
    console.warn(`localStorage write failed for ${key}: ${errorMessage(error)}`);
    return false;
  }
}

function writeStoreWithRecovery(key, value) {
  try {
    writeStore(key, value);
    return false;
  } catch (error) {
    if (!isStorageQuotaError(error)) throw error;
    recoverLocalStorage(key);
    writeStore(key, value);
    return true;
  }
}

function recoverLocalStorage(targetKey) {
  if (targetKey !== keys.history) compactStoredHistoryKey(keys.history);
  for (const key of legacyHistoryKeys) {
    try {
      if (localStorage.getItem(key) !== null) localStorage.removeItem(key);
    } catch {
      // Ignore unreadable legacy cache entries; the next write will report any real failure.
    }
  }
}

function compactStoredHistoryKey(key) {
  let raw = "";
  try {
    raw = localStorage.getItem(key) || "";
  } catch {
    return;
  }
  if (!raw) return;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    localStorage.removeItem(key);
    return;
  }
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.history) ? parsed.history : Array.isArray(parsed?.tasks) ? parsed.tasks : [];
  try {
    localStorage.removeItem(key);
    localStorage.setItem(key, JSON.stringify(compactHistoryForStorage(list)));
  } catch {
    localStorage.removeItem(key);
  }
}

function compactHistoryForStorage(history) {
  return (Array.isArray(history) ? history : []).slice(0, 50).map((task) => {
    const item = task && typeof task === "object" ? task : {};
    return {
      ...item,
      images: compactImageList(item.images),
      outputImages: compactImageList(item.outputImages),
      references: compactReferenceList(item.references)
    };
  });
}

function compactImageList(images) {
  return (Array.isArray(images) ? images : []).filter((image) => {
    const value = String(image || "");
    return value && !/^data:/i.test(value) && !/^blob:/i.test(value);
  });
}

function compactReferenceList(references) {
  return (Array.isArray(references) ? references : []).map((reference) => {
    if (!reference || typeof reference !== "object") return reference;
    const { dataUrl: _dataUrl, ...rest } = reference;
    return rest;
  });
}

function isStorageQuotaError(error) {
  return error instanceof DOMException && (
    error.name === "QuotaExceededError" ||
    error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    error.code === 22 ||
    error.code === 1014
  );
}

function clone(value) {
  return Array.isArray(value) ? [...value] : { ...value };
}

function empty(message) {
  return `<div class="empty-state">${esc(message)}</div>`;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function status(message) {
  dom.statusLine.textContent = message;
}

function clamp(value, min, max) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : min;
}

function time(value) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(value);
}

function formatCreditTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatCredits(value) {
  return `${Math.round(Number(value) || 0)} 积分`;
}

function formatMoney(value) {
  const number = Number(value) || 0;
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function formatElapsed(task, now = Date.now()) {
  if (!task?.createdAt) return "00:00";
  const end = task.finishedAt || now;
  const total = Math.max(0, Math.round((end - task.createdAt) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]);
}

function attr(value) {
  return esc(value);
}
