# 模块 06 · 协议 Protocols

> 状态：全 Mock（治理蓝图） · 对标 Segment Protocols

## 1. 概述

协议 Protocols 是 CDP 的**数据治理层**，对标 Twilio Segment Protocols。它定义「数据应该长什么样」（埋点计划 / Tracking Plan），在事件**入库前**对照计划做 schema 校验，把不符合规范的上报记为**违规 Violations**，并通过**转换 Transformations** 在入库前改写 payload（重命名 / 删除 / 值映射），从而统一下游数据口径、保证数据质量。

当前本模块**三页全为前端 Mock**（右上角均有「Mock 数据」角标），仅展示治理蓝图与示例数据，未接任何后端：没有真实的计划存储、没有校验钩子、没有违规采集、没有转换执行。本文档的目标是把「Mock 接真」的落地路径写具体——核心是把 Tracking Plan 校验作为既有两条真实入库链路（ETL `POST /etl/import`、实时事件 `POST /events/process`）的**入库前钩子**。

- 对标 Segment 的哪块：Protocols（Tracking Plans / Violations / Transformations）。
- 真实/Mock 状态：**全 Mock**。展示层完整，数据层、校验层、执行层全部待建。
- 价值定位：数据质量是 CDP 的地基，违规数据会污染 Unify（OneID）与 Engage（圈人/触达）。

## 2. 详细设计（产品）

### 2.1 子功能清单

| 功能 | 英文 | 状态 | 说明 |
|------|------|------|------|
| 埋点计划 | Tracking Plans | Mock | 管理多份计划，每份绑定若干数据源，统计事件数与合规率 |
| 事件 Schema | Event Schema | Mock | 计划内逐事件定义类型（track/identify）、属性、必填项、审批状态 |
| 数据质量违规 | Violations | Mock | 列出与计划不符的上报，含问题描述、出现次数、来源、严重级别 |
| 数据转换 | Transformations | Mock | 入库前对事件做属性重命名/删除/值映射，按作用范围生效 |
| 入库校验钩子 | Validation Hook | 待建 | 挂在 `/etl/import` 与 `/events/process` 入库前的中间件 |
| 计划审批流 | Plan Approval | 待建 | 事件 schema 的草稿→已批准流转（Mock 中仅有状态字段） |

### 2.2 信息架构与页面

| 路由 | 页面文件 | 说明 | 状态 |
|------|---------|------|------|
| `/protocols` | `frontend/src/pages/segment/TrackingPlansPage.tsx` | 埋点计划列表 + 事件 Schema 表 | Mock |
| `/protocols/violations` | `frontend/src/pages/segment/ViolationsPage.tsx` | 数据质量违规列表 | Mock |
| `/protocols/transformations` | `frontend/src/pages/segment/TransformationsPage.tsx` | 数据转换列表，含「新建转换」按钮（无逻辑） | Mock |

导航定义于 `frontend/src/lib/nav.ts`（「协议 / Protocols」分组），路由注册于 `frontend/src/App.tsx`（第 90–92 行）。三页均通过 `components/segment/kit.tsx` 的 `MockTag` 在右上角标注 Mock。

### 2.3 关键用户流程

写入治理闭环：**定义埋点计划 → 事件入库时校验 → 产生违规 → 转换修复**。

1. **定义埋点计划**：数据治理员在 `/protocols` 新建计划（如「电商核心埋点」），绑定数据源（Web/App/小程序），逐事件定义 schema——事件名、类型（track/identify）、属性列表、必填属性、审批状态（草稿→已批准）。
2. **事件入库时校验**：上游通过 ETL（`POST /etl/import`）或实时事件（`POST /events/process`）上报。入库**前**，校验钩子按该数据源所绑定计划的事件 schema 逐条校验：事件是否声明、必填属性是否齐全、属性类型是否匹配、是否存在未声明属性。
3. **产生违规**：校验失败的事件按「事件 + 问题」聚合写入 `violations`（累加 `count`、更新 `last_seen`），按 high/low 分级，呈现在 `/protocols/violations`。校验策略可配置为「仅告警放行」或「阻断」。
4. **转换修复**：治理员在 `/protocols/transformations` 配置转换（如 `amount → order_amount` 重命名、丢弃 PII、渠道值归一化），按作用范围（某事件 / 所有事件）在入库前改写 payload，使后续上报符合计划、消除违规。

### 2.4 数据模型（建议表，全部 待建）

| 表 | 关键字段 | 状态 | 说明 |
|----|---------|------|------|
| `tracking_plans` | `id` / `tenant_id` / `name` / `sources` | 待建 | 一份计划，`sources` 为绑定的数据源列表 |
| `tracking_plan_events` | `id` / `plan_id` / `event` / `type` / `properties_json` / `required` | 待建 | 计划内单个事件的 schema；`properties_json` 存属性与类型，`required` 存必填项 |
| `violations` | `id` / `tenant_id` / `event` / `issue` / `count` / `source` / `severity` / `first_seen` / `last_seen` | 待建 | 按「事件+问题」聚合的违规记录，校验失败时累加 |
| `transformations` | `id` / `tenant_id` / `name` / `scope` / `type` / `config` / `enabled` | 待建 | 转换规则；`type` ∈ 属性重命名/属性删除/值映射，`config` 存具体参数 |

> 所有表均需 `tenant_id` 列，按工作区（1001/1002）隔离，落 MySQL `:3308`。

## 3. 技术设计

### 3.1 前端（现有 Mock 页与组件）

- **页面**：`TrackingPlansPage.tsx` / `ViolationsPage.tsx` / `TransformationsPage.tsx`，均位于 `frontend/src/pages/segment/`。
- **数据源**：`frontend/src/mock/data.ts` 导出 `trackingPlans`（name/events/sources/conformance/updated）、`trackingEvents`（event/type/properties/required/status）、`violations`（event/issue/count/source/severity）、`transformations`（name/scope/type/status）。
- **UI 套件**：`components/ui.tsx`（`Card`/`DataTable`/`Button`）、`components/segment/kit.tsx`（`StatCards`/`MockTag`）。
- **现状**：纯静态渲染，无任何请求、无表单逻辑（「新建转换」按钮无 onClick）。接真时改为从 `/api/protocols/*` 拉数，并补建计划/事件/转换的编辑表单。

### 3.2 后端（建议服务/端点/表 + 校验钩子，全标 待建）

建议落在 `services/sql-engine/` 下新增 `protocols.py`（治理服务），在 `main.py` 注册端点。

| 端点 | 方法 | 状态 | 说明 |
|------|------|------|------|
| `/protocols/plans` | GET/POST/PUT/DELETE | 待建 | Tracking Plans CRUD |
| `/protocols/plans/{id}/events` | GET/POST/PUT/DELETE | 待建 | 计划内事件 schema CRUD |
| `/protocols/violations` | GET | 待建 | 违规列表（按 tenant/source/severity 过滤） |
| `/protocols/transformations` | GET/POST/PUT/DELETE | 待建 | Transformations CRUD |
| `/protocols/transformations/{id}/run` | POST | 待建 | 对给定 payload 执行转换（供钩子与调试用） |

**校验钩子（核心，待建）**：抽出 `validate_event(tenant_id, source, event_name, payload) -> {ok, issues}`，封装为入库前中间件：

1. 查该 `source` 绑定的 `tracking_plans` → `tracking_plan_events`，取目标事件 schema。
2. 校验：事件已声明？必填属性齐全？属性类型匹配（如 `amount` 应为 number）？有无未声明属性？
3. 失败 → upsert 进 `violations`（累加 `count`、刷新 `last_seen`），按策略「告警放行」或「阻断」。
4. 通过/放行 → 依次应用启用中的 `transformations` 改写 payload，再交给原入库逻辑。

建议表见 2.4：`tracking_plans` / `tracking_plan_events` / `violations` / `transformations`，全部待建。

### 3.3 真实 vs Mock 边界

| 部分 | 现状 | 接真后 |
|------|------|--------|
| 三个页面渲染 | 真实（静态） | 真实（接 API） |
| 计划 / 事件 / 违规 / 转换 数据 | Mock（`mock/data.ts`） | MySQL 表 |
| 计划与转换的增删改 | 无 | CRUD 端点 |
| 入库校验 | 无（事件直接入库） | `/etl/import`、`/events/process` 前置钩子 |
| 违规采集 | Mock 静态 | 校验失败时实时写入 |
| 转换执行 | 无 | 入库前 payload 改写 |

**边界关键点**：本模块的「真实」不只是给三页接 API，而是要把校验/转换**插入既有真实入库链路**——这是与其他 Mock 模块最大的不同。

### 3.4 依赖与集成（与 ETL 导入 / 事件接入的校验集成点）

- **ETL 导入**：`POST /etl/import`（`services/sql-engine/etl.py` 的 `run_import`，逐行 upsert 到目标对象）。集成点：在逐行 upsert **前**对每行调用 `validate_event` + 应用 transformations；违规行可按策略跳过或记违规后放行。前端入口 `frontend/src/api/client.ts` 第 93 行。
- **实时事件**：`POST /events/process`（`services/id-mapping/main.py` 第 507 行，模拟 Flink Job 做 OneID 合并与画像更新）。集成点：在 `process_event` 进入 OneID 合并**前**做校验与转换，避免脏数据污染 OneID 与画像。`/users/import` 批量导入复用同一钩子。
- **多租户**：所有计划/违规/转换查询按 `tenant_id` 隔离，与平台底座一致。
- **下游影响**：治理质量直接影响 Unify（02）的 OneID 准确性与 Engage（03）的圈人/触达精度；与 Privacy（05）的 PII 处理在「属性删除/哈希」上有交集，可共享转换执行层。

## 4. TODOs

### P0（打通最小闭环：能存计划、能校验、能记违规）

- [ ] [数据] 建表 `tracking_plans` / `tracking_plan_events` / `violations` / `transformations`（含 `tenant_id`），落 MySQL `:3308`。
- [ ] [后端] 新建 `services/sql-engine/protocols.py`，实现 Tracking Plans 与 Event Schema 的 CRUD 端点。
- [ ] [后端] 实现 `validate_event(tenant_id, source, event, payload)` 校验函数（声明/必填/类型/未声明属性）。
- [ ] [后端] 把校验钩子接入 `etl.py::run_import`，违规 upsert 进 `violations`（累加 count、刷新 last_seen）。
- [ ] [前端] `/protocols` 与 `/protocols/violations` 改为读 `/api/protocols/plans`、`/api/protocols/violations`，移除 `MockTag`。

### P1（转换执行 + 实时链路 + 编辑能力）

- [ ] [后端] Transformations CRUD + `/{id}/run` 执行（属性重命名/删除/值映射）。
- [ ] [后端] 把校验+转换钩子接入 `id-mapping` 的 `/events/process` 与 `/users/import`（OneID 合并前）。
- [ ] [前端] 计划/事件/转换的新建与编辑表单（含「新建转换」按钮逻辑）。
- [ ] [前端] `/protocols/transformations` 接 API，支持启用/停用切换。

### P2（治理体验增强）

- [ ] [后端] 校验策略可配（告警放行 / 阻断）+ 事件 schema 审批流（草稿→已批准）。
- [ ] [数据] 违规趋势与合规率随时间统计，支撑监控（06）联动。
- [ ] [前端] 违规详情下钻、按来源/级别过滤、一键生成修复转换。
- [ ] [后端] 与 Privacy（05）共享转换执行层，统一 PII 删除/哈希逻辑。
