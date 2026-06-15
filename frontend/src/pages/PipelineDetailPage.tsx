import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Play, ExternalLink } from "lucide-react";
import Layout from "../components/layout/Layout";
import { Card, Button, Spinner, DataTable } from "../components/ui";
import { StatCards, StatusPill } from "../components/segment/kit";
import SchedulerBanner from "../components/scheduler/SchedulerBanner";
import { useTenant } from "../context/TenantContext";
import { useLang } from "../context/LangContext";
import {
  getPipeline, executePipeline, pipelineRuns,
  type PipelineDetail, type PipelineRun,
} from "../api/connections";

function tone(s: string) {
  if (s === "active" || s === "running") return "green" as const;
  if (s === "draft") return "gray" as const;
  return "amber" as const;
}

function runTone(s: string | null) {
  if (s === "success") return "green" as const;
  if (s === "failed") return "red" as const;
  if (s === "running" || s === "queued") return "amber" as const;
  return "gray" as const;
}

export default function PipelineDetailPage() {
  const { id = "" } = useParams();
  const { tenant } = useTenant();
  const { tr } = useLang();
  const [p, setP] = useState<PipelineDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState<string | null>(null);
  const [runUrl, setRunUrl] = useState<string | null>(null);
  const [runs, setRuns] = useState<PipelineRun[] | null>(null);

  function loadRuns() { pipelineRuns(id).then(setRuns).catch(() => setRuns([])); }
  function load() {
    setP(null); setErr(null);
    getPipeline(tenant, id).then(setP).catch((e) => setErr(e?.response?.data?.detail || String(e)));
    loadRuns();
  }
  useEffect(load, [tenant, id]);

  async function run() {
    setRunning(true); setRunMsg(null); setRunUrl(null);
    try {
      const r = await executePipeline(tenant, id);
      const dr = r.scheduler?.dag_run;
      setRunMsg(dr
        ? tr(`已触发 Airflow · ${dr.dag_run_id} · ${dr.state ?? ""}`, `Triggered on Airflow · ${dr.dag_run_id} · ${dr.state ?? ""}`)
        : (r.scheduler && !r.scheduler.reachable
            ? tr("调度器不可达（本地模拟）", "Scheduler unreachable (local sim)")
            : `${r.status}`));
      if (r.scheduler?.ui_url) setRunUrl(r.scheduler.ui_url);
      load();
      // 运行后延迟再拉一次，捕捉状态从 queued→running→success 的变化
      setTimeout(loadRuns, 4000);
    } catch (e: any) {
      setRunMsg(e?.response?.data?.detail || String(e));
    } finally { setRunning(false); }
  }

  const NCOL = { id: tr("节点", "Node"), label: tr("名称", "Label"), kind: tr("类别", "Kind") };
  const ECOL = { from: tr("源", "From"), to: tr("目标", "To") };
  const RCOL = { run: tr("运行 ID", "Run ID"), state: tr("状态", "State"), start: tr("开始", "Start"), end: tr("结束", "End") };

  return (
    <Layout
      title={p ? p.pipeline_name : tr("管道详情", "Pipeline")}
      subtitle={tr("管道拓扑与运行 —— 在 Airflow 上执行并查看状态", "Pipeline topology and runs — execute on Airflow and track status")}
      actions={
        <>
          <Link to="/connections/pipelines"><Button variant="outline"><ArrowLeft className="h-4 w-4" /> {tr("返回列表", "Back")}</Button></Link>
          <Button onClick={run} disabled={running || !p}><Play className="h-4 w-4" /> {running ? tr("执行中…", "Running…") : tr("执行", "Run")}</Button>
        </>
      }
    >
      <SchedulerBanner />

      {err && <Card className="mb-4 p-5 text-sm text-red-600">{err}</Card>}
      {!p && !err && <div className="flex items-center gap-2 text-gray-500"><Spinner /> {tr("加载中…", "Loading…")}</div>}

      {p && (
        <>
          <div className="mb-4 flex items-center gap-3">
            <StatusPill tone={tone(p.status)}>{p.status}</StatusPill>
            <span className="text-xs text-gray-400">{p.pipeline_id}</span>
          </div>

          {runMsg && (
            <div className="mb-4 rounded-lg bg-brand-50 px-4 py-2 text-sm text-brand-700">
              {runMsg}{" "}
              {runUrl && <a href={runUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium hover:underline">{tr("查看运行", "View run")} <ExternalLink className="h-3.5 w-3.5" /></a>}
            </div>
          )}

          <StatCards items={[
            { label: tr("节点数", "Nodes"), value: p.nodes?.length ?? 0 },
            { label: tr("连线数", "Edges"), value: p.edges?.length ?? 0 },
            { label: tr("执行次数", "Runs"), value: p.execution_count ?? 0 },
            { label: tr("最近执行", "Last run"), value: p.last_executed_time || "—" },
          ]} />

          <div className="mb-2 mt-6 text-sm font-semibold text-gray-700">{tr("节点", "Nodes")}</div>
          <Card className="mb-6 p-2">
            <DataTable
              columns={[NCOL.id, NCOL.label, NCOL.kind]}
              rows={(p.nodes ?? []).map((n: any) => ({
                [NCOL.id]: n.id ?? "—",
                [NCOL.label]: n.label ?? n.type ?? "—",
                [NCOL.kind]: n.kind ?? "—",
              }))}
            />
          </Card>

          <div className="mb-2 text-sm font-semibold text-gray-700">{tr("连线", "Edges")}</div>
          <Card className="mb-6 p-2">
            <DataTable
              columns={[ECOL.from, ECOL.to]}
              rows={(p.edges ?? []).map((e: any) => ({
                [ECOL.from]: e.source ?? "—",
                [ECOL.to]: e.target ?? "—",
              }))}
            />
          </Card>

          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
            {tr("执行历史", "Run History")}
            <button onClick={loadRuns} className="text-xs font-normal text-brand-600 hover:underline">{tr("刷新", "Refresh")}</button>
          </div>
          <Card className="p-2">
            {!runs ? (
              <div className="flex items-center gap-2 px-4 py-6 text-sm text-gray-500"><Spinner /> {tr("加载中…", "Loading…")}</div>
            ) : (
              <DataTable
                columns={[RCOL.run, RCOL.state, RCOL.start, RCOL.end]}
                rows={runs.map((r) => ({
                  [RCOL.run]: <span className="font-mono text-xs text-gray-600">{r.dag_run_id}</span>,
                  [RCOL.state]: <StatusPill tone={runTone(r.state)}>{r.state ?? "—"}</StatusPill>,
                  [RCOL.start]: <span className="text-gray-500">{r.start_date ? r.start_date.replace("T", " ").slice(0, 19) : "—"}</span>,
                  [RCOL.end]: <span className="text-gray-500">{r.end_date ? r.end_date.replace("T", " ").slice(0, 19) : "—"}</span>,
                }))}
              />
            )}
          </Card>
        </>
      )}
    </Layout>
  );
}
