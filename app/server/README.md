# 服务端目标目录

当前正式服务端仍在 `server/`。

后续迁移目标：

- `routes/`：HTTP 路由入口。
- `modules/image-generation/`：生成、编辑、模板读取和上游接口。
- `modules/studio/`：拍摄定制、样片、成片和交付状态。
- `modules/auth-credits/`：注册、登录、积分、订单和支付。
- `modules/works/`：作品历史、删除恢复和图片访问。
- `shared/`：配置、存储、日志和通用工具。

P0 不移动代码，只建立后续迁移边界。
