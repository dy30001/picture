# 墨境当前代码逻辑图 build 报告 v01

Date: 2026-05-02
Mode: doc
Workspace: `/Users/dy3000/code/pic`

## 1. 变更摘要

- 新增当前代码逻辑图文档。
- 把当前主工作台、客户复核台、样片逻辑和交付逻辑画成 mermaid 图。
- 明确这张图画的是“当前真实代码”，不是未来目标图。

## 2. 修改的文件和核心改动

- `planning/current_code_logic_diagram_v01.md`
  - 新增总体逻辑图。
  - 新增主工作台逻辑图。
  - 新增客户复核台逻辑图。
  - 新增样片与交付当前逻辑图。
  - 新增服务端接口分组图。

## 3. 核查命令和结果

- `sed -n '1,120p' package.json`
  - 通过；确认当前默认启动脚本。
- `grep -n "app.get\\|app.post\\|app.use" server/index.mjs identity-workflow/server.mjs`
  - 通过；确认两套服务端接口边界。
- `grep -n "studioPanel\\|sampleCard\\|deliveryCard" public/index.html public/app.js`
  - 通过；确认主工作台里的摄影棚、样片和交付摘要流程。
- `grep -n "workflow\\|sceneTemplate\\|renderBatches\\|renderDelivery" identity-workflow/public/app.js`
  - 通过；确认复核台里的批次样片和交付逻辑。
- `lsof -nP -iTCP:9999 -sTCP:LISTEN`
  - 通过；确认本机当前监听。
- `curl -sS http://127.0.0.1:9999/api/health`
  - 通过；确认当前 9999 返回主工作台健康结果。

## 4. UI 检查结果

本轮没有修改 UI 代码，因此未运行截图。

## 5. 剩余风险或后续事项

- 当前只是“现状图”，不是目标融合图。
- 下一步最适合直接接的是“目标融合图 + 分阶段迁移计划”。
