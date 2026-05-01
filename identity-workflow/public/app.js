const storeKeys = {
  refs: "identity.workflow.refs.v1",
  gate: "identity.workflow.gate.v1",
  scene: "identity.workflow.scene.v1",
  outfit: "identity.workflow.outfit.v1",
  auth: "identity.workflow.auth.v1"
};

const defaultGate = { detected: false, turnaround: false, baseline: false, batchLocked: true };

const sceneConfigs = [
  {
    id: "wedding",
    label: "婚纱照",
    short: "婚纱",
    intro: "先锁新娘、新郎和合照，再选礼服与旅拍风格。",
    meta: "高定主纱、旅拍纪实、城市夜景等婚纱样片。",
    sourcePolicy: "以新娘、新郎和合照原片为准。",
    roles: [
      { id: "bride", label: "新娘原片", note: "脸部清楚" },
      { id: "groom", label: "新郎原片", note: "脸部清楚" },
      { id: "couple", label: "新人合照", note: "身形关系" }
    ],
    checklist: ["双人像本人", "礼服高级", "场景可信"],
    review: ["脸部一致性复核", "侧脸和身形比例复核", "服装与场景一致性复核"]
  },
  {
    id: "friends",
    label: "闺蜜照",
    short: "闺蜜",
    intro: "主角和闺蜜都要有清晰原片，合照用来校准关系和站位。",
    meta: "适合双人闺蜜、多人姐妹、生日聚会写真。",
    sourcePolicy: "以主角、闺蜜和合照素材为准。",
    roles: [
      { id: "lead", label: "主角原片", note: "脸部清楚" },
      { id: "friend", label: "闺蜜原片", note: "脸部清楚" },
      { id: "group", label: "合照/集体照", note: "站位关系" }
    ],
    checklist: ["多人不串脸", "站位关系", "妆造统一"],
    review: ["主角和闺蜜逐一复核", "多人站位和身高关系复核", "妆造与氛围一致性复核"]
  },
  {
    id: "friendsWedding",
    label: "闺蜜婚纱",
    short: "闺蜜婚纱",
    intro: "闺蜜婚纱要同时锁住每个人的脸、身高关系和姐妹感。",
    meta: "适合闺蜜婚纱、姐妹婚纱、多人白纱写真。",
    sourcePolicy: "以主角、闺蜜和合照素材为准。",
    roles: [
      { id: "lead", label: "主角原片", note: "脸部清楚" },
      { id: "friend", label: "闺蜜原片", note: "脸部清楚" },
      { id: "group", label: "闺蜜合照", note: "站位关系" }
    ],
    checklist: ["多人不串脸", "白纱不婚礼化", "姐妹关系自然"],
    review: ["逐人脸部复核", "姐妹站位和身高关系复核", "白纱与场景一致性复核"]
  },
  {
    id: "travel",
    label: "旅游照",
    short: "旅游",
    intro: "人物原片负责锁脸，旅行照片负责确定动作、服装和氛围。",
    meta: "适合旅行跟拍、城市漫游、度假生活照。",
    sourcePolicy: "以人物原片和旅行参考照为准。",
    roles: [
      { id: "main", label: "人物近照", note: "脸部清楚" },
      { id: "body", label: "全身照片", note: "身形衣着" },
      { id: "travel", label: "旅行参考", note: "动作氛围" }
    ],
    checklist: ["人物不漂移", "动作自然", "旅行氛围"],
    review: ["人物脸部和身形复核", "动作与旅行氛围复核", "服装和场景协调复核"]
  },
  {
    id: "landmark",
    label: "地标打卡照",
    short: "地标",
    intro: "人物、全身和地标参考要分开传，方便锁人也锁机位。",
    meta: "适合城市地标、建筑打卡、纪念照。",
    sourcePolicy: "以人物原片、全身照片和地标参考为准。",
    roles: [
      { id: "main", label: "人物近照", note: "脸部清楚" },
      { id: "body", label: "全身照片", note: "比例姿态" },
      { id: "landmark", label: "地标参考", note: "建筑机位" }
    ],
    checklist: ["人物清楚", "机位可信", "地标完整"],
    review: ["人物身份复核", "地标机位和透视复核", "人物与地标比例复核"]
  },
  {
    id: "child10",
    label: "儿童10岁照",
    short: "儿童",
    intro: "儿童近照优先，表情和全身照片用来保持年龄感和动作自然。",
    meta: "适合10岁成长照、生日照、家庭纪念照。",
    sourcePolicy: "以儿童近照、全身和家庭参考素材为准。",
    roles: [
      { id: "child", label: "儿童近照", note: "脸部清楚" },
      { id: "body", label: "全身/表情", note: "年龄动作" },
      { id: "family", label: "家庭/服装参考", note: "氛围服装" }
    ],
    checklist: ["年龄感准确", "表情自然", "服装干净"],
    review: ["儿童脸部和年龄感复核", "表情动作自然度复核", "服装和家庭氛围复核"]
  }
];

const sceneThemes = {
  wedding: {
    tone: "高定旅拍",
    proof: "身份、礼服、场景一起复核",
    cards: [
      { label: "身份", title: "新人锁脸", copy: "新娘、新郎、合照分开锁定" },
      { label: "礼服", title: "主纱选款", copy: "材质、裙摆、头纱先定调" },
      { label: "样片", title: "9 张预览", copy: "封面、互动、细节同步看" }
    ]
  },
  friendsWedding: {
    tone: "闺蜜白纱",
    proof: "多人身份、身高关系、姐妹感一起复核",
    cards: [
      { label: "身份", title: "逐人锁脸", copy: "主角和闺蜜不串脸" },
      { label: "关系", title: "姐妹站位", copy: "亲密但不情侣化" },
      { label: "白纱", title: "轻婚纱感", copy: "保持自然写真氛围" }
    ]
  },
  default: {
    tone: "多场景写真",
    proof: "人物、服装、场景按当前模板复核",
    cards: [
      { label: "素材", title: "身份原片", copy: "先把人物关系锁准" },
      { label: "造型", title: "衣服模板", copy: "按场景选择服装方向" },
      { label: "结果", title: "样片复核", copy: "看片、选片、再交付" }
    ]
  }
};

const wardrobeBlueprints = {
  wedding: {
    targets: ["新娘", "新郎", "双人"],
    styles: ["主纱仪式", "缎面极简", "法式蕾丝", "复古宫廷", "轻纱旅拍", "黑白礼服", "东方新中式", "海岛度假", "城市夜景", "森系花园"],
    pieces: ["拖尾婚纱 + 黑色西装", "缎面鱼尾裙 + 白衬衫西裤", "蕾丝长袖裙 + 深色礼服", "泡袖礼服 + 领结西装", "轻纱吊带裙 + 亚麻套装"],
    textures: ["缎面", "蕾丝", "薄纱", "珍珠", "羊毛西装"],
    palettes: [
      ["象牙白", "珍珠白 / 香槟金 / 深黑"],
      ["晨雾粉", "柔粉 / 米白 / 银灰"],
      ["夜景黑", "黑色 / 白色 / 金属银"],
      ["花园绿", "白色 / 鼠尾草绿 / 奶油色"]
    ]
  },
  friends: {
    targets: ["双人闺蜜", "多人姐妹", "生日聚会"],
    styles: ["同色系西装", "奶油针织", "法式小裙", "学院衬衫", "生日亮片", "复古牛仔", "海边吊带", "城市酷感", "花园碎花", "睡衣派对"],
    pieces: ["短西装 + 半裙", "针织开衫 + 直筒裙", "吊带裙 + 薄外套", "白衬衫 + 百褶裙", "亮片上衣 + 高腰裤"],
    textures: ["针织", "棉麻", "牛仔", "亮片", "雪纺"],
    palettes: [
      ["奶油同色", "奶油白 / 杏色 / 浅咖"],
      ["粉蓝姐妹", "浅粉 / 天蓝 / 白色"],
      ["黑白酷感", "黑色 / 白色 / 银色"],
      ["复古胶片", "牛仔蓝 / 酒红 / 米色"]
    ]
  },
  friendsWedding: {
    targets: ["双人闺蜜", "多人姐妹", "生日聚会"],
    styles: ["闺蜜白纱", "奶油短纱", "法式缎面", "海边轻纱", "花园头纱", "城市酷白", "复古珍珠", "派对亮片", "黑白姐妹", "夕阳纱裙"],
    pieces: ["白色短纱 + 高腰裙", "缎面吊带裙 + 复古头纱", "轻纱上衣 + 奶油半裙", "白衬衫 + 纱裙", "亮片上衣 + 白色长裙"],
    textures: ["薄纱", "缎面", "蕾丝", "珍珠", "亮片"],
    palettes: [
      ["白纱同色", "象牙白 / 奶油白 / 珍珠"],
      ["粉白姐妹", "柔粉 / 白色 / 银色"],
      ["黑白高级", "黑色 / 白色 / 银色"],
      ["海岛清透", "白色 / 天蓝 / 米色"]
    ]
  },
  travel: {
    targets: ["单人旅行", "双人旅行", "度假生活"],
    styles: ["松弛亚麻", "城市漫游", "山野机能", "海岛罩衫", "咖啡店日常", "博物馆文艺", "雪山针织", "老钱度假", "街头牛仔", "雨天风衣"],
    pieces: ["亚麻衬衫 + 阔腿裤", "风衣 + 直筒牛仔", "机能外套 + 工装裤", "吊带裙 + 防晒罩衫", "针织背心 + 半裙"],
    textures: ["亚麻", "牛仔", "针织", "防水面料", "棉质"],
    palettes: [
      ["自然米色", "米白 / 卡其 / 橄榄绿"],
      ["城市蓝灰", "牛仔蓝 / 灰色 / 白色"],
      ["海岛明亮", "白色 / 珊瑚橙 / 天蓝"],
      ["雪山暖调", "奶油白 / 驼色 / 深棕"]
    ]
  },
  landmark: {
    targets: ["城市地标", "建筑打卡", "纪念合影"],
    styles: ["利落风衣", "高级黑裙", "白衬衫打卡", "红裙地标", "新中式城市", "西装街拍", "运动休闲", "博主极简", "夜景金属", "亲子地标"],
    pieces: ["长风衣 + 直筒裤", "黑色长裙 + 小外套", "白衬衫 + 高腰裤", "红色连衣裙 + 细腰带", "盘扣上衣 + 半裙"],
    textures: ["风衣棉", "醋酸", "羊毛", "丝缎", "金属感面料"],
    palettes: [
      ["建筑中性色", "黑色 / 白色 / 灰色"],
      ["地标红", "正红 / 奶白 / 深黑"],
      ["城市驼色", "驼色 / 米白 / 深棕"],
      ["夜景银黑", "黑色 / 银色 / 深蓝"]
    ]
  },
  child10: {
    targets: ["10岁儿童", "生日成长", "亲子纪念"],
    styles: ["小礼服", "学院制服", "运动少年", "公主纱裙", "生日派对", "户外牛仔", "画室文艺", "亲子同色", "国风童装", "干净白衬衫"],
    pieces: ["白衬衫 + 背带裤", "纱裙 + 小皮鞋", "棒球外套 + 休闲裤", "针织马甲 + 百褶裙", "盘扣上衣 + 宽松裤"],
    textures: ["纯棉", "针织", "薄纱", "牛仔", "柔软毛呢"],
    palettes: [
      ["干净浅色", "白色 / 浅蓝 / 米色"],
      ["生日明亮", "粉色 / 奶油黄 / 白色"],
      ["学院深浅", "海军蓝 / 白色 / 酒红"],
      ["自然户外", "牛仔蓝 / 草木绿 / 卡其"]
    ]
  }
};

const seasons = ["春", "夏", "秋", "冬"];
const wardrobeLibrary = buildWardrobeLibrary();

const state = {
  tab: "recognition",
  auth: normalizeAuth(readStore(storeKeys.auth, {})),
  authModalOpen: false,
  authView: "register",
  authAccountType: "email",
  authMessage: "",
  authMessageKind: "",
  authSubmitting: false,
  authCodeSending: false,
  authCodeCooldown: 0,
  workflow: null,
  generation: null,
  imageTool: null,
  imageToolState: "idle",
  imageToolMessage: "准备连接生图工具。",
  selectedScene: readSceneStore(),
  selectedOutfits: normalizeSelectedOutfits(readStore(storeKeys.outfit, {})),
  selectedBatch: "",
  selectedDeliveryBatch: "",
  selectedImageIndex: 0,
  lightboxOpen: false,
  lightboxZoom: 1,
  lightboxOriginX: 50,
  lightboxOriginY: 50,
  lightboxPanX: 0,
  lightboxPanY: 0,
  lightboxDragging: false,
  lightboxDragStartX: 0,
  lightboxDragStartY: 0,
  lightboxDragPanX: 0,
  lightboxDragPanY: 0,
  refs: normalizeRefs(readStore(storeKeys.refs, {})),
  gates: normalizeGates(readStore(storeKeys.gate, {}))
};

const dom = {};
let authCodeTimer = null;

document.addEventListener("DOMContentLoaded", () => {
  for (const id of [
    "statusLine", "refreshBtn", "confirmBaselineBtn", "baselineState", "finalTotal", "chengpinTotal",
    "authBar", "authChip", "authAvatar", "authName", "authMeta", "loginBtn", "registerBtn", "logoutBtn",
    "authModal", "authBackdrop", "authForm", "authTitle", "authSubtitle", "authCloseBtn",
    "authModeLogin", "authModeRegister", "authTypeSelect", "authAccountLabel", "authAccountInput",
    "authNicknameField", "authNicknameInput", "authCodeField", "authCodeInput", "sendCodeBtn",
    "authPasswordInput", "authMessage", "authSubmitBtn",
    "syncState", "stageRail", "clearRefsBtn", "heroSceneTone", "heroSceneProof",
    "customerStepPanel", "customerStepKicker", "customerStepTitle", "customerStepCopy", "customerStepProof",
    "customerStepDetail", "customerNextBtn", "customerFlowRail",
    "sceneTitle", "sceneIntro", "sceneRail", "sceneMeta", "sceneCampaignStrip",
    "uploadGrid", "referenceStrip", "sideSceneTitle", "sideSceneCopy", "sideSceneChecklist",
    "detectFaceBtn", "buildTurnaroundBtn", "lockBatchBtn", "wardrobeSummary", "selectedOutfitTitle",
    "selectedOutfitDetail", "wardrobeGrid", "gateNote", "generateSceneBtn", "generateAllBtn",
    "generationStatus",
    "baselineCompareLink", "baselineCompareImg", "turnaroundLink", "turnaroundImg", "sourcePolicy",
    "batchSummary", "batchList", "deliverySummary", "deliveryBatchList", "deliveryImageGrid",
    "nextList", "recognitionPanel", "turnaroundPanel", "imageToolPanel", "deliveryPanel",
    "imageToolStatus", "refreshImageToolBtn", "openImageToolBtn", "imageToolFrame", "imageToolEmpty",
    "reviewPanel", "imageViewer", "viewerBatch", "viewerTitle", "viewerCounter", "viewerPrevBtn",
    "viewerNextBtn", "viewerZoomBtn", "viewerFrame", "viewerImage", "viewerEmpty", "thumbGrid",
    "heroImageMain", "heroImageSide", "heroImageTail", "lightbox", "lightboxBatch", "lightboxTitle",
    "lightboxCounter", "lightboxZoomLabel", "lightboxPrevBtn", "lightboxNextBtn",
    "lightboxResetZoomBtn", "lightboxCloseBtn", "lightboxStage", "lightboxImage"
  ]) dom[id] = document.getElementById(id);
  dom.tabs = Array.from(document.querySelectorAll(".module-tab"));

  dom.tabs.forEach((tab) => tab.addEventListener("click", () => switchTab(tab.dataset.tab)));
  dom.refreshBtn.addEventListener("click", () => void loadStatus());
  dom.loginBtn.addEventListener("click", () => openAuth("login"));
  dom.registerBtn.addEventListener("click", () => openAuth("register"));
  dom.logoutBtn.addEventListener("click", logoutAuth);
  dom.authBackdrop.addEventListener("click", closeAuth);
  dom.authCloseBtn.addEventListener("click", closeAuth);
  dom.authModeLogin.addEventListener("click", () => switchAuthView("login"));
  dom.authModeRegister.addEventListener("click", () => switchAuthView("register"));
  dom.authTypeSelect.addEventListener("change", () => {
    state.authAccountType = dom.authTypeSelect.value === "phone" ? "phone" : "email";
    clearAuthMessage();
    renderAuth();
  });
  dom.sendCodeBtn.addEventListener("click", () => void sendAuthCode());
  dom.authForm.addEventListener("submit", (event) => void submitAuth(event));
  dom.customerNextBtn.addEventListener("click", handleCustomerNext);
  dom.confirmBaselineBtn.addEventListener("click", confirmBaseline);
  dom.clearRefsBtn.addEventListener("click", clearRefs);
  dom.detectFaceBtn.addEventListener("click", detectFaces);
  dom.buildTurnaroundBtn.addEventListener("click", buildTurnaround);
  dom.lockBatchBtn.addEventListener("click", toggleBatchLock);
  dom.generateSceneBtn.addEventListener("click", () => void accelerateGeneration(false));
  dom.generateAllBtn.addEventListener("click", () => void accelerateGeneration(true));
  dom.refreshImageToolBtn.addEventListener("click", () => void loadImageTool(true));
  dom.openImageToolBtn.addEventListener("click", openImageTool);
  dom.imageToolFrame.addEventListener("load", markImageToolLoaded);
  dom.viewerPrevBtn.addEventListener("click", () => moveImage(-1));
  dom.viewerNextBtn.addEventListener("click", () => moveImage(1));
  dom.viewerZoomBtn.addEventListener("click", openLightbox);
  dom.viewerFrame.addEventListener("click", openLightbox);
  dom.viewerFrame.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openLightbox();
  });
  dom.lightbox.addEventListener("click", (event) => {
    if (event.target === dom.lightbox) closeLightbox();
  });
  dom.lightboxPrevBtn.addEventListener("click", () => moveImage(-1));
  dom.lightboxNextBtn.addEventListener("click", () => moveImage(1));
  dom.lightboxResetZoomBtn.addEventListener("click", resetLightboxZoom);
  dom.lightboxCloseBtn.addEventListener("click", closeLightbox);
  dom.lightboxStage.addEventListener("wheel", handleLightboxWheel, { passive: false });
  dom.lightboxStage.addEventListener("pointerdown", handleLightboxPointerDown);
  dom.lightboxStage.addEventListener("pointermove", handleLightboxPointerMove);
  dom.lightboxStage.addEventListener("pointerup", endLightboxPan);
  dom.lightboxStage.addEventListener("pointercancel", endLightboxPan);
  dom.lightboxStage.addEventListener("lostpointercapture", endLightboxPan);
  dom.lightboxImage.addEventListener("dragstart", (event) => event.preventDefault());
  document.addEventListener("keydown", handleGlobalKeys);

  render();
  void loadStatus();
});

async function loadStatus() {
  status("读取项目");
  try {
    const response = await fetch("/api/workflow/status", { headers: { Accept: "application/json" } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.message || `${response.status} ${response.statusText}`);
    state.workflow = data.workflow;
    state.generation = data.workflow?.activeGeneration || state.generation;
    render();
    status("项目已更新");
  } catch (error) {
    status(`读取失败：${errorMessage(error)}`);
  }
}

function render() {
  renderAuth();
  renderTabs();
  renderSummary();
  renderHero();
  renderCustomerFlow();
  renderStages();
  renderScene();
  renderUploadCards();
  renderRefs();
  renderWardrobe();
  renderEvidence();
  renderBatches();
  renderDelivery();
  renderImageTool();
  renderGeneration();
  renderNext();
  renderGate();
}

function renderAuth() {
  const user = state.auth.user;
  const isAuthed = Boolean(user);
  dom.authChip.hidden = !isAuthed;
  dom.loginBtn.hidden = isAuthed;
  dom.registerBtn.hidden = isAuthed;
  dom.logoutBtn.hidden = !isAuthed;
  if (user) {
    dom.authAvatar.textContent = nicknameInitial(user.nickname);
    dom.authName.textContent = user.nickname || "已注册";
    dom.authMeta.textContent = `${accountTypeLabel(user.type)} · ${user.accountLabel || "本地账号"}`;
  }

  dom.authModal.hidden = !state.authModalOpen;
  document.body.classList.toggle("auth-open", state.authModalOpen);
  const isRegister = state.authView === "register";
  dom.authTitle.textContent = isRegister ? "注册账号" : "登录账号";
  dom.authSubtitle.textContent = isRegister ? "用邮箱验证码注册，项目记录跟着账号走。" : "登录后继续查看本地婚纱照项目。";
  dom.authModeRegister.classList.toggle("active", isRegister);
  dom.authModeLogin.classList.toggle("active", !isRegister);
  dom.authNicknameField.hidden = !isRegister;
  dom.authCodeField.hidden = !isRegister;
  dom.authTypeSelect.value = state.authAccountType;
  dom.authAccountLabel.textContent = accountTypeLabel(state.authAccountType);
  dom.authAccountInput.type = "email";
  dom.authAccountInput.inputMode = "email";
  dom.authAccountInput.placeholder = "your@email.com";
  dom.authSubmitBtn.textContent = state.authSubmitting ? (isRegister ? "注册中..." : "登录中...") : (isRegister ? "立即注册" : "登录");
  dom.authSubmitBtn.disabled = state.authSubmitting || state.authCodeSending;
  dom.sendCodeBtn.disabled = state.authSubmitting || state.authCodeSending || state.authCodeCooldown > 0;
  dom.sendCodeBtn.textContent = state.authCodeSending ? "发送中..." : state.authCodeCooldown > 0 ? `${state.authCodeCooldown}s` : "获取验证码";
  dom.authMessage.hidden = !state.authMessage;
  dom.authMessage.textContent = state.authMessage;
  dom.authMessage.classList.toggle("ok", state.authMessageKind === "ok");
}

function openAuth(view = "register") {
  state.authModalOpen = true;
  state.authView = view === "login" ? "login" : "register";
  clearAuthMessage();
  renderAuth();
  window.setTimeout(() => dom.authAccountInput.focus(), 0);
}

function closeAuth() {
  state.authModalOpen = false;
  clearAuthMessage();
  renderAuth();
}

function switchAuthView(view) {
  state.authView = view === "login" ? "login" : "register";
  clearAuthMessage();
  renderAuth();
}

function logoutAuth() {
  state.auth = { user: null };
  writeStore(storeKeys.auth, state.auth);
  renderAuth();
  status("已退出账号");
}

async function sendAuthCode() {
  const account = dom.authAccountInput.value.trim();
  state.authCodeSending = true;
  clearAuthMessage();
  renderAuth();
  try {
    const data = await postJson("/api/auth/verification-code", { type: state.authAccountType, account });
    if (data.code) dom.authCodeInput.value = data.code;
    setAuthMessage(data.message || `验证码已发送到 ${data.accountLabel || "邮箱"}，5 分钟内有效`, "ok");
    startAuthCodeCooldown();
  } catch (error) {
    setAuthMessage(errorMessage(error), "error");
  } finally {
    state.authCodeSending = false;
    renderAuth();
  }
}

async function submitAuth(event) {
  event.preventDefault();
  state.authSubmitting = true;
  clearAuthMessage();
  renderAuth();
  try {
    const isRegister = state.authView === "register";
    const data = await postJson(isRegister ? "/api/auth/register" : "/api/auth/login", {
      type: state.authAccountType,
      account: dom.authAccountInput.value.trim(),
      nickname: dom.authNicknameInput.value.trim(),
      code: dom.authCodeInput.value.trim(),
      password: dom.authPasswordInput.value
    });
    state.auth = { user: data.user };
    writeStore(storeKeys.auth, state.auth);
    state.authModalOpen = false;
    dom.authPasswordInput.value = "";
    dom.authCodeInput.value = "";
    status(isRegister ? `注册成功：${data.user.nickname}` : `登录成功：${data.user.nickname}`);
  } catch (error) {
    setAuthMessage(errorMessage(error), "error");
  } finally {
    state.authSubmitting = false;
    renderAuth();
  }
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.message || `${response.status} ${response.statusText}`);
  return data;
}

function startAuthCodeCooldown() {
  if (authCodeTimer) window.clearInterval(authCodeTimer);
  state.authCodeCooldown = 60;
  authCodeTimer = window.setInterval(() => {
    state.authCodeCooldown = Math.max(0, state.authCodeCooldown - 1);
    if (state.authCodeCooldown === 0 && authCodeTimer) {
      window.clearInterval(authCodeTimer);
      authCodeTimer = null;
    }
    renderAuth();
  }, 1000);
}

function setAuthMessage(message, kind) {
  state.authMessage = message;
  state.authMessageKind = kind;
}

function clearAuthMessage() {
  state.authMessage = "";
  state.authMessageKind = "";
}

function switchTab(tab) {
  if (!["recognition", "turnaround", "imageTool", "delivery", "review"].includes(tab)) return;
  state.tab = tab;
  renderTabs();
  if (tab === "imageTool") void loadImageTool();
}

function selectScene(sceneId) {
  if (!sceneConfigs.some((scene) => scene.id === sceneId) || sceneId === state.selectedScene) return;
  state.selectedScene = sceneId;
  ensureSceneRefs(sceneId);
  ensureSceneGate(sceneId);
  persist();
  render();
  status(`已选择场景：${sceneConfig().label}`);
}

function selectOutfit(outfitId) {
  const outfit = wardrobeLibrary.find((item) => item.id === outfitId && item.scene === state.selectedScene);
  if (!outfit) return;
  state.selectedOutfits[state.selectedScene] = outfit.id;
  persist();
  renderWardrobe();
  status(`已选择衣服：${outfit.title}`);
}

function renderTabs() {
  dom.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === state.tab));
  dom.recognitionPanel.hidden = state.tab !== "recognition";
  dom.turnaroundPanel.hidden = state.tab !== "turnaround";
  dom.imageToolPanel.hidden = state.tab !== "imageTool";
  dom.deliveryPanel.hidden = state.tab !== "delivery";
  dom.reviewPanel.hidden = state.tab !== "review";
  dom.recognitionPanel.classList.toggle("active", state.tab === "recognition");
  dom.turnaroundPanel.classList.toggle("active", state.tab === "turnaround");
  dom.imageToolPanel.classList.toggle("active", state.tab === "imageTool");
  dom.deliveryPanel.classList.toggle("active", state.tab === "delivery");
  dom.reviewPanel.classList.toggle("active", state.tab === "review");
}

function renderSummary() {
  const workflow = state.workflow;
  dom.baselineState.textContent = sceneConfig().label;
  dom.finalTotal.textContent = String(workflow?.totals?.final4k || 0);
  dom.chengpinTotal.textContent = String(workflow?.totals?.chengpin || 0);
  dom.syncState.textContent = workflow?.totals?.synced ? "已对齐" : "待复核";
  dom.syncState.classList.toggle("warn", Boolean(workflow && !workflow.totals.synced));
}

function renderHero() {
  const sceneImages = sceneResultBatches(state.selectedScene).flatMap((batch) => batch.images || []);
  const images = sceneImages.length ? sceneImages : (state.workflow?.batches || []).flatMap((batch) => batch.images || []);
  const picks = [images[1], images[Math.floor(images.length / 2)], images[images.length - 2]].filter(Boolean);
  [dom.heroImageMain, dom.heroImageSide, dom.heroImageTail].forEach((image, index) => {
    const pick = picks[index] || picks[0];
    if (!pick) {
      image.removeAttribute("src");
      return;
    }
    image.src = pick.url;
  });
}

function renderStages() {
  const stages = state.workflow?.stages || [
    { id: "originals", label: "场景素材", status: "blocked", evidence: "等待导入" },
    { id: "face", label: "身份确认", status: "blocked", evidence: "等待确认" },
    { id: "turnaround", label: "三视图", status: "blocked", evidence: "等待复核" },
    { id: "identity", label: "身份复核", status: "blocked", evidence: "等待确认" },
    { id: "batch", label: "模板样片", status: "blocked", evidence: "等待生成" },
    { id: "delivery", label: "交付成片", status: "blocked", evidence: "等待交付" }
  ];
  dom.stageRail.innerHTML = stages.map((stage, index) => `
    <article class="stage ${statusClass(stage.status)}" data-stage="${attr(stageTab(index))}" data-step="${String(index + 1).padStart(2, "0")}">
      <span>${String(index + 1).padStart(2, "0")}</span>
      <strong>${esc(stageLabel(stage, index))}</strong>
      <small>${esc(stageEvidence(stage, index))}</small>
    </article>`).join("");
  dom.stageRail.querySelectorAll("[data-stage]").forEach((item) => {
    item.addEventListener("click", () => switchTab(item.dataset.stage));
  });
}

function renderCustomerFlow() {
  const step = customerStep();
  dom.customerStepPanel.dataset.step = step.id;
  dom.customerStepKicker.textContent = `下一步 · ${step.index}/5`;
  dom.customerStepTitle.textContent = step.title;
  dom.customerStepCopy.textContent = step.copy;
  dom.customerStepProof.textContent = step.proof;
  dom.customerStepDetail.textContent = step.detail;
  dom.customerNextBtn.textContent = step.action;
  dom.customerNextBtn.dataset.targetTab = step.tab;
  dom.customerNextBtn.disabled = Boolean(step.disabled);
  dom.customerFlowRail.innerHTML = customerFlowItems().map((item) => `
    <button class="customer-flow-step ${item.state}" data-flow-tab="${attr(item.tab)}" type="button">
      <span>${esc(item.index)}</span>
      <strong>${esc(item.title)}</strong>
      <small>${esc(item.caption)}</small>
    </button>`).join("");
  dom.customerFlowRail.querySelectorAll("[data-flow-tab]").forEach((item) => {
    item.addEventListener("click", () => switchTab(item.dataset.flowTab || "recognition"));
  });
}

function renderScene() {
  const selected = sceneConfig();
  document.body.dataset.scene = selected.id;
  const theme = sceneTheme(selected.id);
  dom.heroSceneTone.textContent = theme.tone;
  dom.heroSceneProof.textContent = theme.proof;
  dom.sceneTitle.textContent = `${selected.label}素材确认`;
  dom.sceneIntro.textContent = selected.intro;
  dom.sceneMeta.textContent = selected.meta;
  dom.sideSceneTitle.textContent = `${selected.label}人物确认`;
  dom.sideSceneCopy.textContent = "确认人物和场景素材后进入三视图复核。";
  dom.sideSceneChecklist.innerHTML = selected.checklist.map((item) => `<span>${esc(item)}</span>`).join("");
  dom.sceneRail.innerHTML = sceneConfigs.map((scene) => `
    <button class="scene-card ${scene.id === state.selectedScene ? "active" : ""}" data-scene="${attr(scene.id)}" type="button">
      <span class="scene-card-top">
        <strong>${esc(scene.label)}</strong>
        <em>${esc(sceneSampleLabel(scene.id))}</em>
      </span>
      <small>${esc(scene.meta)}</small>
    </button>`).join("");
  dom.sceneCampaignStrip.innerHTML = theme.cards.map((card, index) => `
    <article class="campaign-card" data-index="${index + 1}">
      <span>${esc(card.label)}</span>
      <strong>${esc(card.title)}</strong>
      <small>${esc(card.copy)}</small>
    </article>`).join("");
  dom.sceneRail.querySelectorAll("[data-scene]").forEach((item) => {
    item.addEventListener("click", () => selectScene(item.dataset.scene || "wedding"));
  });
}

function renderUploadCards() {
  const selected = sceneConfig();
  ensureSceneRefs(selected.id);
  dom.uploadGrid.innerHTML = selected.roles.map((role) => `
    <label class="upload-card">
      <span>${esc(role.label)}</span>
      <small>${esc(role.note)}</small>
      <input data-upload-role="${attr(role.id)}" type="file" accept="image/*" multiple />
    </label>`).join("");
  dom.uploadGrid.querySelectorAll("[data-upload-role]").forEach((input) => {
    input.addEventListener("change", () => void addRefs(input.dataset.uploadRole || "", input));
  });
}

function renderRefs() {
  const refs = allRefs();
  if (!refs.length) {
    dom.referenceStrip.innerHTML = `<div class="empty">等待${esc(sceneConfig().short)}素材</div>`;
    return;
  }
  dom.referenceStrip.innerHTML = refs.map((ref) => `
    <article class="ref-card">
      <img src="${attr(ref.dataUrl)}" alt="${attr(ref.name)}" />
      <div><strong>${esc(roleName(ref.role))}</strong><span>${esc(ref.name)}</span></div>
    </article>`).join("");
}

function renderWardrobe() {
  const items = wardrobeItemsForScene();
  const picked = selectedOutfit();
  dom.wardrobeSummary.textContent = `${sceneConfig().label}可选 ${items.length} 套 · 总库 ${wardrobeLibrary.length} 套`;
  dom.selectedOutfitTitle.textContent = picked ? picked.title : "未选择";
  dom.selectedOutfitDetail.textContent = picked ? `${picked.pieces} · ${picked.palette} · ${picked.season}` : "先从衣服库里选一套。";
  dom.wardrobeGrid.innerHTML = items.map((item) => `
    <button class="outfit-card ${picked?.id === item.id ? "active" : ""}" data-outfit="${attr(item.id)}" type="button">
      <span>${esc(item.target)}</span>
      <strong>${esc(item.title)}</strong>
      <small>${esc(item.pieces)}</small>
      <em>${esc(item.palette)} · ${esc(item.texture)} · ${esc(item.season)}</em>
    </button>`).join("");
  dom.wardrobeGrid.querySelectorAll("[data-outfit]").forEach((item) => {
    item.addEventListener("click", () => selectOutfit(item.dataset.outfit || ""));
  });
}

function renderEvidence() {
  const baseline = state.workflow?.identityBaseline;
  setEvidence(dom.baselineCompareLink, dom.baselineCompareImg, baseline?.compareSheetUrl, baseline?.compareSheetExists);
  setEvidence(dom.turnaroundLink, dom.turnaroundImg, baseline?.turnaroundUrl, baseline?.turnaroundExists);
  dom.sourcePolicy.textContent = sceneConfig().sourcePolicy;
}

function renderBatches() {
  const batches = sceneResultBatches();
  dom.batchSummary.textContent = state.workflow ? `${sceneConfig().label} · ${batches.length} 组模板 · 样片 ${countBatchImages(batches)} 张` : "读取中";
  syncSelectedBatch(batches);
  if (!batches.length) {
    dom.batchList.innerHTML = `<div class="empty">暂无${esc(sceneConfig().label)}模板样片</div>`;
    renderViewer(null);
    return;
  }
  dom.batchList.innerHTML = batches.map((batch) => {
    const cover = batchCoverUrl(batch);
    return `
    <article class="batch-row ${cover ? "has-cover" : ""} ${batch.synced ? "ready" : "warn"} ${batch.folder === state.selectedBatch ? "selected" : ""}" data-batch="${attr(batch.folder)}" tabindex="0">
      ${cover ? `<img class="batch-cover" src="${attr(cover)}" alt="${attr(batchLabel(batch))}" loading="lazy" />` : ""}
      <div class="batch-copy">
        <strong>${esc(batchLabel(batch))}</strong>
        <small>${esc(batchNote(batch))}</small>
      </div>
      <div class="batch-meta">
        <span>模板样片 ${batch.finalCount} 张</span>
        <span>${(batch.images || []).length} 张</span>
        ${batch.contactSheetExists ? `<a href="${attr(batch.contactSheetUrl)}" target="_blank" rel="noopener">看片表</a>` : "<em>缺看片表</em>"}
        ${batch.buildReportExists ? "<span>复核记录</span>" : "<em>缺复核</em>"}
      </div>
    </article>`;
  }).join("");
  dom.batchList.querySelectorAll("[data-batch]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target instanceof HTMLAnchorElement) return;
      selectBatch(row.dataset.batch || "");
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      selectBatch(row.dataset.batch || "");
    });
  });
  renderViewer(currentBatch());
}

function renderDelivery() {
  const batches = deliveryBatches();
  const total = batches.reduce((sum, batch) => sum + (batch.images || []).length, 0);
  dom.deliverySummary.textContent = state.workflow ? `交付成片 ${total} 张 · ${batches.length} 组` : "读取中";
  syncSelectedDeliveryBatch(batches);
  if (!batches.length) {
    dom.deliveryBatchList.innerHTML = `<div class="empty">暂无交付成片</div>`;
    dom.deliveryImageGrid.innerHTML = `<div class="empty">成片会显示在这里，不显示模板样片。</div>`;
    return;
  }
  dom.deliveryBatchList.innerHTML = batches.map((batch) => {
    const cover = batchCoverUrl(batch);
    return `
    <article class="batch-row ${cover ? "has-cover" : ""} ${batch.synced ? "ready" : "warn"} ${batch.folder === state.selectedDeliveryBatch ? "selected" : ""}" data-delivery-batch="${attr(batch.folder)}" tabindex="0">
      ${cover ? `<img class="batch-cover" src="${attr(cover)}" alt="${attr(batchLabel(batch))}" loading="lazy" />` : ""}
      <div class="batch-copy">
        <strong>${esc(batchLabel(batch))}</strong>
        <small>${esc(batchNote(batch))}</small>
      </div>
      <div class="batch-meta">
        <span>成片 ${batch.chengpinCount || (batch.images || []).length} 张</span>
        ${batch.contactSheetExists ? `<a href="${attr(batch.contactSheetUrl)}" target="_blank" rel="noopener">看片表</a>` : "<em>缺看片表</em>"}
        ${batch.buildReportExists ? "<span>复核记录</span>" : "<em>缺复核</em>"}
      </div>
    </article>`;
  }).join("");
  dom.deliveryBatchList.querySelectorAll("[data-delivery-batch]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target instanceof HTMLAnchorElement) return;
      selectDeliveryBatch(row.dataset.deliveryBatch || "");
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      selectDeliveryBatch(row.dataset.deliveryBatch || "");
    });
  });
  const batch = currentDeliveryBatch();
  const images = batch?.images || [];
  dom.deliveryImageGrid.innerHTML = images.length ? images.map((image) => `
    <a class="delivery-image-card" href="${attr(image.url)}" target="_blank" rel="noopener">
      <img src="${attr(image.url)}" alt="${attr(`${batchLabel(batch)} ${image.title}`)}" loading="lazy" />
      <span>${esc(image.title)}</span>
    </a>`).join("") : `<div class="empty">该批次暂无成片图片</div>`;
}

async function loadImageTool(force = false) {
  if (state.imageToolState === "loading") return;
  if (state.imageTool && !force) return;
  state.imageToolState = "loading";
  state.imageToolMessage = "连接生图工具";
  renderImageTool();
  try {
    const response = await fetch("/api/tool/image-workbench", { headers: { Accept: "application/json" } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.message || `${response.status} ${response.statusText}`);
    state.imageTool = data.tool;
    state.imageToolState = "ready";
    state.imageToolMessage = "工具入口已就绪";
    renderImageTool();
    const healthy = await probeImageToolHealth(data.tool?.healthUrl);
    state.imageToolState = healthy ? "ready" : "warn";
    state.imageToolMessage = healthy ? "生图工具已连接" : "入口已加载，4174 服务可能未启动";
  } catch (error) {
    state.imageTool = null;
    state.imageToolState = "warn";
    state.imageToolMessage = `工具连接失败：${errorMessage(error)}`;
  }
  renderImageTool();
}

async function probeImageToolHealth(healthUrl) {
  if (!healthUrl) return false;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 1800);
  try {
    const response = await fetch(healthUrl, { headers: { Accept: "application/json" }, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    return response.ok && data.ok !== false;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

function renderImageTool() {
  const tool = state.imageTool;
  const url = tool?.url || "";
  dom.imageToolStatus.textContent = state.imageToolMessage;
  dom.imageToolStatus.classList.toggle("ready", state.imageToolState === "ready");
  dom.imageToolStatus.classList.toggle("warn", state.imageToolState === "warn");
  dom.refreshImageToolBtn.disabled = state.imageToolState === "loading";
  dom.openImageToolBtn.disabled = !url;
  dom.imageToolFrame.hidden = !url;
  dom.imageToolEmpty.hidden = Boolean(url);
  if (url && dom.imageToolFrame.getAttribute("src") !== url) dom.imageToolFrame.src = url;
  if (!url) dom.imageToolFrame.removeAttribute("src");
}

function openImageTool() {
  const url = state.imageTool?.url;
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

function markImageToolLoaded() {
  if (state.imageToolState === "warn" || !state.imageTool) return;
  state.imageToolState = "ready";
  state.imageToolMessage = "生图工具已打开";
  renderImageTool();
}

function renderGeneration() {
  const job = state.generation || state.workflow?.activeGeneration;
  const running = job?.status === "running";
  const gate = canGenerateSamples();
  dom.generateSceneBtn.disabled = Boolean(running) || !gate.ok;
  dom.generateAllBtn.disabled = Boolean(running) || !gate.ok;
  dom.generateSceneBtn.title = gate.ok ? "" : gate.reason;
  dom.generateAllBtn.title = gate.ok ? "" : gate.reason;
  dom.generationStatus.textContent = generationStatusText(job);
  dom.generationStatus.classList.toggle("running", Boolean(running));
  dom.generationStatus.classList.toggle("ready", job?.status === "completed");
  dom.generationStatus.classList.toggle("warn", job?.status === "failed");
  scheduleGenerationPoll(Boolean(running));
}

function renderViewer(batch) {
  const images = batch?.images || [];
  if (!batch || !images.length) {
    dom.viewerBatch.textContent = batch ? batchLabel(batch) : "选择批次";
    dom.viewerTitle.textContent = "暂无图片";
    dom.viewerCounter.textContent = "0 / 0";
    dom.viewerImage.removeAttribute("src");
    dom.viewerImage.hidden = true;
    dom.viewerEmpty.hidden = false;
    dom.viewerZoomBtn.disabled = true;
    dom.viewerPrevBtn.disabled = true;
    dom.viewerNextBtn.disabled = true;
    dom.thumbGrid.innerHTML = "";
    if (state.lightboxOpen) closeLightbox();
    return;
  }
  if (state.selectedImageIndex >= images.length) state.selectedImageIndex = 0;
  const image = images[state.selectedImageIndex];
  dom.viewerBatch.textContent = batchLabel(batch);
  dom.viewerTitle.textContent = image.title;
  dom.viewerCounter.textContent = `${state.selectedImageIndex + 1} / ${images.length}`;
  dom.viewerImage.src = image.url;
  dom.viewerImage.alt = `${batchLabel(batch)} ${image.title}`;
  dom.viewerImage.hidden = false;
  dom.viewerEmpty.hidden = true;
  dom.viewerZoomBtn.disabled = false;
  dom.viewerPrevBtn.disabled = images.length < 2;
  dom.viewerNextBtn.disabled = images.length < 2;
  dom.thumbGrid.innerHTML = images.map((item, index) => `
    <button class="thumb-item ${index === state.selectedImageIndex ? "active" : ""}" data-image-index="${index}" type="button">
      <img src="${attr(item.url)}" alt="${attr(`${batchLabel(batch)} ${item.title}`)}" loading="lazy" />
      <span>${esc(item.title)}</span>
    </button>`).join("");
  dom.thumbGrid.querySelectorAll("[data-image-index]").forEach((thumb) => {
    thumb.addEventListener("click", () => selectImage(Number(thumb.dataset.imageIndex) || 0));
  });
  if (state.lightboxOpen) renderLightbox();
}

function syncSelectedBatch(batches) {
  if (!batches.length) {
    state.selectedBatch = "";
    state.selectedImageIndex = 0;
    return;
  }
  const selectedStillExists = batches.some((batch) => batch.folder === state.selectedBatch);
  if (!state.selectedBatch || !selectedStillExists) {
    state.selectedBatch = batches.find((batch) => (batch.images || []).length)?.folder || batches[0].folder;
    state.selectedImageIndex = 0;
  }
}

function syncSelectedDeliveryBatch(batches) {
  if (!batches.length) {
    state.selectedDeliveryBatch = "";
    return;
  }
  const selectedStillExists = batches.some((batch) => batch.folder === state.selectedDeliveryBatch);
  if (!state.selectedDeliveryBatch || !selectedStillExists) {
    state.selectedDeliveryBatch = batches.find((batch) => (batch.images || []).length)?.folder || batches[0].folder;
  }
}

function currentBatch() {
  return sceneResultBatches().find((batch) => batch.folder === state.selectedBatch) || null;
}

function currentDeliveryBatch() {
  return deliveryBatches().find((batch) => batch.folder === state.selectedDeliveryBatch) || null;
}

function selectBatch(folder) {
  if (!folder || folder === state.selectedBatch) return;
  state.selectedBatch = folder;
  state.selectedImageIndex = 0;
  resetLightboxZoom();
  renderBatches();
  status(`已选择批次：${currentBatch() ? batchLabel(currentBatch()) : folder}`);
}

function selectDeliveryBatch(folder) {
  if (!folder || folder === state.selectedDeliveryBatch) return;
  state.selectedDeliveryBatch = folder;
  renderDelivery();
  status(`已选择成片批次：${currentDeliveryBatch() ? batchLabel(currentDeliveryBatch()) : folder}`);
}

function selectImage(index) {
  const images = currentBatch()?.images || [];
  if (!images.length) return;
  state.selectedImageIndex = Math.min(Math.max(index, 0), images.length - 1);
  resetLightboxZoom();
  renderViewer(currentBatch());
}

function moveImage(delta) {
  const images = currentBatch()?.images || [];
  if (!images.length) return;
  state.selectedImageIndex = (state.selectedImageIndex + delta + images.length) % images.length;
  resetLightboxZoom();
  renderViewer(currentBatch());
}

function openLightbox() {
  const images = currentBatch()?.images || [];
  if (!images.length) return;
  state.lightboxOpen = true;
  dom.lightbox.hidden = false;
  document.body.classList.add("lightbox-open");
  resetLightboxZoom();
  renderLightbox();
}

function closeLightbox() {
  state.lightboxOpen = false;
  dom.lightbox.hidden = true;
  document.body.classList.remove("lightbox-open");
  dom.lightboxImage.removeAttribute("src");
  resetLightboxZoom();
}

function renderLightbox() {
  const batch = currentBatch();
  const images = batch?.images || [];
  const image = images[state.selectedImageIndex];
  if (!batch || !image) return;
  dom.lightboxBatch.textContent = batchLabel(batch);
  dom.lightboxTitle.textContent = image.title;
  dom.lightboxCounter.textContent = `${state.selectedImageIndex + 1} / ${images.length}`;
  dom.lightboxImage.src = image.url;
  dom.lightboxImage.alt = `${batchLabel(batch)} ${image.title}`;
  dom.lightboxPrevBtn.disabled = images.length < 2;
  dom.lightboxNextBtn.disabled = images.length < 2;
  renderLightboxZoom();
}

function handleLightboxWheel(event) {
  if (!state.lightboxOpen) return;
  event.preventDefault();
  const previousZoom = state.lightboxZoom;
  const nextZoom = clamp(state.lightboxZoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12), 1, 4);
  state.lightboxZoom = Number(nextZoom.toFixed(3));
  state.lightboxOriginX = 50;
  state.lightboxOriginY = 50;
  if (state.lightboxZoom === 1) {
    state.lightboxPanX = 0;
    state.lightboxPanY = 0;
  } else {
    const zoomRatio = state.lightboxZoom / previousZoom;
    state.lightboxPanX *= zoomRatio;
    state.lightboxPanY *= zoomRatio;
    clampLightboxPan();
  }
  renderLightboxZoom();
}

function handleLightboxPointerDown(event) {
  if (!state.lightboxOpen || state.lightboxZoom <= 1 || event.button !== 0) return;
  event.preventDefault();
  state.lightboxDragging = true;
  state.lightboxDragStartX = event.clientX;
  state.lightboxDragStartY = event.clientY;
  state.lightboxDragPanX = state.lightboxPanX;
  state.lightboxDragPanY = state.lightboxPanY;
  dom.lightboxStage.setPointerCapture(event.pointerId);
  renderLightboxZoom();
}

function handleLightboxPointerMove(event) {
  if (!state.lightboxDragging) return;
  event.preventDefault();
  state.lightboxPanX = state.lightboxDragPanX + event.clientX - state.lightboxDragStartX;
  state.lightboxPanY = state.lightboxDragPanY + event.clientY - state.lightboxDragStartY;
  clampLightboxPan();
  renderLightboxZoom();
}

function endLightboxPan(event) {
  if (!state.lightboxDragging) return;
  state.lightboxDragging = false;
  if (event?.pointerId !== undefined && dom.lightboxStage.hasPointerCapture(event.pointerId)) {
    dom.lightboxStage.releasePointerCapture(event.pointerId);
  }
  renderLightboxZoom();
}

function resetLightboxZoom() {
  state.lightboxZoom = 1;
  state.lightboxOriginX = 50;
  state.lightboxOriginY = 50;
  state.lightboxPanX = 0;
  state.lightboxPanY = 0;
  state.lightboxDragging = false;
  renderLightboxZoom();
}

function renderLightboxZoom() {
  if (!dom.lightboxImage || !dom.lightboxZoomLabel) return;
  dom.lightboxImage.style.setProperty("--lightbox-zoom", String(state.lightboxZoom));
  dom.lightboxImage.style.setProperty("--lightbox-origin-x", `${state.lightboxOriginX}%`);
  dom.lightboxImage.style.setProperty("--lightbox-origin-y", `${state.lightboxOriginY}%`);
  dom.lightboxImage.style.setProperty("--lightbox-pan-x", `${state.lightboxPanX}px`);
  dom.lightboxImage.style.setProperty("--lightbox-pan-y", `${state.lightboxPanY}px`);
  dom.lightboxZoomLabel.textContent = `${Math.round(state.lightboxZoom * 100)}%`;
  dom.lightboxResetZoomBtn.disabled = state.lightboxZoom === 1;
  dom.lightboxStage.classList.toggle("is-zoomed", state.lightboxZoom > 1);
  dom.lightboxStage.classList.toggle("is-panning", state.lightboxDragging);
}

function clampLightboxPan() {
  const rect = dom.lightboxStage.getBoundingClientRect();
  const maxX = Math.max(0, ((state.lightboxZoom - 1) * rect.width) / 2);
  const maxY = Math.max(0, ((state.lightboxZoom - 1) * rect.height) / 2);
  state.lightboxPanX = clamp(state.lightboxPanX, -maxX, maxX);
  state.lightboxPanY = clamp(state.lightboxPanY, -maxY, maxY);
}

function handleGlobalKeys(event) {
  if (state.authModalOpen && event.key === "Escape") {
    closeAuth();
    return;
  }
  if (!state.lightboxOpen) return;
  if (event.key === "Escape") closeLightbox();
  if (event.key === "ArrowLeft") moveImage(-1);
  if (event.key === "ArrowRight") moveImage(1);
}

function renderNext() {
  const actions = reviewActions();
  dom.nextList.innerHTML = actions.map((action, index) => `
    <article class="next-item" data-priority="${index + 1}"><span>${index + 1}</span><strong>${esc(action)}</strong></article>`).join("");
}

function renderGate() {
  const count = allRefs().length;
  const gate = currentGate();
  const selected = sceneConfig();
  const locked = gate.batchLocked || !gate.baseline;
  dom.detectFaceBtn.disabled = count === 0;
  dom.buildTurnaroundBtn.disabled = !gate.detected;
  dom.confirmBaselineBtn.disabled = count > 0 && !gate.turnaround;
  dom.lockBatchBtn.textContent = locked ? "恢复出片" : "暂停出片";
  if (!count) {
    dom.gateNote.textContent = `等待导入${selected.short}素材。`;
  } else if (!gate.detected) {
    dom.gateNote.textContent = `已导入 ${count} 张，等待确认人物。`;
  } else if (!gate.turnaround) {
    dom.gateNote.textContent = "人物已确认，等待三视图复核。";
  } else if (!gate.baseline) {
    dom.gateNote.textContent = "三视图已完成，等待交付前确认。";
  } else {
    dom.gateNote.textContent = locked ? "已暂停出片，等待复核。" : "人物和三视图已确认，可生成模板样片。";
  }
}

async function addRefs(role, input) {
  const files = Array.from(input.files || []);
  const refs = await Promise.all(files.map(readFile));
  if (!role) return;
  ensureSceneRefs(state.selectedScene);
  if (!state.refs[state.selectedScene][role]) state.refs[state.selectedScene][role] = [];
  state.refs[state.selectedScene][role].push(...refs);
  updateGate({ detected: false, turnaround: false, baseline: false, batchLocked: true });
  input.value = "";
  persist();
  render();
  status(`已导入${roleName(role)} ${refs.length} 张`);
}

function detectFaces() {
  if (!allRefs().length) return;
  updateGate({ detected: true, turnaround: false, baseline: false, batchLocked: true });
  persist();
  render();
  status(`${sceneConfig().label}人物已确认`);
}

function buildTurnaround() {
  if (!currentGate().detected) return;
  updateGate({ turnaround: true, baseline: false, batchLocked: true });
  persist();
  render();
  status("三视图已完成");
}

function confirmBaseline() {
  updateGate({ detected: true, turnaround: true, baseline: true, batchLocked: false });
  persist();
  render();
  status("三视图已确认，可选模板样片");
}

function toggleBatchLock() {
  updateGate({ batchLocked: !currentGate().batchLocked });
  persist();
  render();
  status(currentGate().batchLocked ? "已暂停出片" : "已恢复出片");
}

function customerStep() {
  const count = allRefs().length;
  const gate = currentGate();
  const selected = sceneConfig();
  const batches = sceneResultBatches();
  const delivery = deliveryBatches();
  if (!count) {
    return {
      id: "refs",
      index: 1,
      tab: "recognition",
      title: "上传人物素材",
      copy: `${selected.label}已选好，先上传清晰人物和关系参考。`,
      proof: "等待素材",
      detail: selected.roles.map((role) => role.label).join(" / "),
      action: "上传素材"
    };
  }
  if (!gate.detected) {
    return {
      id: "identity",
      index: 2,
      tab: "recognition",
      title: "确认人物身份",
      copy: "素材已导入，先确认人物关系和参考图是否正确。",
      proof: `已导入 ${count} 张`,
      detail: "确认后再做三视图。",
      action: "去确认人物"
    };
  }
  if (!gate.turnaround) {
    return {
      id: "turnaround",
      index: 3,
      tab: "turnaround",
      title: "完成三视图复核",
      copy: "先看正面、侧面和身形比例，再开放模板样片。",
      proof: "人物已确认",
      detail: "三视图通过前不能批量出片。",
      action: "看三视图"
    };
  }
  if (!gate.baseline || gate.batchLocked) {
    return {
      id: "baseline",
      index: 3,
      tab: "turnaround",
      title: "确认三视图",
      copy: gate.batchLocked ? "当前已暂停出片，确认三视图后恢复样片生成。" : "三视图已完成，客户确认像本人后再生成样片。",
      proof: gate.batchLocked ? "已暂停" : "待确认",
      detail: "确认后进入模板样片。",
      action: "去确认"
    };
  }
  if (!batches.length) {
    const outfit = selectedOutfit();
    return {
      id: "samples",
      index: 4,
      tab: "recognition",
      title: "生成模板样片",
      copy: `从${selected.label}推荐衣服和模板开始，先出小批样片。`,
      proof: "三视图已确认",
      detail: outfit ? `已选：${outfit.title}` : "可先选衣服，也可直接生成。",
      action: "生成样片"
    };
  }
  return {
    id: "delivery",
    index: 5,
    tab: delivery.length ? "delivery" : "recognition",
    title: delivery.length ? "查看交付成片" : "复核模板样片",
    copy: delivery.length ? "成片已经分区展示，可核对数量并下载。" : "先看样片方向，确认后再进入最终交付。",
    proof: delivery.length ? `交付 ${state.workflow?.totals?.chengpin || 0} 张` : `样片 ${countBatchImages(batches)} 张`,
    detail: "样片和成片分开，避免误交付。",
    action: delivery.length ? "看成片" : "看样片"
  };
}

function customerFlowItems() {
  const count = allRefs().length;
  const gate = currentGate();
  const hasSamples = sceneResultBatches().length > 0;
  const hasDelivery = deliveryBatches().length > 0;
  const states = [
    count ? "done" : "active",
    gate.detected ? "done" : count ? "active" : "locked",
    gate.baseline ? "done" : gate.detected ? "active" : "locked",
    hasSamples ? "done" : gate.baseline && !gate.batchLocked ? "active" : "locked",
    hasDelivery ? "done" : hasSamples ? "active" : "locked"
  ];
  return [
    { index: "1", title: "素材", caption: count ? `${count} 张` : "待传", tab: "recognition", state: states[0] },
    { index: "2", title: "人物", caption: gate.detected ? "已确认" : "待确认", tab: "recognition", state: states[1] },
    { index: "3", title: "三视图", caption: gate.baseline ? "已通过" : gate.turnaround ? "待确认" : "待复核", tab: "turnaround", state: states[2] },
    { index: "4", title: "样片", caption: hasSamples ? `${countBatchImages(sceneResultBatches())} 张` : "待生成", tab: "recognition", state: states[3] },
    { index: "5", title: "交付", caption: hasDelivery ? `${state.workflow?.totals?.chengpin || 0} 张` : "待交付", tab: "delivery", state: states[4] }
  ];
}

function handleCustomerNext() {
  const step = customerStep();
  if (step.id === "identity" && allRefs().length) {
    detectFaces();
    return;
  }
  if (step.id === "samples" && canGenerateSamples().ok) {
    void accelerateGeneration(false);
    return;
  }
  switchTab(step.tab);
  status(step.title);
}

function canGenerateSamples() {
  const gate = currentGate();
  if (!allRefs().length) return { ok: false, reason: "先上传人物素材，再生成模板样片。", shortReason: "待上传素材" };
  if (!gate.detected) return { ok: false, reason: "先确认人物身份，再生成模板样片。", shortReason: "待确认人物" };
  if (!gate.turnaround) return { ok: false, reason: "先完成三视图复核，再生成模板样片。", shortReason: "待三视图" };
  if (!gate.baseline) return { ok: false, reason: "先确认三视图像本人，再生成模板样片。", shortReason: "待确认三视图" };
  if (gate.batchLocked) return { ok: false, reason: "当前已暂停出片，请恢复后再生成。", shortReason: "已暂停出片" };
  return { ok: true, reason: "", shortReason: "" };
}

async function accelerateGeneration(allScenes) {
  const gate = canGenerateSamples();
  if (!gate.ok) {
    status(gate.reason);
    renderGate();
    return;
  }
  const scenes = allScenes ? sceneConfigs.map((scene) => scene.id) : [state.selectedScene];
  const body = {
    allScenes,
    sceneId: state.selectedScene,
    scenes,
    concurrency: 10,
    outfits: generationOutfits(scenes),
    refs: generationRefs(scenes)
  };
  status(allScenes ? "全场景加速任务启动中" : `${sceneConfig().label} 9 张任务启动中`);
  try {
    const response = await fetch("/api/generation/accelerate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.message || `${response.status} ${response.statusText}`);
    state.generation = data.job;
    renderGeneration();
    status(allScenes ? "全场景加速生成已开始" : `${sceneConfig().label} 9 张生成已开始`);
  } catch (error) {
    status(`启动失败：${errorMessage(error)}`);
  }
}

function generationOutfits(scenes) {
  return Object.fromEntries(scenes.map((sceneId) => {
    const outfit = selectedOutfit(sceneId);
    return [sceneId, outfit ? {
      title: outfit.title,
      detail: `${outfit.pieces} · ${outfit.palette} · ${outfit.season}`,
      prompt: outfit.prompt
    } : {}];
  }));
}

function generationRefs(scenes) {
  const result = {};
  for (const sceneId of scenes) {
    const sceneRefs = state.refs[sceneId] || {};
    result[sceneId] = Object.fromEntries(Object.entries(sceneRefs).map(([role, refs]) => [
      role,
      Array.isArray(refs) ? refs.map((ref) => ({ name: ref.name, dataUrl: ref.dataUrl })) : []
    ]));
  }
  return result;
}

let generationPollTimer = null;

function scheduleGenerationPoll(shouldPoll) {
  if (generationPollTimer) {
    window.clearTimeout(generationPollTimer);
    generationPollTimer = null;
  }
  if (!shouldPoll) return;
  generationPollTimer = window.setTimeout(() => void loadStatus(), 5000);
}

function generationStatusText(job) {
  const gate = canGenerateSamples();
  if (!job && !gate.ok) return gate.shortReason;
  if (!job) return "待启动";
  const scenes = Array.isArray(job.sceneLabels) && job.sceneLabels.length ? job.sceneLabels.join("、") : "场景";
  if (job.status === "running") return `生成中 · ${scenes} · ${job.concurrency || 10}线程`;
  if (job.status === "completed") return `已完成 · ${scenes}`;
  if (job.status === "failed") return `需处理 · ${scenes}`;
  return "待启动";
}

function clearRefs() {
  state.refs[state.selectedScene] = emptySceneRefs(state.selectedScene);
  state.gates[state.selectedScene] = { ...defaultGate, baseline: false, batchLocked: true };
  persist();
  render();
  status(`${sceneConfig().label}素材已清空`);
}

function identityStateLabel(workflow) {
  if (!workflow) return "读取中";
  const gate = currentGate();
  if (workflow.identityBaseline?.status === "accepted" || gate.baseline) return "已确认";
  if (gate.turnaround) return "待确认";
  return "待确认";
}

function stageLabel(stage, index) {
  const labels = {
    originals: "场景素材",
    face: "人物确认",
    turnaround: "三视图",
    baseline: "交付复核",
    batch: "模板样片",
    delivery: "交付成片"
  };
  return labels[stage.id] || labelsByIndex(index) || stage.label;
}

function stageEvidence(stage, index) {
  if (stage.id === "originals") return stage.status === "ready" ? "已导入" : "等待导入";
  if (stage.id === "face") return stage.status === "ready" || stage.status === "accepted" ? "已确认" : "待确认";
  if (stage.id === "turnaround") return stage.status === "ready" || stage.status === "accepted" ? "待复核" : "等待三视图";
  if (stage.id === "identity" || stage.id === "baseline") return stage.status === "accepted" ? "已确认" : "待确认";
  if (stage.id === "batch") return stage.evidence || "待生成";
  if (stage.id === "delivery") return deliveryEvidence();
  const fallback = ["等待导入", "等待确认", "等待复核", "等待确认", "等待选片", "等待交付"][index];
  return fallback || stage.evidence;
}

function labelsByIndex(index) {
  return ["场景素材", "人物确认", "三视图", "交付复核", "模板样片", "交付成片"][index];
}

function deliveryEvidence() {
  const totals = state.workflow?.totals;
  if (!totals) return "等待交付";
  return `交付 ${totals.chengpin}`;
}

function reviewActions() {
  const selected = sceneConfig();
  const batches = deliveryBatches();
  const pending = batches
    .filter((batch) => !batch.synced)
    .slice(0, 2)
    .map((batch) => `${batchLabel(batch)}：核对场景样片`);
  return [
    ...selected.review,
    ...pending,
    "确认选片和交付数量"
  ].slice(0, 5);
}

function batchLabel(batch) {
  return String(batch?.label || "样片").replace(/\s+v\d+.*$/i, "");
}

function batchNote(batch) {
  if (batch?.kind === "sceneTemplate") return `${sceneConfig(batch.sceneId).label} 9 张模板样片`;
  if (!batch?.synced) return "交付和原图待核对";
  if (!batch.contactSheetExists) return "待补看片表";
  if (!batch.buildReportExists) return "待补复核记录";
  if (String(batch.risk || "").includes("重点")) return "重点看片复核";
  if (String(batch.risk || "").includes("候选")) return "候选选片复核";
  return "可看片选片";
}

function sceneResultBatches(sceneId = state.selectedScene) {
  return (state.workflow?.batches || []).filter((batch) => batch.kind === "sceneTemplate" && batch.sceneId === sceneId);
}

function deliveryBatches() {
  return (state.workflow?.batches || []).filter((batch) => batch.kind !== "sceneTemplate");
}

function countBatchImages(batches) {
  return batches.reduce((sum, batch) => sum + (batch.images || []).length, 0);
}

function sceneSampleLabel(sceneId) {
  const count = countBatchImages(sceneResultBatches(sceneId));
  return count ? `样片 ${count} 张` : "暂无样片";
}

function sceneTheme(sceneId) {
  return sceneThemes[sceneId] || sceneThemes.default;
}

function batchCoverUrl(batch) {
  return (batch?.images || [])[0]?.url || "";
}

function setEvidence(link, img, url, exists) {
  if (url && exists) {
    link.href = url;
    img.src = url;
    link.classList.remove("missing");
    return;
  }
  link.removeAttribute("href");
  img.removeAttribute("src");
  link.classList.add("missing");
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      id: `ref-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      dataUrl: String(reader.result || "")
    });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function allRefs() {
  const refs = state.refs[state.selectedScene] || {};
  return sceneConfig().roles.flatMap((role) => (refs[role.id] || []).map((ref) => ({ ...ref, role: role.id })));
}

function persist() {
  writeStore(storeKeys.scene, state.selectedScene);
  writeStore(storeKeys.refs, state.refs);
  writeStore(storeKeys.gate, state.gates);
  writeStore(storeKeys.outfit, state.selectedOutfits);
}

function readStore(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    if (!value) return clone(fallback);
    const parsed = JSON.parse(value);
    return Array.isArray(fallback) ? parsed : { ...fallback, ...parsed };
  } catch {
    return clone(fallback);
  }
}

function writeStore(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local previews can be too large for storage; the visible UI still works for the current session.
  }
}

function normalizeAuth(raw) {
  if (!raw || typeof raw !== "object" || !raw.user || typeof raw.user !== "object") return { user: null };
  return {
    user: {
      id: String(raw.user.id || ""),
      nickname: String(raw.user.nickname || "已注册"),
      type: raw.user.type === "phone" ? "phone" : "email",
      accountLabel: String(raw.user.accountLabel || "")
    }
  };
}

function accountTypeLabel(type) {
  return "邮箱";
}

function nicknameInitial(nickname) {
  return String(nickname || "已").trim().slice(0, 1) || "已";
}

function status(message) {
  dom.statusLine.textContent = message;
}

function statusClass(value) {
  if (["accepted", "ready", "synced"].includes(value)) return "ready";
  if (["manual", "warning"].includes(value)) return "warn";
  return "locked";
}

function stageTab(index) {
  if (index <= 1) return "recognition";
  if (index <= 3) return "turnaround";
  if (index === 4) return "recognition";
  if (index === 5) return "delivery";
  return "review";
}

function roleName(role) {
  const config = sceneConfig();
  return config.roles.find((item) => item.id === role)?.label || "参考素材";
}

function buildWardrobeLibrary() {
  return sceneConfigs.flatMap((scene) => {
    const blueprint = wardrobeBlueprints[scene.id];
    return blueprint.styles.flatMap((style, styleIndex) => blueprint.palettes.map((palette, paletteIndex) => {
      const index = styleIndex * blueprint.palettes.length + paletteIndex + 1;
      const target = blueprint.targets[(styleIndex + paletteIndex) % blueprint.targets.length];
      const pieces = blueprint.pieces[styleIndex % blueprint.pieces.length];
      const texture = blueprint.textures[(styleIndex + paletteIndex) % blueprint.textures.length];
      const season = seasons[(styleIndex + paletteIndex) % seasons.length];
      return {
        id: `${scene.id}-${String(index).padStart(3, "0")}`,
        scene: scene.id,
        target,
        title: `${style} · ${palette[0]}`,
        style,
        palette: palette[1],
        texture,
        season,
        pieces,
        prompt: `${scene.label}，${target}，${style}，${pieces}，${palette[1]}，${texture}质感，${season}季拍照造型`
      };
    }));
  });
}

function wardrobeItemsForScene(sceneId = state.selectedScene) {
  return wardrobeLibrary.filter((item) => item.scene === sceneId);
}

function selectedOutfit(sceneId = state.selectedScene) {
  const outfitId = state.selectedOutfits[sceneId];
  return wardrobeLibrary.find((item) => item.id === outfitId) || null;
}

function sceneConfig(sceneId = state.selectedScene) {
  return sceneConfigs.find((scene) => scene.id === sceneId) || sceneConfigs[0];
}

function readSceneStore() {
  try {
    const value = window.localStorage.getItem(storeKeys.scene);
    if (!value) return "wedding";
    const parsed = JSON.parse(value);
    const sceneId = typeof parsed === "string" ? parsed : parsed?.id;
    return sceneConfigs.some((scene) => scene.id === sceneId) ? sceneId : "wedding";
  } catch {
    return "wedding";
  }
}

function normalizeRefs(raw) {
  const refs = {};
  for (const scene of sceneConfigs) refs[scene.id] = emptySceneRefs(scene.id);
  if (raw && typeof raw === "object" && ("bride" in raw || "groom" in raw || "couple" in raw)) {
    refs.wedding = { ...refs.wedding, ...raw };
    return refs;
  }
  for (const scene of sceneConfigs) {
    refs[scene.id] = { ...refs[scene.id], ...(raw?.[scene.id] || {}) };
  }
  return refs;
}

function emptySceneRefs(sceneId) {
  const config = sceneConfig(sceneId);
  return Object.fromEntries(config.roles.map((role) => [role.id, []]));
}

function ensureSceneRefs(sceneId) {
  if (!state.refs[sceneId]) state.refs[sceneId] = emptySceneRefs(sceneId);
  const current = state.refs[sceneId];
  for (const role of sceneConfig(sceneId).roles) {
    if (!Array.isArray(current[role.id])) current[role.id] = [];
  }
  return current;
}

function normalizeGates(raw) {
  const gates = Object.fromEntries(sceneConfigs.map((scene) => [scene.id, { ...defaultGate }]));
  if (raw && typeof raw === "object" && "detected" in raw) {
    gates.wedding = { ...defaultGate, ...raw };
    return gates;
  }
  for (const scene of sceneConfigs) {
    gates[scene.id] = { ...defaultGate, ...(raw?.[scene.id] || {}) };
  }
  return gates;
}

function normalizeSelectedOutfits(raw) {
  const selected = Object.fromEntries(sceneConfigs.map((scene) => [scene.id, ""]));
  if (!raw || typeof raw !== "object") return selected;
  for (const scene of sceneConfigs) {
    const outfitId = raw[scene.id];
    selected[scene.id] = wardrobeLibrary.some((item) => item.id === outfitId && item.scene === scene.id) ? outfitId : "";
  }
  return selected;
}

function ensureSceneGate(sceneId) {
  if (!state.gates[sceneId]) state.gates[sceneId] = { ...defaultGate };
  return state.gates[sceneId];
}

function currentGate() {
  return ensureSceneGate(state.selectedScene);
}

function updateGate(next) {
  state.gates[state.selectedScene] = { ...currentGate(), ...next };
}

function clone(value) {
  return Array.isArray(value) ? [...value] : { ...value };
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]);
}

function attr(value) {
  return esc(value);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
