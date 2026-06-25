# Quasar 待办总览（TODO Board）

> 由各模块文档 `## 4. TODOs` 汇总而成（截至 2026-06-25）。以各模块文档为准，本页只做跨模块聚合与排序。
> 标记：`[ ]` 待办 · `[~]` 部分完成 · `[x]` 已完成（仅保留有后续的）。标签 `[前端]/[后端]/[数据]`。

## 三条主线（贯穿多模块）

1. **前端接真**：几乎每个模块前端仍读 `mock/data.ts` + `MockTag`，后端 API 已就绪，需逐页切真。涉及 01/03/04/05/06/07/08/09。
2. **真实执行引擎**（消除「模拟边界」）：调度器、投递引擎、旅程状态机、群发外呼、反向同步搬运、数仓/函数运行时。涉及 01/04/05/08。
3. **入库前钩子统一**：Tracking Plan 校验 + PII 哈希/阻断 + 抑制名单校验，统一挂到 `etl.py::run_import` 与 `id-mapping /events/process`（OneID 合并前）。涉及 06/07。

---

## P0（优先）

### 前端接真
- [ ] [前端] 01 `ConnectionsPage` 接 `GET /connections/sources` 真实列表（替换写死 `SOURCES`）
- [ ] [前端] 01 EtlPage 暴露 `link`（建关系）配置 UI（后端已支持）
- [ ] [前端] 03 对象详情页：单对象主数据 + 关联对象面板（订单→商品行），接 P0 端点
- [ ] [前端] 04 账户详情页 `StatCards` 接真实聚合指标
- [ ] [前端] 05 `JourneysPage`/`BroadcastsPage` 接 `/api/engage/*`，去 `mock/data.ts` 与 `MockTag`
- [ ] [前端] 05 `AudienceDetailPage` 按 `:id` 读真实受众，去 `audienceSample`
- [ ] [前端] 06 `/protocols`、`/protocols/violations` 接真实 API，移除 `MockTag`
- [ ] [前端] 07 `DeletionPage`「新建删除请求」接 POST；列表切 `/api/privacy/deletion`，摘 `MockTag`
- [ ] [前端] 08 `DeliveryPage` / `EventLogsPage` / `AlertsPage` 接 `/monitor/*`，摘 `MockTag`
- [ ] [前端] 09 General/Access 接 `/api/tenants`、`/api/iam/*`，去 `MockTag`，带 `tenant_id`

### 后端 / 数据
- [ ] [后端] 01 `mysql` 数据源适配器：连接配置 + 表/SQL 抽取 → 复用 `EtlService`
- [ ] [前后端] 01 编排画布接 `/connections/pipelines` 保存/读取 + 节点配置抽屉 + 单源单目的真实执行
- [ ] [数据] 01 对象表补主键/唯一约束 + 导入幂等校验，保证 upsert 可预期
- [ ] [后端] 04 账户聚合指标自动计算管道（基于 `owns`/`purchased` 回填，替手动 upsert）
- [ ] [后端] 05 受众规模快照定时写入 + `GET /engage/.../size-trend`
- [ ] [后端] 05 受众详情成员明细（复用 `searchObjects`/`groups/{id}/members`，分页返回命中 `one_id`）
- [ ] [后端] 06 校验抽成入库前钩子，接入 `etl.py::run_import`（现仅显式 `/validate`）
- [~] [后端] 07 删除执行器：改走 id-mapping 服务接口/同事务、写 `merge_log` 留痕、匿名化 `object_user`
- [~] [后端] 07 抑制校验 `/privacy/suppression/check` 挂到 `/etl/import` 与 `/events/process` 入口
- [x] [后端] 09 API Token：在网关/中间件校验 scopes（剩余项，依赖登录态）→ 部分已随 CDP Key 落地，需核对

---

## P1

### 接真 / 编辑能力
- [ ] [前端] 04 账户画像页 + 按账户圈选受众 + 账户层级树展示/编辑
- [ ] [前端][后端] 05 受众「连接的目的地」接真（写 `segment_destinations` + 详情读取）
- [ ] [前端] 06 计划/事件/转换的新建与编辑表单；`/protocols/transformations` 接 API + 启停切换
- [ ] [前端] 07 `DataControlsPage` 可编辑 + `ConsentPage` 分类/厂商映射可配 + 数据源切 API
- [ ] [前端] 09 邀请成员/生成令牌弹窗（明文仅展示一次 + 复制）；审计页接 `/api/iam/audit` + 筛选分页
- [ ] [前端] 09 抽出共享 `TABS`/SubTabs，消除四页重复
- [ ] [前端] 01 SourceDetail/Destinations/ReverseEtl 接真实 `/connections/*`（现占位 `to:"#"`）

### 执行引擎 / 管道
- [ ] [后端] 01 Destinations 投递引擎：真实外连投递 + 写 `connections_delivery_logs`
- [ ] [后端] 01 Reverse-ETL 调度器：cron + 真实反向搬运（现 run-now 仅记 `pending`）
- [ ] [后端] 05 受众定时增量重算（调度器周期重跑 `estimate` 回写 + 落快照）
- [ ] [后端] 06 转换入库执行：按规则改写 payload（`rename`/`delete`/`mapping`）+ `/{id}/run` 调试
- [ ] [后端] 06 校验+转换钩子接入 `id-mapping /events/process` 与 `/users/import`
- [ ] [后端] 06 入库前按 `source` 自动定位绑定计划
- [ ] [数据] 08 `/events/process` / `/etl/import` 加埋点中间件，自动写 `monitor/metrics` + `delivery-logs`
- [ ] [后端] 09 邀请流程邮件发送/链接分发（剩余项）；团队按团队授资源范围（剩余项）

### 对象建模 / 知识 / 应用 / 分析
- [ ] [后端] 03 `OBJECT_REGISTRY`/`RELATION_MATRIX` 启动期/缓存级注入，让自建对象全链路自动可见
- [ ] [前端] 03 新建对象向导 + 字段管理 + 关系建模页；字段/列配置（展示列/排序/筛选保存）
- [ ] [后端][数据] 10 知识库文件夹树（`parent_id` 层级）+ 移动/重命名
- [ ] [后端] 11 应用连接配置表单 + 凭证管理（OAuth/API Key，加密存 `config`）
- [ ] [后端] 11 应用对接真实 Destination/Reverse-ETL：字段映射 + 回传/同步任务
- [ ] [后端][数据] 12 时间序列/趋势源（按 `create_time` 分桶）→ 真实 line/area
- [ ] [后端] 12 更多维度 + 跨对象指标（线索→订单→支付真实 funnel）

---

## P2

### 执行闭环
- [ ] [后端] 01 Warehouse 连接器：真实数仓连接 + 落库同步（现 sync 仅置 `healthy`）
- [ ] [后端] 01 Functions 运行时：代码沙箱执行 + 写 `connections_function_runs`
- [ ] [后端] 01 `kafka`/`api` 适配器：流式消费/定时拉取接入 `EtlService`
- [ ] [后端] 04 账户合并真实主数据迁移/去重（现仅审计记录）
- [ ] [后端] 05 旅程编排引擎（事件驱动状态机，推进 `journey_state`）
- [ ] [后端] 05 群发发送引擎：对接 Destinations 真实 Push/SMS/EDM + 逐条写 `broadcast_sends`
- [ ] [后端] 08 告警评估周期调度器 + 通知渠道下发（邮件/飞书 webhook）
- [ ] [后端] 08 与 Destinations 集成，回写每事件→目的地真实投递状态

### 治理 / 体验
- [ ] [后端] 06 校验策略可配（告警放行/阻断）+ 事件 schema 审批流（草稿→已批准）
- [ ] [数据] 06 违规趋势与合规率随时间统计，联动监控
- [ ] [前端] 06 违规详情下钻 + 按来源/级别过滤 + 一键生成修复转换
- [ ] [后端] 06/07 共享转换执行层，统一 PII 删除/哈希逻辑
- [ ] [后端] 07 审计回执上报 08-monitor；删除请求异步化（队列 + 进度回写）
- [ ] [前端] 07 删除请求详情页（受影响表/条数/回执）+ 导出合规报告
- [ ] [数据] 07 PII 扫描结果落库 + 定时重扫 + 规则版本化
- [ ] [后端] 09 细粒度 RBAC（scope 按模块×动作）+ 统一鉴权装饰器；令牌轮换/过期 + `api_token_usage` 埋点
- [ ] [前端] 09 审计日志 CSV 导出；列表分页排序；SSO/SCIM 占位入口

### 检索 / 大文件 / 看板
- [ ] [前端] 03 对象级全文搜索 + 结果导出 CSV；[后端] 大结果集分页/排序（limit≤1000）
- [ ] [前端] 01 ETL 大文件分片/进度 + 失败行重试；`DataTable` 预览分页
- [ ] [后端] 10 缩略图/预览生成 + 秒传去重；接对象存储（S3/MinIO/OSS）+ 分片上传
- [ ] [后端][数据] 10 文档向量化 + 检索，作为智能助手 RAG 知识源
- [ ] [前端] 10 对象记录详情页内嵌「关联资料」区
- [ ] [后端] 11 应用连接健康检查 + 同步状态 + 错误告警（接监控）
- [ ] [前端] 11 应用详情页（用量/映射/日志）+ 分类搜索增强
- [ ] [前端] 12 看板拖拽布局 + 定时刷新 + 分享导出（PNG/PDF）
- [ ] [后端] 12 NL 生成支持过滤条件（带 where）+ 图表缓存
