import { useEffect, useState } from "react";
import { Radio, RefreshCw } from "lucide-react";
import { getInfraStats, type InfraStats } from "../../api/platform";
import { useTenant } from "../../context/TenantContext";
import { useLang } from "../../context/LangContext";

const POLL_MS = 8000;

export default function QueuePanel() {
  const { tr } = useLang();
  const { tenant } = useTenant();
  const [stats, setStats] = useState<InfraStats | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try { setStats(await getInfraStats(tenant)); } catch { /* ignore */ }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); const t = setInterval(load, POLL_MS); return () => clearInterval(t); }, [tenant]);

  const topics = stats?.kafka_topic_names ?? null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Radio className="h-4 w-4 text-amber-600" />
        <div className="flex-1 text-[11px] text-gray-400">{tr("Kafka 多租户事件 Topic", "Kafka multi-tenant event topics")}</div>
        <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
          {stats?.kafka_topics ?? "—"} {tr("队列", "topics")}
        </span>
        <button type="button" onClick={load} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" title={tr("刷新", "Refresh")}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {topics === null && <div className="px-1 py-4 text-center text-[12px] text-gray-400">{tr("Kafka 暂不可达", "Kafka unreachable")}</div>}
      {topics && topics.length === 0 && <div className="px-1 py-4 text-center text-[12px] text-gray-400">{tr("暂无 Topic", "No topics")}</div>}
      {topics && topics.length > 0 && (
        <div className="space-y-0.5">
          {topics.map((t) => (
            <div key={t} className="flex items-center gap-2 rounded-lg border border-gray-100 px-2.5 py-1.5">
              <Radio className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span className="truncate font-mono text-[11.5px] text-gray-600" title={t}>{t}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
