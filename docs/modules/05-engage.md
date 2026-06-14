# 模块 05 · 触达 Engage

> 状态：受众列表/圈人/存为受众真实，其余 Mock · 对标 Segment Engage

## 1. 概述

触达 Engage 是 CDP 的「人群运营 + 激活」层，对标 Twilio Segment 的 **Engage**：在统一档案（Unify 的 OneID + 多对象数据）之上圈选人群、保存为可复用的**受众 Audiences**，再通过**旅程 Journeys**（自动化编排）与**群发 Broadcasts**（一次性触达）把人群激活到下游目的地。

本模块当前**部分真实**：

- **真实**：受众列表（读 `/segments`）、创建受众（统一筛选器 `UnifiedFilter`：多条件 / 跨对象链式关联 / 边条件 / 自然语言圈人 / 实时预估 / SQL 预览 / 存为受众）。
- **Mock**：受众详情（规模趋势、成员明细、连接目的地）、旅程 Journeys、群发 Broadcasts —— 仅 UI + `mock/data.ts` 假数据，右上角带「Mock 数据」角标。

圈人能力复用平台底座的 DSL 引擎（`dsl.py` / `objects.py`），与 02-Unify 共享同一套对象元数据与关系图谱；激活能力（Journeys/Broadcasts）依赖 01-Connections 的 Destinations，尚未接通。

## 2. 详细设计（产品）

### 2.1 子功能清单

| 功能 | 英文 | 状态 | 说明 |
|------|------|------|------|
| 受众列表 | Audiences | 真实 | 已保存人群包列表，读 `GET /segments/{tenant_id}`，隐藏 `dsl` 列 |
| 创建受众 | Build Audience | 真实 | `UnifiedFilter` 圈人 → 预估 → 预览 SQL → 存为受众 |
| 多条件筛选 | Conditions | 真实 | 本对象多条件 + AND/OR 逻辑 |
| 跨对象链式关联 | Relations | 真实 | 多条线、正/反向、链式嵌套（relations.relations） |
| 边条件 | Edge Conditions | 真实 | 关系边上的属性过滤（如「通过 app 渠道购买」） |
| 自然语言圈人 | NL → Segment | 真实 | 自然语言 → DSL 草稿 + 预估，可能要求澄清 |
| 实时预估人数 | Estimate | 真实 | `POST /dsl/estimate`，返回命中数 + 耗时 |
| SQL 预览 | SQL Preview | 真实 | 预估/查询返回编译后 SQL，可展开查看 |
| 命中明细 | Search | 真实 | `POST /objects/search`，最多 50 条 |
| 存为受众 | Save as Segment | 真实 | `POST /segments`，落 `segments` 表（含 dsl） |
| 受众详情 | Audience Detail | Mock | 规模趋势、连接目的地（`audienceSample`） |
| 旅程 | Journeys | Mock | 多步骤自动化编排（`journeys`） |
| 群发 | Broadcasts | Mock | 一次性群发 Push/SMS/EDM（`broadcasts`） |

### 2.2 信息架构与页面

| 路由 | 页面文件 | 说明 | 状态 |
|------|---------|------|------|
| `/engage` | `pages/EngagePage.tsx` | 受众列表，读 `/segments` | 真实 |
| `/engage/audiences/new` | `pages/FilterPage.tsx` → `components/filter/UnifiedFilter.tsx` | 创建受众（统一筛选器） | 真实 |
| `/engage/audiences/:id` | `pages/segment/AudienceDetailPage.tsx` | 受众详情：规模趋势、连接目的地 | Mock |
| `/engage/journeys` | `pages/segment/JourneysPage.tsx` | 旅程列表 | Mock |
| `/engage/broadcasts` | `pages/segment/BroadcastsPage.tsx` | 群发列表 | Mock |

组件分层：`FilterPage` 仅是壳，核心在 `UnifiedFilter`，其内嵌 `ConditionEditor`（本对象条件）、`RelationEditor`（跨对象关系 + 边条件 + 链式）、`RelAddButton`（按元数据关系图谱添加关联线）。

### 2.3 关键用户流程

**创建受众（核心闭环）**：

1. **选 base 对象**：默认 `user`，可切换为任意可搜索对象（`OBJECTS` 中 `kind === "object"`）；切换会清空条件与关系。
2. **加本对象条件**：`ConditionEditor` 增删多条 `Leaf{field, op, value}`，并切换 AND/OR；可不加，仅靠跨对象关联筛选。
3. **加跨对象链式关联（多条线）**：点「添加跨对象关联」，按 `meta.relations` 图谱推断关系类型与方向（forward/reverse），每条 `Relation` 可带：
   - `conditions`：关联对象的属性条件；
   - `edge_conditions`：**边条件**，关系边上的属性（如订单渠道 = app）；
   - `relations`：**链式嵌套**，再往下一跳关联（A→B→C）。
4. **自然语言圈人（可选/旁路）**：输入「过去30天有过购买的用户」→ `draftSegment` 返回 DSL 草稿。若 `needs_clarification` 则提示澄清问题；否则回填整条 `rule` 并展示来源/置信度，附带预估。
5. **预估人数**：`runEstimate()` → `estimate()`，展示命中数 + 耗时 + 可展开 SQL。
6. **查询明细**：`runSearch()` → `searchObjects()`，最多 50 条命中行；可配 `rowLink` 跳转详情。
7. **存为受众**：弹窗填「群组编码 + 名称」→ `confirmSegment()`，后端保存前自动校验 + 预估，落 `segments` 表。保存成功后回到 `/engage` 即可见。

### 2.4 数据模型

| 表 | 关键字段 | 状态 |
|----|---------|------|
| `segments` | `segment_id`、`tenant_id`、`segment_code`、`segment_name`、`base_object`、`dsl`(JSON 规则)、`estimate`、`source` | 已存在 |
| `user_groups` | `id`、`tenant_id`、`group_code`、`group_name` 等 | 已存在 |
| `user_group_members` | `group_id`、`one_id`（成员明细） | 已存在 |
| `audience_size_snapshot` | `segment_id`、`ts`、`size`（规模随时间快照，供详情趋势） | 待建 |
| `journeys` / `journey_steps` / `journey_state` | 旅程定义、步骤、用户在途状态 | 待建 |
| `broadcasts` / `broadcast_sends` | 群发任务、逐条发送记录与回执 | 待建 |

> `segments` 与 `user_groups` 是两套并行实体：`UnifiedFilter`「存为群组」走 `confirmSegment` → `segments`（含 dsl，可重算）；`groups.py` 是显式成员名单（`one_id` 列表），适合静态人群与成员增删。

## 3. 技术设计

### 3.1 前端

**`UnifiedFilter` 能力**：单一组件覆盖「圈人全流程」，支持 props `baseObject`（预置对象）、`lockBase`（锁定不可换）、`autoSearch`（元数据就绪自动查一次）、`rowLink`（明细行跳转）—— 既用于 `/engage/audiences/new`，也可复用于对象列表页。

**状态（useState）**：`meta`(元数据)、`rule`(当前 DSL)、`nl`/`nlMsg`(自然语言)、`busy`(进行中动作)、`est`({n, ms, sql})、`rows`(明细)、`showSql`、`err`、`saveOpen`/`saveCode`/`saveName`/`saveMsg`(存为群组弹窗)。

**调用的 api 函数**（`api/client.ts`）：

| 动作 | 函数 | 后端端点 |
|------|------|---------|
| 加载元数据 | `getMetadata(tenant)` | `GET /metadata`（Unify 共享） |
| 自然语言草稿 | `draftSegment(tenant, question)` | `POST /agent/segment/draft` |
| 预估人数 | `estimate(tenant, rule)` | `POST /dsl/estimate` |
| 查询明细 | `searchObjects({...})` | `POST /objects/search` |
| 存为受众 | `confirmSegment(tenant, code, name, rule)` | `POST /agent/segment/confirm` → `segments` |
| 列表 | `listSegments(tenant)` | `GET /segments/{tenant_id}` |
| 校验 | `validateRule` | `POST /dsl/validate` |

**DSL 类型**（`api/types.ts`）：

```ts
DslRule { object: string; logic: "AND"|"OR"; conditions: Leaf[]; relations: Relation[] }
Relation { rel_type; object; direction: "forward"|"reverse";
           conditions: Leaf[]; edge_conditions: Leaf[]; relations: Relation[] /* 链式 */ }
Leaf { field; op; value }
```

`rule` 与 `Relation` 同构（都含 `conditions` + `relations`），因此天然支持任意深度的跨对象链式嵌套。

### 3.2 后端（`services/sql-engine/`）

| 端点 | 表/模块 | 状态 |
|------|--------|------|
| `GET /segments/{tenant_id}`、`GET /segments/{tenant_id}/{segment_code}` | `segments`（`segments.py`） | 已实现 |
| `POST /segments` | `segments.py`（INSERT…ON DUPLICATE KEY UPDATE） | 已实现 |
| `POST /agent/segment/draft`、`POST /agent/segment/confirm` | `agent.py` / `nl_query.py` | 已实现 |
| `POST /dsl/estimate`、`POST /dsl/validate`、`POST /dsl/compile` | `dsl.py` / `engine.py` | 已实现 |
| `POST /objects/search` | `objects.py` | 已实现 |
| `POST /groups`、`GET /groups/{t}`(+`/{id}`、`/code/{code}`、`/{id}/members`) | `groups.py` / `user_groups`、`user_group_members` | 已实现 |
| `POST /groups/{t}/{id}/members`、`DELETE /groups/{t}/{id}/members/{one_id}`、`POST /groups/search` | `groups.py` | 已实现 |
| 受众规模快照（趋势） | `audience_size_snapshot` | 待建 |
| 旅程编排引擎 | journeys 服务 | 待建 |
| 群发发送引擎 | broadcasts 服务（依赖 Destinations） | 待建 |
| 受众定时增量重算 | 调度 + dsl 重算 | 待建 |

### 3.3 真实 vs Mock 边界

| 维度 | 真实 | Mock |
|------|------|------|
| 数据来源 | MySQL `segments` / `user_groups` + DSL 引擎实时查询 | `frontend/src/mock/data.ts` |
| 受众列表 `/engage` | ✅ 读 `/segments` | — |
| 创建受众 `/engage/audiences/new` | ✅ 全链路（圈人/预估/SQL/存） | — |
| 受众详情 `/engage/audiences/:id` | — | `audienceSample`（规模趋势/连接目的地/规模数）始终是同一条假数据，不读 `:id` |
| 旅程 `/engage/journeys` | — | `journeys`（步骤数/在途/转化率） |
| 群发 `/engage/broadcasts` | — | `broadcasts`（渠道/受众/发送量/打开率） |

> Mock 页面均通过 `components/segment/kit.tsx` 的 `MockTag` 在右上角标注，并复用 `StatCards`/`Sparkline` 套件。

### 3.4 依赖与集成

- **02-Unify**：共享对象元数据（`/metadata`）、OneID、关系图谱（`meta.relations`），是圈人的数据底座。
- **平台底座 DSL 引擎**：`dsl.py`/`engine.py`/`objects.py` 提供规则→SQL 编译、预估、校验、搜索。
- **自然语言**：`agent.py` + `nl_query.py` 提供 NL→DSL（draft/confirm）。
- **01-Connections（待接）**：Journeys / Broadcasts 的激活需要 Destinations 作为下游发送通道。
- **多租户**：所有端点按 `tenant_id` 隔离，前端顶栏 Workspace 切换驱动。

## 4. TODOs

**P0**

- [数据] 建 `audience_size_snapshot` 表，定时（按周期）记录每个 `segment` 规模快照。
- [后端] 新增 `GET /segments/{tenant_id}/{segment_code}/size-trend`，返回最近 N 期规模序列。
- [前端] `AudienceDetailPage` 按 `:id` 读真实受众（名称/条件/规模/趋势），去掉 `audienceSample`，移除 `MockTag`。
- [后端] 受众详情成员明细：复用 `searchObjects` 或 `groups/{id}/members`，分页返回命中 `one_id`。

**P1**

- [后端] 受众定时增量重算：调度器周期性对 `segments.dsl` 重跑 `estimate`，回写 `estimate` 并落快照。
- [前端][后端] 受众「连接的目的地」接真：受众 ↔ Destinations 关联表 + 详情页读取。
- [数据] 设计 `journeys`/`journey_steps`/`journey_state` 模型，支持多步骤编排与按条件分流。

**P2**

- [后端] 旅程编排引擎：事件驱动状态机，节点进入/退出、分流、延时、触达。
- [后端] 群发发送引擎：对接 01-Connections Destinations，实现 Push/SMS/EDM 发送与回执（`broadcast_sends`）。
- [前端] Journeys / Broadcasts 由 Mock 列表升级为可视化编排器 + 发送配置向导，逐步去除 `mock/data.ts` 依赖。
- [前端] 受众列表增加规模列、来源（manual/NL）标识与「重算」操作入口。
