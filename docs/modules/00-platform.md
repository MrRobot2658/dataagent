# 模块 00 · 平台底座 Platform

> 状态：**外壳真实、鉴权 Mock** · 对标 Segment 的 App Shell + 工作区 + IAM 壳

## 1. 概述

平台底座是所有业务模块共用的「框架层」：左侧分区导航、顶栏（搜索 + Workspace 切换 + 头像）、页面骨架（标题/副标题/动作位）、UI 组件库、Mock 套件、API 客户端、主题与多租户上下文。它不承载具体业务，但决定了整套控制台「长得像 Segment、跑得通真实数据」。

## 2. 详细设计（产品）

### 2.1 子功能清单

| 功能 | 英文 | 状态 | 说明 |
|------|------|------|------|
| 分区导航 | Sidebar IA | 真实 | 8 大分区 + 设置，激活分区展开二级；中文主 + 英文术语 |
| 工作区切换 | Workspace | 真实(租户)/Mock(组织) | 顶栏切租户 1001/1002，驱动全站按 `tenant_id` 查询 |
| 租户管理 | Tenant Management | 规划 | 租户列表 + 增删改 + **每租户独立配置**（容量/通道/策略/隐私/集成）；见 §2.5 |
| 全局搜索 | Search | Mock | 顶栏搜索框占位（未接） |
| 账号/头像 | Account | Mock | 头像占位，无登录态 |
| 页面骨架 | Page Shell | 真实 | `Layout(title/subtitle/actions)` 统一页头 |
| 品牌主题 | Theme | 真实 | Segment 绿（`brand-*` 调色板）|
| Mock 标注 | MockTag | 真实 | 未接后端页面统一打角标 |

### 2.2 信息架构与页面

- 顶层分区（`lib/nav.ts` 的 `SECTIONS`）：连接 / 统一 / 对象 / 客户 / 触达 / 协议 / 隐私 / 监控；底部 `FOOTER_SECTION`：设置。
- 单页：概览 Overview（`/`，`pages/Dashboard.tsx`，真实计数）。
- 租户管理（§2.5）落在 **设置 → 租户管理**（`/settings/tenants`），属平台级治理，详见 [09-settings](./09-settings.md)。
- 骨架：`components/layout/{Layout,Sidebar,Header}.tsx`。

### 2.3 关键用户流程

1. 进入 → 默认概览，看各对象实时计数 → 点卡片进入对应模块。
2. 顶栏切 Workspace（租户）→ 全站数据随 `tenant_id` 刷新。
3. 左栏点分区 → 展开二级 → 进入功能页。

### 2.4 数据模型

- 平台底座不直接拥有业务表；依赖 `tenants` 表（租户基础信息）与新增的 `tenant_config` 表（每租户配置，见 §2.5）。
- 前端无持久化；`TenantContext` 仅内存态（当前 `tenants` 写死 `[1001,1002]`，落地后改为从 `GET /tenants` 拉取）。

### 2.5 租户管理与每租户配置

平台支持对**多个租户**做集中治理：超级管理员维护租户清单，并为**每个租户单独配置**容量、数据通道、ID-Mapping 策略、隐私合规与集成密钥。租户之间配置互不影响——这是「多租户」从「只切 `tenant_id`」升级为「可独立运营」的关键。

#### 2.5.1 子功能

| 功能 | 说明 |
|------|------|
| 租户列表 | 展示所有租户：名称、tier、状态、scale 档位、事件量；支持搜索/筛选 |
| 新建 / 编辑租户 | 表单维护基础信息 + 各配置域；保存前 dry-run 校验（如 topic 冲突、配额合法性）|
| 启用 / 停用 | `status=active/suspended`；停用后该租户写入与查询被网关拦截 |
| 配置详情 | 单租户的「配置中心」，按配置域分 Tab（见 §2.5.2）|
| 配置变更审计 | 每次改配置落 `merge_log` 风格的审计记录（关联 [09-settings](./09-settings.md) Audit Trail）|

#### 2.5.2 每租户配置域（核心）

每个租户拥有一套独立配置，按域划分：

| 配置域 | 字段示例 | 说明 / 关联模块 |
|--------|----------|----------------|
| 基础 | `tenant_name` / `tier`(premium·standard) / `status`(active·suspended) | 租户身份与生命周期 |
| 数据通道 | `kafka_topic` / `topic_mode`(独占·共享) / 分区数 | 独占 `tenant-{id}-events` 或落到 `shared-tenant-events`（见 1003 示例）|
| 容量 / 伸缩 | `scale_tier`(dev·medium·large·xlarge) / Redis 分片 / Flink 并行度 / OLAP 副本 | 对标 [scale-comparison](../scale-comparison.md)；驱动 `scripts/scale-up.sh` 取向 |
| ID-Mapping 策略 | 合并置信度阈值 / 渠道优先级 / 是否启用算法合并 | 注入 id-mapping 服务的合并逻辑 |
| 存储 / OLAP | `OLAP_BACKEND`(mysql·doris) / 库前缀 / 数据保留期 | 后端可按租户隔离（executor 已解耦）|
| 隐私 / 合规 | 数据保留天数 / 默认同意态 / 删除 SLA | 关联 [07-privacy](./07-privacy.md) |
| 集成 | `AGENT_LLM_ENABLED` / LLM Key / destinations 凭证 | 关联 [01-connections](./01-connections.md)、NL→DSL |
| 配额 | 事件 QPS 上限 / 日导入行数 / segment 数上限 | 软/硬限额，超限告警或拒绝 |

> 设计取舍：基础 4 字段沿用现有 `tenants` 表；其余配置域统一落到新表 `tenant_config(tenant_id, domain, config JSON)` 或 `tenants` 扩展列，避免频繁改表结构。读取时按 `tenant_id` 合并出一份「有效配置」。

#### 2.5.3 关键流程

1. 管理员进入 **设置 → 租户管理** → 看租户列表。
2. 新建租户 → 填基础信息 + 选 scale 档位 → 系统建 topic、初始化 `one_id_sequence`、写 `tenant_config`。
3. 编辑某租户的「ID-Mapping 策略」Tab → 改置信度阈值 → 保存 → 审计留痕 → id-mapping 服务热加载新配置。
4. 停用租户 → 网关对该 `tenant_id` 的请求返回 403。

#### 2.5.4 真实 vs Mock 边界

- 现状：`tenants` 表已存在（基础 4 字段 + 1003 共享 topic 示例），但**无管理 UI**、**无 `tenant_config`**、配置散落在全局 env（`OLAP_*`/`AGENT_LLM_ENABLED`/scale 脚本）。
- 落地目标：把全局 env 配置「下沉」为每租户配置，并提供管理 UI + 后端 CRUD + 审计。

## 3. 技术设计

### 3.1 前端

| 关注点 | 实现 |
|--------|------|
| 路由 | `App.tsx`（react-router v6，`BASENAME` dev=`/` / prod=`/console`）|
| 导航数据 | `lib/nav.ts`（`HOME` / `SECTIONS` / `FOOTER_SECTION`，类型 `NavSection`/`NavChild`）|
| 骨架 | `Layout` 包 `Sidebar` + `Header` + `<main>`（`max-w-7xl` 容器）|
| 多租户 | `context/TenantContext.tsx`（`useTenant()` 提供 `tenant/setTenant/tenants`）|
| 主题 | `tailwind.config.js` 的 `brand` 调色板（绿）；组件统一用 `brand-*` |
| UI 库 | `components/ui.tsx`：`Card/Badge/Button/DataTable(含 rowLink)/Modal/TextField/Spinner` |
| Segment 套件 | `components/segment/kit.tsx`：`MockTag/StatCards/StatusPill/Catalog/Timeline/EmptyState/SubTabs/Sparkline` |
| API 客户端 | `api/client.ts`（axios，baseURL `/api`，45s 超时）；类型 `api/types.ts` |

### 3.2 后端

- 网关 **Nginx :8080**：`/console/` 托管前端，`/api/*` 反代到 SQL Engine `:8002`。
- 鉴权：**当前无**。Workspace 切换只是前端切 `tenant_id`，无登录、无权限校验。
- 租户管理（规划）：sql-engine 暴露 `GET/POST/PUT /tenants` 与 `GET/PUT /tenants/{id}/config`；写操作需超级管理员权限（落地于 [09-settings](./09-settings.md) IAM）。`tenants` + 新增 `tenant_config` 表经 `scripts/apply_migrations.sh` 迁移（强制 `utf8mb4`）。

### 3.3 真实 vs Mock 边界

- 真实：导航、租户切换、页面骨架、主题、概览计数。
- Mock / 规划：顶栏搜索、头像/登录态、组织级 Workspace（多租户已有，但无「组织/成员」概念）、**租户管理与每租户配置**（§2.5，`tenants` 表已在但无 UI/配置下沉）。

### 3.4 依赖与集成

- 被所有业务模块依赖（页面都用 `Layout` + `ui`/`kit`）。
- 与 [09-settings](./09-settings.md) 的 IAM 强相关（真实鉴权落地在 Settings 模块）。

## 4. TODOs

**P0（让底座可登录、可治理）**
- [ ] [后端] 引入鉴权服务：登录、会话/JWT、`tenant_id` 从令牌解析（取代前端硬切）。
- [ ] [前端] 登录页 + 路由守卫 + 401 拦截（axios 拦截器）。
- [ ] [前端] 顶栏头像接真实用户；Workspace 列表来自后端 `GET /tenants` 而非写死 `[1001,1002]`。
- [ ] [后端] 新增 `tenant_config` 表 + 迁移（§2.5）；`/tenants` CRUD 与 `/tenants/{id}/config` 读写接口。
- [ ] [后端] 配置「下沉」：`OLAP_*` / `AGENT_LLM_ENABLED` / scale 档位等全局 env 改为按 `tenant_id` 读取有效配置。
- [ ] [前端] 设置 → 租户管理页：租户列表 + 新建/编辑 + 各配置域 Tab + 启停 + 变更审计。

**P1（体验与健壮性）**
- [ ] [前端] 全局搜索接 `objects/search` 跨对象（Sources/Audiences/Profiles）。
- [ ] [前端] 错误边界 + 统一 Toast；移动端折叠侧栏（当前 `lg:` 才显示）。
- [ ] [前端] 面包屑 + 页面级 loading skeleton。

**P2（打磨）**
- [ ] [前端] 暗色主题；i18n 抽出中英文案。
- [ ] [前端] `DataTable` 升级：分页、排序、列配置、CSV 导出。
- [ ] [前端] 把 `mock/data.ts` 按模块拆分，便于各模块独立维护。
