# 墨境板块实施规格 build 报告 v01

Date: 2026-05-02
Mode: doc
Workspace: `/Users/dy3000/code/pic`

## 1. 变更摘要

- 重写板块实施规格文档。
- 在“统一网址 `9999`”之外，新增“统一代码根目录”硬规则。
- 明确把样片管理升成正式模块。

## 2. 修改的文件和核心改动

- `planning/module_implementation_spec_v01.md`
  - 把实施顺序改成 9 个板块。
  - 补充“统一代码树”和“样片管理”的实施方式。
  - 明确当前必须区分源码默认值、当前运行现状和目标融合态。
- `README.md`
  - 增加新规格索引入口。
- `.gitignore`
  - 放行新增 build report 和 spec。

## 3. 核查命令和结果

- `sed -n '1,120p' package.json`
  - 通过；确认当前默认启动脚本口径。
- `sed -n '399,430p' server/index.mjs`
  - 通过；确认主服务默认端口是 `9999`。
- `sed -n '377,405p' identity-workflow/server.mjs`
  - 通过；确认 `identity-workflow` 默认端口是 `4184`，fallback 是 `4174`。
- `sed -n '1,260p' planning/development_module_map_v01.md`
  - 通过；确认实施规格与新版总图一致。

## 4. UI 检查结果

本轮没有改 UI 代码，因此未运行截图。

## 5. 剩余风险或后续事项

- 当前只是实施规格，尚未落到代码迁移计划。
- 最优先下一步是按新总图分别补 `main_app`、`identity_workflow`、`pipeline`、`deployment` 的专项 spec。
