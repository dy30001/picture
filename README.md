# 墨境图像工作台

专门为 **GPT Image 2 / `gpt-image-2`** 做的本地图片生成工具。现在对外已经收口成一套统一主应用，前台以“个人AI摄影棚 + 图片创作工作台”的方式提供拍摄定制、模板选用、智能生图、作品管理、注册开通和我的积分。

English keywords: GPT Image 2, `gpt-image-2`, OpenAI-compatible image generation, prompt templates, API relay, image generation workbench.

![墨境图像工作台预览](public/assets/mojing-share-card.png)

## 适合谁

- 想用 `gpt-image-2` 快速生成图片的人。
- 有自己的 OpenAI Key，或者正在使用中转站、转发站、聚合 API 的用户。
- 需要大量提示词模板、分类筛选和一键套用的人。
- 想把生成记录、图片预览、下载和删除恢复都放在本机管理的人。

## 核心功能

- **GPT Image 2 优先**：默认图像模型是 `gpt-image-2`。
- **兼容中转站 API**：默认 Base URL 是 `https://alexai.work/v1`；只要接口兼容 OpenAI `/v1`，也可以换成自己的 Base URL 和 API Key。
- **两种调用模式**：支持 `/v1/images/generations`、`/v1/images/edits`，也支持 `/v1/responses` + `image_generation` 工具模式。
- **2300+ 个提示词模板**：内置模板库，支持搜索、分类、精选筛选，分类会显示数量。
- **轻量模板加载**：列表只加载摘要，点“使用模板”时再取完整 prompt。
- **参考图编辑**：上传参考图后自动走图片编辑流程。
- **本机历史记录**：生成历史保存在本机 JSON 文件和图片目录里，不依赖数据库。
- **图片体验完整**：图片可点击放大，一键保存到下载，历史可软删除、恢复、清空已删除。
- **中国风界面资产**：水墨底图和分享图可由脚本重生；正式 icon 只认 Air 原件，不重画。
- **独立运行**：一个 Node.js 服务即可启动，适合本地使用和打包分发。

## 快速开始

需要 Node.js 20+。

```bash
npm install
npm run open
```

macOS 可以直接双击：

```text
启动图片生成工作台.command
```

打开页面后默认就是可用的客户前端，不再展示“连接设置 / 测试连接”。当前客户前台统一按下面这套路由使用：

- 一级菜单：`拍摄定制` / `图片创作` / `我的作品` / `注册开通` / `我的积分`
- 当前设计采用 5 个业务板块，不是界面排版规则；前端可以按响应式设计横排或换行。后续如果业务设计要调整板块数量、命名或顺序，先改文档确认，再改代码。
- `拍摄定制`：`样片集` / `生图` / `身份确认` / `选模板` / `生成`
- `样片集`：先选大场景，再看样片组矩阵，当前组内照片同屏预览；样片来源优先按 `final_4k/` 子目录自动成组。
- `图片创作`：`模板库` / `智能生图`
- `我的作品`：`全部作品` / `已删除`
- `注册开通`：`注册` / `登录`
- `我的积分`：`我的积分` / `充值中心` / `充值订单` / `积分流水`

API Key、接口模式和模型默认按系统已接好的通道处理，不作为客户前台的显式操作。没有账号的用户，可以通过主应用里的 `注册开通` 完成站内注册，历史上使用过的推广地址仍然是：

```text
https://alexai.work/register?aff=6019d650
```

## 运行默认配置

当前客户前端默认走已经接好的图像通道，不要求客户先做连接设置。下面这些接口和模型说明主要给内部调试、部署和兼容 OpenAI 中转站时使用。

这个工具对中转站非常友好。中转站只需要满足其中一种 OpenAI 兼容接口：

- `GET /v1/models`
- `POST /v1/images/generations`
- `POST /v1/images/edits`
- 可选：`POST /v1/responses`

常见配置方式：

```text
API URL: https://alexai.work/v1
API Key: your-relay-key
接口模式: images
图像模型: gpt-image-2
```

如果你的中转站把图片能力放在 Responses API：

```text
接口模式: responses
主模型: gpt-5.5 或你的中转站模型名
图像工具: image_generation
图像模型: gpt-image-2
```

当前正式前端不再展示“测试连接”。如果需要做内部调试，请直接用接口探活、服务健康检查或开发环境参数确认通道可用性。

## 常用命令

```bash
npm run open          # 启动并打开工作台
npm start             # 启动本机服务
npm run preview       # 本机预览
npm run build         # 生成 dist 独立包
npm run assets:brand  # 重新生成水墨底图和分享图，不重画正式 icon
npm run lint:strict   # 静态检查
npm test              # 单元和服务测试
npm run typecheck     # TypeScript 类型检查
npm run verify:visual # Playwright 视觉和关键流程检查
```

## 项目结构

```text
docs/                   文档中心、规范和统一索引
app/                    后续统一代码根目录壳，当前只记录迁移边界
app/client/             前端目标目录说明，当前正式前端仍在 public/
app/server/             服务端目标目录说明，当前正式服务端仍在 server/
public/                 前端页面、样式、模板数据和视觉资产
public/assets/          水墨底图、应用图标、分享预览图
server/                 Express 服务、模板缓存和 API 路由
scripts/                构建、启动、模板导入、视觉检查和资产生成脚本
src/                    可测试的核心逻辑
tests/                  单元测试和服务集成测试
data/                   本机历史、账户、订单等本地账本数据
generated/              生成过程中的源图和中间 4K 结果
review/                 联系表、复核截图和修图队列
final_4k/               唯一正式成片目录
成片/                   历史重复目录，仅保留兼容数据，待后续清理
planning/               工作文档总目录
planning/01-架构与规范/  品牌、架构、模块和统一入口规范
planning/02-产品与交付/  产品设计、客户流程、样片和验收规范
planning/03-流程与提示词/ 身份锁定、工作流、提示词和风格矩阵
planning/04-研究与交接/  研究、说明和线程交接
planning/05-执行计划/    单次任务计划
planning/06-执行报告/    单次任务报告
planning/07-结构化清单/  CSV 清单和队列表
启动图片生成工作台.command macOS 双击启动入口
```

当前主应用已经统一到一套入口：

- 主工作台代码统一在 `public/ + server/`
- `img.inklens.art` 当前主服务口径统一到 `127.0.0.1:9999`
- 香港 VPS Nginx 的 `/api/` 也统一反向代理到 `127.0.0.1:9999`
- 注册开通、我的积分、充值订单和生成记录都归到同一套主应用
- 正式成片目录统一为 `final_4k/`
- `成片/` 只保留历史重复数据，不再作为正式交付目录

注意：`9999` 是内部部署端口，不写进客户页面；客户页面只展示域名、品牌、流程、隐私和交付说明。

## 当前前端功能目录

这套前端当前已经不是“单独的生图页”，而是一套统一主应用：

- `拍摄定制`
  - 客户主线，负责场景选择、参考照、身份确认和成片交付。
- `图片创作`
  - 直接创作入口，保留 `模板库` 和 `智能生图`，并试用 `换背景`、`换装`、`高清增强`、`局部修复` 四个客户能理解的编辑入口；这些入口都复用同一套已接好的智能生图能力，不暴露连接设置和测试链接。
- `我的`
  - 管理通用生成结果、注册登录、我的积分、充值订单和删除恢复，不替代正式样片管理和正式交付台账。

## 样片与成片目录口径

当前正式口径统一如下：

- `拍摄定制 -> 样片确认`
  - 负责看方向、确认方向、决定是否进入下一批生成。
- `拍摄定制 -> 成片交付`
  - 负责看正式可交付结果，不混入淘汰样片和过程稿。
- `generated/`
  - 生成过程源图和中间结果。
- `review/`
  - 联系表、修复队列、复核证据。
- `data/`
  - 本机历史、账户、订单等运行账本，不作为正式样片或正式成片目录。
- `final_4k/`
  - 唯一正式成片目录。
- `成片/`
  - 历史重复目录，只保留兼容数据，不再新增正式交付，也不再和 `final_4k/` 重复并行维护。

## 模板库

模板来源：

- `public/README_zh.md`：基础中文模板
- `public/sorry-templates.json`：补充模板数据

服务端会合并、去重并缓存模板。默认 `/api/templates` 返回轻量列表，不返回完整 prompt；完整提示词通过 `/api/templates/:id` 按需读取，这样 2000+ 模板也能快速打开。

## 文档入口

- `docs/README.md`：统一文档入口，先看这里。
- `docs/01-文档体系规范.md`：文档分层、命名、归档和维护规则。
- `planning/01-架构与规范/07-品牌视觉设计规范.md`：墨境品牌设计规范，统一品牌命名、logo、色彩、字体和界面口径。
- `planning/01-架构与规范/08-前端设计规范.md`：墨境前端设计规范，统一信息架构、布局、组件、文案、交互和验收口径。
- `planning/02-产品与交付/07-客户语言口径规范.md`：客户界面词汇替换、禁用词和推荐写法。
- `planning/04-研究与交接/04-icon原件来源与替换口径.md`：正确 icon 原件来源、替换步骤和禁用做法。
- `planning/README.md`：`planning/` 分类索引和主线文档入口。
- `NEXT_TASKS.md`：当前交接状态、停点和下一步。

当前主线开发文档已经收敛到上面的入口里，不再在 `README.md` 里重复堆长列表。需要看摄影棚主线规格时，从 `planning/README.md` 进入即可。

## 视觉资产

发布版内置原创中国风资产：

- `public/assets/mojing-ink-hero.png`
- `public/assets/mojing-panel-wash.png`
- `public/assets/icon-192.png`
- `public/assets/icon-512.png`
- `public/assets/mojing-share-card.png`

重新生成：

```bash
npm run assets:brand
```

说明：

- `npm run assets:brand` 现在不再生成正式 icon。
- 正式 icon 原件口径见 `planning/04-研究与交接/04-icon原件来源与替换口径.md`。

## 隐私和安全

- 不要把真实 API Key 写入代码、README、issue 或截图。
- `.env`、生成历史和下载图片默认不会进入 Git。
- 浏览器设置保存在本机 `localStorage`。
- 生成历史索引保存在 `data/history.json`。
- 生成历史图片保存在 `data/generated-history/`。
- 客户页面不展示内部端口号，也不放备案号；正规感通过品牌、流程承诺、隐私说明、客服/协议入口表达。

## 发布到 GitHub

这个仓库只应提交工具本体：

- `public/`
- `server/`
- `scripts/`
- `src/`
- `tests/`
- `docs/`
- `planning/README.md`
- `planning/01-架构与规范/`
- `planning/02-产品与交付/`
- `planning/03-流程与提示词/`
- `planning/04-研究与交接/`
- `README.md`
- `.gitignore`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `index.html`
- `manifest.webmanifest`
- `启动图片生成工作台.command`

不要提交本机素材、历史记录、密钥、旧项目生成物：

- `node_modules/`
- `dist/`
- `data/`
- `review/`
- `generated/`
- `final_4k/`
- `成片/`（历史重复目录）
- `reference/`
- `planning/05-执行计划/`
- `planning/06-执行报告/`
- `planning/07-结构化清单/`
- `.env`

## License

MIT
