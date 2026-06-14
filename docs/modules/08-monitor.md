# 模块 08 · 监控 Monitor

> 状态：全 Mock（可观测蓝图） · 对标 Segment Monitor

## 1. 概述

监控 Monitor 是 CDP 的「可观测性中枢」，对标 Twilio Segment 的 **Monitor**（Delivery Overview / Sources Debugger / Alerts / Event Logs）。它回答三个问题：**数据进来了吗？（吞吐）**、**进得健康吗？（成功率/时延/数据源健康）**、**出问题谁知道？（告警 + 逐事件投递日志）**。

当前实现为 **100% 前端 Mock**：三个页面用 `mock/data.ts` 的静态数据 + `components/segment/kit.tsx` 的 `Sparkline`/`StatCards` 渲染，右上角统一带「Mock 数据」角标。但底层链路里**已经存在两类真实信号**，可作为「接真」的起点：

- **id-mapping 合并日志** `GET /merge-log/{tenant}`：真实的 OneID 合并事件流，天然是一条「事件日志 / 吞吐」雏形。
- **入库路径** `POST /events/process`、`POST /etl/import`：所有事件/批量数据的真实入口，是埋「吞吐 / 成功率 / 时延」采集点的最佳位置。

本模块的目标是把 Mock 的指标卡与表格逐步替换为「采集中间件 → 聚合存储 → 查询端点 → 告警引擎」的真实链路。

## 2. 详细设计（产品）

### 2.1 子功能清单

| 功能 | 英文 | 状态 | 说明 |
|------|------|------|------|
| 投递概览 | Delivery Overview | Mock | 近24h事件量、成功率、失败数、P95 时延、事件量趋势图 |
| 数据源健康 | Sources Health | Mock | 各数据源近24h事件、错误率、健康状态 |
| 告警规则 | Alerts | Mock | 阈值规则列表（成功率/事件量/违规），通知渠道与触发状态 |
| 新建告警 | Create Alert | Mock | 按钮存在，无表单/无后端 |
| 事件投递日志 | Event Logs | Mock | 逐事件追踪：数据源 → 目的地，状态 + HTTP code |
| 指标采集 | Metrics Collection | 待建 | 入库路径打点（吞吐/成功率/时延） |
| 告警引擎 | Alert Engine | 待建 | 规则评估 + 通知下发（邮件/飞书） |

### 2.2 信息架构与页面

| 路由 | 页面文件 | 说明 | 状态 |
|------|----------|------|------|
| `/monitor` | `frontend/src/pages/segment/DeliveryPage.tsx` | 投递概览：吞吐/成功率/P95/趋势 + 数据源健康表 | Mock |
| `/monitor/alerts` | `frontend/src/pages/segment/AlertsPage.tsx` | 告警规则列表 + 统计卡 + 新建按钮 | Mock |
| `/monitor/logs` | `frontend/src/pages/segment/EventLogsPage.tsx` | 事件投递日志表（数据源→目的地） | Mock |

路由注册见 `frontend/src/App.tsx`，导航见 `frontend/src/lib/nav.ts`。

### 2.3 关键用户流程

> 运维/数据工程师排障主线：**看投递概览 → 下钻数据源健康 → 配告警 → 查事件投递日志**

1. **看投递概览**：进入 `/monitor`，先看四张指标卡（近24h事件 / 成功率 / 失败 / P95 时延）与事件量趋势 Sparkline，建立整体健康直觉。
2. **下钻数据源健康**：发现成功率掉了，往下看「数据源健康」表，定位是哪个 `source` 错误率飙升、状态异常。
3. **配告警**：为避免下次靠人盯，去 `/monitor/alerts` 新建规则（如「成功率 < 95% 持续 5min」），绑定通知渠道（邮件/飞书）与范围（某数据源/全局）。
4. **查事件投递日志**：告警触发后回到 `/monitor/logs`，按数据源/目的地/状态/HTTP code 逐条排查失败事件，定位具体目的地（Destination）投递失败原因。

### 2.4 数据模型

> 标 `待建` 为需要新增的指标/表；同时指出**已有可用信号**作为接真起点。

**建议指标（时序，按 tenant + source + 时间桶聚合）**

| 指标 | 字段 | 说明 | 状态 | 已有信号 |
|------|------|------|------|----------|
| 事件吞吐 | `events_total` | 单位时间事件计数 | 待建 | `POST /events/process`、`POST /etl/import` 调用计数；`merge-log` 行数 |
| 成功/失败 | `success_total` / `failed_total` | 成功率 = success/total | 待建 | 入库路径返回码打点 |
| 处理时延 | `latency_ms_p50/p95/p99` | 入库/投递耗时分布 | 待建 | 入库路径耗时打点 |
| 数据源错误率 | `error_rate` | 按 source 维度 | 待建 | 同上，按 source 分组 |

**建议表（聚合存储）**

| 表 | 关键列 | 说明 | 状态 |
|----|--------|------|------|
| `monitor_metrics` | `tenant_id, source, bucket_ts, events, success, failed, p95_ms` | 分钟/小时桶聚合表（替代真时序库的轻量方案） | 待建 |
| `monitor_alert_rule` | `id, tenant_id, name, metric, op, threshold, window, scope, channel, severity, enabled` | 告警规则 | 待建 |
| `monitor_alert_event` | `id, rule_id, fired_at, value, status` | 告警触发记录（驱动「最近触发」） | 待建 |
| `event_delivery_log` | `ts, tenant_id, source, event, dest, status, http_code` | 逐事件投递日志 | 待建（雏形：`merge_log`） |

**Mock 字段对照（`frontend/src/mock/data.ts`）**：`deliveryMetrics`(events24h/successRate/failed24h/p95LatencyMs/series[])、`sourcesHealth`(source/events24h/errorRate/status)、`alerts`(name/channel/scope/status/severity/last)、`eventLogs`(time/source/event/dest/status/code) —— 每个字段对应上表一列，接真时一一替换。

## 3. 技术设计

### 3.1 前端

- **现有 Mock 页**：三个页面均为纯展示组件，从 `mock/data.ts` 读取静态对象，无状态管理、无请求。
- **复用 kit**：`StatCards`（指标卡）、`Sparkline`（趋势图）、`MockTag`（角标）来自 `components/segment/kit.tsx`；表格用 `components/ui` 的 `DataTable`，布局用 `Layout`。
- **接真改造**：引入数据请求层（与其余真实页一致走 `/api/*`），把 `deliveryMetrics`/`sourcesHealth`/`alerts`/`eventLogs` 替换为对应端点返回；趋势图 `series[]` 直接喂给 `Sparkline`。Alerts 页补「新建/编辑」表单（当前仅有按钮）。摘掉 `MockTag` 作为接真完成标志。

### 3.2 后端

> 当前无 Monitor 后端服务；以下均 `待建`，可在现有 `services/` 内扩展。

- **指标采集中间件（待建）**：在入库路径 `POST /events/process`、`POST /etl/import`（及 id-mapping 合并）包一层埋点，记录 `tenant/source/成功失败/耗时`，写入聚合缓冲。**可复用 `merge_log`** 作为现成事件流先把日志/吞吐跑通。
- **聚合存储（待建）**：定时（分钟桶）把缓冲落到 `monitor_metrics`；不引入独立时序库，用 MySQL 聚合表 + 索引即可满足近24h/趋势查询。
- **告警引擎（待建）**：周期评估 `monitor_alert_rule`，命中写 `monitor_alert_event` 并经**通知渠道（邮件/飞书 webhook）**下发。
- **建议端点（待建）**：

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/monitor/metrics` | 投递概览：吞吐/成功率/P95/`series[]` |
| GET | `/monitor/sources` | 数据源健康列表 |
| GET/POST/PUT/DELETE | `/monitor/alerts` | 告警规则 CRUD |
| GET | `/monitor/logs` | 事件投递日志（分页 + 按 source/dest/status 过滤） |

均按 `tenant_id` 隔离，与全局约定一致。

### 3.3 真实 vs Mock 边界

| 区块 | 现状 | 已有真实信号 | 接真路径 |
|------|------|--------------|----------|
| 投递概览指标 | Mock | 入库路径调用可统计 | 采集中间件 → `monitor_metrics` → `GET /monitor/metrics` |
| 趋势图 series | Mock | 同上（按桶） | 聚合表按时间桶查询 |
| 数据源健康 | Mock | 按 source 分组打点 | `GET /monitor/sources` |
| 告警 | Mock（含按钮无表单） | 无 | 规则表 + 引擎 + 通知渠道 |
| 事件日志 | Mock | **`GET /merge-log/{tenant}` 真实** | 先映射 merge_log，再扩展 `event_delivery_log` |

### 3.4 依赖与集成

- **埋点采集点**：`POST /etl/import`（批量导入）、`POST /events/process`（单事件入库）—— 在此统计吞吐/成功率/时延；id-mapping `GET /merge-log/{tenant}` 作为现成事件流。
- **日志与 Destinations 关联**：事件投递日志的 `dest` + `status` + `http_code` 依赖 **01-Connections 的 Destinations** 投递结果；需在投递侧回写每事件到目的地的状态，Monitor 仅做读侧聚合与展示。
- **多租户**：所有指标/日志/规则按 `tenant_id` 隔离，前端顶栏 Workspace 切换（1001/1002）。

## 4. TODOs

**P0（先把日志/吞吐用真实信号跑通）**

- [后端] 新增 `GET /monitor/logs`，先直接映射 id-mapping `GET /merge-log/{tenant}` 作为事件日志雏形。
- [数据] 在 `POST /events/process` / `POST /etl/import` 加埋点，记录 tenant/source/成功失败/耗时。
- [前端] `EventLogsPage` 改读 `/monitor/logs`，摘掉 `MockTag`。

**P1（指标聚合 + 概览接真）**

- [数据] 建 `monitor_metrics` 聚合表 + 分钟桶聚合任务。
- [后端] 实现 `GET /monitor/metrics`、`GET /monitor/sources`。
- [前端] `DeliveryPage` 接真（指标卡 + `Sparkline` series + 数据源健康表）。

**P2（告警闭环）**

- [数据] 建 `monitor_alert_rule` / `monitor_alert_event` 表。
- [后端] 告警规则 CRUD + 评估引擎 + 通知渠道（邮件/飞书）。
- [前端] `AlertsPage` 补「新建/编辑告警」表单，展示真实触发记录。
- [后端] 与 01-Connections Destinations 集成，回写每事件→目的地投递状态到 `event_delivery_log`。
