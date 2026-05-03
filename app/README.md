# 墨境统一代码目录

日期：2026-05-02
状态：P0 目录壳

## 1. 当前定位

`app/` 是后续业务代码融合的目标根目录。

本轮 P0 只建立目录边界，不迁移当前运行代码。当前正式运行代码仍在：

- `public/`
- `server/`
- `src/`

## 2. 迁移原则

- 先建壳，再迁移。
- 先按模块拆清楚，再移动代码。
- 不新增第二套运行入口。
- 不改变客户访问方式。
- 不把 `generated/`、`review/`、`final_4k/`、`data/` 这类业务产物并入 `app/`。

## 3. 目标结构

```text
app/
  client/
    shell/
    modules/
    shared/
    assets/
  server/
    routes/
    modules/
    shared/
```

## 4. P0 完成标准

- 能说明未来代码归位方式。
- 不影响现有 `public/ + server/` 运行。
- 不引入空跑入口。
