# 墨境文档中心

这份索引是仓库文档的统一入口。以后找规范、看现状、接手任务，先从这里进，不再从根目录和 `planning/` 里盲找。

## 1. 阅读顺序

1. `../README.md`
   - 产品简介、启动方式、目录总览。
2. `01-文档体系规范.md`
   - 文档分层、命名、归档和维护规则。
3. `../planning/README.md`
   - `planning/` 的分类索引和主线文档入口。
4. `../NEXT_TASKS.md`
   - 当前交接状态、停点和下一步。

## 2. 文档分层

| 位置 | 作用 | 是否为源文档 |
| --- | --- | --- |
| `README.md` | 对外总说明、快速开始、项目总结构 | 是 |
| `docs/` | 文档体系规范、统一入口、长期索引 | 是 |
| `planning/` | 规格、计划、交接、流程规则、build report | 是 |
| `public/README_zh.md` | 提示词库内容说明和来源说明 | 是 |
| `dist/` | 构建产物和打包后的只读副本 | 否 |

## 3. 当前主线入口

- `../planning/jingmo_brand_design_spec_v01.md`
  - 境墨品牌命名、logo、色彩、字体、图像和界面口径。
- `../planning/development_module_map_v01.md`
  - 现在的开发板块总图。
- `../planning/module_implementation_spec_v01.md`
  - 板块实施规格。
- `../planning/current_code_logic_diagram_v01.md`
  - 当前代码逻辑图。
- `../planning/unified_codebase_structure_spec_v01.md`
  - 代码与目录统一目标结构。
- `../planning/face_lock_reference_workflow_v02.md`
  - 身份锁定基准流程。
- `../planning/identity_preservation_gate.md`
  - 身份一致性门禁。

## 4. 更新规则

- 新增长期规则、命名口径、入口索引：放 `docs/`。
- 新增工作流规格、计划、交接、build report：放 `planning/`。
- 新增客户可见的产品说明、启动说明：回写 `README.md`。
- 新增 `planning/` 主线文档后，要同步更新 `planning/README.md`。
- 新增长期入口或规范文档后，要同步更新本文件。

## 5. 当前硬规则

- 对外统一入口只认 `http://<host>:9999`。
- 默认主服务只认 `server/index.mjs`。
- `final_4k/` 是唯一正式成片目录。
- `成片/` 只保留历史重复数据，不再作为正式交付口径。
- 人像类流程保持 `先三视图，再出模板样片`。

## 6. 不要这样做

- 不要把新的过程文档继续堆到仓库根目录。
- 不要直接编辑 `dist/` 里的文档副本。
- 不要只写 `build_report_*` 而不把长期结论沉淀到规范或索引里。
