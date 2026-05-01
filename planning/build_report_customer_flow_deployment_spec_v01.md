# 客户选片与部署门禁 build 报告 v01

Date: 2026-05-02
Mode: doc
Workspace: `/Users/dy3000/code/pic`

## 1. 变更摘要

- 新增客户视角流程规格。
- 明确“先场景选择，再身份三视图，再模板样片，再批量成片，再交付”的主流程。
- 明确样片和最终成片必须分区展示。
- 新增服务器部署门禁，覆盖启动、健康检查、接口检查、页面检查、生成链路和回滚标准。

## 2. 修改的文件和核心改动

- `planning/customer_flow_deployment_spec_v01.md`
  - 记录客户选择流程、页面信息架构、部署检查和验收清单。
  - 保留“三视图确认是正式样片和批量成片前置门禁”的硬规则。
  - 将婚纱、情侣、闺蜜、儿童 10 岁、女生写真、夕阳红作为一线场景入口。
- `planning/build_report_customer_flow_deployment_spec_v01.md`
  - 记录本次 `22` 执行范围、验证结果和剩余风险。
- `.gitignore`
  - 将 `planning/` 忽略规则收窄为 `planning/*`。
  - 放行本次客户流程规格和 build 报告，避免把历史 planning 文件批量纳入版本管理。

## 3. 测试命令和结果

- `sed -n '72,100p' /Users/dy3000/.codex/memories/MEMORY.md`
  - 通过；确认本项目既有硬规则：先三视图，再出模板样片。
- `grep -R "api/health\\|app.get\\|app.post\\|/api/" -n server identity-workflow/server.mjs`
  - 通过；确认部署门禁中引用的健康、模板、历史、工作流、认证和生成任务接口存在。
- `grep -R "fetch(\\|/api/" -n public/app.js identity-workflow/public/app.js`
  - 通过；确认前端当前依赖的接口范围。
- `sed -n '1,220p' scripts/visual-check.mjs`
  - 通过；确认已有视觉检查覆盖桌面、移动、模板、生成、设置、上传、历史和横向溢出。
- `sed -n '1,220p' tests/identity-workflow.test.ts`
  - 通过；确认成片选片复核台已有独立服务、健康检查和工作流接口测试。
- `git check-ignore -v planning/customer_flow_deployment_spec_v01.md planning/build_report_customer_flow_deployment_spec_v01.md`
  - 返修前：两份文档被 `.gitignore:20:planning/` 忽略。
  - 返修后：输出 `.gitignore` 中的 `!planning/...` 放行规则；配合 `git status` 可见新增文件，表示两份文档可进入版本管理。
- `git status --short -- .gitignore planning/customer_flow_deployment_spec_v01.md planning/build_report_customer_flow_deployment_spec_v01.md`
  - 返修后：显示 `.gitignore` 修改，以及两份 planning 文档为新增。

## 4. UI 检查结果

本轮没有修改 UI 代码，因此未运行新的浏览器截图。

文档中已加入后续 code 模式必须执行的 UI 门禁：

- 首页只展示当前流程、当前步骤和下一步。
- 历史、完整模板库和高级设置默认折叠。
- 样片区和最终成片区分开。
- 移动端不得出现横向滚动、按钮挤压和主动作不可见。
- 未确认三视图前，不允许展示批量成片主动作。

## 5. 剩余风险或后续事项

- 当前只是文档规格和版本管理返修，还没有把客户流程落到实际页面。
- 工作区已有多处未提交代码改动，本轮未触碰。
- 后续进入 `code` 模式时，需要按规格拆成小步实现，并补跑 `npm run lint:strict && npm test && npm run typecheck`。
- 如果修改页面，必须再运行 `npm run verify:visual` 并保留桌面/移动截图证据。
