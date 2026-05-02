# 墨境样片管理规格 build 报告 v01

Date: 2026-05-02
Mode: doc
Workspace: `/Users/dy3000/code/pic`

## 1. 变更摘要

- 新增样片管理规格文档。
- 把主应用预览、复核台看片、repair queue 三套样片相关能力统一写成一个正式模块。
- 写清样片对象、状态、操作、界面和与交付的边界。

## 2. 修改的文件和核心改动

- `planning/sample_management_spec_v01.md`
  - 新增样片管理模块定位。
  - 记录样片字段、状态、动作、界面结构和完成标准。
  - 明确样片和交付的边界。

## 3. 核查命令和结果

- `grep -Rni "样片|sample|deliveryReadyCount|sceneTemplate" public identity-workflow server`
  - 通过；确认样片相关能力当前散在主应用、复核台和服务端。
- `sed -n '1,220p' public/index.html`
  - 通过；确认主应用已存在样片方向与交付摘要区。
- `sed -n '1,260p' identity-workflow/public/index.html`
  - 通过；确认复核台已存在模板样片和交付批次视图。
- `sed -n '1,120p' review/repair_queue_venice_v02.csv`
  - 通过；确认已有离线修复状态。

## 4. UI 检查结果

本轮没有修改 UI 代码，因此未运行截图。

## 5. 剩余风险或后续事项

- 当前只是规格，还没有把样片对象、状态和记录层真正做出来。
- 最值得优先开的 `code` 任务，是先做样片元数据层和状态流转。
