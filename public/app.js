const keys = {
  settings: "pic.native.settings",
  params: "pic.native.params",
  history: "pic.native.history",
  deletedHistory: "pic.native.deletedHistory",
  studio: "pic.native.studio",
  clientKey: "pic.native.clientKey",
  auth: "pic.native.auth"
};

const appVersion = "20260503-sample-groups";
const studioRequiredReferenceCount = 3;
const sampleStatusLabels = ["待查看", "已查看", "已入围", "已淘汰", "待重生", "已转正"];
const legacyHistoryKeys = ["alexai-replica-tasks", "gpt-image-node-tasks"];
const referenceImageLimits = {
  maxEdge: 2048,
  maxBytes: 18 * 1024 * 1024,
  jpegQuality: 0.9
};
const creditCopy = {
  rechargeMenu: "买积分",
  ordersLoadError: "充值记录没加载出来",
  ledgerLoadError: "积分明细没加载出来",
  emptyOrders: "还没有充值记录",
  emptyLedger: "还没有积分明细",
  recentOrders: "最近充值",
  recentLedger: "最近明细",
  ordersUnavailable: "充值记录暂时没加载出来",
  ledgerUnavailable: "积分明细暂时没加载出来",
  paymentReturnHint: "付款已返回，请刷新充值记录确认是否到账"
};

const defaults = {
  settings: { apiUrl: "https://img.inklens.art/v1", apiKey: "", apiMode: "images", mainModelId: "gpt-5.5", modelId: "gpt-image-2", timeoutSeconds: 120 },
  params: { size: "auto", quality: "auto", outputFormat: "png", count: 1 },
  studio: {
    selectedSceneId: "wedding",
    identityStatus: "待上传",
    selectedSampleId: "",
    selectedSampleGroupId: "",
    selectedSamplePhotoId: "",
    previewedSampleKey: "",
    selectedTemplateId: "",
    selectedTemplateTitle: "",
    selectedTemplateCategory: "",
    selectedTemplatePrompt: "",
    templateConfirmed: false,
    referenceCount: 0,
    deliveryReadyCount: 0,
    sampleDecisions: {}
  },
  credits: { balance: 0, ledger: [], packages: [], updatedAt: "" },
  payment: { provider: "stripe", mode: "disabled", enabled: false, ready: false, currency: "cny", message: "现在还不能购买积分" },
  auth: { user: null }
};

const studioFlow = [
  { key: "upload", title: "传三张图", note: "正脸、半身、全身参考" },
  { key: "threeview", title: "确认像本人", note: "像本人，才更稳" },
  { key: "template", title: "选模板", note: "风格统一，出片更稳" },
  { key: "generate", title: "生成", note: "成片直达作品库" }
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
      { id: "chinese", title: "中式礼服", tags: "秀禾、旗袍、红金仪式感", query: "中式婚礼 写真 情侣", prompt: "以已确认的两位参考照为基础，生成一组中式婚礼写真样片。新娘穿高级秀禾或旗袍，新郎穿合身中式礼服，红金配色克制，脸部清晰像本人，真实皮肤质感，姿态自然，不要影楼站桩，不要夸张磨皮。" },
      { id: "travel", title: "旅拍大片", tags: "目的地、自然互动、电影感", query: "婚纱 旅拍 情侣", prompt: "以已确认的情侣参考照为基础，生成目的地婚纱旅拍样片。真实旅拍光线，自然牵手互动，婚纱材质高级，地标背景可信，脸部清晰像本人，避免游客打卡感和假背景。" },
      { id: "registry", title: "婚登照", tags: "干净、亲密、可分享", query: "婚登照 情侣 写真", prompt: "以两位参考照为基础，生成干净高级的婚登纪念照样片。浅色背景，亲密但克制的双人构图，服装整洁，五官清晰像本人，适合社交分享，不要证件照僵硬感。" }
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
      { id: "daily", title: "日常胶片", tags: "街拍、松弛、真实关系", query: "情侣 日常 胶片", prompt: "以两位参考照为基础，生成情侣日常胶片写真样片。城市街头或咖啡馆环境，自然说笑互动，色彩柔和，脸部像本人，关系亲密但不摆拍。" },
      { id: "travel", title: "旅行同行", tags: "牵手、远景、目的地", query: "情侣 旅行 写真", prompt: "以情侣参考照为基础，生成旅行情侣写真样片。两人并肩或牵手走在目的地街道，背景真实，服装协调，脸部清晰，避免网红打卡姿势。" },
      { id: "cinema", title: "城市地标", tags: "地标、街区、旅行纪念", query: "情侣 城市地标 写真", prompt: "以两位参考照为基础，生成城市地标情侣写真样片。两人自然同行或并肩看向地标，背景真实可信，服装协调，脸像本人，避免游客打卡姿势和假背景。" }
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
      { id: "studio", title: "棚拍合照", tags: "干净、亲密、杂志感", query: "闺蜜照 棚拍 写真", prompt: "以已确认的闺蜜参考照为基础，生成棚拍闺蜜写真样片。两人亲密朋友关系，自然靠近但不僵硬，服装同系列但不完全相同，脸部各自像本人，不串脸。" },
      { id: "street", title: "城市街拍", tags: "走路、说笑、轻纪实", query: "闺蜜照 街拍", prompt: "以闺蜜参考照为基础，生成城市街拍闺蜜写真样片。两人边走边笑，动作自然，有轻纪实感，背景有生活气，脸部清晰且身份不混淆。" },
      { id: "birthday", title: "闺蜜婚礼", tags: "伴娘、仪式、温暖合照", query: "闺蜜 婚礼 伴娘 写真", prompt: "以闺蜜参考照为基础，生成闺蜜婚礼或伴娘合照样片。婚礼现场氛围真实，服装协调但不抢新人，情绪温暖，五官各自像本人，避免串脸和廉价影棚感。" }
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
      { id: "campus", title: "校园成长", tags: "书包、操场、自然笑容", query: "10岁 儿童 写真 校园", prompt: "以儿童参考照为基础，生成 10 岁成长纪念样片。校园或操场环境，自然笑容，服装干净，年龄感准确，脸像本人，不要成人化妆容。" },
      { id: "birthday", title: "生日纪念", tags: "蛋糕、家庭、明亮", query: "儿童 生日 写真", prompt: "以儿童参考照为基础，生成 10 岁生日纪念写真样片。明亮室内或户外，蛋糕和气球克制点缀，孩子表情自然，身份像本人，画面温暖不幼稚。" },
      { id: "outdoor", title: "户外奔跑", tags: "草地、阳光、活力", query: "儿童 户外 写真", prompt: "以儿童参考照为基础，生成户外成长写真样片。自然阳光、草地或公园，轻跑或回头笑，脸部清晰，动作真实，避免夸张童话滤镜。" }
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
      { id: "french", title: "法式胶片", tags: "慵懒、自然、轻复古", query: "女生写真 法式 胶片", prompt: "以已确认的单人参考照为基础，生成法式胶片女生写真样片。自然妆发，轻复古服装，窗边或街角光线，脸像本人，皮肤真实，不要网红过度磨皮。" },
      { id: "magazine", title: "杂志肖像", tags: "高级、干净、强质感", query: "女生写真 杂志 肖像", prompt: "以单人参考照为基础，生成高级杂志肖像样片。干净背景，精致但不过度的妆发，五官清晰像本人，构图克制，避免塑料皮肤和夸张脸型。" },
      { id: "guofeng", title: "轻国风", tags: "中式、素雅、东方气质", query: "女生写真 国风", prompt: "以单人参考照为基础，生成轻国风女生写真样片。素雅中式服装或改良旗袍，浅色背景，东方气质克制，脸像本人，不要戏服化和夸张古装。" }
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
      { id: "anniversary", title: "纪念合照", tags: "端庄、温暖、真实", query: "夕阳红 纪念照", prompt: "以两位长辈参考照为基础，生成夕阳红纪念合照样片。端庄温暖的室内或园林环境，表情自然，年龄感真实，脸像本人，不要过度年轻化。" },
      { id: "travel", title: "旅行留念", tags: "景点、牵手、轻松", query: "夕阳红 旅行 写真", prompt: "以长辈参考照为基础，生成旅行纪念写真样片。两人自然站立或牵手，背景是可信的旅行地点，服装得体，脸部清晰，避免假景区背景。" },
      { id: "qipao", title: "旗袍礼服", tags: "中式、仪式、优雅", query: "夕阳红 旗袍 写真", prompt: "以长辈参考照为基础，生成中式旗袍礼服纪念照样片。服装高级合身，光线柔和，人物端庄亲切，年龄感准确，脸像本人，不要过度美颜。" }
    ]
  }
];

const studioSceneTemplateLabels = {
  wedding: "婚纱照",
  couple: "情侣照",
  friends: "闺蜜照",
  child10: "10岁照",
  portrait: "女生写真",
  senior: "夕阳红"
};

const studioSamplePreviewSets = {
  wedding: {
    chinese: [
      "/studio-review/contact_sheets/identity_wedding_20260502094035_review.jpg",
      "/studio-previews/07_new_york_v01/wedding_062_new_york_black_gold_qipao_detail_50mm_v01_4k.png",
      "/studio-previews/04_kyoto_v01/wedding_034_kyoto_red_torii_new_chinese_70_200mm_v01_4k.png"
    ],
    travel: [
      "/studio-review/contact_sheets/identity_wedding_20260502094035_review.jpg",
      "/studio-previews/01_paris_v02/wedding_004_paris_paris_street_walk_35mm_v02_4k.png",
      "/studio-previews/02_santorini_v02/wedding_013_santorini_white_alley_island_light_35mm_v02_4k.png"
    ],
    registry: [
      "/studio-review/contact_sheets/identity_wedding_20260502094035_review.jpg",
      "/studio-previews/identity_wedding_20260502094035/identity_wedding_02_wedding_02_4k.png",
      "/studio-previews/identity_wedding_20260502094035/identity_wedding_05_wedding_05_4k.png"
    ]
  },
  couple: {
    daily: [
      "/studio-review/contact_sheets/identity_travel_20260502094035_review.jpg",
      "/studio-previews/identity_travel_20260502094035/identity_travel_01_travel_01_4k.png",
      "/studio-previews/identity_travel_20260502094035/identity_travel_04_travel_04_4k.png"
    ],
    travel: [
      "/studio-review/contact_sheets/identity_travel_20260502094035_review.jpg",
      "/studio-previews/identity_travel_20260502094035/identity_travel_02_travel_02_4k.png",
      "/studio-previews/identity_travel_20260502094035/identity_travel_05_travel_05_4k.png"
    ],
    cinema: [
      "/studio-review/contact_sheets/identity_landmark_20260502094035_review.jpg",
      "/studio-previews/identity_landmark_20260502094035/identity_landmark_03_landmark_03_4k.png",
      "/studio-previews/identity_landmark_20260502094035/identity_landmark_06_landmark_06_4k.png"
    ]
  },
  friends: {
    studio: [
      "/studio-review/contact_sheets/identity_friends_20260502094035_review.jpg",
      "/studio-previews/identity_friends_20260502094035/identity_friends_01_friends_01_4k.png",
      "/studio-previews/identity_friends_20260502094035/identity_friends_04_friends_04_4k.png"
    ],
    street: [
      "/studio-review/contact_sheets/identity_friends_20260502094035_review.jpg",
      "/studio-previews/identity_friends_20260502094035/identity_friends_02_friends_02_4k.png",
      "/studio-previews/identity_friends_20260502094035/identity_friends_05_friends_05_4k.png"
    ],
    birthday: [
      "/studio-review/contact_sheets/identity_friends_20260502094035_review.jpg",
      "/studio-previews/identity_friends_20260502094035/identity_friends_03_friends_03_4k.png",
      "/studio-previews/identity_friends_20260502094035/identity_friends_06_friends_06_4k.png"
    ]
  },
  child10: {
    campus: [
      "/studio-review/contact_sheets/identity_child10_20260502094035_review.jpg",
      "/studio-previews/identity_child10_20260502094035/identity_child10_02_child10_02_4k.png",
      "/studio-previews/identity_child10_20260502094035/identity_child10_05_child10_05_4k.png"
    ],
    birthday: [
      "/studio-review/contact_sheets/identity_child10_20260502094035_review.jpg",
      "/studio-previews/identity_child10_20260502094035/identity_child10_01_child10_01_4k.png",
      "/studio-previews/identity_child10_20260502094035/identity_child10_04_child10_04_4k.png"
    ],
    outdoor: [
      "/studio-review/contact_sheets/identity_child10_20260502094035_review.jpg",
      "/studio-previews/identity_child10_20260502094035/identity_child10_03_child10_03_4k.png",
      "/studio-previews/identity_child10_20260502094035/identity_child10_06_child10_06_4k.png"
    ]
  },
  portrait: {
    french: [
      "/studio-review/identity_lock/female_lifestyle_v02/L03_life_no_glasses_soft.jpg",
      "/studio-review/identity_lock/female_lifestyle_v02/L02_life_seated_glasses.jpg",
      "/studio-review/identity_lock/female_lifestyle_v02/W03_old_wedding_pink.jpg"
    ],
    magazine: [
      "/studio-review/identity_lock/female_lifestyle_v02/L04_life_no_glasses_front.jpg",
      "/studio-review/identity_lock/female_lifestyle_v02/CURRENT_v01_generated_face.jpg",
      "/studio-review/contact_sheets/female_v07_lifestyle_identity_compare.jpg"
    ],
    guofeng: [
      "/studio-previews/07_new_york_v01/wedding_062_new_york_black_gold_qipao_detail_50mm_v01_4k.png",
      "/studio-previews/04_kyoto_v01/wedding_034_kyoto_red_torii_new_chinese_70_200mm_v01_4k.png",
      "/studio-review/identity_lock/female_lifestyle_v02/W01_old_wedding_side.jpg"
    ]
  },
  senior: {
    anniversary: [
      "/studio-review/contact_sheets/identity_landmark_20260502094035_review.jpg",
      "/studio-previews/09_prague_v01/wedding_078_prague_vltava_river_story_lace_70_200mm_v01_4k.png",
      "/studio-previews/05_swiss_alps_v01/wedding_041_swiss_alps_wood_boardwalk_short_train_50mm_v01_4k.png"
    ],
    travel: [
      "/studio-review/contact_sheets/identity_travel_20260502094035_review.jpg",
      "/studio-previews/06_maldives_v01/wedding_049_maldives_barefoot_beach_walk_35mm_v01_4k.png",
      "/studio-previews/05_swiss_alps_v01/wedding_040_swiss_alps_snow_walk_wool_cape_35mm_v01_4k.png"
    ],
    qipao: [
      "/studio-review/contact_sheets/identity_wedding_20260502094035_review.jpg",
      "/studio-previews/04_kyoto_v01/wedding_034_kyoto_red_torii_new_chinese_70_200mm_v01_4k.png",
      "/studio-previews/07_new_york_v01/wedding_062_new_york_black_gold_qipao_detail_50mm_v01_4k.png"
    ]
  }
};

const studioWorkflowProof = [
  {
    title: "样片集",
    note: "样片定调，审美在线",
    image: "./assets/studio-showcase-3view.png"
  },
  {
    title: "身份确认",
    note: "身份稳定，脸更像本人",
    image: "./assets/studio-showcase-sample.png"
  },
  {
    title: "模板定调",
    note: "风格统一，成片更稳",
    image: "./assets/studio-showcase-wedding-review.jpg"
  }
];

const state = {
  tab: "studio",
  studioAnchor: "sample",
  creditAnchor: "overview",
  templates: [],
  studioSamples: { loaded: false, total: 0, updatedAt: "", scenes: {}, sceneGroups: {}, error: "" },
  query: "",
  templateGroup: "all",
  category: "all",
  featuredOnly: false,
  limit: 24,
  prompt: "",
  createMode: "generate",
  selectedPromptOptions: [],
  settings: applyQuerySettings(loadSettings()),
  params: readStore(keys.params, defaults.params),
  references: [],
  historyMode: "active",
  history: normalizeStoredHistory(readStore(keys.history, [])),
  deletedHistory: normalizeStoredHistory(readStore(keys.deletedHistory, [])),
  studio: normalizeStudio(readStore(keys.studio, defaults.studio)),
  credits: { ...defaults.credits },
  payment: { ...defaults.payment },
  creditOrders: [],
  auth: normalizeAuth(readStore(keys.auth, defaults.auth)),
  authView: "login",
  authRegisterStep: "credentials",
  authMessage: "",
  authMessageKind: "",
  authSubmitting: false,
  authCodeSending: false,
  authCodeCooldown: 0,
  creditEstimate: null,
  creditEstimateError: "",
  pendingPaymentReturn: null,
  templateSelectionMode: "create"
};

const dom = {};
const localClientKey = ensureLocalClientKey();
let generationTimerId = 0;
let creditEstimateTimerId = 0;
let generationRunning = false;
let authCodeTimerId = 0;

const secondaryMenus = {
  studio: [
    { label: "样片集", tab: "studio", anchor: "sample" },
    { label: "生图", tab: "studio", anchor: "flow" },
    { label: "身份确认", tab: "studio", anchor: "identity" },
    { label: "选模板", tab: "studio", anchor: "packages" },
    { label: "生成", tab: "studio", anchor: "delivery" }
  ],
  create: [
    { label: "模板库", tab: "templates" },
    { label: "智能生图", tab: "generate", createMode: "generate" }
  ],
  history: [
    { label: "全部作品", tab: "history", historyMode: "active" },
    { label: "已删除", tab: "history", historyMode: "deleted" }
  ],
  credits: [
    { label: "我的积分", tab: "credits", anchor: "overview" },
    { label: creditCopy.rechargeMenu, tab: "credits", anchor: "packages" }
  ]
};

const createToolModes = {
  generate: {
    title: "智能生图",
    hint: "上传照片、写提示词、直接开拍；写法参考都放在右侧辅助区。",
    placeholder: "先写你想要的结果，再补人物、场景、镜头和气质",
    status: "智能生图已就绪"
  }
};

const templateLibraryGroups = [
  {
    id: "all",
    label: "全部",
    note: "模板库全部内容",
    image: "./assets/mojing-workbench-bg.png",
    kind: "mixed"
  },
  {
    id: "fun",
    label: "趣味生图",
    note: "海报、头像、插画、产品图等快速玩法",
    image: "./assets/mojing-workbench-bg.png",
    kind: "template"
  },
  {
    id: "identity",
    label: "形象确认",
    note: "像本人基准和身份起版参考",
    image: "./assets/studio-showcase-3view.png",
    kind: "reference"
  },
  {
    id: "set",
    label: "套图写真",
    note: "婚纱、情侣、闺蜜、儿童、写真等成组参考",
    image: "./assets/studio-showcase-wedding-review.jpg",
    kind: "reference"
  }
];

const promptOptionPresets = {
  background: {
    title: "换背景",
    short: "只换背景，主体不动",
    requiresReference: true,
    summary: "保留人物身份、表情、姿态和服装，只替换背景与氛围。",
    promptAddon: "换背景要求：保留人物身份、表情、姿态和服装不变，只替换背景。新背景需真实可信，光线方向一致，边缘自然，不要改变人物五官和身材。"
  },
  outfit: {
    title: "换装",
    short: "只换服装，脸和动作保持",
    requiresReference: true,
    summary: "保留脸部、发型、表情和姿态，只替换服装与材质。",
    promptAddon: "换装要求：保留人物脸部、发型、表情、姿态和背景关系，只替换服装。服装需版型合身、布料真实、光影一致，不要改变人物身份。"
  },
  enhance: {
    title: "高清增强",
    short: "提高清晰度和质感",
    requiresReference: true,
    summary: "提升清晰度、皮肤细节、服装纹理和整体画面质感。",
    promptAddon: "高清增强要求：提升清晰度、皮肤细节、服装纹理和画面质感，保持原始构图、人物身份、表情和年龄感不变。不要过度磨皮，不要改变脸型，不要新增不真实细节。"
  },
  repair: {
    title: "局部修复",
    short: "只修局部，其余保持",
    requiresReference: true,
    summary: "适合修手部、衣服、边缘或背景小问题，其余区域保持稳定。",
    promptAddon: "局部修复要求：只修复需要处理的局部区域，其他区域保持不变。保留人物身份、表情、构图和整体光影，不要连带改动无关区域。"
  }
};

const templateCategoryOrder = ["人像基准", "婚纱照", "情侣照", "闺蜜照", "10岁照", "女生写真", "夕阳红"];
const localTemplateCategoryCovers = {
  "人像基准": "./assets/studio-showcase-3view.png",
  "婚纱照": "./assets/studio-showcase-wedding-review.jpg",
  "情侣照": "./assets/studio-showcase-couple-review.jpg",
  "闺蜜照": "./assets/studio-showcase-friends-review.jpg",
  "10岁照": "./assets/studio-showcase-child-review.jpg",
  "女生写真": "./assets/studio-showcase-portrait-review.jpg",
  "夕阳红": "./assets/studio-showcase-senior-review.jpg"
};
const localTemplateIdCovers = {
  "portrait-axis-female-3view-v01": "./assets/studio-showcase-3view.png",
  "portrait-axis-male-3view-v01": "./assets/studio-showcase-3view.png",
  "portrait-axis-child-10yo-3view-v01": "./assets/studio-showcase-child-review.jpg",
  "portrait-axis-senior-couple-3view-v01": "./assets/studio-showcase-senior-review.jpg",
  "portrait-axis-best-friends-3view-v01": "./assets/studio-showcase-friends-review.jpg"
};

document.addEventListener("DOMContentLoaded", () => {
  for (const id of [
    "statusLine", "trustStrip", "studioPanel", "studioCommand", "studioSceneRail", "studioStageList", "studioPackagesSection", "studioIdentitySection", "studioSampleSection", "studioDeliverySection",
    "studioStartBtn", "openGenerationFlowBtn", "studioHeroVisualEyebrow", "studioHeroVisualTitle", "studioHeroVisualChip", "studioHeroGallery", "studioHeroProof", "studioFlow",
    "studioSummaryScene", "studioSummaryIdentity", "studioSummarySample", "studioSummaryDelivery",
    "studioWorkOrderEyebrow", "studioCurrentStep", "studioActionHint", "studioCurrentScene", "studioCurrentSample",
    "studioCurrentCredits", "studioNextActionBtn", "scenePackGrid", "openTemplateLibraryBtn", "identitySummary",
    "identityStatusChip", "identityCheckGrid", "studioReferenceInput", "confirmIdentityBtn", "sampleSummary", "samplePreviewPanel", "sampleDirectionList",
    "studioTemplateCard", "studioTemplateSummary", "studioTemplateStatusChip", "studioTemplateName", "studioTemplateMeta",
    "deliverySceneCount", "deliverySampleCount", "deliveryReadyCount", "studioGenerateBtn", "templatesPanel", "generatePanel", "registerPanel", "registerNowBtn", "historyPanel", "templateSearch", "categoryFilter", "featuredOnly",
    "templateGrid", "templateCount", "templateHint", "loadMoreBtn", "promptInput", "qualitySelect",
    "formatSelect", "countInput", "sizeInput", "editImageInput", "editModeState", "promptOptionGrid", "promptOptionHint", "promptOptionPreview", "clearPromptOptionsBtn", "referenceInput", "referenceList", "generateBtn",
    "generationTimer", "historyList", "historyTitle", "historyCount", "clearHistoryBtn", "deletedHistoryBtn",
    "generateSummaryTitle", "generateSummaryHint", "generateModeBadge", "generateReferenceBadge", "generatePromptBadge", "generateBalanceBadge", "generateBackToTemplatesBtn", "generateModeTags",
    "openSizeBtn", "creditCostBar", "creditCostStatus", "creditCostHint", "creditRechargeShortcut", "secondaryNav", "creditsPanel", "creditOverviewView", "creditRechargeView", "creditOrdersView", "creditLedgerView", "creditRefreshBtn", "creditUpdatedAt", "creditBalance", "creditOverviewBuyBtn", "openCreditsBtn", "topCreditBalance",
    "creditStatus", "creditPackages", "creditLedger", "creditLedgerCount", "paymentStatusHint", "paymentStatusBadge", "creditOrderCount", "creditOrderList", "creditRecordsPanel", "creditOrdersSection", "creditLedgerSection", "creditOrderSummaryHint", "creditLedgerSummaryHint", "modalRoot",
    "templateCollections",
    "authModeRegisterBtn", "authModeLoginBtn", "registerPanelEyebrow", "registerPanelTitle", "registerModeTitle", "registerFlowNote", "registerUsernameField", "registerUsernameInput",
    "registerEmailField", "registerEmailInput", "registerCodeField", "registerCodeInput", "sendCodeBtn", "registerPasswordField", "registerPasswordInput",
    "registerMessage", "registerAccountCard", "registerAccountName", "registerAccountMeta", "registerStartCreateBtn", "registerLogoutBtn", "siteFooterPoints"
  ]) dom[id] = document.getElementById(id);
  dom.primaryTabs = Array.from(document.querySelectorAll(".primary-tab"));
  consumeRuntimeQueryState();
  bindEvents();
  syncControls();
  renderAll();
  void loadStudioSamples();
  loadTemplates();
  void loadPersistentHistory();
  void loadCredits();
  void loadPaymentConfig();
  void loadCreditOrders();
  void handlePendingPaymentReturn();
});

function bindEvents() {
  dom.primaryTabs.forEach((tab) => tab.addEventListener("click", () => switchPrimary(tab.dataset.tab)));
  dom.studioStartBtn.addEventListener("click", () => openStudioSection("sample"));
  dom.openGenerationFlowBtn.addEventListener("click", () => openStudioSection("flow"));
  dom.studioNextActionBtn.addEventListener("click", handleStudioNextAction);
  dom.openTemplateLibraryBtn.addEventListener("click", openStudioTemplateLibrary);
  dom.studioReferenceInput.addEventListener("change", () => addStudioReferences(dom.studioReferenceInput));
  dom.confirmIdentityBtn.addEventListener("click", handleIdentityStageAction);
  dom.studioGenerateBtn.addEventListener("click", () => useStudioSample());
  dom.templateSearch.addEventListener("input", () => {
    state.query = dom.templateSearch.value;
    state.limit = 24;
    renderTemplates();
    renderCreateGenerateOverview();
  });
  dom.categoryFilter.addEventListener("change", () => {
    state.category = dom.categoryFilter.value;
    state.limit = 24;
    renderTemplates();
    renderCreateGenerateOverview();
  });
  dom.featuredOnly.addEventListener("change", () => {
    state.featuredOnly = dom.featuredOnly.checked;
    state.limit = 24;
    renderTemplates();
    renderCreateGenerateOverview();
  });
  dom.loadMoreBtn.addEventListener("click", () => {
    state.limit += 24;
    renderTemplates();
  });
  dom.promptInput.addEventListener("input", () => setPromptValue(dom.promptInput.value));
  dom.qualitySelect.addEventListener("change", () => saveParams({ quality: dom.qualitySelect.value }));
  dom.formatSelect.addEventListener("change", () => saveParams({ outputFormat: dom.formatSelect.value }));
  dom.countInput.addEventListener("input", () => saveParams({ count: clamp(Number(dom.countInput.value), 1, 4) }));
  dom.editImageInput.addEventListener("change", () => void addReferences(dom.editImageInput, { replace: true, source: "edit" }));
  dom.clearPromptOptionsBtn?.addEventListener("click", clearPromptOptions);
  dom.referenceInput.addEventListener("change", () => void addReferences(dom.referenceInput, { source: "reference" }));
  dom.generateBtn.addEventListener("click", () => void generateImage());
  dom.clearHistoryBtn.addEventListener("click", clearHistory);
  dom.deletedHistoryBtn.addEventListener("click", toggleDeletedHistory);
  dom.generateBackToTemplatesBtn?.addEventListener("click", () => {
    state.templateSelectionMode = "create";
    switchTab("templates");
  });
  dom.openSizeBtn.addEventListener("click", openSize);
  dom.authModeRegisterBtn?.addEventListener("click", () => switchAuthView("register"));
  dom.authModeLoginBtn?.addEventListener("click", handleAuthModeLoginAction);
  dom.registerUsernameInput?.addEventListener("input", renderRegisterPanel);
  dom.registerEmailInput?.addEventListener("input", renderRegisterPanel);
  dom.registerCodeInput?.addEventListener("input", renderRegisterPanel);
  dom.registerPasswordInput?.addEventListener("input", renderRegisterPanel);
  dom.sendCodeBtn?.addEventListener("click", () => void sendAuthCode());
  dom.registerNowBtn?.addEventListener("click", () => void submitAuth());
  dom.registerStartCreateBtn?.addEventListener("click", goToCreateWorkspace);
  dom.registerLogoutBtn?.addEventListener("click", logoutAuth);
  dom.creditRechargeShortcut.addEventListener("click", () => {
    state.creditAnchor = "packages";
    switchTab("credits");
  });
  dom.creditRefreshBtn.addEventListener("click", () => void refreshCreditCenter(true));
  dom.creditOverviewBuyBtn?.addEventListener("click", () => {
    state.creditAnchor = "packages";
    renderTabs();
    focusCreditsAnchor("packages");
  });
}

async function loadTemplates() {
  status("模板读取中");
  try {
    const response = await apiFetch("/api/templates", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    state.templates = normalizeTemplates(await response.json());
    renderTemplateCollections();
    renderCategories();
    renderTemplates();
    status(`已读取 ${state.templates.length} 个模板`);
  } catch (error) {
    state.templates = [];
    renderTemplateCollections();
    renderCategories();
    renderTemplates(errorMessage(error));
    status("模板读取失败");
  }
}

async function loadStudioSamples() {
  try {
    const response = await apiFetch("/api/studio-samples", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    state.studioSamples = normalizeStudioSamples(await response.json());
  } catch (error) {
    state.studioSamples = { loaded: true, total: 0, updatedAt: "", scenes: {}, sceneGroups: {}, error: errorMessage(error) };
  }
  renderStudio();
}

function normalizeStudioSamples(data) {
  const source = data && typeof data === "object" ? data : {};
  const scenes = {};
  const sceneGroups = {};
  let total = 0;
  for (const scene of scenePacks) {
    const list = Array.isArray(source.scenes?.[scene.id]) ? source.scenes[scene.id] : [];
    const seen = new Set();
    scenes[scene.id] = list.map((item, index) => normalizeStudioSampleAsset(scene, item, index))
      .filter((item) => {
        if (!item.src || seen.has(item.src)) return false;
        seen.add(item.src);
        return true;
      });
    const groups = Array.isArray(source.sceneGroups?.[scene.id]) ? source.sceneGroups[scene.id] : [];
    sceneGroups[scene.id] = groups
      .map((item, index) => normalizeStudioSampleGroup(scene, item, index))
      .filter((item) => item.items.length || item.cover);
    total += scenes[scene.id].length;
  }
  return {
    loaded: true,
    total: Number(source.total) || total,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : "",
    scenes,
    sceneGroups,
    error: ""
  };
}

function normalizeStudioSampleAsset(scene, item, index) {
  const source = item && typeof item === "object" ? item : {};
  const sampleId = scene.samples.some((sample) => sample.id === source.sampleId) ? source.sampleId : scene.samples[0]?.id || "";
  const sample = scene.samples.find((entry) => entry.id === sampleId) || scene.samples[0] || null;
  const src = String(source.src || "");
  return {
    id: String(source.id || `${scene.id}-asset-${index + 1}`),
    src,
    alt: String(source.alt || `${scene.name} · ${sample?.title || "样片"} · 样片 ${index + 1}`),
    label: String(source.label || `样片 ${index + 1}`),
    title: String(source.title || `${scene.name} · ${sample?.title || "样片"}`),
    sampleId,
    sampleTitle: sample?.title || scene.name,
    groupId: String(source.groupId || source.group || ""),
    groupTitle: String(source.groupTitle || source.title || ""),
    group: String(source.group || "")
  };
}

function normalizeStudioSampleGroup(scene, item, index) {
  const source = item && typeof item === "object" ? item : {};
  const sampleId = scene.samples.some((sample) => sample.id === source.sampleId) ? source.sampleId : scene.samples[0]?.id || "";
  const sample = scene.samples.find((entry) => entry.id === sampleId) || scene.samples[0] || null;
  const groupId = String(source.groupId || source.group || source.id || `${scene.id}-group-${index + 1}`);
  const title = String(source.title || sample?.title || `样片组 ${index + 1}`);
  const items = (Array.isArray(source.items) ? source.items : [])
    .map((entry, entryIndex) => ({
      ...normalizeStudioSampleAsset(scene, { ...entry, sampleId, groupId, groupTitle: title }, entryIndex),
      groupId,
      groupTitle: title
    }))
    .filter((entry) => entry.src);
  const cover = String(source.cover || items[0]?.src || "");
  return {
    id: String(source.id || safeClientId(`group-${scene.id}-${groupId || index + 1}`)),
    sceneId: scene.id,
    sampleId,
    sampleTitle: String(source.sampleTitle || sample?.title || scene.name),
    groupId,
    title,
    subtitle: String(source.subtitle || `${sample?.title || scene.name} · ${items.length || 0} 张`),
    cover,
    coverAlt: String(source.coverAlt || `${scene.name} · ${title}`),
    count: Number(source.count) || items.length,
    items
  };
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
      language: String(item.language || ""),
      sourceUrl: String(item.sourceUrl || item.url || ""),
      isLocal: String(item.sourceUrl || item.url || "").startsWith("local://")
    };
    return { ...template, searchText: templateSearchText(template) };
  }).filter((item) => item.id && item.title);
}

function isStudioTemplate(item) {
  return item.isLocal;
}

function visibleTemplates() {
  return state.templates.filter((item) => matchesTemplateLibraryGroup(item, state.templateGroup));
}

function matchesTemplateLibraryGroup(item, groupId = "all") {
  if (groupId === "all") return true;
  if (groupId === "fun") return !item.isLocal;
  if (groupId === "identity") return item.isLocal && item.category === "人像基准";
  if (groupId === "set") return item.isLocal && item.category !== "人像基准";
  return true;
}

function currentTemplateLibraryGroup() {
  return templateLibraryGroups.find((group) => group.id === state.templateGroup) || templateLibraryGroups[0];
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
  renderRegisterPanel();
  renderTemplateCollections();
  renderCategories();
  renderTemplates();
  renderPromptOptions();
  renderReferences();
  renderHistory();
  renderCredits();
  renderCreateGenerateOverview();
}

function renderTabs() {
  const primaryTab = tabGroup(state.tab);
  const hasSecondaryMenu = (secondaryMenus[primaryTab] || []).length > 0;
  dom.primaryTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === primaryTab));
  renderSecondaryNav(primaryTab);
  document.body.classList.remove("register-focus");
  if (dom.trustStrip) dom.trustStrip.hidden = state.tab !== "studio";
  if (dom.siteFooterPoints) dom.siteFooterPoints.hidden = state.tab !== "studio";
  dom.secondaryNav.hidden = !hasSecondaryMenu;
  dom.studioPanel.hidden = state.tab !== "studio";
  dom.templatesPanel.hidden = state.tab !== "templates";
  dom.generatePanel.hidden = state.tab !== "generate";
  dom.registerPanel.hidden = state.tab !== "register";
  dom.historyPanel.hidden = state.tab !== "history";
  dom.creditsPanel.hidden = state.tab !== "credits";
  dom.studioPanel.classList.toggle("active", state.tab === "studio");
  dom.templatesPanel.classList.toggle("active", state.tab === "templates");
  dom.generatePanel.classList.toggle("active", state.tab === "generate");
  dom.registerPanel.classList.toggle("active", state.tab === "register");
  dom.historyPanel.classList.toggle("active", state.tab === "history");
  dom.creditsPanel.classList.toggle("active", state.tab === "credits");
  if (state.tab === "studio") renderStudioSections();
  if (state.tab === "credits") renderCreditSections();
}

function renderSecondaryNav(primaryTab) {
  const items = secondaryMenus[primaryTab] || [];
  dom.secondaryNav.innerHTML = items.map((item) => {
    const active = secondaryItemActive(item);
    const attributes = item.action
      ? `data-action="${attr(item.action)}"`
      : `data-tab="${attr(item.tab)}"${item.anchor ? ` data-anchor="${attr(item.anchor)}"` : ""}${item.createMode ? ` data-create-mode="${attr(item.createMode)}"` : ""}${item.historyMode ? ` data-history-mode="${attr(item.historyMode)}"` : ""}${item.authView ? ` data-auth-view="${attr(item.authView)}"` : ""}`;
    return `<button class="tab ${active ? "active" : ""}" ${attributes} type="button">${esc(item.label)}</button>`;
  }).join("");
  dom.secondaryNav.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      if (tab === "history" && button.dataset.historyMode) state.historyMode = button.dataset.historyMode;
      if (tab === "studio") state.studioAnchor = button.dataset.anchor || "flow";
      if (tab === "generate" && button.dataset.createMode) state.createMode = normalizeCreateMode(button.dataset.createMode);
      if (tab === "credits") state.creditAnchor = normalizeCreditAnchor(button.dataset.anchor || "overview");
      if (tab === "register" && button.dataset.authView) {
        state.authView = button.dataset.authView === "login" ? "login" : "register";
        if (state.authView === "register") state.authRegisterStep = "credentials";
      }
      switchTab(tab);
      if (tab === "generate" && button.dataset.createMode) applyCreateMode(button.dataset.createMode);
      if (tab === "studio") focusStudioAnchor(state.studioAnchor);
      if (tab === "credits") focusCreditsAnchor(state.creditAnchor);
    });
  });
}

function secondaryItemActive(item) {
  if (item.action) return false;
  if (item.tab !== state.tab) return false;
  if (item.historyMode) return state.historyMode === item.historyMode;
  if (item.anchor && item.tab === "studio") return state.studioAnchor === item.anchor;
  if (item.anchor && item.tab === "credits") return normalizeCreditAnchor(state.creditAnchor) === item.anchor;
  if (item.createMode && item.tab === "generate") return state.createMode === item.createMode;
  if (item.authView) return state.authView === item.authView;
  return true;
}

function renderStudio() {
  const scene = selectedStudioScene();
  const groups = studioSceneGroups(scene);
  const selectedGroup = selectedStudioSampleGroup(scene, groups);
  const selectedPhoto = selectedStudioSamplePhoto(scene, selectedGroup);
  const sample = selectedStudioSample(scene) || sampleForStudioGroup(scene, selectedGroup);
  const identityReady = state.studio.identityStatus === "已确认";
  const template = selectedStudioTemplate();
  const templateSelected = Boolean(state.studio.templateConfirmed && template?.id);
  const uploaded = state.studio.referenceCount >= studioRequiredReferenceCount;
  const readyCount = [uploaded, identityReady, templateSelected].filter(Boolean).length;
  renderStudioWorkOrder(scene, identityReady, templateSelected, template);
  renderStudioOverview(scene, template, uploaded, identityReady);
  renderStudioHeroVisual(scene, sample);
  dom.studioFlow.innerHTML = studioFlow
    .map((step, index) => studioFlowStep(step, index, uploaded, identityReady, templateSelected))
    .join("");
  dom.scenePackGrid.innerHTML = scenePacks.map((item) => scenePackCard(item)).join("");
  dom.scenePackGrid.querySelectorAll("[data-studio-scene]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextSceneId = button.dataset.studioScene;
      const sceneChanged = nextSceneId !== state.studio.selectedSceneId;
      const nextScene = scenePacks.find((item) => item.id === nextSceneId) || selectedStudioScene();
      const nextGroups = studioSceneGroups(nextScene);
      const nextGroup = nextGroups[0] || null;
      const nextPhoto = selectedStudioSamplePhoto(nextScene, nextGroup);
      saveStudio({
        selectedSceneId: nextSceneId,
        selectedSampleId: sceneChanged ? nextGroup?.sampleId || "" : state.studio.selectedSampleId,
        selectedSampleGroupId: sceneChanged ? nextGroup?.id || "" : state.studio.selectedSampleGroupId,
        selectedSamplePhotoId: sceneChanged ? nextPhoto?.id || "" : state.studio.selectedSamplePhotoId,
        previewedSampleKey: sceneChanged ? "" : state.studio.previewedSampleKey,
        ...(sceneChanged ? emptyStudioTemplateSelection() : {})
      });
      status(`已选 ${nextScene.name}，同屏查看样片组和组内照片`);
    });
  });
  const referenceSummary = studioReferenceSummary();
  dom.identitySummary.textContent = `${referenceSummary} · ${identityHelpText(state.studio.identityStatus)}`;
  dom.identityStatusChip.textContent = state.studio.identityStatus;
  dom.identityStatusChip.className = `status-chip ${identityReady ? "ready" : state.studio.identityStatus === "需返修" ? "danger" : "pending"}`;
  dom.confirmIdentityBtn.textContent = identityPrimaryActionLabel();
  dom.confirmIdentityBtn.disabled = !uploaded;
  dom.identityCheckGrid.innerHTML = identityChecks(identityReady).map((item) => `
    <button class="identity-check ${item.active ? "active" : ""}" data-identity-status="${attr(item.status)}" type="button">
      <strong>${esc(item.status)}</strong>
      <span>${esc(item.note)}</span>
    </button>`).join("");
  dom.identityCheckGrid.querySelectorAll("[data-identity-status]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextStatus = button.dataset.identityStatus;
      if (["待生成", "待确认", "已确认"].includes(nextStatus) && !uploaded) {
        status("三张参考照到位，身份锁定更稳");
        return;
      }
      saveStudio({ identityStatus: nextStatus });
    });
  });
  dom.sampleSummary.innerHTML = studioSampleSummary(scene, selectedGroup, selectedPhoto);
  dom.samplePreviewPanel.innerHTML = studioSamplePreviewPanel(scene, groups, selectedGroup, selectedPhoto);
  dom.samplePreviewPanel.querySelectorAll("[data-studio-sample-group]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextGroup = groups.find((item) => item.id === button.dataset.studioSampleGroup);
      if (!nextGroup) return;
      const nextPhoto = studioGroupPreviewEntries(scene, nextGroup)[0] || null;
      saveStudio({
        selectedSampleId: nextGroup.sampleId,
        selectedSampleGroupId: nextGroup.id,
        selectedSamplePhotoId: nextPhoto?.id || "",
        previewedSampleKey: studioGroupPreviewKey(scene, nextGroup)
      });
      status(`${nextGroup.title} 已在同屏展开`);
    });
  });
  dom.samplePreviewPanel.querySelectorAll("[data-studio-sample-photo]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextPhotoId = button.dataset.studioSamplePhoto;
      const nextPhoto = studioGroupPreviewEntries(scene, selectedGroup).find((item) => item.id === nextPhotoId);
      if (!nextPhoto || !selectedGroup) return;
      saveStudio({
        selectedSampleId: selectedGroup.sampleId,
        selectedSampleGroupId: selectedGroup.id,
        selectedSamplePhotoId: nextPhoto.id,
        previewedSampleKey: studioGroupPreviewKey(scene, selectedGroup)
      });
      status(`${selectedGroup.title} · ${nextPhoto.label} 已在同屏预览`);
    });
  });
  dom.sampleDirectionList.innerHTML = studioSamplePhotoGrid(scene, selectedGroup, selectedPhoto);
  dom.sampleDirectionList.querySelectorAll("[data-studio-sample-photo]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextPhotoId = button.dataset.studioSamplePhoto;
      const nextPhoto = studioGroupPreviewEntries(scene, selectedGroup).find((item) => item.id === nextPhotoId);
      if (!nextPhoto || !selectedGroup) return;
      saveStudio({
        selectedSampleId: selectedGroup.sampleId,
        selectedSampleGroupId: selectedGroup.id,
        selectedSamplePhotoId: nextPhoto.id,
        previewedSampleKey: studioGroupPreviewKey(scene, selectedGroup)
      });
      status(`${selectedGroup.title} · ${nextPhoto.label} 已在同屏预览`);
    });
  });
  if (dom.studioTemplateSummary) {
    dom.studioTemplateSummary.textContent = templateSelected
      ? "模板已定，成片气质在线。"
      : identityReady
        ? "身份已稳，模板库开始定调。"
        : "参考照与身份确认到位后，模板库定调。";
  }
  if (dom.studioTemplateStatusChip) {
    dom.studioTemplateStatusChip.textContent = templateSelected ? "已选择" : "待选择";
    dom.studioTemplateStatusChip.className = `status-chip ${templateSelected ? "ready" : "pending"}`;
  }
  if (dom.studioTemplateName) dom.studioTemplateName.textContent = templateSelected ? template.title : "模板待选";
  if (dom.studioTemplateMeta) {
    dom.studioTemplateMeta.textContent = templateSelected
      ? `${template.category || scene.name} · 风格已定`
      : identityReady
        ? `${studioSceneTemplateLabels[scene.id] || scene.name} 大片更好定调`
        : "风格一定，出片更稳";
  }
  if (dom.openTemplateLibraryBtn) {
    dom.openTemplateLibraryBtn.disabled = !identityReady;
    dom.openTemplateLibraryBtn.textContent = templateSelected ? "重新定调" : identityReady ? "进入模板库" : "确认像本人";
  }
  dom.deliverySceneCount.textContent = String(state.studio.referenceCount || 0);
  dom.deliverySampleCount.textContent = templateSelected ? "1" : "0";
  dom.deliveryReadyCount.textContent = String(readyCount);
  dom.studioGenerateBtn.disabled = !(uploaded && identityReady && templateSelected);
  dom.studioGenerateBtn.textContent = uploaded && identityReady
    ? templateSelected ? "开拍成片" : "模板定调"
    : !uploaded
      ? "上传参考照"
      : "确认像本人";
  renderStudioSections();
}

function renderStudioWorkOrder(scene, identityReady, templateSelected, template) {
  if (!dom.studioCurrentStep) return;
  const action = studioNextAction(scene, identityReady);
  if (dom.studioWorkOrderEyebrow) dom.studioWorkOrderEyebrow.textContent = action.section;
  dom.studioCurrentStep.textContent = action.title;
  if (dom.studioActionHint) dom.studioActionHint.textContent = action.hint;
  dom.studioCurrentScene.textContent = `方向：${scene.name} · ${scene.recommendedShots}`;
  dom.studioCurrentSample.textContent = `参考照：${state.studio.referenceCount || 0}/${studioRequiredReferenceCount} · 身份确认：${identityReady ? "已确认" : state.studio.identityStatus} · 模板：${templateSelected ? template?.title || "已选择" : "待选择"}`;
  dom.studioCurrentCredits.textContent = `余额：${formatCredits(state.credits.balance)}`;
  dom.studioNextActionBtn.textContent = action.label;
}

function renderStudioOverview(scene, template, uploaded, identityReady) {
  const templateSelected = Boolean(state.studio.templateConfirmed && template?.id);
  if (dom.studioSummaryScene) dom.studioSummaryScene.textContent = `${state.studio.referenceCount || 0}/${studioRequiredReferenceCount} 张`;
  if (dom.studioSummaryIdentity) dom.studioSummaryIdentity.textContent = identityReady ? "已确认" : state.studio.identityStatus;
  if (dom.studioSummarySample) dom.studioSummarySample.textContent = templateSelected ? template.title : "待选择";
  if (dom.studioSummaryDelivery) dom.studioSummaryDelivery.textContent = uploaded && identityReady && templateSelected ? "可开拍" : "待就绪";
}

function openStudioTemplateLibrary() {
  const scene = selectedStudioScene();
  const identityReady = state.studio.identityStatus === "已确认";
  const uploaded = (state.studio.referenceCount || 0) >= studioRequiredReferenceCount;
  if (!uploaded) {
    openStudioSection("identity");
    status("三张参考照到位后，模板库为你定调");
    return;
  }
  if (!identityReady) {
    openStudioSection("identity");
    status("身份确认完成，风格更稳");
    return;
  }
  state.templateSelectionMode = "studio";
  state.templateGroup = "set";
  state.query = "";
  state.featuredOnly = false;
  state.limit = 24;
  state.category = studioSceneTemplateLabels[scene.id] || "all";
  switchTab("templates");
  renderTemplateCollections();
  renderCategories();
  renderTemplates();
  status(`${scene.name} 模板库已打开`);
}

function renderStudioHeroVisual(scene, sample) {
  const activeSample = sample || scene.samples[0] || null;
  const previews = activeSample ? studioSamplePreviewEntries(scene, activeSample) : [];
  if (dom.studioHeroVisualEyebrow) dom.studioHeroVisualEyebrow.textContent = `${scene.name} · ${scene.audience}`;
  if (dom.studioHeroVisualTitle) {
    dom.studioHeroVisualTitle.textContent = activeSample
      ? `${activeSample.title} 样片集，风格一眼看准`
      : `${scene.name} 样片集，效果一眼看准`;
  }
  if (dom.studioHeroVisualChip) dom.studioHeroVisualChip.textContent = scene.status === "优先" ? "优先套餐" : "可立即开拍";
  if (dom.studioHeroGallery) {
    dom.studioHeroGallery.innerHTML = studioHeroGalleryMarkup(scene, activeSample, previews);
    dom.studioHeroGallery.querySelectorAll("[data-open-studio-hero-preview]").forEach((button) => {
      button.addEventListener("click", () => openStudioSamplePreview(scene, activeSample, Number(button.dataset.previewIndex) || 0));
    });
  }
  if (dom.studioHeroProof) dom.studioHeroProof.innerHTML = studioWorkflowProof.map(studioHeroProofCard).join("");
}

function studioHeroGalleryMarkup(scene, sample, previews) {
  const main = previews[0] || fallbackStudioPreviewEntry(scene, sample, "样片封面");
  const sideA = previews[1] || fallbackStudioPreviewEntry(scene, sample, "互动样片");
  const sideB = previews[2] || fallbackStudioPreviewEntry(scene, sample, "细节样片");
  return `
    <button class="studio-hero-shot main" data-open-studio-hero-preview data-preview-index="0" type="button">
      <img src="${attr(main.src)}" alt="${attr(main.alt)}" />
      <span>${esc(sample?.title || scene.name)}</span>
    </button>
    <button class="studio-hero-shot side" data-open-studio-hero-preview data-preview-index="1" type="button">
      <img src="${attr(sideA.src)}" alt="${attr(sideA.alt)}" />
      <span>${esc(sideA.label)}</span>
    </button>
    <button class="studio-hero-shot side" data-open-studio-hero-preview data-preview-index="2" type="button">
      <img src="${attr(sideB.src)}" alt="${attr(sideB.alt)}" />
      <span>${esc(sideB.label)}</span>
    </button>
    <article class="studio-hero-gallery-card">
      <div class="studio-hero-gallery-kicker">${esc(scene.people)} · ${esc(scene.status)}</div>
      <strong>${esc(scene.recommendedShots)}</strong>
      <p>${esc(scene.audience)}</p>
      <div class="studio-hero-gallery-tags">
        <span>样片集</span>
        <span>参考方向</span>
        <span>${esc(sample?.title || "今日推荐")}</span>
      </div>
    </article>`;
}

function studioHeroProofCard(item) {
  return `
    <article class="studio-proof-card">
      <img src="${attr(item.image)}" alt="${attr(item.title)}" loading="lazy" />
      <div>
        <strong>${esc(item.title)}</strong>
        <span>${esc(item.note)}</span>
      </div>
    </article>`;
}

function fallbackStudioPreviewEntry(scene, sample, label) {
  return {
    src: templateFallbackImage({ category: scene.name, title: `${sample?.title || scene.name} ${label}`, description: sample?.tags || scene.audience }),
    alt: `${scene.name} · ${label}`,
    label
  };
}

function studioNextAction(scene, identityReady) {
  const templateSelected = Boolean(state.studio.templateConfirmed && state.studio.selectedTemplateId);
  if (state.studio.identityStatus === "需返修") {
    return {
      key: "upload",
      section: "身份重修",
      title: "重新锁定身份",
      label: "重传参考照",
      hint: "身份更稳，成片更高级。"
    };
  }
  if ((state.studio.referenceCount || 0) < studioRequiredReferenceCount) {
    return {
      key: "upload",
      section: "身份锁定",
      title: "传三张图",
      label: "上传参考照",
      hint: `${studioRequiredReferenceCount} 张参考照一到位，像本人更稳。`
    };
  }
  if (state.studio.identityStatus === "待生成") {
    return {
      key: "threeview",
      section: "身份锁定",
      title: "确认像本人",
      label: "确认身份",
      hint: "像本人，成片才有底气。"
    };
  }
  if (!identityReady) {
    return {
      key: "identity",
      section: "身份定稿",
      title: "确认像本人",
      label: "确认像本人",
      hint: "像本人，才是出片底气。"
    };
  }
  if (!templateSelected) {
    return {
      key: "template",
      section: "风格定调",
      title: "选模板",
      label: "进入模板库",
      hint: "模板一定，整组更出片。"
    };
  }
  return {
    key: "generate",
    section: "成片开拍",
    title: `生成 ${scene.name}`,
    label: "开拍成片",
    hint: "身份、风格、模板齐备，成片感拉满。"
  };
}

function handleStudioNextAction() {
  const scene = selectedStudioScene();
  const action = studioNextAction(scene, state.studio.identityStatus === "已确认");
  if (action.key === "upload") {
    openStudioSection("identity");
    dom.studioReferenceInput.click();
    return;
  }
  if (action.key === "threeview") {
    openStudioSection("identity");
    status("身份确认后，风格更稳");
    return;
  }
  if (action.key === "identity") {
    openStudioSection("identity");
    status("把像本人这件事定下来");
    return;
  }
  if (action.key === "template") {
    openStudioSection("packages");
    status("模板定调，成片更稳");
    return;
  }
  openStudioSection("delivery");
  status("成片生成已就绪");
}

function handleIdentityStageAction() {
  const current = state.studio.identityStatus;
  const uploaded = (state.studio.referenceCount || 0) >= studioRequiredReferenceCount;
  if (!uploaded) {
    dom.studioReferenceInput.click();
    status(`${studioRequiredReferenceCount} 张参考照，身份更稳`);
    return;
  }
  if (current === "待上传") {
    saveStudio({ identityStatus: "待生成" });
    status("参考照已齐，准备确认身份");
    return;
  }
  if (current === "待生成") {
    saveStudio({ identityStatus: "待确认" });
    status("身份已起版，准备定稿");
    return;
  }
  if (current === "待确认") {
    saveStudio({ identityStatus: "已确认" });
    status("身份已锁定，风格开始定调");
    return;
  }
  if (current === "需返修") {
    saveStudio({ identityStatus: "待上传", referenceCount: 0 });
    dom.studioReferenceInput.click();
    status("重新上传参考照，身份更稳");
    return;
  }
  status("身份已定稿，模板库已就绪");
}

function renderStudioSections() {
  const anchor = state.studioAnchor || "sample";
  const stageMap = {
    packages: dom.studioPackagesSection,
    identity: dom.studioIdentitySection,
    sample: dom.studioSampleSection,
    delivery: dom.studioDeliverySection
  };
  const isFlow = anchor === "flow";
  if (dom.studioCommand) dom.studioCommand.hidden = !isFlow;
  if (dom.studioCommand) dom.studioCommand.dataset.view = isFlow ? "flow" : "stage";
  if (dom.studioSceneRail) dom.studioSceneRail.hidden = true;
  if (dom.studioStageList) dom.studioStageList.hidden = isFlow;
  for (const [key, section] of Object.entries(stageMap)) {
    if (!section) continue;
    section.hidden = isFlow ? true : key !== anchor;
  }
}

function openStudioSection(anchor) {
  state.studioAnchor = anchor;
  switchTab("studio");
  focusStudioAnchor(anchor);
}

function focusStudioAnchor(anchor) {
  const target = {
    flow: dom.studioCommand,
    packages: dom.studioPackagesSection,
    identity: dom.studioIdentitySection,
    sample: dom.studioSampleSection,
    delivery: dom.studioDeliverySection
  }[anchor] || dom.studioFlow;
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function normalizeCreditAnchor(anchor) {
  return ["packages", "orders", "records"].includes(anchor) ? "packages" : "overview";
}

function focusCreditsAnchor(anchor) {
  const normalizedAnchor = normalizeCreditAnchor(anchor);
  const target = {
    overview: dom.creditOverviewView,
    packages: dom.creditRechargeView,
    records: dom.creditRechargeView,
    orders: dom.creditRechargeView,
    ledger: dom.creditOverviewView
  }[normalizedAnchor] || dom.creditOverviewView;
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderCreditSections() {
  const anchor = normalizeCreditAnchor(state.creditAnchor);
  state.creditAnchor = anchor;
  const sections = {
    overview: dom.creditOverviewView,
    packages: dom.creditRechargeView
  };
  for (const [key, section] of Object.entries(sections)) {
    if (!section) continue;
    section.hidden = key !== anchor;
  }
  if (dom.creditsPanel) dom.creditsPanel.dataset.view = anchor;
}

function studioFlowStep(step, index, uploaded, identityReady, templateSelected) {
  const checkpoints = [uploaded, identityReady, Boolean(templateSelected)];
  let activeIndex = checkpoints.findIndex((item) => !item);
  if (activeIndex === -1) activeIndex = 3;
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
  const cover = scenePackPreview(scene);
  const groups = studioSceneGroups(scene);
  const groupCount = groups.length;
  const galleryCount = studioSceneGalleryEntries(scene).length;
  const tags = scene.samples.slice(0, 2).map((item) => `<span>${esc(item.title)}</span>`).join("");
  const extra = groupCount > 2 ? `<span>+${Math.max(0, groupCount - 2)} 组样片</span>` : "";
  return `
    <article class="scene-pack-card ${selected ? "selected" : ""}">
      <div class="scene-pack-cover">
        <img src="${attr(cover.src)}" alt="${attr(cover.alt)}" loading="lazy" />
        <div class="scene-pack-cover-overlay">
          <span>${esc(scene.name)}</span>
          <em>${esc(scene.samples[0]?.title || "场景预览")}</em>
        </div>
      </div>
      <div class="scene-pack-head">
        <span>${esc(scene.people)}</span>
        <em>${esc(scene.status)}</em>
      </div>
      <h3>${esc(scene.name)}</h3>
      <p>${esc(scene.audience)}</p>
      <div class="scene-pack-tags">${tags}${extra}</div>
      <div class="scene-pack-meta">
        <span>${esc(scene.recommendedShots)}</span>
        <span>${groupCount} 组 / ${galleryCount} 张</span>
      </div>
      <button class="${selected ? "primary-btn" : "ghost-btn"} small" data-studio-scene="${attr(scene.id)}" type="button" aria-pressed="${selected ? "true" : "false"}">${selected ? "已选场景" : "选择场景"}</button>
    </article>`;
}

function sampleDirectionCard(scene, sample, selectedSample, previewSample) {
  const selected = sample.id === selectedSample?.id;
  const previewing = sample.id === previewSample?.id;
  const thumb = sampleDirectionPreview(scene, sample);
  const count = studioSamplePreviewEntries(scene, sample).length;
  return `
    <article class="sample-direction-card ${selected ? "selected" : ""} ${previewing ? "previewing" : ""}">
      <img class="sample-direction-cover" src="${attr(thumb.src)}" alt="${attr(thumb.alt)}" loading="lazy" />
      <div class="sample-direction-copy">
        <strong>${esc(sample.title)}</strong>
        <span>${esc(sample.tags)}</span>
        <p>${count > 3 ? `${count} 张可看，点开看大图` : "点一下直接看大图样片"}</p>
        <button class="${selected ? "primary-btn" : "ghost-btn"} small" data-studio-sample="${attr(sample.id)}" type="button">看大图</button>
      </div>
    </article>`;
}

function scenePackPreview(scene) {
  const sample = scene.samples[0] || null;
  const previews = studioSceneGalleryEntries(scene);
  return previews[1] || previews[0] || fallbackStudioPreviewEntry(scene, sample, "场景预览");
}

function sampleDirectionPreview(scene, sample) {
  const previews = studioSamplePreviewEntries(scene, sample);
  return previews[1] || previews[0] || fallbackStudioPreviewEntry(scene, sample, "样片预览");
}

function studioSceneGroups(scene) {
  const groups = Array.isArray(state.studioSamples.sceneGroups?.[scene.id]) ? state.studioSamples.sceneGroups[scene.id] : [];
  if (groups.length) return groups;
  return studioStaticSampleGroups(scene);
}

function studioStaticSampleGroups(scene) {
  return scene.samples.map((sample, index) => {
    const items = studioStaticSamplePreviewEntries(scene, sample).map((entry, entryIndex) => ({
      ...entry,
      id: entry.id || `${scene.id}-${sample.id}-static-${entryIndex + 1}`,
      groupId: `${scene.id}-${sample.id}`,
      groupTitle: sample.title
    }));
    const cover = items[0] || fallbackStudioPreviewEntry(scene, sample, "样片组");
    return {
      id: `${scene.id}-${sample.id}`,
      sceneId: scene.id,
      sampleId: sample.id,
      sampleTitle: sample.title,
      groupId: `${scene.id}-${sample.id}`,
      title: sample.title,
      subtitle: `${sample.tags} · ${items.length} 张`,
      cover: cover.src,
      coverAlt: cover.alt,
      count: items.length,
      items
    };
  });
}

function selectedStudioSampleGroup(scene = selectedStudioScene(), groups = studioSceneGroups(scene)) {
  return groups.find((item) => item.id === state.studio.selectedSampleGroupId || item.groupId === state.studio.selectedSampleGroupId)
    || groups[0]
    || null;
}

function selectedStudioSamplePhoto(scene = selectedStudioScene(), group = selectedStudioSampleGroup(scene)) {
  const entries = studioGroupPreviewEntries(scene, group);
  return entries.find((item) => item.id === state.studio.selectedSamplePhotoId)
    || entries[0]
    || null;
}

function sampleForStudioGroup(scene, group) {
  if (!group) return scene.samples[0] || null;
  return scene.samples.find((item) => item.id === group.sampleId) || scene.samples[0] || null;
}

function studioGroupPreviewEntries(_scene, group) {
  return group?.items?.length ? group.items : [];
}

function studioGroupPreviewKey(scene, group) {
  return group ? `${scene.id}:${group.id}` : "";
}

function currentStudioPreviewSample(scene = selectedStudioScene()) {
  return selectedStudioSample(scene) || scene.samples[0] || null;
}

function studioPreviewKey(scene, sample) {
  return sample ? `${scene.id}:${sample.id}` : "";
}

function sampleDecisionKey(scene, sample) {
  return studioPreviewKey(scene, sample);
}

function studioSampleDecision(scene, sample) {
  const key = sampleDecisionKey(scene, sample);
  const source = state.studio.sampleDecisions?.[key] || {};
  const statusValue = sampleStatusLabels.includes(source.status) ? source.status : "待查看";
  return {
    status: statusValue,
    note: typeof source.note === "string" ? source.note : "",
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : ""
  };
}

function studioSampleSummary(scene, selectedGroup, selectedPhoto) {
  const groups = studioSceneGroups(scene);
  const count = studioSceneGalleryEntries(scene).length;
  const selectedText = selectedGroup
    ? `${scene.name} · ${groups.length} 组 / ${count} 张 · 当前 ${selectedGroup.title}${selectedPhoto ? ` / ${selectedPhoto.label}` : ""}`
    : `${scene.name} · 已选场景，先看样片组，再看组内照片`;
  return `
    <span>${esc(selectedText)}</span>
  `;
}

function sampleStatusSummary(scene) {
  return scene.samples.reduce((summary, sample) => {
    const statusValue = studioSampleDecision(scene, sample).status;
    if (statusValue === "待查看") summary.pending += 1;
    if (statusValue === "已入围") summary.shortlisted += 1;
    if (statusValue === "待重生") summary.regen += 1;
    if (statusValue === "已转正") summary.promoted += 1;
    return summary;
  }, { pending: 0, shortlisted: 0, regen: 0, promoted: 0 });
}

function sampleActionOptions(statusValue) {
  const options = [
    { status: "已入围", label: "入围" },
    { status: "已淘汰", label: "淘汰" },
    { status: "待重生", label: "需重生" },
    { status: "已转正", label: "转正记录" }
  ];
  return options.filter((item) => item.status !== statusValue);
}

function updateSampleDecision(scene, sample, statusValue) {
  if (!sampleStatusLabels.includes(statusValue)) return;
  saveStudio({
    sampleDecisions: nextSampleDecisions(scene, sample, statusValue),
    selectedSampleId: sample.id
  });
  status(`${scene.name} · ${sample.title} 已标记为${statusValue}`);
}

function nextSampleDecisions(scene, sample, statusValue) {
  const key = sampleDecisionKey(scene, sample);
  return {
    ...(state.studio.sampleDecisions || {}),
    [key]: {
      status: statusValue,
      note: sampleStatusNote(statusValue),
      updatedAt: new Date().toISOString()
    }
  };
}

function sampleStatusNote(statusValue) {
  return {
    "已查看": "样片已打开，风格已看过",
    "已入围": "进入优选名单，放大审美点",
    "已淘汰": "不进入正式交付，直接划走",
    "待重生": "这一版不够稳，重来更合适",
    "已转正": "仅记录转正意向，正式文件仍以成片交付为准"
  }[statusValue] || "已记录样片状态";
}

function sampleDecisionSummary(decision) {
  if (decision.note) return decision.note;
  return decision.status === "待查看"
    ? "样片待看，方向待定"
    : "已看过，直接定调即可";
}

function samplePreviewHint(selected, statusValue) {
  if (statusValue === "已转正") return "转正意向已记，正式交付仍以成片交付为准";
  if (statusValue === "待重生") return "这一版不够稳，重生更合适";
  if (statusValue === "已入围") return "已进优选名单，放大风格点";
  if (statusValue === "已淘汰") return "已划走，不进正式交付";
  return selected ? "当前参考已选定" : "风格看准，方向定稳";
}

function sampleStatusClass(statusValue) {
  if (statusValue === "已入围" || statusValue === "已转正") return "ready";
  if (statusValue === "已淘汰" || statusValue === "待重生") return "danger";
  return "pending";
}

function studioSamplePreviewPanel(scene, groups, selectedGroup, selectedPhoto) {
  if (!groups.length) return `<div class="empty-inline">本场景暂无样片组</div>`;
  const photoCount = groups.reduce((sum, item) => sum + studioGroupPreviewEntries(scene, item).length, 0);
  const activePhoto = selectedPhoto || studioGroupPreviewEntries(scene, selectedGroup)[0] || null;
  const activeSample = sampleForStudioGroup(scene, selectedGroup);
  const loadingCopy = state.studioSamples.loaded ? `${groups.length} 组 / ${photoCount} 张` : "正在读取全部样片";
  return `
    <div class="sample-preview-head sample-gallery-head sample-one-screen-head">
      <div>
        <strong>${esc(scene.name)} 样片组</strong>
        <span>${esc(`${loadingCopy} · 点组切换，点照片同屏预览`)}</span>
      </div>
      <div class="sample-preview-head-actions">
        <span class="sample-preview-chip">${esc(selectedGroup?.title || "待选样片组")}</span>
      </div>
    </div>
    <div class="sample-one-screen-layout">
      <div class="sample-group-grid" data-sample-group-count="${groups.length}">
        ${groups.map((item) => studioSampleGroupCard(item, selectedGroup)).join("")}
      </div>
      <aside class="sample-group-detail">
        <div class="sample-group-stage">
          ${activePhoto ? `<img src="${attr(activePhoto.src)}" alt="${attr(activePhoto.alt)}" />` : ""}
          <span>${esc(activePhoto ? `${selectedGroup?.title || scene.name} · ${activePhoto.label}` : "选择左侧样片组")}</span>
        </div>
        <div class="sample-group-copy">
          <strong>${esc(selectedGroup?.title || scene.name)}</strong>
          <p>${esc(selectedGroup?.subtitle || "同一屏完成选组和看片")}</p>
          <div>
            <span>${esc(activeSample?.title || scene.name)}</span>
            <span>${studioGroupPreviewEntries(scene, selectedGroup).length} 张</span>
          </div>
        </div>
      </aside>
    </div>
    <div class="sample-preview-meta">
      <span>不跳弹窗，不换页面；当前组照片就在下方。</span>
      <strong>一屏完成查看</strong>
    </div>
  `;
}

function studioSampleGroupCard(group, selectedGroup) {
  const selected = group?.id === selectedGroup?.id;
  return `
    <button class="sample-group-card ${selected ? "selected" : ""}" data-studio-sample-group="${attr(group.id)}" type="button" aria-pressed="${selected ? "true" : "false"}">
      <img src="${attr(group.cover)}" alt="${attr(group.coverAlt || group.title)}" loading="lazy" />
      <span>${esc(group.sampleTitle || "样片组")}</span>
      <strong>${esc(group.title)}</strong>
      <em>${esc(group.subtitle || `${group.count || 0} 张`)}</em>
    </button>`;
}

function studioSamplePhotoGrid(scene, group, selectedPhoto) {
  const entries = studioGroupPreviewEntries(scene, group);
  if (!entries.length) return `<div class="empty-inline">这一组还没有照片</div>`;
  return `
    <div class="sample-photo-grid" data-gallery-count="${entries.length}">
      ${entries.map((item, index) => studioSamplePhotoCard(item, selectedPhoto, index)).join("")}
    </div>`;
}

function studioSamplePhotoCard(item, selectedPhoto, index) {
  const selected = item.id === selectedPhoto?.id;
  return `
    <button class="sample-photo-card ${selected ? "selected" : ""}" data-studio-gallery-item data-studio-sample-photo="${attr(item.id)}" type="button" aria-label="同屏查看第 ${index + 1} 张样片">
      <img src="${attr(item.src)}" alt="${attr(item.alt)}" loading="lazy" />
      <span>${esc(item.groupTitle || item.sampleTitle || "样片")}</span>
      <strong>${esc(item.label || `第 ${index + 1} 张`)}</strong>
    </button>`;
}

function studioSampleDisplayEntries(scene, sample) {
  const entries = studioSamplePreviewEntries(scene, sample);
  const [contactSheets, samplePhotos] = entries.reduce((groups, item) => {
    const isContactSheet = String(item.src || "").includes("/contact_sheets/");
    groups[isContactSheet ? 0 : 1].push(item);
    return groups;
  }, [[], []]);
  return [...samplePhotos, ...contactSheets];
}

function studioSamplePreviewEntries(scene, sample) {
  const fromCatalog = studioSampleAssetEntries(scene, sample);
  if (fromCatalog.length) return fromCatalog;
  return studioStaticSamplePreviewEntries(scene, sample);
}

function studioSceneGalleryEntries(scene, activeSample = null) {
  const groups = studioSceneGroups(scene);
  const merged = [];
  for (const group of groups) {
    for (const entry of studioGroupPreviewEntries(scene, group)) {
      if (merged.some((item) => item.src === entry.src)) continue;
      merged.push({ ...entry, sampleId: group.sampleId, sampleTitle: group.sampleTitle, groupId: group.groupId, groupTitle: group.title });
    }
  }
  if (!activeSample) return merged;
  return [
    ...merged.filter((item) => item.sampleId === activeSample.id),
    ...merged.filter((item) => item.sampleId !== activeSample.id)
  ];
}

function studioSampleAssetEntries(scene, sample) {
  const entries = Array.isArray(state.studioSamples.scenes?.[scene.id]) ? state.studioSamples.scenes[scene.id] : [];
  return entries
    .filter((item) => item.sampleId === sample.id)
    .map((item, index) => normalizeStudioGalleryEntry(scene, item, index, sample));
}

function normalizeStudioGalleryEntry(scene, item, index, sampleOverride = null) {
  const sample = sampleOverride || scene.samples.find((entry) => entry.id === item.sampleId) || scene.samples[0] || null;
  return {
    ...item,
    id: item.id || `${scene.id}-gallery-${index + 1}`,
    alt: item.alt || `${scene.name} · ${sample?.title || "样片"} · 样片 ${index + 1}`,
    label: item.label || `样片 ${index + 1}`,
    sampleId: sample?.id || item.sampleId || "",
    sampleTitle: sample?.title || item.sampleTitle || scene.name
  };
}

function studioStaticSamplePreviewEntries(scene, sample) {
  const fromAssets = (studioSamplePreviewSets[scene.id]?.[sample.id] || []).map((src, index) => ({
    id: `${scene.id}-${sample.id}-${index + 1}`,
    src,
    alt: `${scene.name} · ${sample.title} · 样片 ${index + 1}`,
    label: ["封面", "互动", "细节"][index] || `样片 ${index + 1}`,
    sampleId: sample.id,
    sampleTitle: sample.title
  }));
  const fromTemplates = matchStudioPreviewTemplates(scene, sample, fromAssets.length)
    .map((item, index) => ({
      id: `tpl-${item.id}`,
      src: templateRemoteImage(item.imageUrl) || templateFallbackImage(item),
      alt: `${scene.name} · ${item.title}`,
      label: item.title.replace(/^[^-\s]+(?:\s*-\s*)?/, "").slice(0, 12) || `样片 ${index + 1}`,
      sampleId: sample.id,
      sampleTitle: sample.title
    }));
  const merged = [];
  for (const item of [...fromAssets, ...fromTemplates]) {
    if (merged.some((entry) => entry.src === item.src)) continue;
    merged.push(item);
    if (merged.length >= 3) return merged;
  }
  while (merged.length < 3) {
    const index = merged.length + 1;
    merged.push({
      id: `fallback-${scene.id}-${sample.id}-${index}`,
      src: templateFallbackImage({ category: scene.name, title: `${sample.title} 样片 ${index}`, description: sample.tags }),
      alt: `${scene.name} · ${sample.title} · 样片 ${index}`,
      label: `样片 ${index}`,
      sampleId: sample.id,
      sampleTitle: sample.title
    });
  }
  return merged;
}

function matchStudioPreviewTemplates(scene, sample, existingCount = 0) {
  if (!state.templates.length || existingCount >= 3) return [];
  const label = studioSceneTemplateLabels[scene.id] || scene.name;
  const terms = [
    label,
    scene.name,
    sample.title,
    ...String(sample.query || "").split(/\s+/).filter(Boolean)
  ].map((item) => String(item || "").trim().toLowerCase()).filter(Boolean);
  return state.templates
    .map((item) => ({ item, score: studioPreviewScore(item, label, terms) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.item.title.localeCompare(right.item.title, "zh-CN"))
    .slice(0, Math.max(0, 3 - existingCount))
    .map((entry) => entry.item);
}

function studioPreviewScore(item, label, terms) {
  const category = String(item.category || "").toLowerCase();
  const title = String(item.title || "").toLowerCase();
  const search = String(item.searchText || "").toLowerCase();
  let score = 0;
  if (category === String(label).toLowerCase()) score += 10;
  for (const term of terms) {
    if (!term) continue;
    if (title.includes(term)) score += 6;
    else if (category.includes(term)) score += 4;
    else if (search.includes(term)) score += 2;
  }
  return score;
}

function openStudioSamplePreview(scene = selectedStudioScene(), sample = currentStudioPreviewSample(scene), activeIndex = 0, entriesOverride = null) {
  if (!sample) return;
  const previews = Array.isArray(entriesOverride) && entriesOverride.length ? entriesOverride : studioSamplePreviewEntries(scene, sample);
  const safeIndex = clamp(Number(activeIndex) || 0, 0, previews.length - 1);
  const current = previews[safeIndex];
  saveStudio({
    selectedSampleId: sample.id,
    selectedSamplePhotoId: current?.id || "",
    previewedSampleKey: studioPreviewKey(scene, sample)
  });
  status(`${sample.title} 已在同屏预览`);
}

function addStudioReferences(input) {
  const count = Array.from(input?.files || []).filter((file) => file?.type?.startsWith("image/")).length;
  if (!count) return;
  const nextCount = clamp((state.studio.referenceCount || 0) + count, 0, studioRequiredReferenceCount);
  const nextStatus = nextCount >= studioRequiredReferenceCount ? "待生成" : "待上传";
  saveStudio({
    referenceCount: nextCount,
    identityStatus: nextStatus,
    ...(state.studio.identityStatus === "已确认" || state.studio.templateConfirmed ? emptyStudioTemplateSelection() : {})
  });
  status(nextCount >= studioRequiredReferenceCount
    ? `${studioRequiredReferenceCount}/${studioRequiredReferenceCount} 张参考照已就位`
    : `已记录 ${nextCount}/${studioRequiredReferenceCount} 张参考图，还差 ${studioRequiredReferenceCount - nextCount} 张`);
  input.value = "";
}

function useStudioSample() {
  const scene = selectedStudioScene();
  const group = selectedStudioSampleGroup(scene);
  const sample = selectedStudioSample(scene) || sampleForStudioGroup(scene, group) || currentStudioPreviewSample(scene);
  const template = selectedStudioTemplate();
  const templateSelected = Boolean(state.studio.templateConfirmed && template?.id);
  if ((state.studio.referenceCount || 0) < studioRequiredReferenceCount || state.studio.identityStatus !== "已确认") {
    openStudioSection("identity");
    status("三张参考照和身份确认就位，成片更稳");
    return;
  }
  if (!templateSelected) {
    openStudioSection("packages");
    status("模板定调，成片更稳");
    return;
  }
  setPromptValue(buildStudioPrompt(scene, sample, template));
  state.createMode = "generate";
  setPromptOptions([]);
  state.templateSelectionMode = "create";
  switchTab("generate");
  dom.promptInput.focus();
  status(`成片开拍：${template.title}`);
}

function buildStudioPrompt(scene, sample, template) {
  const group = selectedStudioSampleGroup(scene);
  return [
    `模板名称：${template?.title || "未命名模板"}`,
    template?.category ? `模板分类：${template.category}` : "",
    template?.prompt ? `模板基础提示：${template.prompt}` : "",
    sample ? `可选样片参考：${scene.name} · ${sample.title}` : "",
    group ? `样片组参考：${group.title} · ${group.subtitle}` : "",
    sample?.prompt ? `样片参考：${sample.prompt}` : "",
    `身份要求：使用已确认的参考照作为唯一身份依据，脸部必须像本人，年龄感、脸型、眼睛、鼻子、嘴型和气质不能明显漂移。`,
    `拍摄前提：已上传三张图，已确认身份，已选好模板，现在开拍成片。`,
    `质量约束：真实皮肤质感，手部自然，服装合身，背景可信，构图紧凑高级。`,
    `负面约束：不要过度磨皮，不要塑料皮肤，不要影楼站桩，不要假背景，不要五官漂移，不要多人串脸。`
  ].filter(Boolean).join("\n\n");
}

function selectedStudioScene() {
  return scenePacks.find((item) => item.id === state.studio.selectedSceneId) || scenePacks[0];
}

function selectedStudioSample(scene = selectedStudioScene()) {
  return scene.samples.find((item) => item.id === state.studio.selectedSampleId) || null;
}

function selectedStudioTemplate() {
  const id = typeof state.studio.selectedTemplateId === "string" ? state.studio.selectedTemplateId : "";
  if (!id) return null;
  const template = state.templates.find((item) => item.id === id);
  return {
    id,
    title: template?.title || state.studio.selectedTemplateTitle || "已选模板",
    category: template?.category || state.studio.selectedTemplateCategory || "",
    prompt: template?.prompt || state.studio.selectedTemplatePrompt || ""
  };
}

function emptyStudioTemplateSelection() {
  return {
    selectedTemplateId: "",
    selectedTemplateTitle: "",
    selectedTemplateCategory: "",
    selectedTemplatePrompt: "",
    templateConfirmed: false
  };
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
  const selectedSampleGroupId = typeof source.selectedSampleGroupId === "string" ? source.selectedSampleGroupId : "";
  const selectedSamplePhotoId = typeof source.selectedSamplePhotoId === "string" ? source.selectedSamplePhotoId : "";
  const previewedSampleKey = typeof source.previewedSampleKey === "string" ? source.previewedSampleKey : "";
  const identityStatuses = ["待上传", "待生成", "待确认", "已确认", "需返修"];
  const sampleDecisions = normalizeSampleDecisions(source.sampleDecisions);
  return {
    selectedSceneId,
    identityStatus: identityStatuses.includes(source.identityStatus) ? source.identityStatus : defaults.studio.identityStatus,
    selectedSampleId,
    selectedSampleGroupId,
    selectedSamplePhotoId,
    previewedSampleKey,
    selectedTemplateId: typeof source.selectedTemplateId === "string" ? source.selectedTemplateId : "",
    selectedTemplateTitle: typeof source.selectedTemplateTitle === "string" ? source.selectedTemplateTitle : "",
    selectedTemplateCategory: typeof source.selectedTemplateCategory === "string" ? source.selectedTemplateCategory : "",
    selectedTemplatePrompt: typeof source.selectedTemplatePrompt === "string" ? source.selectedTemplatePrompt : "",
    templateConfirmed: Boolean(source.templateConfirmed),
    referenceCount: clamp(Number(source.referenceCount || 0), 0, studioRequiredReferenceCount),
    deliveryReadyCount: clamp(Number(source.deliveryReadyCount || 0), 0, 999),
    sampleDecisions
  };
}

function normalizeSampleDecisions(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.entries(source).reduce((result, [key, entry]) => {
    if (!/^[a-z0-9]+:[a-z0-9-]+$/i.test(key)) return result;
    const item = entry && typeof entry === "object" ? entry : {};
    const statusValue = sampleStatusLabels.includes(item.status) ? item.status : "待查看";
    result[key] = {
      status: statusValue,
      note: typeof item.note === "string" ? item.note.slice(0, 80) : "",
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : ""
    };
    return result;
  }, {});
}

function identityHelpText(statusValue) {
  return {
    "待上传": `${studioRequiredReferenceCount} 张参考照，越像越稳`,
    "待生成": "参考照已齐，准备确认身份",
    "待确认": "身份待定稿",
    "已确认": "身份已锁，模板可定调",
    "需返修": "重修后更像本人"
  }[statusValue] || "参考照待就位";
}

function studioReferenceSummary() {
  const count = Math.min(studioRequiredReferenceCount, Math.max(0, Number(state.studio.referenceCount || 0)));
  const remain = Math.max(0, studioRequiredReferenceCount - count);
  return remain ? `已传 ${count}/${studioRequiredReferenceCount} 张，还差 ${remain} 张` : `已传满 ${studioRequiredReferenceCount}/${studioRequiredReferenceCount} 张`;
}

function identityChecks(identityReady) {
  return [
    { status: "待上传", note: studioReferenceSummary(), active: state.studio.identityStatus === "待上传" },
    { status: "待生成", note: "参考照已齐，准备确认身份", active: state.studio.identityStatus === "待生成" },
    { status: "待确认", note: "像本人，等你定稿", active: state.studio.identityStatus === "待确认" },
    { status: "已确认", note: identityReady ? "身份已锁" : "像本人后定模板", active: state.studio.identityStatus === "已确认" },
    { status: "需返修", note: "脸不像或串脸", active: state.studio.identityStatus === "需返修" }
  ];
}

function identityPrimaryActionLabel() {
  if (state.studio.identityStatus === "待上传" && (state.studio.referenceCount || 0) >= studioRequiredReferenceCount) return "确认身份";
  return {
    "待上传": "上传参考照",
    "待生成": "确认像本人",
    "待确认": "确认像本人",
    "已确认": "身份已锁定",
    "需返修": "重传参考照"
  }[state.studio.identityStatus] || "确认像本人";
}

function renderCategories() {
  const counts = categoryCounts(visibleTemplates());
  const categories = [...counts.keys()].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const total = visibleTemplates().length;
  dom.categoryFilter.innerHTML = `<option value="all">全部分类 (${total})</option>${categories.map((item) => `<option value="${esc(item)}">${esc(item)} (${counts.get(item) || 0})</option>`).join("")}`;
  if (!categories.includes(state.category)) state.category = "all";
  dom.categoryFilter.value = state.category;
}

function renderTemplateCollections() {
  if (!dom.templateCollections) return;
  dom.templateCollections.innerHTML = templateLibraryGroups.map((group) => {
    const total = state.templates.filter((item) => matchesTemplateLibraryGroup(item, group.id)).length;
    const unit = group.kind === "template" ? "个模板" : group.kind === "reference" ? "条参考" : "条内容";
    return `
      <button class="template-collection-card ${group.id === state.templateGroup ? "active" : ""} ${group.id === "all" ? "featured" : ""}" data-template-group="${attr(group.id)}" type="button">
        <img src="${attr(group.image)}" alt="${attr(group.label)}" loading="lazy" />
        <div class="template-collection-overlay"></div>
        <div class="template-collection-copy">
          <span>${esc(group.label)}</span>
          <strong>${total} ${unit}</strong>
          <p>${esc(group.note)}</p>
          <em>${group.kind === "reference" ? "本地参考分类" : group.kind === "template" ? "外部模板分类" : "全部内容"}</em>
        </div>
      </button>`;
  }).join("");
  dom.templateCollections.querySelectorAll("[data-template-group]").forEach((button) => {
    button.addEventListener("click", () => {
      state.templateGroup = button.dataset.templateGroup || "all";
      state.limit = 24;
      renderTemplateCollections();
      renderCategories();
      renderTemplates();
      status(`${currentTemplateLibraryGroup().label} 分类已打开`);
    });
  });
}

function categoryCounts(templates) {
  const counts = new Map();
  for (const item of templates) counts.set(item.category, (counts.get(item.category) || 0) + 1);
  return counts;
}

function renderCreateGenerateOverview() {
  renderCreateOverview();
  renderGenerateOverview();
}

function normalizeCreateMode(mode) {
  return createToolModes[mode] ? mode : "generate";
}

function selectedCreateMode() {
  return createToolModes[normalizeCreateMode(state.createMode)] || createToolModes.generate;
}

function applyCreateMode(mode) {
  state.createMode = normalizeCreateMode(mode);
  const currentMode = selectedCreateMode();
  renderTabs();
  renderCreateGenerateOverview();
  dom.promptInput?.focus();
  status(currentMode.status);
}

function validPromptOptionIds(ids = []) {
  return [...new Set((Array.isArray(ids) ? ids : []).filter((id) => promptOptionPresets[id]))];
}

function selectedPromptOptions() {
  return validPromptOptionIds(state.selectedPromptOptions).map((id) => ({ id, ...promptOptionPresets[id] }));
}

function promptOptionsNeedReference(options = selectedPromptOptions()) {
  return options.some((item) => item.requiresReference);
}

function promptOptionTitles(options = selectedPromptOptions()) {
  return options.map((item) => item.title);
}

function buildPromptOptionAddon(options = selectedPromptOptions()) {
  if (!options.length) return "";
  return [
    "附加处理要求：",
    ...options.map((item) => `- ${item.promptAddon}`)
  ].join("\n");
}

function buildEffectivePrompt() {
  const basePrompt = state.prompt.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const optionAddon = buildPromptOptionAddon();
  return [basePrompt, optionAddon].filter(Boolean).join("\n\n").trim();
}

function setPromptOptions(ids = []) {
  state.selectedPromptOptions = validPromptOptionIds(ids);
  renderPromptOptions();
  renderEditState();
}

function clearPromptOptions() {
  if (!state.selectedPromptOptions.length) return;
  state.selectedPromptOptions = [];
  renderPromptOptions();
  renderEditState();
  status("可选功能已清空");
}

function togglePromptOption(id) {
  const current = new Set(validPromptOptionIds(state.selectedPromptOptions));
  if (current.has(id)) current.delete(id);
  else current.add(id);
  state.selectedPromptOptions = [...current];
  renderPromptOptions();
  renderEditState();
  const titles = promptOptionTitles();
  status(
    state.selectedPromptOptions.length
      ? `可选功能已启用：${titles.join(" / ")}`
      : "可选功能已清空"
  );
}

function renderPromptOptions() {
  const activeIds = new Set(validPromptOptionIds(state.selectedPromptOptions));
  const options = selectedPromptOptions();
  const activeCount = activeReferences().length;
  if (dom.promptOptionGrid) {
    dom.promptOptionGrid.innerHTML = Object.entries(promptOptionPresets).map(([id, item]) => {
      const active = activeIds.has(id);
      return `
        <button class="prompt-option-card ${active ? "active" : ""}" data-prompt-option="${attr(id)}" type="button">
          <span class="prompt-option-label">
            <strong>${esc(item.title)}</strong>
            <em>${item.requiresReference ? "需原图" : "可直接生效"}</em>
          </span>
          <small>${esc(item.short)}</small>
        </button>
      `;
    }).join("");
    dom.promptOptionGrid.querySelectorAll("[data-prompt-option]").forEach((button) => {
      button.addEventListener("click", () => togglePromptOption(button.dataset.promptOption));
    });
  }
  if (dom.clearPromptOptionsBtn) dom.clearPromptOptionsBtn.hidden = !options.length;
  if (dom.promptOptionHint) {
    dom.promptOptionHint.textContent = options.length
      ? activeCount
        ? `${options.length} 个可选功能已就绪，成片效果更饱满`
        : `${options.length} 个可选功能已选，原图就位更稳`
      : "可选功能都是后补效果，不用先想这个。";
  }
  if (dom.promptOptionPreview) {
    dom.promptOptionPreview.innerHTML = options.length
      ? `<strong>附加效果：</strong>${options.map((item) => `${esc(item.title)}：${esc(item.summary)}`).join("；")}`
      : "先上传照片、写提示词；需要时再补可选功能。";
  }
}

function renderCreateOverview() {
  if (dom.createTemplateMetric) dom.createTemplateMetric.textContent = `${state.templates.length} 个模板`;
  if (dom.createCategoryMetric) dom.createCategoryMetric.textContent = `${categoryCounts(state.templates).size} 个分区`;
  if (dom.createCreditMetric) dom.createCreditMetric.textContent = formatCredits(state.credits.balance);
  if (dom.createFlowHint) {
    const activeCount = activeReferences().length;
    const hasPrompt = Boolean(state.prompt.trim());
    dom.createFlowHint.textContent = hasPrompt
      ? activeCount
        ? `画面灵感和 ${activeCount} 张原图已就位，开拍感更稳。`
        : "画面灵感已就位，直接开拍。"
      : state.category !== "all"
        ? `${state.category} 分区已打开，更容易出片。`
        : "模板定风格，智能生图稳定出片。";
  }
}

function renderGenerateOverview() {
  const activeCount = activeReferences().length;
  const options = selectedPromptOptions();
  const optionTitles = promptOptionTitles(options);
  const optionCount = options.length;
  const promptLength = state.prompt.trim().length;
  const needsReference = optionCount > 0 && promptOptionsNeedReference(options);
  const estimateText = state.creditEstimate?.estimatedCost
    ? `预计 ${formatCredits(state.creditEstimate.estimatedCost)}`
    : state.creditEstimateError
      ? "积分预估失败"
      : "正在估算积分";
  if (dom.generateModeBadge) {
    dom.generateModeBadge.textContent = !promptLength
      ? activeCount
        ? "待补画面描述"
        : "待上传照片"
      : optionCount && !activeCount && needsReference
        ? "待上传原图"
        : activeCount
          ? optionCount
            ? "可开始编辑"
            : "原图已就绪"
          : optionCount
            ? "可选功能已选"
            : "可直接生成";
  }
  if (dom.generateReferenceBadge) dom.generateReferenceBadge.textContent = `${activeCount} 张`;
  if (dom.generatePromptBadge) dom.generatePromptBadge.textContent = promptLength ? `${promptLength} 字` : "待写";
  if (dom.generateBalanceBadge) dom.generateBalanceBadge.textContent = formatCredits(state.credits.balance);
  if (dom.generateModeTags) {
    const tags = [
      activeCount ? "照片已载入" : "未传照片",
      optionCount ? optionTitles.join(" / ") : "不选功能",
      "自动归档"
    ];
    dom.generateModeTags.innerHTML = tags.map((item) => `<span>${esc(item)}</span>`).join("");
  }
  if (dom.promptInput) dom.promptInput.placeholder = selectedCreateMode().placeholder || "先写你想要的结果，再补人物、场景、镜头和气质";
  if (dom.generateSummaryTitle) {
    dom.generateSummaryTitle.textContent = !promptLength
      ? activeCount
        ? "照片已就绪，写提示词就能开拍"
        : "先上传照片，再写提示词"
      : optionCount && !activeCount && needsReference
        ? "原图待就位"
        : activeCount
          ? optionCount
            ? "照片和可选功能已就绪"
            : "照片已就绪，可直接编辑"
          : optionCount
            ? "提示词和可选功能已就绪"
            : "提示词已就绪";
  }
  if (dom.generateSummaryHint) {
    dom.generateSummaryHint.textContent = !promptLength
      ? activeCount
        ? `${activeCount} 张照片已到位，再写一句提示词就能开拍；不会写全时，用右侧辅助区补。`
        : "主区先做三件事：上传照片、写提示词、开拍。提示词不会写时，再用右侧辅助区补。"
      : optionCount && !activeCount && needsReference
        ? `${optionTitles.join(" / ")} 已选好；原图就位后效果更稳。`
        : activeCount
          ? optionCount
            ? `${activeCount} 张照片已载入，${optionCount} 个可选功能已就绪，主区现在可以直接开拍，${estimateText}。`
            : `${activeCount} 张照片已载入，编辑开拍更稳，${estimateText}。`
          : optionCount
            ? `${optionCount} 个可选功能已选好，提示词现在能直接开拍；原图就位更稳，${estimateText}。`
            : `提示词已经就绪，现在可以直接开拍；需要换背景、换装、增强、修复时，再去右侧补功能，${estimateText}。`;
  }
}

function renderTemplates(error = "") {
  const filtered = filterTemplates();
  const visible = filtered.slice(0, state.limit);
  const currentGroup = currentTemplateLibraryGroup();
  const groupTotal = visibleTemplates().length;
  const unit = currentGroup.kind === "template" ? "个模板" : currentGroup.kind === "reference" ? "条参考" : "条内容";
  dom.templateCount.textContent = `${filtered.length} / ${groupTotal} ${unit}`;
  dom.templateHint.textContent = state.templateSelectionMode === "studio"
    ? state.category !== "all"
      ? `拍摄定制 · ${state.category} 大片更好定调`
      : "拍摄定制 · 模板定调"
    : state.category !== "all"
      ? `${state.category} 分区 · 选中即开拍`
    : state.featuredOnly
      ? "精选模板，出片更稳"
      : currentGroup.id === "fun"
        ? "趣味生图分类 · 快速挑风格"
        : currentGroup.id === "identity"
          ? "形象确认分类 · 先锁定像本人"
          : currentGroup.id === "set"
            ? "套图写真分类 · 婚纱情侣闺蜜等成组参考"
            : "模板库已按分类整理";
  dom.loadMoreBtn.hidden = filtered.length <= visible.length;
  if (error) {
    dom.templateGrid.innerHTML = empty(`模板读取失败：${error}`);
    renderCreateGenerateOverview();
    return;
  }
  if (!visibleTemplates().length) {
    dom.templateGrid.innerHTML = empty("暂无模板数据");
    renderCreateGenerateOverview();
    return;
  }
  if (!visible.length) {
    dom.templateGrid.innerHTML = empty("没有匹配模板");
    renderCreateGenerateOverview();
    return;
  }
  dom.templateGrid.innerHTML = visible.map(templateCard).join("");
  dom.templateGrid.querySelectorAll("[data-use-template]").forEach((button) => {
    button.addEventListener("click", () => void useTemplate(button.dataset.useTemplate));
  });
  hydrateTemplateImages();
  renderCreateGenerateOverview();
}

function filterTemplates() {
  const keyword = state.query.trim().toLowerCase();
  return visibleTemplates().filter((item) => {
    if (state.category !== "all" && item.category !== state.category) return false;
    if (state.featuredOnly && !item.featured) return false;
    if (!keyword) return true;
    return item.searchText.includes(keyword);
  }).sort((left, right) => {
    const score = templatePriority(right) - templatePriority(left);
    if (score) return score;
    return left.title.localeCompare(right.title, "zh-CN");
  });
}

function templateCard(item) {
  const fallback = templateFallbackImage(item);
  const source = localTemplateImage(item) || templateRemoteImage(item.imageUrl);
  const imageSource = source || fallback;
  const image = `<img src="${attr(imageSource)}" data-fallback="${attr(fallback)}" ${source ? `data-real-image="true"` : ""} alt="${attr(item.title)}" loading="lazy" referrerpolicy="no-referrer" />`;
  const isStudioSelection = state.templateSelectionMode === "studio";
  const badges = [
    item.category,
    item.isLocal ? "本地参考" : "",
    item.featured ? "精选" : "",
    item.language || ""
  ].filter(Boolean).map((label) => `<span>${esc(label)}</span>`).join("");
  const actionLabel = isStudioSelection
    ? (item.isLocal ? "选择这个参考" : "选择这个模板")
    : (item.isLocal ? "使用参考" : "使用模板");
  return `
    <article class="template-card ${item.isLocal ? "local" : ""}">
      <div class="template-thumb" style="--template-fallback: url('${attr(fallback)}')">${image}</div>
      <div class="template-body">
        <div class="meta-row">${badges}</div>
        <h3>${esc(item.title)}</h3>
        <p>${esc(item.description || "点一下，直接开拍")}</p>
        <div class="template-card-foot">
          <span>${esc(templateCardHint(item))}</span>
          <em>${esc(item.isLocal ? "本地参考" : "通用模板")}</em>
        </div>
        <button class="primary-btn small" data-use-template="${attr(item.id)}" type="button">${esc(actionLabel)}</button>
      </div>
    </article>`;
}

function templatePriority(item) {
  const local = item.isLocal ? 200 : 0;
  const featured = item.featured ? 80 : 0;
  const categoryIndex = templateCategoryOrder.indexOf(item.category);
  const category = categoryIndex >= 0 ? (templateCategoryOrder.length - categoryIndex) * 10 : 0;
  return local + featured + category;
}

function localTemplateImage(item) {
  return localTemplateIdCovers[item.id] || localTemplateCategoryCovers[item.category] || "";
}

function templateCardHint(item) {
  return {
    "人像基准": "身份起版，像本人更稳",
    "婚纱照": "封面样片和套餐预览都合适",
    "情侣照": "适合纪念日、旅行和日常互动",
    "闺蜜照": "适合双人关系和生日纪念",
    "10岁照": "适合成长纪念和亲子方向",
    "夕阳红": "适合纪念合照和旅行留念",
    "女生写真": "适合头像、生日和个人形象"
  }[item.category] || "选中就能开拍";
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
  if (url.startsWith("/")) return url;
  if (url.startsWith("./")) return url;
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
  const isStudioSelection = state.templateSelectionMode === "studio";
  const subject = item.isLocal ? "参考" : "模板";
  status(item.prompt ? (isStudioSelection ? `${subject}已定：${item.title}` : `${subject}已带入：${item.title}`) : `${subject}详情读取中`);
  try {
    await ensureTemplatePrompt(item);
  } catch (error) {
    status(`${subject}详情读取失败：${errorMessage(error)}`);
    return;
  }
  if (isStudioSelection) {
    saveStudio({
      selectedTemplateId: item.id,
      selectedTemplateTitle: item.title,
      selectedTemplateCategory: item.category,
      selectedTemplatePrompt: item.prompt,
      templateConfirmed: true
    });
    state.templateSelectionMode = "create";
    openStudioSection("delivery");
    status(`${subject}已定：${item.title}，成片感就绪`);
    return;
  }
  setPromptValue(item.prompt);
  state.createMode = "generate";
  setPromptOptions([]);
  state.templateSelectionMode = "create";
  switchTab("generate");
  dom.promptInput.focus();
  status(`${subject}已带入：${item.title}`);
}

async function ensureTemplatePrompt(item) {
  if (item.prompt) return item;
  const response = await apiFetch(`/api/templates/${encodeURIComponent(item.id)}`, { headers: { Accept: "application/json" } });
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
  if (tab === "history") renderHistory();
  if (tab === "register") renderRegisterPanel();
  if (tab === "credits") void refreshCreditCenter(false);
  if (tab === "templates") {
    renderTemplateCollections();
    renderCategories();
    renderTemplates();
  }
  if (tab === "templates" || tab === "generate") renderCreateGenerateOverview();
}

function tabGroup(tab) {
  if (["templates", "generate"].includes(tab)) return "create";
  return tab;
}

function switchPrimary(primary) {
  const defaultTabs = {
    studio: "studio",
    create: "templates",
    history: "history",
    register: "register",
    credits: "credits"
  };
  if (primary === "studio") state.studioAnchor = "sample";
  if (primary === "create") {
    state.templateSelectionMode = "create";
    state.templateGroup = "all";
  }
  if (primary === "history") state.historyMode = "active";
  if (primary === "register") {
    state.authView = "login";
    state.authRegisterStep = "credentials";
  }
  if (primary === "credits") state.creditAnchor = "overview";
  switchTab(defaultTabs[primary] || "studio");
}

function goToRegisterPanel() {
  switchTab("register");
  renderRegisterPanel();
  dom.registerEmailInput?.focus();
  status("请先登录，还没有账号再创建");
}

function goToCreateWorkspace(message = "已进入图片创作") {
  state.templateSelectionMode = "create";
  state.templateGroup = "all";
  switchTab("templates");
  status(message);
}

function currentRegisterStep() {
  return state.authRegisterStep === "verify" ? "verify" : "credentials";
}

function renderRegisterPanel() {
  const isRegister = state.authView === "register";
  const registerStep = currentRegisterStep();
  const verifyingEmail = isRegister && registerStep === "verify";
  const draft = currentAuthDraft();
  const user = state.auth.user?.id ? state.auth.user : null;
  if (dom.registerPanelEyebrow) dom.registerPanelEyebrow.textContent = isRegister ? (verifyingEmail ? "验证邮箱" : "创建账号") : "登录";
  if (dom.registerPanelTitle) dom.registerPanelTitle.textContent = isRegister ? (verifyingEmail ? "完成邮箱验证" : "创建你的账号") : "登录后继续创作";
  if (dom.registerModeTitle) dom.registerModeTitle.textContent = isRegister ? (verifyingEmail ? "输入验证码" : "创建账号") : "邮箱登录";
  if (dom.authModeRegisterBtn) dom.authModeRegisterBtn.hidden = isRegister;
  if (dom.authModeLoginBtn) dom.authModeLoginBtn.hidden = !isRegister;
  if (dom.authModeRegisterBtn) dom.authModeRegisterBtn.textContent = "还没有账号？创建一个";
  if (dom.authModeLoginBtn) dom.authModeLoginBtn.textContent = verifyingEmail ? "返回上一步" : "已有账号？去登录";
  if (dom.registerUsernameField) dom.registerUsernameField.hidden = true;
  if (dom.registerEmailField) dom.registerEmailField.hidden = verifyingEmail;
  if (dom.registerPasswordField) dom.registerPasswordField.hidden = verifyingEmail;
  if (dom.registerCodeField) dom.registerCodeField.hidden = !verifyingEmail;
  if (dom.registerFlowNote) {
    dom.registerFlowNote.textContent = isRegister
      ? verifyingEmail
        ? `验证码已发到 ${maskEmailAccount(draft.account) || "你的邮箱"}，输入 6 位验证码完成创建。`
        : "先填邮箱和密码，我们会把验证码发到你的邮箱。"
      : "用邮箱和密码登录；还没有账号就创建一个。";
  }
  if (dom.registerPasswordInput) dom.registerPasswordInput.autocomplete = isRegister ? "new-password" : "current-password";
  if (dom.registerNowBtn) {
    dom.registerNowBtn.textContent = state.authSubmitting
      ? (isRegister ? (verifyingEmail ? "创建中..." : "继续中...") : "登录中...")
      : (isRegister ? (verifyingEmail ? "完成创建" : "继续") : "立即登录");
    dom.registerNowBtn.disabled = state.authSubmitting || state.authCodeSending || !authReadyToSubmit(isRegister, draft);
  }
  if (dom.sendCodeBtn) {
    dom.sendCodeBtn.hidden = !verifyingEmail;
    dom.sendCodeBtn.disabled = state.authSubmitting || state.authCodeSending || state.authCodeCooldown > 0 || !draft.account || draft.password.length < 6;
    dom.sendCodeBtn.textContent = state.authCodeSending ? "发送中..." : state.authCodeCooldown > 0 ? `${state.authCodeCooldown}s` : "重新发送";
  }
  if (dom.registerMessage) {
    dom.registerMessage.hidden = !state.authMessage;
    dom.registerMessage.textContent = state.authMessage;
    dom.registerMessage.classList.toggle("ok", state.authMessageKind === "ok");
  }
  if (dom.registerAccountCard) dom.registerAccountCard.hidden = !user;
  if (dom.registerAccountName) dom.registerAccountName.textContent = user ? (user.username || user.nickname || "已登录") : "未登录";
  if (dom.registerAccountMeta) {
    dom.registerAccountMeta.textContent = user
      ? `${user.accountLabel || "邮箱账号"} · 已登录`
      : "";
  }
  if (dom.registerStartCreateBtn) dom.registerStartCreateBtn.hidden = !user;
  if (dom.registerLogoutBtn) dom.registerLogoutBtn.hidden = !user;
}

function handleAuthModeLoginAction() {
  if (state.authView === "register" && currentRegisterStep() === "verify") {
    state.authRegisterStep = "credentials";
    clearAuthMessage();
    renderRegisterPanel();
    dom.registerEmailInput?.focus();
    return;
  }
  switchAuthView("login");
}

function switchAuthView(view) {
  state.authView = view === "login" ? "login" : "register";
  state.authRegisterStep = "credentials";
  clearAuthMessage();
  renderRegisterPanel();
  dom.registerEmailInput?.focus();
}

async function sendAuthCode({ advance = false } = {}) {
  const account = String(dom.registerEmailInput?.value || "").trim();
  state.authCodeSending = true;
  clearAuthMessage();
  renderRegisterPanel();
  let shouldFocusCode = false;
  try {
    const data = await postJson("/api/auth/verification-code", { type: "email", account });
    if (data.code && dom.registerCodeInput) dom.registerCodeInput.value = data.code;
    setAuthMessage(data.message || `验证码已发送到 ${data.accountLabel || "邮箱"}，5 分钟内有效`, "ok");
    startAuthCodeCooldown();
    if (advance && state.authView === "register") {
      state.authRegisterStep = "verify";
      shouldFocusCode = true;
    }
  } catch (error) {
    setAuthMessage(errorMessage(error), "error");
  } finally {
    state.authCodeSending = false;
    renderRegisterPanel();
    if (shouldFocusCode) dom.registerCodeInput?.focus();
  }
}

async function submitAuth() {
  const isRegister = state.authView === "register";
  if (isRegister && currentRegisterStep() === "credentials") {
    await sendAuthCode({ advance: true });
    return;
  }
  state.authSubmitting = true;
  clearAuthMessage();
  renderRegisterPanel();
  try {
    const data = await postJson(isRegister ? "/api/auth/register" : "/api/auth/login", {
      type: "email",
      account: String(dom.registerEmailInput?.value || "").trim(),
      username: String(dom.registerUsernameInput?.value || "").trim(),
      code: String(dom.registerCodeInput?.value || "").trim(),
      password: String(dom.registerPasswordInput?.value || ""),
      clientKey: localClientKey
    });
    state.auth = normalizeAuth({ user: { ...data.user, clientKey: data.clientKey } });
    tryWriteStore(keys.auth, state.auth);
    if (dom.registerUsernameInput) dom.registerUsernameInput.value = "";
    if (dom.registerEmailInput) dom.registerEmailInput.value = "";
    if (dom.registerCodeInput) dom.registerCodeInput.value = "";
    if (dom.registerPasswordInput) dom.registerPasswordInput.value = "";
    state.authRegisterStep = "credentials";
    await Promise.allSettled([loadPersistentHistory(false), refreshCreditCenter(false)]);
    goToCreateWorkspace("已进入图片创作");
  } catch (error) {
    setAuthMessage(errorMessage(error), "error");
  } finally {
    state.authSubmitting = false;
    renderRegisterPanel();
  }
}

function logoutAuth() {
  state.auth = { user: null };
  tryWriteStore(keys.auth, state.auth);
  state.history = [];
  state.deletedHistory = [];
  persistHistory();
  persistDeletedHistory();
  state.authRegisterStep = "credentials";
  renderHistory();
  clearAuthMessage();
  renderRegisterPanel();
  void Promise.allSettled([loadPersistentHistory(false), refreshCreditCenter(false)]);
  status("已退出账号");
}

function currentAuthDraft() {
  return {
    username: String(dom.registerUsernameInput?.value || "").trim(),
    account: String(dom.registerEmailInput?.value || "").trim(),
    code: String(dom.registerCodeInput?.value || "").trim(),
    password: String(dom.registerPasswordInput?.value || "")
  };
}

function authReadyToSubmit(isRegister, draft) {
  if (isRegister) {
    if (currentRegisterStep() === "verify") return Boolean(draft.account && draft.code && draft.password.length >= 6);
    return Boolean(draft.account && draft.password.length >= 6);
  }
  return Boolean(draft.account && draft.password.length >= 6);
}

function maskEmailAccount(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return "";
  const [name = "", domain = ""] = email.split("@");
  const visible = name.length <= 2 ? name : `${name.slice(0, 2)}***`;
  return `${visible}@${domain}`;
}

function setAuthMessage(message, kind) {
  state.authMessage = message;
  state.authMessageKind = kind;
}

function clearAuthMessage() {
  state.authMessage = "";
  state.authMessageKind = "";
}

function startAuthCodeCooldown() {
  if (authCodeTimerId) window.clearInterval(authCodeTimerId);
  state.authCodeCooldown = 60;
  authCodeTimerId = window.setInterval(() => {
    state.authCodeCooldown = Math.max(0, state.authCodeCooldown - 1);
    if (state.authCodeCooldown === 0 && authCodeTimerId) {
      window.clearInterval(authCodeTimerId);
      authCodeTimerId = 0;
    }
    renderRegisterPanel();
  }, 1000);
}

function syncControls() {
  setPromptValue(state.prompt);
  dom.qualitySelect.value = state.params.quality;
  dom.formatSelect.value = state.params.outputFormat;
  dom.countInput.value = String(state.params.count);
  dom.sizeInput.value = state.params.size;
  queueCreditEstimate();
}

function setPromptValue(value) {
  state.prompt = String(value || "");
  if (dom.promptInput) dom.promptInput.value = state.prompt;
  renderCreateGenerateOverview();
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
    if (file.size > referenceImageLimits.maxBytes) throw new Error("图片过大，压缩到 18MB 以内");
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
  const options = selectedPromptOptions();
  const optionTitles = promptOptionTitles(options);
  if (dom.editModeState) {
    dom.editModeState.textContent = activeCount
      ? optionTitles.length
        ? `已载入 ${activeCount} 张照片 · ${optionTitles.join(" / ")} 已补进可选效果`
        : `已载入 ${activeCount} 张照片 · 画面质感更稳，可选功能随时加`
      : optionTitles.length
        ? `已选 ${optionTitles.length} 个可选功能 · 原图就位更稳`
        : "纯文字也能开拍；换背景、换装、增强、修复，加原图更像样。";
  }
  renderCreditEstimate();
  renderCreateGenerateOverview();
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
    state.creditAnchor = "packages";
    switchTab("credits");
    return;
  }
  const references = activeReferences();
  const selectedOptions = selectedPromptOptions();
  if (selectedOptions.length && promptOptionsNeedReference(selectedOptions) && !references.length) {
    status(`${promptOptionTitles(selectedOptions).join(" / ")} 已选，原图就位后开拍`);
    dom.editImageInput?.focus();
    return;
  }
  const basePrompt = state.prompt.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!basePrompt) {
    status("画面描述待填写");
    dom.promptInput.focus();
    return;
  }
  const prompt = buildEffectivePrompt();
  const task = { id: `task-${Date.now().toString(36)}`, prompt, params: { ...state.params }, references: [...references], settingsSummary: settingsSummary(state.settings), status: "running", createdAt: Date.now(), images: [], error: "" };
  state.history.unshift(task);
  persistHistory();
  renderHistory();
  startGenerationTimer(task);
  const estimateText = state.creditEstimate?.estimatedCost ? `，预计 ${formatCredits(state.creditEstimate.estimatedCost)}` : "";
  status(`${references.length ? "编辑" : "生成"}请求已提交：${task.settingsSummary}${estimateText}，耗时 00:00`);
  try {
    const response = await apiFetch("/api/generate", {
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
  if (dom.historyTitle) dom.historyTitle.textContent = deletedMode ? "已删除作品" : "我的作品";
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

async function loadPersistentHistory(syncLocal = true) {
  try {
    if (syncLocal && state.history.length) {
      await apiFetch("/api/history/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: state.history })
      });
    }
    const response = await apiFetch("/api/history", { headers: { Accept: "application/json" } });
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
  const response = await apiFetch("/api/history?deleted=1", { headers: { Accept: "application/json" } });
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
    setPromptValue(task.revisedPrompt || task.prompt);
    state.params = { ...task.params };
    state.references = [reference];
    state.createMode = "generate";
    setPromptOptions(["repair"]);
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
  setPromptValue(task.prompt);
  state.params = { ...task.params };
  state.references = task.references || [];
  state.createMode = "generate";
  setPromptOptions([]);
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
  void apiFetch(`/api/history/${encodeURIComponent(id)}`, { method: "DELETE" })
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
    void apiFetch("/api/history?deleted=1", { method: "DELETE" })
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
  void apiFetch("/api/history", { method: "DELETE" })
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
  void apiFetch(`/api/history/${encodeURIComponent(id)}/restore`, { method: "POST" })
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
  void apiFetch(`/api/history/${encodeURIComponent(id)}/permanent`, { method: "DELETE" })
    .then((response) => {
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    })
    .catch((error) => status(`本机已清除，服务端同步失败：${errorMessage(error)}`));
}

function toggleDeletedHistory() {
  state.historyMode = state.historyMode === "deleted" ? "active" : "deleted";
  renderTabs();
  renderHistory();
}

async function loadCredits(options = {}) {
  try {
    const response = await apiFetch("/api/credits", { headers: { Accept: "application/json" } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.message || `${response.status} ${response.statusText}`);
    state.credits = normalizeCredits(data);
    renderCredits();
    queueCreditEstimate();
    if (options.announce) status(`余额已刷新：${formatCredits(state.credits.balance)}`);
  } catch (error) {
    renderCreditError(errorMessage(error));
    if (options.announce) status(`余额没读出来：${errorMessage(error)}`);
  }
}

async function loadPaymentConfig() {
  try {
    const response = await apiFetch("/api/payments/config", { headers: { Accept: "application/json" } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.message || `${response.status} ${response.statusText}`);
    state.payment = normalizePaymentConfig(data.payment || data);
    renderCredits();
  } catch (error) {
    state.payment = { ...defaults.payment, message: `购买状态没读出来：${errorMessage(error)}` };
    renderCredits();
  }
}

async function loadCreditOrders() {
  try {
    const response = await apiFetch("/api/credits/orders", { headers: { Accept: "application/json" } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.message || `${response.status} ${response.statusText}`);
    state.creditOrders = Array.isArray(data?.orders) ? data.orders.map(normalizeCreditOrder).filter(Boolean) : [];
    renderCredits();
  } catch (error) {
    state.creditOrders = [];
    renderCreditOrders(`${creditCopy.ordersLoadError}：${errorMessage(error)}`);
  }
}

async function refreshCreditCenter(announce = false) {
  await Promise.allSettled([
    loadCredits({ announce }),
    loadPaymentConfig(),
    loadCreditOrders()
  ]);
}

function normalizeCredits(data) {
  return {
    balance: Math.max(0, Number(data?.balance) || 0),
    ledger: Array.isArray(data?.ledger) ? data.ledger.map(normalizeCreditEntry).filter(Boolean) : [],
    packages: Array.isArray(data?.packages) ? data.packages.map(normalizeCreditPackage).filter(Boolean) : [],
    updatedAt: String(data?.updatedAt || "")
  };
}

function normalizePaymentConfig(data) {
  return {
    provider: String(data?.provider || "stripe"),
    mode: String(data?.mode || "disabled"),
    enabled: Boolean(data?.enabled),
    ready: Boolean(data?.ready),
    currency: String(data?.currency || "cny"),
    message: String(data?.message || "现在还不能购买积分")
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
    badge: String(item.badge || ""),
    bestFor: String(item.bestFor || ""),
    standardShots: Math.max(0, Number(item.standardShots) || 0),
    editShots: Math.max(0, Number(item.editShots) || 0)
  };
}

function normalizeCreditOrder(item) {
  if (!item?.id) return null;
  return {
    id: String(item.id),
    packageId: String(item.packageId || ""),
    packageName: String(item.packageName || item.packageId || "充值记录"),
    credits: Math.max(0, Number(item.credits) || 0),
    bonus: Math.max(0, Number(item.bonus) || 0),
    amountCny: Math.max(0, Number(item.amountCny) || 0),
    provider: String(item.provider || ""),
    providerSessionId: String(item.providerSessionId || ""),
    providerPaymentId: String(item.providerPaymentId || ""),
    status: String(item.status || "draft"),
    ledgerId: String(item.ledgerId || ""),
    failureReason: String(item.failureReason || ""),
    createdAt: String(item.createdAt || ""),
    updatedAt: String(item.updatedAt || "")
  };
}

function normalizeCreditEntry(item) {
  if (!item?.id) return null;
  return {
    id: String(item.id),
    type: String(item.type || "recharge"),
    title: String(item.title || "积分明细"),
    credits: Number(item.credits) || 0,
    amountCny: Number(item.amountCny) || 0,
    status: String(item.status || "succeeded"),
    createdAt: String(item.createdAt || "")
  };
}

function renderCredits() {
  if (!dom.creditBalance) return;
  const balanceText = formatCredits(state.credits.balance);
  dom.creditBalance.textContent = balanceText;
  if (dom.topCreditBalance) dom.topCreditBalance.textContent = balanceText;
  if (dom.studioCurrentCredits) dom.studioCurrentCredits.textContent = `余额：${balanceText}`;
  dom.creditStatus.textContent = creditBalanceStatusText(state.credits.balance);
  dom.creditUpdatedAt.textContent = state.credits.updatedAt ? `余额已更新 ${formatCreditTime(state.credits.updatedAt)}` : "正在读取余额";
  renderPaymentConfig();
  renderCreditPackages();
  renderCreditOrders();
  renderCreditLedger();
  renderCreditEstimate();
  renderCreateGenerateOverview();
  renderCreditSections();
}

function renderPaymentConfig() {
  if (!dom.paymentStatusBadge || !dom.paymentStatusHint) return;
  dom.paymentStatusBadge.textContent = paymentStatusText(state.payment);
  dom.paymentStatusBadge.className = `payment-status-badge ${paymentStatusClass(state.payment)}`;
  dom.paymentStatusHint.textContent = paymentHintText(state.payment);
}

function queueCreditEstimate() {
  if (!dom.creditCostStatus) return;
  window.clearTimeout(creditEstimateTimerId);
  creditEstimateTimerId = window.setTimeout(() => void loadCreditEstimate(), 120);
}

async function loadCreditEstimate() {
  try {
    const response = await apiFetch("/api/credits/estimate", {
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
    dom.creditCostStatus.textContent = "没算出来";
    if (dom.creditCostHint) dom.creditCostHint.textContent = "刷新后再试";
    dom.creditCostBar.classList.add("warning");
  } else if (!estimate) {
    dom.creditCostStatus.textContent = "正在计算";
    if (dom.creditCostHint) dom.creditCostHint.textContent = "先算本次要用多少积分";
    dom.creditCostBar.classList.remove("warning");
  } else {
    dom.creditCostStatus.textContent = `${formatCredits(estimate.estimatedCost)}`;
    if (dom.creditCostHint) {
      dom.creditCostHint.textContent = estimate.shortage
        ? `当前积分 ${formatCredits(estimate.balance)} · 还差 ${formatCredits(estimate.shortage)}`
        : `当前积分 ${formatCredits(estimate.balance)} · 单张 ${formatCredits(estimate.unitCost)} · ${estimate.referenceCount ? "照着照片改" : "直接拍一张"}`;
    }
    dom.creditCostBar.classList.toggle("warning", !estimate.enough);
  }
  if (!generationRunning && dom.generateBtn) {
    const activeCount = activeReferences().length;
    const selectedOptions = selectedPromptOptions();
    const needsReference = selectedOptions.length && promptOptionsNeedReference(selectedOptions) && !activeCount;
    dom.generateBtn.disabled = isCreditBlocked();
    dom.generateBtn.textContent = isCreditBlocked()
      ? "积分不足"
      : needsReference
        ? "上传原图"
        : activeCount
          ? "开始编辑"
          : "开拍";
  }
  renderCreateGenerateOverview();
}

function isCreditBlocked() {
  if (!state.creditEstimate) return true;
  return !state.creditEstimate.enough;
}

function renderCreditPackages() {
  if (!state.credits.packages.length) {
    dom.creditPackages.innerHTML = empty("暂时没有可买套餐");
    return;
  }
  dom.creditPackages.innerHTML = state.credits.packages.map(creditPackageCard).join("");
  dom.creditPackages.querySelectorAll("[data-recharge-package]").forEach((button) => {
    button.addEventListener("click", () => void rechargeCredits(button.dataset.rechargePackage));
    button.disabled = !state.payment.ready;
  });
}

function creditPackageCard(item) {
  const total = item.credits + item.bonus;
  const toneClass = item.id === "studio" ? "recommended" : item.id === "starter" ? "popular" : "";
  const actionText = state.payment.ready ? "去付款" : "暂不可买";
  return `
    <article class="credit-package-card ${toneClass}">
      <div class="credit-package-head">
        <div><span>${esc(item.name)}</span><strong>${esc(formatCredits(total))}</strong></div>
        ${item.badge ? `<em>${esc(item.badge)}</em>` : ""}
      </div>
      <p>含 ${esc(formatCredits(item.credits))}${item.bonus ? ` · 多送 ${esc(formatCredits(item.bonus))}` : ""}</p>
      <span class="credit-package-usage">${esc(item.bestFor || "付款后到账")} · 约 ${esc(item.standardShots || 0)} 张直接拍一张${item.editShots ? ` / ${esc(item.editShots)} 张照着照片改` : ""}</span>
      <div class="credit-package-action">
        <strong>¥${esc(formatMoney(item.amountCny))}</strong>
        <button class="primary-btn small" data-recharge-package="${attr(item.id)}" type="button">${actionText}</button>
      </div>
    </article>`;
}

function renderCreditOrders(error = "") {
  if (!dom.creditOrderList || !dom.creditOrderCount) return;
  const orders = state.creditOrders.slice(0, 20);
  const pendingCount = state.creditOrders.filter((item) => ["pending", "failed"].includes(item.status)).length;
  dom.creditOrderCount.textContent = `${state.creditOrders.length} 条`;
  if (dom.creditOrderSummaryHint) {
    dom.creditOrderSummaryHint.textContent = pendingCount
      ? `${pendingCount} 笔待处理`
      : state.creditOrders.length
        ? creditCopy.recentOrders
        : creditCopy.emptyOrders;
  }
  if (error) {
    dom.creditOrderList.innerHTML = empty(error);
    return;
  }
  if (!orders.length) {
    dom.creditOrderList.innerHTML = empty(creditCopy.emptyOrders);
    return;
  }
  dom.creditOrderList.innerHTML = orders.map((item) => {
    const total = item.credits + item.bonus;
    const note = item.status === "failed" && item.failureReason
      ? item.failureReason
      : item.status === "pending"
        ? "还没完成付款"
        : item.status === "paid"
          ? `到账 ${formatCredits(total)}`
          : "处理中，稍后刷新";
    return `
      <article class="credit-order-item">
        <div class="credit-order-main">
          <strong>${esc(item.packageName)}</strong>
          <span>¥${esc(formatMoney(item.amountCny))} · ${esc(formatCredits(total))} · ${esc(formatCreditTime(item.createdAt || item.updatedAt))}</span>
        </div>
        <em class="credit-order-status ${attr(item.status)}">${esc(orderStatusText(item.status))}</em>
        <p class="credit-order-note">${esc(note)}</p>
      </article>`;
  }).join("");
}

function renderCreditLedger() {
  const ledger = state.credits.ledger.slice(0, 20);
  dom.creditLedgerCount.textContent = `${state.credits.ledger.length} 条`;
  if (dom.creditLedgerSummaryHint) {
    dom.creditLedgerSummaryHint.textContent = state.credits.ledger.length ? creditCopy.recentLedger : creditCopy.emptyLedger;
  }
  if (!ledger.length) {
    dom.creditLedger.innerHTML = empty(creditCopy.emptyLedger);
    return;
  }
  dom.creditLedger.innerHTML = ledger.map((item) => {
    const amountText = item.amountCny > 0 ? ` · ¥${formatMoney(item.amountCny)}` : "";
    return `
      <article class="credit-ledger-item">
        <div>
          <strong>${esc(item.title)}</strong>
          <span>${esc(formatCreditTime(item.createdAt))}${esc(amountText)}</span>
        </div>
        <em class="${item.credits >= 0 ? "positive" : "negative"}">${item.credits >= 0 ? "+" : ""}${esc(formatCredits(item.credits))}</em>
      </article>`;
  }).join("");
}

function renderCreditError(message) {
  if (dom.creditStatus) dom.creditStatus.textContent = message;
  if (dom.topCreditBalance) dom.topCreditBalance.textContent = "没读出来";
  if (dom.creditCostHint) dom.creditCostHint.textContent = "刷新后再试";
  if (dom.creditPackages) dom.creditPackages.innerHTML = empty("套餐暂时没加载出来");
  if (dom.creditOrderList) dom.creditOrderList.innerHTML = empty(creditCopy.ordersUnavailable);
  if (dom.creditLedger) dom.creditLedger.innerHTML = empty(creditCopy.ledgerUnavailable);
  if (dom.creditOrderSummaryHint) dom.creditOrderSummaryHint.textContent = creditCopy.ordersLoadError;
  if (dom.creditLedgerSummaryHint) dom.creditLedgerSummaryHint.textContent = creditCopy.ledgerLoadError;
}

async function rechargeCredits(packageId) {
  const selected = state.credits.packages.find((item) => item.id === packageId);
  if (!selected) return;
  if (!state.payment.ready) {
    status(state.payment.message || "现在还不能购买积分");
    return;
  }
  status(`正在去付款：${selected.name}`);
  try {
    setRechargeButtonsDisabled(true);
    const response = await apiFetch("/api/payments/checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.message || `${response.status} ${response.statusText}`);
    if (data.order) {
      const nextOrder = normalizeCreditOrder(data.order);
      state.creditOrders = [nextOrder, ...state.creditOrders.filter((item) => item.id !== nextOrder.id)];
      renderCreditOrders();
    }
    if (data.payment) {
      state.payment = normalizePaymentConfig(data.payment);
      renderPaymentConfig();
    }
    status(`已进入付款：${selected.name}`);
    if (data.checkoutUrl) {
      window.location.assign(String(data.checkoutUrl));
      return;
    }
    throw new Error("付款页没打开");
  } catch (error) {
    status(`付款页没打开：${errorMessage(error)}`);
  } finally {
    setRechargeButtonsDisabled(false);
  }
}

function setRechargeButtonsDisabled(disabled) {
  dom.creditPackages?.querySelectorAll("[data-recharge-package]").forEach((button) => {
    button.disabled = disabled || !state.payment.ready;
  });
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

function apiFetch(input, init = {}) {
  const headers = new Headers(init.headers || {});
  const clientKey = currentClientKey();
  if (clientKey) headers.set("X-Client-Key", clientKey);
  return fetch(input, { ...init, headers });
}

async function postJson(url, body) {
  const response = await apiFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.message || `${response.status} ${response.statusText}`);
  return data;
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

function normalizeAuth(value) {
  const user = value?.user && typeof value.user === "object" ? value.user : null;
  if (!user) return { user: null };
  return {
    user: {
      id: String(user.id || ""),
      username: String(user.username || user.nickname || ""),
      nickname: String(user.nickname || user.username || ""),
      type: String(user.type || "email"),
      accountLabel: String(user.accountLabel || ""),
      createdAt: String(user.createdAt || ""),
      lastLoginAt: String(user.lastLoginAt || ""),
      clientKey: normalizeClientKey(user.clientKey || `account-${user.id}`)
    }
  };
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
  return apiKey ? `专属通道已接入 · Key #${keyFingerprint(apiKey)}` : "默认通道已接入";
}

function ensureLocalClientKey() {
  const stored = readStore(keys.clientKey, { value: "", createdAt: "" });
  const existing = normalizeClientKey(stored.value);
  if (existing) return existing;
  const next = createClientKey();
  tryWriteStore(keys.clientKey, { value: next, createdAt: new Date().toISOString() });
  return next;
}

function normalizeClientKey(value) {
  const clean = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return clean || "";
}

function createClientKey() {
  const seed = typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return normalizeClientKey(`client-${seed}`) || `client-${Date.now().toString(36)}`;
}

function currentClientKey() {
  const accountClientKey = normalizeClientKey(state.auth.user?.clientKey || "");
  return accountClientKey || localClientKey;
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

function consumeRuntimeQueryState() {
  const params = new URLSearchParams(window.location.search);
  const requestedTab = normalizeQueryTab(params.get("tab"));
  if (requestedTab) state.tab = requestedTab;
  const paymentKind = normalizePaymentReturnKind(params.get("payment"));
  const tradeNo = String(params.get("trade_no") || "");
  const outTradeNo = String(params.get("out_trade_no") || "");
  const resolvedPaymentKind = paymentKind || (outTradeNo || tradeNo ? "success" : "");
  if (resolvedPaymentKind) {
    state.pendingPaymentReturn = {
      kind: resolvedPaymentKind,
      orderId: String(params.get("order") || outTradeNo || ""),
      sessionId: String(params.get("session_id") || ""),
      tradeNo
    };
    state.tab = "credits";
  }
  if (!requestedTab && !resolvedPaymentKind) return;
  params.delete("tab");
  params.delete("payment");
  params.delete("order");
  params.delete("session_id");
  params.delete("trade_no");
  params.delete("out_trade_no");
  window.history.replaceState(null, "", `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`);
}

async function handlePendingPaymentReturn() {
  const pending = state.pendingPaymentReturn;
  if (!pending) return;
  state.pendingPaymentReturn = null;
  state.creditAnchor = "packages";
  renderTabs();
  if (pending.kind === "success") status("付款已完成，正在确认到账");
  if (pending.kind === "cancel") status("已取消，可重新选择套餐");
  if (pending.kind === "success" && (pending.sessionId || pending.tradeNo || pending.orderId)) {
    try {
      await postJson("/api/payments/confirm-session", {
        orderId: pending.orderId,
        sessionId: pending.sessionId,
        tradeNo: pending.tradeNo
      });
    } catch (error) {
      status(`付款已返回，但 ${paymentProviderLabel(state.payment)}校验失败：${errorMessage(error)}`);
    }
  }
  await refreshCreditCenter(false);
  if (pending.kind !== "success") return;
  const matched = state.creditOrders.find((item) =>
    item.id === pending.orderId
    || item.providerSessionId === pending.sessionId
    || item.providerPaymentId === pending.tradeNo
  );
  if (matched?.status === "paid") {
    status(`积分已到账：${matched.packageName}，当前 ${formatCredits(state.credits.balance)}`);
    return;
  }
  if (matched?.status === "pending") {
    status(`付款已返回，正在等待 ${paymentProviderLabel(state.payment)}确认到账`);
    return;
  }
  status(creditCopy.paymentReturnHint);
}

function normalizeQueryTab(value) {
  return ["studio", "templates", "generate", "register", "history", "credits"].includes(value) ? value : "";
}

function normalizePaymentReturnKind(value) {
  return ["success", "cancel"].includes(String(value || "")) ? String(value) : "";
}

function normalizeApiBaseUrl(value) {
  const trimmed = String(value || defaults.settings.apiUrl || "https://img.inklens.art/v1").trim();
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

function creditBalanceStatusText(balance) {
  const value = Math.max(0, Number(balance) || 0);
  if (value >= 20) return `还能拍约 ${Math.floor(value / 20)} 张`;
  if (value > 0) return "还差一张，先买积分";
  return "还没有余额";
}

function formatMoney(value) {
  const number = Number(value) || 0;
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function paymentStatusText(payment) {
  if (payment?.ready) return "可付款";
  return "暂不可买";
}

function paymentStatusClass(payment) {
  if (payment?.mode === "fake") return "fake";
  if (payment?.ready) return "ready";
  return "disabled";
}

function paymentHintText(payment) {
  if (payment?.ready) return "付款完成后到账";
  return "现在还不能购买积分";
}

function paymentProviderLabel(payment) {
  return payment?.provider === "alipay" ? "支付宝" : "Stripe";
}

function orderStatusText(status) {
  return {
    draft: "待付款",
    pending: "待付款",
    paid: "已到账",
    failed: "失败",
    cancelled: "已取消",
    refunded: "已退款"
  }[String(status || "")] || "处理中";
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

function safeClientId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 96) || `id-${Date.now().toString(36)}`;
}
