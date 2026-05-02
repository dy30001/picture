# 墨境开发文档总图 build 报告 v01

Date: 2026-05-02
Mode: doc
Workspace: `/Users/dy3000/code/pic`

## 1. 变更摘要

- 把开发文档总图从 8 个板块升级成 9 个板块。
- 明确加入“样片管理”板块。
- 明确加入“统一代码树”口径，不再只讲统一端口。
- 更新 README 和 `.gitignore`，把新增正式文档纳入索引。

## 2. 修改的文件和核心改动

- `planning/development_module_map_v01.md`
  - 重写总图口径。
  - 把现有模块改成 9 个板块。
  - 明确目标是“一个代码根目录 + 子文件夹”。
  - 明确样片管理是独立板块，不再挂在别的板块下面顺带写。
- `README.md`
  - 增加统一代码树规格和样片管理规格入口。
- `.gitignore`
  - 放行新增正式 planning 文档。

## 3. 核查命令和结果

- `sed -n '1,120p' package.json`
  - 通过；确认当前源码默认值是主工作台 `9999`、`identity-workflow` `4184`。
- `lsof -nP -iTCP:9999 -sTCP:LISTEN`
  - 通过；确认当前本机 `9999` 有监听。
- `curl -sS http://127.0.0.1:9999/api/health`
  - 通过；确认当前本机 `9999` 返回主工作台健康结果。
- `grep -Rni "样片|sample|sceneTemplate" public identity-workflow review`
  - 通过；确认样片能力确实散在多个位置。

## 4. UI 检查结果

本轮没有修改 UI 代码，因此未运行截图。

## 5. 剩余风险或后续事项

- 当前只是板块总图，还没有开始真实目录迁移。
- 后续最值得优先开的 `code` 任务，是统一代码根目录占位和样片管理元数据层。
