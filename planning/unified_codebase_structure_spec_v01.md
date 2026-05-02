# 墨境统一代码树规格 v01

Date: 2026-05-02
Mode: doc
Workspace: `/Users/dy3000/code/pic`

## 0. 一句话结论

我们现在的运行入口已经统一成一套主应用，但目录还要继续收口成：

```text
app/
```

也就是：

- 仓库根目录保留脚本、测试、文档和业务产物
- 业务前后端逐步收成一个代码根目录，再按子模块拆分

## 1. 当前代码与目录现状

当前现行目录职责如下：

| 目录 | 当前职责 |
| --- | --- |
| `public/` | 主应用前端页面、状态渲染、视觉资产入口 |
| `server/` | 主应用服务、API、静态资源和业务路由 |
| `src/` | 可测试的核心逻辑 |
| `scripts/` | 启动、构建、视觉检查、批量生成脚本 |
| `tests/` | 测试 |
| `generated/` | 生成过程源图和中间结果 |
| `review/` | 联系表、修复队列、截图证据 |
| `final_4k/` | 唯一正式成片目录 |
| `成片/` | 历史重复目录，待后续清理 |
| `reference/` | 参考图 |
| `planning/` | 正式规格、计划和 build report |

## 2. 目标代码树

建议后续重构统一到：

```text
app/
  client/
    shell/
    modules/
      studio/
      image-generation/
      sample-management/
      review-delivery/
      auth-credits/
    shared/
      components/
      state/
      styles/
      utils/
    assets/
  server/
    routes/
    modules/
      image-generation/
      sample-management/
      review-delivery/
      auth-credits/
      pipeline/
    shared/
      config/
      storage/
      utils/
scripts/
tests/
planning/
generated/
review/
final_4k/
成片/
reference/
```

## 3. 当前目录到目标目录的映射

| 当前路径 | 目标位置 | 说明 |
| --- | --- | --- |
| `public/index.html` | `app/client/shell/` | 主应用入口壳 |
| `public/app.js` | `app/client/modules/studio/` + `app/client/modules/image-generation/` + `app/client/modules/review-delivery/` | 后续按模块拆 |
| `public/styles.css` | `app/client/shared/styles/` | 统一视觉层 |
| `public/assets/` | `app/client/assets/` | 视觉资产 |
| `server/index.mjs` | `app/server/routes/` + `app/server/modules/*` | 主服务入口和模块路由 |
| `server/credits/` | `app/server/modules/auth-credits/` | 积分和账户 |
| `server/payments/` | `app/server/modules/auth-credits/` | 支付能力 |
| `src/` | `app/server/shared/` 或 `app/client/shared/` | 按职责归位 |
| `scripts/newapi_generate_*` | `scripts/` + `app/server/modules/pipeline/` | 脚本继续保留在根目录，业务能力归 pipeline |

## 4. 目录规则

### 4.1 代码目录

- 长期目标是所有业务代码都并到 `app/`
- 在真正迁移前，继续允许 `public/` 和 `server/` 作为现行源码目录
- 不再恢复或新增第二套顶层产品代码目录

### 4.2 业务产物目录

- `generated/`：中间结果
- `review/`：复核证据与修复队列
- `final_4k/`：唯一正式成片
- `成片/`：历史重复目录
- `reference/`：参考素材

这些目录继续保留在仓库根目录，不并进 `app/`。

### 4.3 文档目录

- `planning/` 继续保留在仓库根目录
- 规格、计划、build report 分层记录

## 5. 迁移顺序

建议按 5 步推进：

1. 先把文档、启动命令、部署口径统一到现行主应用
2. 抽出 `studio`、`image-generation`、`sample-management`、`review-delivery` 模块边界
3. 建立 `app/` 目录壳和模块占位
4. 逐步把 `public/`、`server/` 的业务代码迁进去
5. 清理历史目录依赖和重复产物口径

## 6. 完成标准

只有同时满足下面 6 条，才算“目录融合完成”：

1. 客户只访问 `9999`
2. 正式代码统一收在 `app/`
3. 根目录只保留脚本、测试、文档和业务产物
4. 正式成片目录只有 `final_4k/`
5. `成片/` 不再被脚本和文档当成正式输出
6. README、规格文档、启动脚本、测试口径一致
