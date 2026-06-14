# 模块 09 · 设置 Settings

> 状态：**全 Mock（IAM 蓝图，与平台鉴权强绑定）** · 对标 Segment Settings

## 1. 概述

设置模块是工作区的「治理中枢」，对标 Segment 的 Settings / IAM：管理**工作区信息**、**成员与角色（IAM）**、**API 令牌**、**审计日志**四类内容。它是整套 CDP 的安全与多租户治理落点——其他模块的「谁能看/谁能改」最终都由这里定义。

当前实现 **100% Mock**：四个页面共享顶部 `SubTabs` 子导航，全部读 `mock/data.ts`，无任何后端、无登录态、无权限校验。本模块与 [00-platform](./00-platform.md) 的鉴权 P0 **强绑定**：平台底座负责「登录/会话/JWT」，本模块负责「用户/角色/团队/令牌/审计」的数据与策略；二者合起来才构成完整 IAM。落地真实的前提是先有登录态，因此本文把真实路径写成可执行蓝图，等待平台鉴权先行。

## 2. 详细设计（产品）

### 2.1 子功能清单

| 功能 | 英文 | 状态 | 说明 |
|------|------|------|------|
| 工作区信息 | General | Mock（tenants 可接真） | 名称/slug/区域/套餐/创建时间/归属租户；只读展示 |
| 权限管理 | Access Management | Mock | 成员列表、角色列表、权限范围；邀请成员入口 |
| 成员管理 | Members / IAM Users | Mock | 姓名/邮箱/角色/团队/状态；增删改、停用 |
| 角色与权限 | Roles & Scopes | Mock | 角色定义、成员数、权限范围（RBAC 雏形）|
| 团队 | Teams | Mock | 把成员分组到团队，按团队授予资源范围 |
| 邀请成员 | Invite Member | Mock | 邮箱邀请 + 指定角色/团队，生成邀请链接 |
| API 令牌 | API Tokens | Mock | 服务端访问凭证：标签/前缀/权限范围/创建/最近使用 |
| 令牌签发/吊销 | Issue / Revoke Token | Mock | 生成时仅展示一次明文，存储 hash；可吊销 |
| 审计日志 | Audit Trail | Mock | 工作区内关键写操作记录：时间/操作者/动作/对象 |

### 2.2 信息架构与页面

四页同属设置区（`lib/nav.ts` 的 `FOOTER_SECTION`），共享顶部 `SubTabs`（`components/segment/kit.tsx`）做子页切换。

| 路由 | 页面文件 | 说明 | 状态 |
|------|---------|------|------|
| `/settings` | `pages/segment/SettingsGeneralPage.tsx` | 通用 General：工作区基本信息与归属租户（只读 `dl`）| Mock |
| `/settings/access` | `pages/segment/AccessPage.tsx` | 权限管理：成员表 + 角色表 + StatCards + 邀请按钮 | Mock |
| `/settings/tokens` | `pages/segment/TokensPage.tsx` | API 令牌：令牌表 + 生成按钮 | Mock |
| `/settings/audit` | `pages/segment/AuditPage.tsx` | 审计日志：操作记录表（时间/操作者/动作/对象）| Mock |

> 四页 `TABS` 常量重复定义（各文件内联），接真前可抽出共享。每页右上 `MockTag` 角标标注未接后端。

### 2.3 关键用户流程

**A. 邀请成员 / 分配角色**
1. `/settings/access` 点「邀请成员」→ 填邮箱、选角色（如 管理员/编辑/只读）、可选团队。
2. 提交 → `POST /api/iam/invitations`（**待建**）→ 生成邀请令牌与链接，发邮件/复制链接。
3. 受邀人接受 → 创建/绑定 `users` 记录，写 `user_roles`；状态从「待接受」转「活跃」。
4. 全程写 `audit_log`（actor=邀请人，action=`invite_member`，target=受邀邮箱）。

**B. 签发 API 令牌**
1. `/settings/tokens` 点「生成令牌」→ 填标签、勾选权限范围（scopes，如 `read:profiles`/`write:segments`）。
2. `POST /api/iam/tokens`（**待建**）→ 后端生成随机串，**仅本次返回明文**，库内只存 `hash` + `prefix` + `scopes`。
3. 列表展示 prefix（前 8 位）、scopes、创建/最近使用时间；可「吊销」(`DELETE /api/iam/tokens/{id}`)。
4. 写审计：`issue_token` / `revoke_token`。

**C. 查审计日志**
1. `/settings/audit` 默认按时间倒序展示工作区内写操作。
2. 可按操作者/动作/时间范围/对象筛选（`GET /api/iam/audit?actor=&action=&from=&to=`，**待建**）。
3. 仅可读、不可改；分页/导出 CSV（P2）。

**D. 改工作区信息**
1. `/settings` 展示工作区元数据（来源应为 `tenants` 表）。
2. 可改的字段（名称/区域/套餐）经 `PATCH /api/tenants/{id}`（**待建写接口**）落库；slug/创建时间只读。
3. 写审计：`update_workspace`。

### 2.4 数据模型

| 表 | 状态 | 关键字段 | 说明 |
|----|------|---------|------|
| `tenants` | **已存在** | id, name, region, plan, created | 作为「工作区」的真实来源（General 接真即可）|
| `users` | 待建 | id, tenant_id, name, email, status | 工作区成员；email 唯一 |
| `roles` | 待建 | id, tenant_id, name, scope(JSON) | 角色定义与权限范围（RBAC）|
| `user_roles` | 待建 | user_id, role_id | 成员↔角色多对多 |
| `teams` | 待建 | id, tenant_id, name | 团队；成员分组、按团队授资源范围 |
| `team_members` | 待建 | team_id, user_id | 团队↔成员多对多 |
| `api_tokens` | 待建 | id, tenant_id, label, prefix, hash, scopes(JSON), created, last_used | 令牌只存 hash；prefix 供识别 |
| `audit_log` | 待建 | id, tenant_id, actor, action, target, ts | 记录所有写操作 |
| `invitations` | 待建 | id, tenant_id, email, role_id, token, status, expires_at | 邀请流程 |

> 所有表均带 `tenant_id`，按租户隔离（沿用全局多租户约定）。Mock 字段对照：`workspaceInfo`→`tenants`；`iamUsers`→`users`+`user_roles`；`roles`→`roles`；`apiTokens`→`api_tokens`；`auditTrail`→`audit_log`。

## 3. 技术设计

### 3.1 前端

| 关注点 | 实现 |
|--------|------|
| 页面 | 4 个 Mock 页（`SettingsGeneralPage`/`AccessPage`/`TokensPage`/`AuditPage`）|
| 子导航 | 顶部 `SubTabs`（`components/segment/kit.tsx`），4 个 tab 指向四路由，`active` 标当前页 |
| 数据源 | 全部读 `mock/data.ts`：`workspaceInfo`/`iamUsers`/`roles`/`apiTokens`/`auditTrail` |
| 组件 | `Layout`（页头/动作位）、`Card`、`DataTable`、`StatCards`（Access 页用）、`MockTag` |
| 动作 | 「邀请成员」「生成令牌」按钮目前为占位（无 onClick 行为）|
| 接真改造 | 引入 `api/client.ts` 调 `/api/iam/*` 与 `/api/tenants/*`；按 `useTenant()` 带 `tenant_id`；表单弹窗用 `ui.tsx` 的 `Modal`/`TextField` |

### 3.2 后端

均为 **待建**。建议新增 IAM 服务（可挂在 SQL Engine `:8002` 下，或独立 `services/iam/`），统一前缀 `/api/iam`：

| 端点 | 方法 | 状态 | 说明 |
|------|------|------|------|
| `/api/iam/users` | GET/POST/PATCH/DELETE | 待建 | 成员 CRUD、停用 |
| `/api/iam/roles` | GET/POST/PATCH/DELETE | 待建 | 角色与权限范围 CRUD |
| `/api/iam/teams` | GET/POST/PATCH/DELETE | 待建 | 团队 CRUD 与成员增删 |
| `/api/iam/invitations` | POST/GET | 待建 | 邀请签发、列表、接受 |
| `/api/iam/tokens` | GET/POST/DELETE | 待建 | 令牌签发（仅一次返明文）、列表、吊销 |
| `/api/iam/audit` | GET | 待建 | 审计查询（actor/action/time/target 过滤、分页）|
| `/api/tenants/{id}` | GET/PATCH | 待建写 | 工作区信息读写（General 接真）|

**令牌校验**：服务端令牌（`api_tokens`）在 **Nginx 网关**或 **SQL Engine 中间件**统一拦截校验——按 `prefix` 定位、比对 `hash`、检查 `scopes` 是否覆盖目标操作、更新 `last_used`，校验失败返回 401/403。用户态会话（登录 JWT）由 00-platform 的鉴权服务签发，二者共存：JWT 走人，token 走机器/服务端。

### 3.3 真实 vs Mock 边界

| 维度 | 现状 | 接真路径 |
|------|------|---------|
| 工作区信息 | Mock（`workspaceInfo`）| `tenants` 表已存在，最易接真（先做 General）|
| 成员/角色/团队 | 全 Mock | 待建表 + `/api/iam/*`；依赖平台登录态 |
| API 令牌 | Mock（明文前缀展示）| 待建 `api_tokens`(hash) + 网关校验 |
| 审计日志 | Mock（静态列表）| 待建 `audit_log`，由各写接口埋点 |
| 鉴权/权限校验 | **完全没有** | 由 00-platform 的鉴权 P0 先行，本模块在其上做 RBAC |

### 3.4 依赖与集成

- **与 00-platform 鉴权 P0 强绑定**：必须先有「登录 + 会话/JWT + `tenant_id` 从令牌解析」，本模块的 IAM 才有意义；否则成员/角色无主体、审计无 actor。本模块是真实鉴权的**数据与策略层**，平台底座是**入口与会话层**。
- **审计贯穿全站**：`audit_log` 不止记录本模块——所有模块的写操作（建连接、改受众、跑 ETL、删数据等）都应统一埋点到审计服务，本模块只是其**查询视图**。
- **令牌在网关校验**：服务端调用 `/api/*` 携带 API 令牌，在 **Nginx 网关 / SQL Engine 中间件**按 `scopes` 鉴权，与全局数据链路（前端 `/api/*` → SQL Engine `:8002` → MySQL `:3308`）对齐。
- **多租户隔离**：所有 IAM 表带 `tenant_id`，沿用顶栏 Workspace 切换（1001/1002）的隔离约定。

## 4. TODOs

**P0（让 IAM 可用，紧随平台鉴权）**
- [ ] [后端] 待 00-platform 鉴权落地后，建 `users`/`roles`/`user_roles` 表与 `/api/iam/users`、`/api/iam/roles` CRUD。
- [ ] [数据] 落 `tenants` 写接口（`PATCH /api/tenants/{id}`），让 General 页接真（最低风险起点）。
- [ ] [后端] 建 `api_tokens`(hash/scopes/last_used) + 签发/吊销端点；令牌在 Nginx 网关或 SQL Engine 中间件校验 scopes。
- [ ] [后端] 建 `audit_log`，并提供统一埋点中间件，所有写操作落审计。
- [ ] [前端] General 与 Access 页接 `/api/tenants`、`/api/iam/*`，去掉 `MockTag`；按 `useTenant()` 带 `tenant_id`。

**P1（完善 IAM 流程）**
- [ ] [后端] 邀请流程：`invitations` 表 + `POST /api/iam/invitations` + 接受端点；邮件/链接。
- [ ] [前端] 邀请成员/生成令牌弹窗（`Modal`+`TextField`）；令牌明文「仅展示一次」+ 复制。
- [ ] [后端] 团队：`teams`/`team_members` + CRUD；按团队授资源范围。
- [ ] [前端] 审计页接 `/api/iam/audit`，支持 actor/action/时间/对象筛选与分页。
- [ ] [前端] 抽出共享的 `TABS` 常量与 SubTabs 包装，消除四页重复。

**P2（治理打磨）**
- [ ] [后端] 细粒度 RBAC：scope 按「模块×动作」建模，接口层统一鉴权装饰器。
- [ ] [前端] 审计日志 CSV 导出；成员/令牌列表分页与排序。
- [ ] [后端] 令牌轮换、过期策略、最近使用 IP/UA 记录。
- [ ] [前端] SSO/SCIM 占位入口（对标 Segment 企业版），SAML/OIDC 预留。
