import { useEffect, useState } from "react";
import { ExternalLink, CheckCircle2, XCircle, Pause, Play } from "lucide-react";
import { useLang } from "../../context/LangContext";
import { schedulerHealth, pauseScheduler, type SchedulerInfo } from "../../api/connections";

// 调度器（Airflow）状态条：连接状态 + 暂停/恢复调度 + 打开 Airflow。
// 暂停切换的是共享 DAG agenticdatahub_pipeline 的 is_paused —— 所有管道共用一个 DAG，
// 故这是全局调度开关。
export default function SchedulerBanner() {
  const { tr } = useLang();
  const [s, setS] = useState<SchedulerInfo | null>(null);
  const [busy, setBusy] = useState(false);

  function reload() { schedulerHealth().then(setS).catch(() => setS({ reachable: false })); }
  useEffect(reload, []);

  const paused = !!s?.dag?.is_paused;
  async function toggle() {
    setBusy(true);
    try { await pauseScheduler(!paused); reload(); } finally { setBusy(false); }
  }

  if (!s) return null;
  return (
    <div className={`mb-4 flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm ${
      s.reachable ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
      <div className="flex items-center gap-2">
        {s.reachable ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        <span className="font-medium">{tr("调度器 Airflow", "Scheduler · Airflow")}</span>
        <span className="text-xs opacity-80">
          {s.reachable
            ? (paused
                ? tr("已连接 · 调度已暂停", "Connected · paused")
                : tr(`已连接 · scheduler ${s.scheduler ?? "?"} · DAG ${s.dag_id ?? ""}`, `Connected · scheduler ${s.scheduler ?? "?"} · DAG ${s.dag_id ?? ""}`))
            : tr("未连接（运行将本地模拟）", "Not connected (runs fall back to local sim)")}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {s.reachable && (
          <button onClick={toggle} disabled={busy} title={tr("切换共享 DAG 的暂停状态（影响全部管道）", "Toggle the shared DAG (affects all pipelines)")}
            className="inline-flex items-center gap-1 text-xs font-medium hover:underline disabled:opacity-50">
            {paused ? <><Play className="h-3.5 w-3.5" /> {tr("恢复调度", "Resume")}</> : <><Pause className="h-3.5 w-3.5" /> {tr("暂停调度", "Pause")}</>}
          </button>
        )}
        {s.ui_url && (
          <a href={s.ui_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium hover:underline">
            {tr("打开 Airflow", "Open Airflow")} <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}
