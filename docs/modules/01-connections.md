# 模块 01 · 连接 Connections

> 状态：ETL(数据源)真实，其余 Mock · 对标 Segment Connections

## 1. 概述

连接模块是 CDP 的「数据入口与出口」，对标 Segment 的 Connections（Sources / Destinations / Reverse ETL / Warehouses / Functions）。定位是「一次接入，导入任意对象（Track once, send everywhere）」：把外部数据源接进来，经字段映射与类型转换后落到统一对象表，并为下游激活、反向同步、落库、自定义转换提供框架。

当前**真实可跑的只有数据源侧的可视化 ETL**（CSV / 粘贴文本 → 字段映射 → 预览 → 导入到 `object_*` 表，并可选建立对象关系）。MySQL / Kafka / REST API 数据源、Destinations（目的地投递）、Reverse ETL（反向同步）、Warehouses（数仓连接）、Functions（自定义转换）均为**路线图占位 / Mock 展示**，UI 真实但不连后端。这条「真实 ETL 内核 + 周边 Mock」的边界是本模块的核心特征。

## 2. 详细设计（产品）

### 2.1 子功能清单

| 功能 | 英文 | 状态 | 说明 |
|------|------|------|------|
| 数据源目录 | Sources Catalog | 真实(壳) | 列「已连接 CSV」+ 路线图 MySQL/Kafka/API；卡片点击进入 ETL |
| 可视化 ETL 导入 | Visual ETL | **真实** | CSV/Inline → 字段映射 → 预览(dry-run) → 导入对象 + 可选建关系（3 步向导）|
| 可视化编排画布 | Pipeline Canvas | Mock(交互真实) | 节点画布：左侧拖出节点、右侧 source→transform→destination 连线编排；前端交互真实，未接后端 |
| 自动字段匹配 | Auto Map | **真实(前端)** | 按列名同名/互相包含自动建议映射 |
| 数据源详情 | Source Detail | Mock | Schema 事件 / Write Key / 实时事件 Debugger（演示） |
| 目的地 | Destinations | Mock | 广告/营销/BI/Webhook 目录占位 |
| 反向 ETL | Reverse ETL | Mock | 数仓宽表按调度反向同步到目的地（任务列表） |
| 数据仓库 | Warehouses | Mock | Profiles/事件落库 OLAP/业务库（连接列表） |
| 自定义函数 | Functions | Mock | 数据源/目的地侧自定义代码转换（函数列表） |

### 2.2 信息架构与页面

| 路由 | 页面文件 | 说明 | 状态 |
|------|----------|------|------|
| `/connections` | `pages/ConnectionsPage.tsx` | 数据源目录：已连接 CSV + 路线图 MySQL/Kafka/API；右上「可视化编排」入口 | 真实(壳) |
| `/connections/flow` | `pages/EtlFlowPage.tsx` | 可视化编排画布：节点拖拽 + 连线（React Flow） | Mock(交互真实) |
| `/connections/sources/new` | `pages/EtlPage.tsx` | 可视化 ETL 导入（3 步：数据源→目标对象→字段映射） | **真实** |
| `/connections/sources/:id` | `pages/segment/SourceDetailPage.tsx` | 数据源详情：概览/Schema/Debugger 子页 | Mock |
| `/connections/destinations` | `pages/DestinationsPage.tsx` | 目的地目录（路线图卡片） | Mock |
| `/connections/reverse-etl` | `pages/segment/ReverseEtlPage.tsx` | 反向 ETL 任务列表 | Mock |
| `/connections/warehouses` | `pages/segment/WarehousesPage.tsx` | 数据仓库连接列表 | Mock |
| `/connections/functions` | `pages/segment/FunctionsPage.tsx` | Functions 列表 | Mock |

约定：真实页面在 `pages/`，Mock 页面在 `pages/segment/`，右上角统一打 `MockTag` 角标（见 [00-platform](./00-platform.md)）。

### 2.3 关键用户流程

**主流程（真实）：添加数据源 → 字段映射 → 预览 → 导入**

1. `/connections` 点「已连接 CSV」卡片或「添加数据源」→ 跳 `/connections/sources/new`（EtlPage）。
2. **步骤 1 数据源**：选数据源类型（仅 CSV/粘贴可选，mysql/kafka/api 置灰标「路线图」），在 textarea 粘贴含表头的 CSV；前端 `parseHeader` 实时解析首行表头为「源列」Badge。
3. **步骤 2 目标对象**：从 `OBJECTS`（kind=object）选导入目标（account/order/product/store）；目标字段来自 `getMetadata(tenant)` 返回的 `object.fields[].code`。
4. **步骤 3 字段映射**：进入或切目标时按「源列 ⟷ 目标字段」同名/互相包含规则 `autoMap()` 自动建议；可手动增删改、点「自动匹配」重算。
5. **预览（dry-run）**：点「预览」→ `etlPreview(body)` → `POST /etl/preview`，后端只解析+映射前 5 行，返回 `total_rows`/`preview`/`issues`（含缺主键、行级转换错误），不写库；前端用 `DataTable` 渲染并高亮 issues。
6. **导入**：点「导入」→ `etlImport(body)` → `POST /etl/import`，后端逐行 `upsert_object`，错误按行收集不中断；返回 `imported`/`relations`/`failed`/`errors`。前端显示统计卡 + 「去筛选 {对象}」跳 `/objects/:object`。
7. 若 `body` 带 `link`（导入时建关系），每行成功后按 `dst_id_source` 取值，写 `object_relations`。

**画布编排流程（交互真实、未接后端）：拖节点 → 连线 → 保存**

1. `/connections` 右上「可视化编排」或左栏「连接 → 可视化编排」→ 进 `/connections/flow`（EtlFlowPage），默认载入示例流程 `CSV → 字段映射 → 对象表`。
2. 左侧节点面板按 **数据源 / 转换 / 目的地** 三组列出可拖节点；拖到右侧画布即生成节点（`onDrop` + `screenToFlowPosition`）。
3. 拖连接把手连线：source 节点仅右出口、destination 仅左入口、transform 两端皆有 —— 从节点形态上约束 source→destination 方向。
4. 缩放/平移、MiniMap、Controls；选中节点按 Backspace 删除；工具条「示例流程 / 清空」。
5. 「保存流程」当前为 mock（角标「未接后端」）——尚未把画布拓扑序列化为可执行管道。

**Mock 流程**：Destinations/Reverse ETL/Warehouses/Functions/SourceDetail 均为只读展示，数据取自 `mock/data.ts`，无写入与调度。

### 2.4 数据模型

| 表/对象 | 字段(要点) | 状态 |
|---------|-----------|------|
| `object_account` | OneID/账户主键 + 注册表字段 | 已存在 |
| `object_order` | 订单主键 + 字段 | 已存在 |
| `object_product` | 商品主键 + 字段（id/sku/category/price…）| 已存在 |
| `object_store` | 门店主键 + 字段 | 已存在 |
| `object_relations` | (tenant_id, src_type, src_id, rel_type, dst_type, dst_id) | 已存在 |
| 对象注册表 | `OBJECT_REGISTRY`（id 主键字段 + fields 类型表）| 已存在(代码) |
| Sources 注册表 | source 实例、类型、write_key、配置 | **待建** |
| 实时事件流 | source 事件落库（Debugger 数据源）| **待建** |
| Destinations 配置 | 目的地实例 + 映射 + 投递日志 | **待建** |
| Reverse ETL 任务 | 任务、调度、目的地、运行记录 | **待建** |
| Warehouse 连接 | 数仓连接串/凭据/同步状态 | **待建** |
| Function 定义 | 代码、运行时、部署状态、执行统计 | **待建** |

## 3. 技术设计

### 3.1 前端

| 关注点 | 实现 |
|--------|------|
| 数据源目录 | `ConnectionsPage`：`SOURCES` 常量分 connected/catalog 两组卡片；均链到 `/connections/sources/new` |
| ETL 页面 | `EtlPage`：本地状态 `sourceType/csv/target/mapping/preview/result/busy/err`；用 `useTenant()` 取租户 |
| 元数据 | `getMetadata(tenant)` → `Metadata`，提供目标对象字段列表（`targetFields`）|
| 派生计算 | `parseHeader(csv)` 解析源列；`autoMap()` 同名/包含匹配建议映射 |
| 预览/导入 | `etlPreview(body)` / `etlImport(body)`，`body` = `{tenant_id, target_object, source:{type,csv}, mapping}` |
| 类型 | `EtlBody` / `EtlFieldMap`（`{target, source?, const?}`），`link` 可选建关系 |
| UI 组件 | `Card/Badge/Button/Spinner/DataTable`（`components/ui.tsx`）；步骤组件 `StepTitle`/`Stat` |
| Mock 页面 | `SourceDetailPage`/`ReverseEtlPage`/`WarehousesPage`/`FunctionsPage`/`DestinationsPage` 取 `mock/data.ts`，用 `kit.tsx` 的 `StatCards/Catalog/SubTabs/MockTag` |
| 编排画布 | `EtlFlowPage`：基于 `@xyflow/react`（React Flow v12）。`PALETTE`/`NODE_META` 定义节点；自定义节点 `EtlNode`（按 `kind` 裁剪 source/target 把手）；`useNodesState`/`useEdgesState` + `addEdge`；HTML5 拖拽落点经 `screenToFlowPosition` 换算。纯前端态，无持久化 |

api/client.ts 相关函数：`getMetadata`、`etlPreview`、`etlImport`。编排画布不调后端。

### 3.2 后端

| 服务/端点/表 | 说明 | 状态 |
|--------------|------|------|
| `POST /etl/preview` | dry-run，解析+映射前 N 行，返回 issues，不写库 | **已实现** |
| `POST /etl/import` | 逐行 upsert + 可选建关系，错误按行收集 | **已实现** |
| `POST /objects/upsert` | 对象 upsert（ETL 复用 `ObjectService.upsert_object`）| **已实现** |
| `GET /metadata/{tenant_id}/fields` | 返回对象字段元数据（前端目标字段来源）| **已实现** |
| `EtlService`（`services/sql-engine/etl.py`）| `read_rows`/`validate_mapping`/`map_record`/`_coerce`/`preview`/`run_import` | **已实现** |
| 源适配器 | `SOURCE_ADAPTERS={csv,inline}` 可运行；`ROADMAP_SOURCES={mysql,kafka,api}` 调用即报错 | csv/inline **已实现**；其余**待建** |
| 类型转换 | 按 `OBJECT_REGISTRY` 字段类型强转（int/float/json/json_array），空串→跳过 | **已实现** |
| 关系写入 | `link`：导入行主键 →(rel_type)→ dst，落 `object_relations` | **已实现** |
| Sources 注册 + Write Key | source 实例/凭据/事件接收端点 | **待建** |
| Destinations 投递引擎 | 目的地实例 + 映射 + 投递 | **待建** |
| Reverse ETL 调度器 | 任务调度 + 反向同步 | **待建** |
| Warehouse 连接器 | 数仓连接 + 落库同步 | **待建** |
| Functions 运行时 | 自定义代码沙箱执行 | **待建** |

后端链路：前端 `/api/*` →（dev vite 代理 / 生产 nginx :8080）→ SQL Engine `:8002` → MySQL `:3308`，按 `tenant_id` 隔离。

### 3.3 真实 vs Mock 边界

- **真实**：数据源目录壳、CSV/Inline ETL 全链路（预览/导入/类型转换/建关系）、自动字段匹配、导入后跳对象筛选。
- **Mock**：mysql/kafka/api 源（适配器位预留，调用报错，不假装支持）、SourceDetail（Schema/Write Key/Debugger 取 `mock/data.ts`）、Destinations、Reverse ETL、Warehouses、Functions。
- **交互真实、未接后端**：可视化编排画布（拖拽/连线/缩放/删除全可用，但拓扑不序列化、不执行、不持久化；保存为 mock）。
- **关键约束**：路线图源 UI 可见但置灰；后端对 `mysql/kafka/api` 显式抛 `ObjectError`，避免「看起来支持实际不支持」。

### 3.4 依赖与集成

- 依赖 [00-platform](./00-platform.md)：`Layout`/`ui`/`kit`、`TenantContext`、API 客户端。
- 依赖对象层 `objects.py`（`ObjectService.upsert_object` / `add_relation`、`OBJECT_REGISTRY`）——导入即写统一对象表。
- 下游衔接 [02-unify](./02-unify.md)：导入后的对象进入统一筛选 `/objects/:object`；关系数据供 OneID/画像使用。
- 出口侧（Destinations/Reverse ETL）未来衔接 [05-engage](./05-engage.md) 的受众激活。

## 4. TODOs

**P0（把数据源接真、补齐 ETL 健壮性）**
- [ ] [后端] 实现 `mysql` 适配器：连接配置 + 表/SQL 抽取 → 复用 `EtlService` 映射链路（替换 `ROADMAP_SOURCES` 报错位）。
- [ ] [后端] 新建 **Sources 注册表**：source 实例 + 类型 + 凭据 + `write_key`，`GET/POST /sources` 驱动 `/connections` 真实列表（替换 `ConnectionsPage` 写死 `SOURCES`）。
- [ ] [前端] EtlPage 暴露 `link`（建关系）配置 UI；目前 `EtlFieldMap`/后端已支持，前端未给入口。
- [ ] [前后端] 编排画布落地：把画布拓扑（节点+连线）序列化为管道 DSL，保存到后端；节点点击打开配置抽屉（CSV 节点复用 EtlPage 映射、对象节点选目标对象），单源单目的链路可一键执行（复用 `EtlService`）。
- [ ] [数据] 为对象表补主键/唯一约束与导入幂等校验，确保 upsert 行为可预期。

**P1（事件流与出口侧落地）**
- [ ] [后端] 实时事件接收端点（按 `write_key` 鉴权）+ 事件落库，供 SourceDetail Debugger 接真（替换 `mock/data.ts.sourceDetail`）。
- [ ] [后端] **Destinations 投递引擎** + 配置表，前端 `DestinationsPage` 接 `GET/POST /destinations`（替换路线图卡片）。
- [ ] [后端] **Reverse ETL 调度器**：任务 + cron 调度 + 运行记录，`ReverseEtlPage` 接 `GET /reverse-etl/jobs`（替换 `mock/data.ts.reverseEtl`）。
- [ ] [前端] SourceDetail 的 Schema/Debugger 子 Tab 接真实接口（当前 `to:"#"` 占位）。

**P2（数仓 / 函数 / 流式源）**
- [ ] [后端] **Warehouse 连接器**：数仓连接串/凭据 + 同步状态，`WarehousesPage` 接 `GET /warehouses`（替换 `mock/data.ts.warehouses`）。
- [ ] [后端] **Functions 运行时**：自定义代码沙箱 + 部署/执行统计，`FunctionsPage` 接 `GET /functions`（替换 `mock/data.ts.functions`）。
- [ ] [后端] `kafka` / `api` 适配器：流式消费 / 定时拉取，接入 `EtlService`。
- [ ] [前端] ETL 导入大文件分片/进度与失败行重试；`DataTable` 预览分页。
