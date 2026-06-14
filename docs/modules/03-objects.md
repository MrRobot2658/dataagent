# 模块 03 · 对象管理 Objects

> 状态：**真实** · 主数据浏览与筛选

## 1. 概述

对象管理是 CDP 的「业务主数据视角」：把门店 / 产品 / 订单等核心业务对象作为一等公民浏览，并支持跨对象的关系筛选（如订单 `contains` 产品、用户 `placed` 订单）。它从「以用户为中心」的统一档案中拆出，独立成为顶层菜单，对标 Twilio Segment 的 **Linked Objects** 视角——围绕业务实体而非仅围绕 Profile 来组织数据。

当前能力为**全真实数据链路**：对象 Hub、各对象列表、跨对象关系筛选均直连 SQL Engine 的 `objects/search`，按 `tenant_id` 隔离。对象详情页为待建。

## 2. 详细设计（产品）

### 2.1 子功能清单

| 功能 | 英文 | 状态 | 说明 |
|------|------|------|------|
| 对象 Hub | Objects Hub | 真实 | 门店 / 产品 / 订单卡片，作为一级菜单入口；二级 = 门店/产品/订单 |
| 对象列表 | Object List | 真实 | 任意主对象 + `UnifiedFilter` 全部能力（基对象条件 + 跨对象关系 + 边条件）|
| 跨对象关系筛选 | Linked Objects | 真实 | `objects/search` 支持 relations 链式多跳（≤3 跳）+ edge_conditions |
| 对象详情 | Object Detail | 待建 | 单个对象详情（如订单含商品行）尚未落地 |
| 新建对象 | Create Object | 规划 | 元数据驱动新建对象 + 物理表，免改代码（见 §2.5）|
| 字段管理 | Field Management | 规划 | 增加 / 编辑字段 → ALTER + 字段白名单（见 §2.5）|
| 关系建模 | Relation Modeling | 规划 | 声明 src-rel-dst + 边属性，替代代码里的关系矩阵（见 §2.5）|

### 2.2 信息架构与页面

| 路由 | 页面文件 | 说明 | 状态 |
|------|----------|------|------|
| `/objects` | `pages/ObjectsHubPage.tsx` | 对象管理 Hub（门店/产品/订单卡片）· **一级菜单**，二级 = 门店/产品/订单 | 真实 |
| `/objects/:key` | `pages/ObjectListPage.tsx` | 对象列表（锁定基对象的 `UnifiedFilter`）| 真实 |
| `/objects/new` | （规划）| 新建对象向导 | 规划 |
| `/objects/:key/schema` | （规划）| 字段管理（增/改字段）| 规划 |
| `/objects/relations` | （规划）| 关系建模（关系矩阵 / 关系图）| 规划 |
| `/unify/objects` | （重定向）| 旧路由 → 重定向到 `/objects` | 兼容 |
| `/unify/objects/:key` | `pages/ObjectListPage.tsx` | 旧路由保留兼容 | 兼容 |

> `ObjectListPage` 按 `:key` 分发：`kind=tag` → `TagsPage`，`kind=segment` → `SegmentsPage`，否则渲染锁定基对象的 `UnifiedFilter`。

### 2.3 关键用户流程

**对象浏览 → 跨对象筛选**
进入 `/objects` Hub（一级菜单「对象管理」）→ 点门店 / 产品 / 订单卡片 → `/objects/:key` → `UnifiedFilter` 锁基对象，支持：基对象条件（字段白名单 + 操作符）、跨对象关系（如订单 `contains` 产品、用户 `placed` 订单）、关系边条件（`create_time` / `properties.*`），编译为 SQL 经 `POST /objects/search` 执行并渲染结果表。

### 2.4 数据模型

| 对象 / 表 | 类型 | 主键 | 说明 | 状态 |
|-----------|------|------|------|------|
| `object_store` | 表 | `store_id` | 门店（store_name/region/address）| 已存在 |
| `object_product` | 表 | `product_id` | 产品（sku/category/price）| 已存在 |
| `object_order` | 表 | `order_id` | 订单（order_no/amount/channel/status）| 已存在 |
| `object_account` | 表 | `account_id` | 客户主数据（详见 [04-accounts](./04-accounts.md)）| 已存在 |
| `object_lead` | 表 | `lead_id` | 线索（lead_name/city/company_size/source/stage）| 已存在 |
| `object_relations` | 表 | — | 关系边：`src_type/rel_type/dst_type/src_id/dst_id/properties/create_time` | 已存在 |

**关系矩阵（来自 metadata，已实现）**：`lead belongs_to user`、`user owns account`、`account purchased product`、`user visited store`、`user placed order`、`order contains product`。边字段统一含 `create_time`，外加各关系声明的 `properties.*`。

### 2.5 对象建模方案：新建对象 / 字段管理 / 关系建模

> 目标：把当前**写死在代码**的对象模型（`objects.py` 的 `OBJECT_REGISTRY` / `RELATION_MATRIX` / `RELATION_PROPERTIES`）升级为**元数据驱动 + 可视化管理**，让业务自助新建对象、增删改字段、声明对象间关系，无需改 Python。

#### 2.5.1 现状与差距

- `OBJECT_REGISTRY`（表/主键/字段类型）、`RELATION_MATRIX`（合法 `src-rel-dst`）、`RELATION_PROPERTIES`（边属性）均为 `objects.py` 内的常量；新建对象 / 加字段 = 改代码 + 写 `sql/migrate_*.sql`。
- **数据写入已具备**：`upsert_object`（字段白名单 upsert）、`add_relation`（按矩阵校验后写 `object_relations`）。缺的是**模型(schema)的自助管理**。

#### 2.5.2 新建对象 Create Object

表单：对象 key（如 `coupon`）、显示名、主键字段名、图标。提交后后端：
1. 校验 key 唯一且为合法标识符（`^[a-z][a-z0-9_]*$`，防注入）。
2. 经迁移建物理表 `object_<key>`（主键 + `tenant_id` + 审计列），强制 `utf8mb4`。
3. 写元数据表 `object_definitions`（见 §2.5.5）。
4. 注册表运行时从 DB 加载（`OBJECT_REGISTRY` 改为「内置常量 + DB 合并」），DSL 校验、ETL、前端 `lib/objects` 自动可见。

#### 2.5.3 字段管理 Add / Edit Field

- **增加字段**：code（标识符白名单）、类型（`int/float/str/json/json_array/datetime` 枚举）、必填、默认值、显示名 → `ALTER TABLE object_<key> ADD COLUMN ...` + 写 `object_fields`。
- **编辑字段**：改显示名/必填/默认 安全；**改类型 / 删除**需兼容检查——仅允许安全拓宽（如 `int→str`），删除走软删 `is_active=0`，避免破坏既有数据与查询。
- 字段进入白名单后才能被 `conditions` / `upsert` / ETL 映射使用（沿用「字段不在白名单即拒绝」）。

#### 2.5.4 关系建模 Object ↔ Object

- **声明关系**：选 src 对象、rel 动词（如 `contains`）、dst 对象，定义边属性 schema（`properties.<key>` 类型 + 显示名）→ 写 `relation_definitions` + `relation_properties`（替代代码里的 `RELATION_MATRIX` / `RELATION_PROPERTIES`）。
- **数据边不变**：实例关系仍落 `object_relations`；`add_relation` 改为按 DB 关系定义校验。
- **可视化**：关系矩阵表 / 关系图（节点=对象、边=关系），供筛选器跨对象多跳（≤3 跳）引用。

#### 2.5.5 数据模型（新增）

| 表 | 字段(要点) | 说明 |
|---|---|---|
| `object_definitions` | tenant_id, object_key, label, table_name, pk, icon, is_builtin | 对象注册表(DB 版) |
| `object_fields` | tenant_id, object_key, code, type, required, default_val, label, is_active, sort | 字段定义 |
| `relation_definitions` | tenant_id, src_type, rel_type, dst_type, label | 合法关系(DB 版矩阵) |
| `relation_properties` | tenant_id, src_type, rel_type, dst_type, prop_key, type, label | 边属性 schema |

#### 2.5.6 安全与约束

- 所有 DDL 经 `scripts/apply_migrations.sh`（utf8mb4）；表/列名走标识符白名单正则，**绝不把用户输入拼进 DDL/DML**（沿用 [00-platform](./00-platform.md) 与 `dsl.py` 安全边界）。
- 多租户：元数据表含 `tenant_id`；物理对象表沿用现有「单库 + `tenant_id` 列」隔离约定。
- 内置对象（user/lead/account/product/store/order）标 `is_builtin`，禁止删除或改主键。

## 3. 技术设计

### 3.1 前端

| 关注点 | 实现 |
|--------|------|
| Hub 卡片 | `ObjectsHubPage`：`components/segment/kit` 的 `Catalog`，对象元数据来自 `lib/objects`（`OBJECTS` / `byKey`）|
| 对象列表 | `ObjectListPage`：按 `:key` 分发——`tag` → `TagsPage`、`segment` → `SegmentsPage`，否则渲染锁定基对象的 `UnifiedFilter` |
| 检索器 | `components/filter/UnifiedFilter`：`baseObject` 锁基对象、`lockBase`、`autoSearch`、`rowLink` 透传给结果表 |
| 结果表 | `components/ui` 的 `DataTable`：`rowLink(row) => string?` 使整行可点击跳转 |
| API 函数 | `api/client.ts`：`searchObjects(SearchBody) → SearchResult.data`、`getMetadata` |

### 3.2 后端

| 端点 | 服务 / 文件 | 表 | 状态 |
|------|-------------|----|------|
| `POST /objects/search` | sql-engine `objects.py` | 各 object 表 + `object_relations` | 已实现（conditions + relations 链式多跳 + edge_conditions，≤3 跳）|
| `GET /objects/meta` | sql-engine `objects.py` | — | 已实现（对象注册表）|
| `GET /metadata/{tenant_id}/fields` | sql-engine | `tag_definitions` 等 | 已实现 |
| `POST /objects/upsert` | sql-engine `objects.py` | object 表 | 已实现（字段白名单 + ON DUPLICATE KEY）|

**核心实现要点（`objects.py`）**：`OBJECT_REGISTRY` 注册各对象的表/主键/字段类型；`RELATION_MATRIX` 约束合法 `(src,rel,dst)`；`_build_relations` 递归展开关系树实现链式多跳，`_count_hops > MAX_HOPS(3)` 拒绝；`_edge_col` 仅允许 `create_time` / `properties.<key>`（白名单防注入）。

### 3.3 真实 vs Mock 边界

- **全真实**：对象 Hub、对象列表、跨对象关系筛选（含链式多跳与边条件）均走 `/api/*` → SQL Engine `:8002` → MySQL `:3308`，按 `tenant_id` 隔离。

### 3.4 依赖与集成

- 依赖 **平台底座 [00-platform](./00-platform.md)**：`Layout`/`ui`/`kit`、`TenantContext`、`api/client`。
- 与 **统一 [02-unify](./02-unify.md)**：对象经 `object_relations` 与用户档案关联（如 `user placed order`）。
- 上游 **连接 [01-connections](./01-connections.md)**：ETL 导入即写 `object_*` 对象表与关系。

## 4. TODOs

**P0（对象详情）**
- [ ] [前端] 对象详情页：单对象主数据 + 关联对象面板（订单 → 含商品行 `order contains product`）。
- [ ] [后端] 详情查询：单对象 + 一跳关系展开端点（复用 `objects/search`）。

**P1（对象建模：元数据驱动，见 §2.5）**
- [ ] [后端] 新增元数据表 `object_definitions` / `object_fields` / `relation_definitions` / `relation_properties` + 迁移；`OBJECT_REGISTRY`/`RELATION_MATRIX` 改为「内置 + DB 合并」运行时加载。
- [ ] [后端] 新建对象端点：建 `object_<key>` 物理表（标识符白名单）+ 写定义；字段增/改 → 受控 `ALTER TABLE`（仅安全拓宽，删字段软删）。
- [ ] [后端] 关系建模端点：声明/校验 `(src,rel,dst)` + 边属性，替代代码常量；`add_relation` 改读 DB。
- [ ] [前端] 新建对象向导 `/objects/new`、字段管理 `/objects/:key/schema`、关系建模 `/objects/relations`（矩阵/图）；对象数据 CRUD 复用 `POST /objects/upsert`。
- [ ] [前端] 字段/列配置：可选展示列、排序、筛选保存。

**P2（检索与导出）**
- [ ] [前端] 对象级全文搜索框 + 结果导出（CSV）。
- [ ] [后端] 大结果集分页/排序（limit≤1000）。
