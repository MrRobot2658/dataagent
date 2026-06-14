# 模块 04 · 客户管理 Accounts

> 状态：**真实** · B2B 账户主数据，一个客户含多个用户

## 1. 概述

客户管理围绕 **account（客户/账户）** 主数据组织视图：一个客户可关联多个用户（`user --owns--> account`），适用于 B2B / 多用户账户场景。它从统一档案中拆出独立为顶层菜单，对标 Twilio Segment 的 **account-level profiles**——以账户而非个人为单位聚合与圈选。

当前能力为**全真实数据链路**：客户列表、客户详情（含其下用户）均直连 SQL Engine 的 `objects/search`，按 `tenant_id` 隔离。账户级聚合画像、按账户圈选受众为待建。

## 2. 详细设计（产品）

### 2.1 子功能清单

| 功能 | 英文 | 状态 | 说明 |
|------|------|------|------|
| 客户列表 | Accounts | 真实 | `account` 对象列表，行可点进详情 |
| 客户详情 | Account Detail | 真实 | 客户基本信息 + 该客户下的多个用户（`user --owns--> account`）|
| 账户级聚合/画像 | Account Profile | 待建 | 用户数 / GMV / 活跃等账户级聚合指标 |
| 按账户圈选 | Account Audience | 待建 | 以账户为单位圈选受众 |

### 2.2 信息架构与页面

| 路由 | 页面文件 | 说明 | 状态 |
|------|----------|------|------|
| `/accounts` | `pages/AccountsPage.tsx` | 客户列表，`rowLink → /accounts/:id` · **一级菜单** | 真实 |
| `/accounts/:id` | `pages/AccountDetailPage.tsx` | 客户详情 + 该客户下用户 | 真实 |
| `/unify/accounts` | （重定向）| 旧路由 → 重定向到 `/accounts` | 兼容 |
| `/unify/accounts/:id` | `pages/AccountDetailPage.tsx` | 旧路由保留兼容 | 兼容 |

### 2.3 关键用户流程

**客户 → 其下多用户 → 点用户进档案**
进入 `/accounts`（一级菜单「客户管理」）→ `searchObjects(object=account)` 查客户列表 → 点行进 `/accounts/:id` → 详情页两路查询：(a) `account` 基本信息（`account_id eq id`）；(b) 该客户下的用户 = `object=user` + `relation owns account(account_id=:id)` → 用户表 `rowLink → /unify/profiles/:one_id` → 下钻进入用户档案详情。

### 2.4 数据模型

| 对象 / 表 | 类型 | 主键 | 说明 | 状态 |
|-----------|------|------|------|------|
| `object_account` | 表 | `account_id` | 客户主数据（name/industry/scale）| 已存在 |
| `object_relations` | 表 | — | 关系边，含 `user owns account` | 已存在 |
| `doris_user_wide` | 表 | `one_id` | 用户宽表，详情用户下钻目标 | 已存在 |

**关系矩阵（已实现）**：`user owns account`（客户下用户）、`account purchased product`（可扩展账户购买视图）。

## 3. 技术设计

### 3.1 前端

| 关注点 | 实现 |
|--------|------|
| 客户列表 | `AccountsPage`：`DataTable` + `rowLink={(r) => /accounts/${r._id}}`，数据来自 `searchObjects(object=account)` |
| 客户详情 | `AccountDetailPage`：`StatCards` + 两路 `searchObjects`（账户信息 + 该客户下用户表）；用户表 `rowLink → /unify/profiles/:one_id` |
| 状态 | `useState` 局部态 + `useTenant()` 注入 `tenant`；`useEffect([id, tenant])` 触发查询 |
| API 函数 | `api/client.ts`：`searchObjects(SearchBody) → SearchResult.data` |

### 3.2 后端

| 端点 | 服务 / 文件 | 表 | 状态 |
|------|-------------|----|------|
| `POST /objects/search` | sql-engine `objects.py` | `object_account` + `object_relations` | 已实现（支持 `relations owns account` 过滤）|

### 3.3 真实 vs Mock 边界

- **全真实**：客户列表与详情、该客户下用户查询均走 `/api/*` → SQL Engine `:8002` → MySQL `:3308`，按 `tenant_id` 隔离。

### 3.4 依赖与集成

- 依赖 **平台底座 [00-platform](./00-platform.md)**：`Layout`/`ui`/`kit`、`TenantContext`、`api/client`。
- 下钻 **统一 [02-unify](./02-unify.md)** 的用户档案详情（`/unify/profiles/:one_id`）。
- 关系矩阵 `account purchased product` 可扩展账户购买视图；对象层见 [03-objects](./03-objects.md)。

## 4. TODOs

**P0（账户级聚合）**
- [ ] [后端] 账户级聚合指标（用户数 / GMV / 活跃），基于 `owns` / `purchased` 关系聚合。
- [ ] [前端] 详情页 `StatCards` 接真实聚合指标。

**P1（画像与圈选）**
- [ ] [前端] 账户画像页：账户级特征展示。
- [ ] [前端] 按账户圈选受众（account-level audience）。
- [ ] [数据] 账户父子层级（集团/子公司）建模。

**P2（治理）**
- [ ] [后端] 账户合并 / 去重（merge）。
- [ ] [前端] 账户 CRUD 与字段配置。
