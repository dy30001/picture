# 墨境图像工作台

专门为 **GPT Image 2 / `gpt-image-2`** 做的本地图片生成工具。它把提示词模板、参考图上传、生成参数、历史记录、图片预览和一键保存放在一个紧凑界面里，适合直接连接 OpenAI 官方 API，也适合连接各种 **OpenAI 兼容中转站 API / Relay API**。

English keywords: GPT Image 2, `gpt-image-2`, OpenAI-compatible image generation, prompt templates, API relay, image generation workbench.

![墨境图像工作台预览](public/assets/mojing-share-card.png)

## 适合谁

- 想用 `gpt-image-2` 快速生成图片的人。
- 有自己的 OpenAI Key，或者正在使用中转站、转发站、聚合 API 的用户。
- 需要大量提示词模板、分类筛选和一键套用的人。
- 想把生成记录、图片预览、下载和删除恢复都放在本机管理的人。

## 核心功能

- **GPT Image 2 优先**：默认图像模型是 `gpt-image-2`。
- **兼容中转站 API**：只要接口兼容 OpenAI `/v1`，就可以在设置里填写 Base URL 和 API Key。
- **两种调用模式**：支持 `/v1/images/generations`、`/v1/images/edits`，也支持 `/v1/responses` + `image_generation` 工具模式。
- **2300+ 个提示词模板**：内置模板库，支持搜索、分类、精选筛选，分类会显示数量。
- **轻量模板加载**：列表只加载摘要，点“使用模板”时再取完整 prompt。
- **参考图编辑**：上传参考图后自动走图片编辑流程。
- **本机历史记录**：生成历史保存在本机 JSON 文件和图片目录里，不依赖数据库。
- **图片体验完整**：图片可点击放大，一键保存到下载，历史可软删除、恢复、清空已删除。
- **中国风界面资产**：内置水墨底图、印章图标和分享图，可重新生成。
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

打开页面后点右上角“设置”，填写：

- `API URL`：OpenAI 官方或中转站 Base URL，例如 `https://api.openai.com/v1` 或 `https://your-relay.example/v1`
- `API Key`：你的 Key
- `接口模式`：普通图片接口选 `images`，Responses 工具模式选 `responses`
- `图像模型`：默认 `gpt-image-2`

API Key 只保存在浏览器 `localStorage`，不会写入仓库。

## 中转站 API 配置

这个工具对中转站非常友好。中转站只需要满足其中一种 OpenAI 兼容接口：

- `GET /v1/models`
- `POST /v1/images/generations`
- `POST /v1/images/edits`
- 可选：`POST /v1/responses`

常见配置方式：

```text
API URL: https://your-relay.example/v1
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

页面里的“测试连接”会请求 `/models`，用来快速确认 Base URL、Key 和中转站是否可用。

## 常用命令

```bash
npm run open          # 启动并打开工作台
npm start             # 启动本机服务
npm run preview       # 本机预览
npm run build         # 生成 dist 独立包
npm run assets:brand  # 重新生成水墨底图、图标和分享图
npm run lint:strict   # 静态检查
npm test              # 单元和服务测试
npm run typecheck     # TypeScript 类型检查
npm run verify:visual # Playwright 视觉和关键流程检查
```

## 项目结构

```text
public/                 前端页面、样式、模板数据和视觉资产
public/assets/          水墨底图、应用图标、分享预览图
server/                 Express 服务、模板缓存和 API 路由
scripts/                构建、启动、模板导入、视觉检查和资产生成脚本
src/                    可测试的核心逻辑
tests/                  单元测试和服务集成测试
启动图片生成工作台.command  macOS 双击启动入口
```

## 模板库

模板来源：

- `public/README_zh.md`：基础中文模板
- `public/sorry-templates.json`：补充模板数据

服务端会合并、去重并缓存模板。默认 `/api/templates` 返回轻量列表，不返回完整 prompt；完整提示词通过 `/api/templates/:id` 按需读取，这样 2000+ 模板也能快速打开。

## 视觉资产

发布版内置原创中国风资产：

- `public/assets/mojing-ink-hero.png`
- `public/assets/mojing-panel-wash.png`
- `public/assets/mojing-icon-192.png`
- `public/assets/mojing-icon-512.png`
- `public/assets/mojing-share-card.png`

重新生成：

```bash
npm run assets:brand
```

## 隐私和安全

- 不要把真实 API Key 写入代码、README、issue 或截图。
- `.env`、生成历史和下载图片默认不会进入 Git。
- 浏览器设置保存在本机 `localStorage`。
- 生成历史索引保存在 `data/history.json`。
- 生成历史图片保存在 `data/generated-history/`。

## 发布到 GitHub

这个仓库只应提交工具本体：

- `public/`
- `server/`
- `scripts/`
- `src/`
- `tests/`
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
- `成片/`
- `reference/`
- `planning/`
- `.env`

## License

MIT
