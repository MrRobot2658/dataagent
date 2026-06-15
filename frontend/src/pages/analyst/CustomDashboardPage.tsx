import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2, LayoutDashboard } from "lucide-react";
import Layout from "../../components/layout/Layout";
import { Card, Button, Spinner } from "../../components/ui";
import { EmptyState } from "../../components/segment/kit";
import AnalystChart from "../../components/analyst/AnalystChart";
import { useTenant } from "../../context/TenantContext";
import { useLang } from "../../context/LangContext";
import { getDashboard, deleteDashboard, type Dashboard } from "../../api/analyst";

// 自定义看板详情：渲染该看板下的所有可下钻图表。
export default function CustomDashboardPage() {
  const { id = "" } = useParams();
  const { tenant } = useTenant();
  const { tr } = useLang();
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setDashboard(null); setErr(null);
    getDashboard(tenant, id)
      .then(setDashboard)
      .catch((e) => setErr(e?.response?.data?.detail || e.message || String(e)));
  }, [tenant, id]);

  async function onDelete() {
    if (!dashboard) return;
    if (!window.confirm(tr(`删除看板「${dashboard.title}」？`, `Delete dashboard "${dashboard.title}"?`))) return;
    try {
      await deleteDashboard(tenant, id);
      navigate("/analyst");
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e.message || tr("删除失败", "Failed to delete"));
    }
  }

  const charts = dashboard?.charts || [];

  return (
    <Layout
      title={dashboard?.title || tr("看板", "Dashboard")}
      subtitle={tr("自定义看板", "Custom dashboard")}
      actions={
        <div className="flex items-center gap-2">
          <Link to="/analyst">
            <Button variant="outline"><ArrowLeft className="h-4 w-4" /> {tr("返回列表", "Back")}</Button>
          </Link>
          <Button variant="outline" onClick={onDelete}>
            <Trash2 className="h-4 w-4" /> {tr("删除看板", "Delete")}
          </Button>
        </div>
      }
    >
      {err && <Card className="mb-4 p-4 text-sm text-red-600">{err}</Card>}

      {!dashboard && !err && (
        <div className="flex items-center gap-2 text-gray-500"><Spinner /> {tr("加载中…", "Loading…")}</div>
      )}

      {dashboard && charts.length === 0 && (
        <EmptyState
          icon={LayoutDashboard}
          title={tr("该看板还没有图表", "No charts in this dashboard")}
          desc={tr("回到看板列表，用自然语言重新创建一个看板。", "Go back and create a dashboard with natural language.")}
        />
      )}

      {dashboard && charts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {charts.map((c, i) => (
            <AnalystChart
              key={i}
              tenant={tenant}
              title={c.title}
              type={c.type}
              source={c.source}
              data={c.data}
            />
          ))}
        </div>
      )}
    </Layout>
  );
}
