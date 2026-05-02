# 墨境板块实施规格 v01

Date: 2026-05-02
Mode: doc
Workspace: `/Users/dy3000/code/pic`

## 0. 实施硬规则

1. 对外唯一入口固定为 `http://<host>:9999`
2. 正式成片目录固定为 `final_4k/`
3. `成片/` 只保留历史兼容数据，不再当成正式输出目录
4. 样片区、成片区、交付区必须分开描述和实现
5. 所有新增开发都默认落在当前主应用，不再按旧双应用思路扩散

## 1. 当前实施判断

截至 2026-05-02：

- 当前默认启动服务已经统一到 `server/index.mjs --port 9999`
- 主应用前端和服务端是现行入口
- 历史拆分态主要残留在旧文档和重复目录，不再是当前启动方式

所以这份实施规格按“单入口主应用”来写，不再把旧拆分态当现行方案。

## 2. 板块实施顺序

建议按 7 步推进：

1. 统一入口与部署口径
2. 摄影棚主流程收口
3. 生图能力模块化
4. 样片管理独立化
5. 复核与交付收口
6. 场景生产与目录治理
7. 账号、积分、支付与质量门禁补齐

## 3. 各板块怎么做

### 3.1 统一入口与部署口径

目标：

- 所有正式入口只认 `9999`

当前依据：

- `package.json`
- `server/index.mjs`
- `scripts/open-workbench.mjs`
- `README.md`

实施动作：

1. 保持 `dev`、`start`、`preview` 指向同一服务
2. 部署文档、README、健康检查命令写同一端口
3. 不再新增第二套客户可见启动说明

验证：

- `curl -fsS http://127.0.0.1:9999/api/health`
- `lsof -nP -iTCP:9999 -sTCP:LISTEN`

### 3.2 摄影棚主流程

目标：

- 客户默认看到的是“场景 -> 身份 -> 样片 -> 成片摘要”

当前依据：

- `public/index.html`
- `public/app.js`
- `public/styles.css`

实施动作：

1. 首屏只保留当前流程和关键状态
2. 生图参数、历史、设置放到次级面板
3. 样片入口、成片入口、交付入口都挂在主应用里

验证：

- `npm run verify:visual`
- 桌面和移动都无大面积无效留白

### 3.3 生图与模板能力

目标：

- 生图能力稳定复用，不和主流程叙事混乱

当前依据：

- `server/index.mjs`
- `src/`
- `public/`

实施动作：

1. 模板、生成、历史、连接测试继续走统一 API
2. 模板列表继续走轻量摘要 + 详情按需加载
3. 服务端负责落地历史和失败保护

验证：

- `npm test`
- `npm run typecheck`
- `/api/templates`
- `/api/generate`
- `/api/history`

### 3.4 样片管理

目标：

- 样片成为独立的正式业务模块

当前依据：

- `public/app.js`
- `review/repair_queue_*.csv`
- `review/contact_sheets/`
- `generated/`

实施动作：

1. 定义统一样片对象和状态
2. 打通样片方向、样片决策、修复队列、转成交付
3. 不再把样片和正式交付混成一个列表

验证：

- 每张样片都能查到状态、决策、修复记录、交付去向

### 3.5 复核与交付

目标：

- 正式交付只认 `final_4k/`

当前依据：

- `public/app.js`
- `server/index.mjs`
- `final_4k/`

实施动作：

1. 交付摘要、成片预览、下载口径统一指向 `final_4k/`
2. 样片和过程稿默认不进交付页
3. `成片/` 仅作为历史兼容数据保留，不再新增同步

验证：

- `server/index.mjs` 的成片预览目录指向 `final_4k/`
- 交付摘要数量与 `final_4k/` 一致

### 3.6 场景生产与目录治理

目标：

- 固定 `三视图 -> 样片 -> 批量生成 -> review -> final_4k`

当前依据：

- `scripts/newapi_generate_*`
- `generated/`
- `review/`
- `planning/build_report_*`

实施动作：

1. 生成脚本只把 `final_4k/` 当正式输出
2. build report 只把 `final_4k/` 写成正式交付结果
3. 每个场景包保留计划、接触表、报告

验证：

- `python3 -m py_compile` 覆盖变更脚本
- build report 能追到 `generated/`、`review/`、`final_4k/`

### 3.7 账号、积分、支付与质量门禁

目标：

- 业务能力统一、校验闭环完整

当前依据：

- `server/credits/`
- `server/payments/`
- `tests/`
- `scripts/lint-strict.mjs`

实施动作：

1. 账号、积分、支付继续集中在主应用服务
2. 不产生第二套登录态
3. 代码相关变更必须跑最小验证

验证：

```bash
npm run lint:strict
npm test
npm run typecheck
python3 -m py_compile scripts/newapi_generate_identity_scene_batch.py scripts/newapi_generate_santorini_v02_batch.py
```

## 4. 目录规则

### 4.1 正式代码目录

- `public/`
- `server/`
- `src/`
- `scripts/`
- `tests/`

### 4.2 业务产物目录

- `generated/`：生成过程结果
- `review/`：接触表、修复队列、复核证据
- `final_4k/`：唯一正式成片
- `成片/`：历史重复目录，待清理
- `reference/`：参考图

### 4.3 文档目录

- `planning/`：规格、计划、build report

## 5. 完成标准

1. 正式启动命令只有一套 `9999`
2. 正式成片目录只有 `final_4k/`
3. 样片、成片、交付边界清楚
4. 文档不再把历史拆分态写成当前主流程
5. 核心验证跑通或明确记录失败原因
