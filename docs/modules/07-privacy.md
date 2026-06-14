# 模块 07 · 隐私 Privacy

> 状态：**全 Mock（合规蓝图）** · 对标 Segment Privacy

## 1. 概述

隐私模块是 CDP 的「合规中枢」，对标 Twilio Segment 的 Privacy。它解决三件事：**PII / 敏感字段的检测与管控**（哈希/阻断/明文）、**同意（Consent）的采集与厂商映射**（控制数据可流向哪些目的地）、**数据主体的删除与抑制请求**（GDPR/CCPA 的 Right to Erasure + Suppression）。

当前三页全部为前端 Mock，仅展示静态表格与统计卡片，无任何后端、无持久化、无执行逻辑。本文给出从 Mock 到「真实可合规」的落地路径。关键约束：**删除/抑制必须跨模块联动**——身份与画像表（`id_mapping`、`doris_user_wide`、`object_*`、`merge_log`）由 [02-unify](./02-unify.md) 的 id-mapping 服务拥有，隐私模块不直接持有这些表的写权限，删除执行器须经其接口或协同事务完成。

## 2. 详细设计（产品）

### 2.1 子功能清单

| 功能 | 英文 | 状态 | 说明 |
|------|------|------|------|
| PII 字段管控 | Data Controls | Mock | 列出受管字段，按字段配置处理动作（哈希/阻断/明文）与生效范围 |
| PII 自动检测 | PII Detection | Mock | 扫描对象/属性，标记疑似 PII（自动 vs 手动） |
| 同意分类 | Consent Categories | Mock | 维护同意分类、是否必选、同意率、厂商数 |
| 厂商映射 | Vendor Mapping | Mock | 把同意分类映射到下游目的地厂商，控制数据流向 |
| 同意采集/查询 | Consent Collection | Mock | 记录每个主体对各分类的授权状态（待建 API） |
| 删除请求 | Deletion / Erasure | Mock | 受理 GDPR 删除请求，跟踪主体处理进度 |
| 抑制请求 | Suppression | Mock | 标记主体进入抑制名单，阻止后续采集与流出 |
| 合规审计 | Audit Trail | 待建 | 记录每次删除/抑制的执行明细与回执 |

### 2.2 信息架构与页面

| 路由 | 页面文件 | 说明 | 状态 |
|------|----------|------|------|
| `/privacy` | `pages/segment/DataControlsPage.tsx` | 数据管控：PII 字段表 + 受管/检测/阻断/明文统计卡 | Mock |
| `/privacy/consent` | `pages/segment/ConsentPage.tsx` | 同意管理：分类表（是否必选/同意率/厂商数）+ 统计卡 | Mock |
| `/privacy/deletion` | `pages/segment/DeletionPage.tsx` | 删除与抑制：请求表（ID/主体/类型/时间/状态）+「新建删除请求」按钮（未接） | Mock |

- 三页均用 `Layout` + `components/ui` 的 `DataTable`/`Card` + `components/segment/kit` 的 `StatCards`/`MockTag`。
- Mock 数据来自 `frontend/src/mock/data.ts`：`piiFields`、`consentCategories`、`deletionRequests`。

### 2.3 关键用户流程

**流程 A · PII 检测 → 标记动作**
1. 运营进入 `/privacy`，触发/查看 PII 扫描结果（扫 `object_*` 的字段与事件 `properties`）。
2. 系统按规则库标记疑似字段，给出「检测方式 = 自动/手动」与建议类别（邮箱/手机/身份证…）。
3. 运营对每个字段选处理动作：**哈希**（落库前不可逆摘要）/ **阻断**（直接丢弃，不入库）/ **明文**（放行）。
4. 配置 `scope`（生效范围：全部来源 / 指定 Source / 指定对象），保存为规则，后续入库管线据此生效。

**流程 B · 同意采集 → 映射厂商**
1. 管理员定义同意分类（如「广告投放」「个性化推荐」），标注是否必选。
2. 把分类映射到下游厂商/目的地（决定数据能流向谁）。
3. 端侧/服务端通过同意采集 API 写入每个主体的授权状态（granted/withdrawn + 时间戳）。
4. 数据流出（Engage / 目的地同步）前校验：主体对目标厂商所属分类是否授权，未授权则拦截。

**流程 C · 删除/抑制请求 → 执行 → 审计**
1. 收到数据主体请求（API 或人工）→ 创建 `deletion_requests` 记录（type=删除/抑制，status=待处理）。
2. 执行器解析主体标识 → 经 id-mapping 解析 OneID → 收集关联身份。
3. **删除**：删/匿名化 `id_mapping`、`doris_user_wide`、`object_*` 的相关行，记录 `merge_log` 影响；**抑制**：写入 `suppression_list`。
4. 写抑制名单（防止后续重新采集复活），更新请求 status=已完成，落审计回执（操作人/范围/条数/时间）。

### 2.4 数据模型

> 隐私模块自身**无任何已建表**，以下均为**待建**；删除/抑制需覆盖的身份画像表为**现有表**（归属 id-mapping）。

**建议待建表**

| 表 | 关键字段 | 用途 | 状态 |
|----|----------|------|------|
| `pii_rules` | field, category, action(哈希/阻断/明文), scope | PII 管控规则 | 待建 |
| `consent_categories` | category, required, vendors, description | 同意分类定义 | 待建 |
| `consent_records` | subject, category, granted(bool), ts | 主体级同意记录 | 待建 |
| `deletion_requests` | id, subject, type(删除/抑制), status, ts | 删除/抑制工单 | 待建 |
| `suppression_list` | identifier, reason, ts | 抑制名单（入库/流出校验） | 待建 |

**涉及的现有身份/画像表（归属 id-mapping，删除/抑制须覆盖）**

| 表 | 说明 | 删除时动作 |
|----|------|-----------|
| `id_mapping` | OneID ↔ 各身份标识映射 | 删除/匿名化对应主体行 |
| `doris_user_wide` | 用户宽表/画像 | 删除对应 OneID 行 |
| `object_*` | 多对象明细（用户/订单等） | 删除/脱敏关联记录 |
| `merge_log` | 身份合并日志 | 记录删除影响、保留审计链 |

## 3. 技术设计

### 3.1 前端（现有 Mock 页）

| 关注点 | 实现 |
|--------|------|
| 数据管控 | `DataControlsPage.tsx`：读 `piiFields`，`StatCards`（受管/自动检测/阻断/明文计数）+ `DataTable`（字段/类别/检测方式/处理动作/范围）|
| 同意管理 | `ConsentPage.tsx`：读 `consentCategories`，`StatCards`（分类数/必选/厂商总数/可选）+ `DataTable`（分类/是否必选/同意率/厂商数）|
| 删除与抑制 | `DeletionPage.tsx`：读 `deletionRequests`，`StatCards`（总数/处理中/已完成）+ `DataTable`（ID/主体/类型/时间/状态）+ 「新建删除请求」按钮（**当前无 onClick**）|
| Mock 数据 | `frontend/src/mock/data.ts`：`piiFields` / `consentCategories` / `deletionRequests` |
| 标注 | 三页 `actions` 均挂 `MockTag` |

### 3.2 后端（建议服务/端点/表，全待建）

> 建议落在 `services/sql-engine/privacy.py`（新模块），表建于 MySQL `:3308`，删除执行器调用 id-mapping `:8001`。

| 端点 | 方法 | 用途 | 状态 |
|------|------|------|------|
| `/privacy/pii/scan` | POST | 扫描 `object_*`/`properties`，返回疑似 PII 字段 | 待建 |
| `/privacy/pii/rules` | GET/POST/PUT/DELETE | PII 规则 CRUD（写 `pii_rules`）| 待建 |
| `/privacy/consent/categories` | GET/POST/PUT | 同意分类 + 厂商映射 | 待建 |
| `/privacy/consent` | POST/GET | 同意采集/查询（写/读 `consent_records`）| 待建 |
| `/privacy/deletion` | GET/POST | 删除/抑制请求 CRUD（写 `deletion_requests`）| 待建 |
| `/privacy/deletion/{id}/execute` | POST | **执行器**：删身份+画像+对象 → 写抑制名单 → 落审计 | 待建 |
| `/privacy/suppression/check` | GET | 抑制名单校验（供 ETL/事件入库调用）| 待建 |

### 3.3 真实 vs Mock 边界

- **当前真实**：无。三页仅渲染静态 Mock，无网络请求、无写操作。
- **Mock**：PII 检测结果、处理动作、同意率、删除请求状态全为写死数据；「新建删除请求」按钮无行为。
- **接真路径**：先建 5 张表 → 三页 `DataTable` 数据源由 `mock/data.ts` 切到 `/api/privacy/*` → 实现执行器与抑制校验钩子 → 摘掉 `MockTag`。
- **合规要点**：删除须**真删或不可逆匿名化**（非软删标记）；抑制名单须在「采集入口」和「流出出口」双侧生效，否则删除后会被重新采集复活。

### 3.4 依赖与集成

- **id-mapping（02-unify，强依赖）**：删除执行器不直接写身份表，须经 id-mapping 解析 OneID 并协同删除 `id_mapping`/`doris_user_wide`/`object_*`，在 `merge_log` 留痕。建议提供 `id-mapping :8001` 的 `erase(one_id)` 接口或同事务删除。
- **ETL / 事件入库（01-connections）**：`suppression_list` 校验须挂在 **`/etl/import`** 与 **`/events/process`** 入口——命中抑制名单的 identifier 直接丢弃，不入任何对象表。
- **PII 管控（入库管线）**：`pii_rules` 的哈希/阻断/明文动作须在入库前置环节执行（同样挂在 ETL/事件处理路径）。
- **Engage / 目的地（05-engage）**：数据流出前按 `consent_records` 做厂商级同意校验，未授权拦截。
- **审计/监控（08-monitor）**：删除/抑制执行回执与异常应上报监控，形成合规可追溯链。

## 4. TODOs

**P0（让合规可执行 —— 删除与抑制闭环）**
- [ ] [数据] 建 `deletion_requests` + `suppression_list` 两表（MySQL `:3308`）。
- [ ] [后端] 新建 `services/sql-engine/privacy.py`：删除/抑制请求 CRUD + 执行器骨架。
- [ ] [后端] 删除执行器联动 id-mapping：解析 OneID → 删 `id_mapping`/`doris_user_wide`/`object_*` → 写 `merge_log` → 写抑制名单。
- [ ] [后端] 抑制校验 `/privacy/suppression/check` 挂到 `/etl/import` 与 `/events/process` 入口。
- [ ] [前端] `DeletionPage` 的「新建删除请求」接 POST；列表数据源切 `/api/privacy/deletion`，摘 `MockTag`。

**P1（PII 管控与同意接真）**
- [ ] [数据] 建 `pii_rules` / `consent_categories` / `consent_records`。
- [ ] [后端] PII 规则 CRUD + 扫描端点（扫 `object_*`/`properties`）；哈希/阻断/明文动作挂入库前置。
- [ ] [后端] 同意采集/查询 API；目的地流出前的厂商级同意校验。
- [ ] [前端] `DataControlsPage` 改可编辑（按字段改动作/范围）；`ConsentPage` 分类+厂商映射可配置；数据源切 API。

**P2（打磨与可追溯）**
- [ ] [后端] 删除/抑制执行落**审计回执**（操作人/范围/条数/时间），上报 08-monitor。
- [ ] [后端] 删除请求异步化（队列 + 进度回写 status），支持大主体批量。
- [ ] [前端] 删除请求详情页：展示受影响表/条数/回执；导出合规报告。
- [ ] [数据] PII 扫描结果落库 + 定时重扫；规则版本化。
