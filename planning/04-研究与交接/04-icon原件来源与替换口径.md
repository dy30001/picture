# 墨境 icon 原件来源与替换口径

日期：2026-05-03
模式：`doc`
工作区：`/Users/dy3000/code/pic`

## 1. 结论

墨境当前唯一正确的正式 icon，不以截图、不以临时重画、不以脚本推演结果为准，只以 Air 桌面的原始 PNG 为准。

仓库正式文件只认：

- `public/assets/icon-192.png`
- `public/assets/icon-512.png`

## 2. 原件来源

Air 桌面当前保存了 4 个原件文件：

- `~/Desktop/mojing-icon-192-original.png`
- `~/Desktop/mojing-icon-512-original.png`
- `~/Desktop/墨境网页原icon-192.png`
- `~/Desktop/墨境网页原icon-512.png`

实际校验结果：

- 两个 `192` 文件内容一致
- 两个 `512` 文件内容一致

当前可复核的校验值：

- `icon-192` SHA1：`9814bdd0c4b1c1f4e99190383c476f8f1b6ef0f8`
- `icon-512` SHA1：`04527b78a2b5913d5c242dff45066f75012b156b`

## 3. 正式使用口径

- 页面入口、manifest、apple touch icon 统一引用：
  - `icon-192.png`
  - `icon-512.png`
- 旧文件：
  - `mojing-icon-192.png`
  - `mojing-icon-512.png`
  已退出正式口径，不再恢复。

## 4. 硬规则

- 不要根据截图手工重画 icon。
- 不要根据视觉近似结果生成“差不多”的替代图。
- 不要把 icon 继续交给 `scripts/generate-brand-assets.mjs` 自动生成。
- 不要只改 `public/assets/` 而忘记重新构建 `dist/`。
- 不要把分享图、Hero 图、水墨底纹的生成规则误套到正式 icon 上。

## 5. 替换流程

如果后面还要替换或恢复 icon，按下面顺序做：

1. 从 Air 桌面取原始 `192` / `512` PNG。
2. 直接覆盖：
   - `public/assets/icon-192.png`
   - `public/assets/icon-512.png`
3. 重新执行：
   - `npm run build`
4. 验证：
   - `public/assets/icon-192.png`
   - `public/assets/icon-512.png`
   - `dist/public/assets/icon-192.png`
   - `dist/public/assets/icon-512.png`
   的哈希应与 Air 原件一致。

## 6. 本次修正后的代码口径

- `index.html`
- `manifest.webmanifest`
- `public/index.html`
- `public/manifest.webmanifest`

以上入口都已统一改为引用 `icon-192.png` / `icon-512.png`。

同时，`scripts/generate-brand-assets.mjs` 已移除错误的 icon 重画逻辑，只保留水墨底图和分享图相关生成。

## 7. 历史文档说明

仓库里更早的执行计划、执行报告或历史说明，可能还会出现下面这类旧表述：

- `npm run assets:brand` 会生成图标
- `mojing-icon-192.png` / `mojing-icon-512.png` 是正式文件

这些都视为历史口径，不能继续执行。

从 2026-05-03 起，统一以本文件和品牌视觉规范中的新规则为准。
