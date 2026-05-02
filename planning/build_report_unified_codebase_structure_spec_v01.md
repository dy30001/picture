# 墨境统一代码树规格 build 报告 v01

Date: 2026-05-02
Mode: doc
Workspace: `/Users/dy3000/code/pic`

## 1. 变更摘要

- 新增统一代码树规格文档。
- 把“多个顶层应用”明确改成“一个代码根目录 + 子文件夹”的目标口径。
- 写清当前目录到目标目录的迁移映射。

## 2. 修改的文件和核心改动

- `planning/unified_codebase_structure_spec_v01.md`
  - 新增统一代码树目标结构。
  - 记录 `public/`、`server/`、`identity-workflow/` 到目标模块目录的映射。
  - 明确完成标准和迁移顺序。

## 3. 核查命令和结果

- `sed -n '1,120p' package.json`
  - 通过；确认当前运行入口还是 `server/index.mjs` 和 `identity-workflow/server.mjs` 两套脚本。
- `find public server identity-workflow -maxdepth 2 -type f | head`
  - 通过；确认当前确实存在两套顶层产品代码。
- `sed -n '1,220p' planning/development_module_map_v01.md`
  - 通过；确认新的代码树规格与板块总图一致。

## 4. UI 检查结果

本轮没有修改 UI 代码，因此未运行截图。

## 5. 剩余风险或后续事项

- 当前只是目录和模块口径，还没有开始真实迁移。
- 下一步最适合开的 `code` 任务，是先搭统一根目录的占位结构，再逐块迁移。
