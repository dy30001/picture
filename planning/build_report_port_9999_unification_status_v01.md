# 9999 端口统一现状核查 build 报告 v01

Date: 2026-05-02
Mode: doc
Workspace: `/Users/dy3000/code/pic`

## 1. 变更摘要

- 把 `9999` 核查文档改成 3 层口径：
  - 源码默认值
  - 当前本机运行现状
  - 目标融合态
- 修正了旧版把 `identity-workflow` 固定写成 `9999`、把主工作台固定写成 `4174` 的过时说法。

## 2. 修改的文件和核心改动

- `planning/port_9999_unification_status_v01.md`
  - 重写端口现状核查。
  - 用当前源码和当前本机运行快照替换旧现场快照。
- `planning/customer_flow_deployment_spec_v01.md`
  - 修正拆分态启动命令和健康检查口径。
- `identity-workflow/README.md`
  - 修正生图工具 fallback 说明。

## 3. 核查命令和结果

- `sed -n '1,120p' package.json`
  - 通过；确认当前源码默认值是主工作台 `9999`、`identity-workflow` `4184`。
- `lsof -nP -iTCP:9999 -sTCP:LISTEN`
  - 通过；确认 `9999` 当前有监听。
- `ps -p 65272 -o pid=,command=`
  - 通过；确认当前 `9999` 是 `server/index.mjs`。
- `curl -sS http://127.0.0.1:9999/api/health`
  - 通过；返回 `service=gpt-image-node`。
- `lsof -nP -iTCP:4184 -sTCP:LISTEN`
  - 通过；当前无监听。
- `lsof -nP -iTCP:4174 -sTCP:LISTEN`
  - 通过；当前无监听。

## 4. UI 检查结果

本轮没有修改 UI 代码，因此未运行截图。

## 5. 剩余风险或后续事项

- `scripts/open-workbench.mjs` 仍会通过抢占 `9999` 启动主工作台，这个行为后续还要在代码流里处理。
- 当前只是端口口径校正，还不是代码融合完成。
