import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Route as RouteIcon, Plus, Workflow } from "lucide-react";
import Layout from "../components/layout/Layout";
import { Card, Button, Spinner, Modal, TextField, DataTable } from "../components/ui";
import { StatCards, StatusPill, EmptyState } from "../components/segment/kit";
import SchedulerBanner from "../components/scheduler/SchedulerBanner";
import { useTenant } from "../context/TenantContext";
import { useLang } from "../context/LangContext";
import { listPipelines, createPipeline, type Pipeline } from "../api/connections";

function tone(s: string) {
  if (s === "active" || s === "running") return "green" as const;
  if (s === "draft") return "gray" as const;
  return "amber" as const;
}

export default function PipelinesPage() {
  const { tenant } = useTenant();
  const { tr } = useLang();
  const [items, setItems] = useState<Pipeline[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const COL = {
    name: tr("管道", "Pipeline"), status: tr("状态", "Status"),
    nodes: tr("节点", "Nodes"), edges: tr("连线", "Edges"), last: tr("最近执行", "Last Run"),
  };

  function load() {
    setItems(null); setErr(null);
    listPipelines(tenant).then(setItems).catch((e) => setErr(String(e)));
  }
  useEffect(load, [tenant]);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true); setErr(null);
    try {
      await createPipeline(tenant, { pipeline_name: name.trim(), nodes: [], edges: [], status: "draft" });
      setName(""); setOpen(false); load();
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  }

  return (
    <Layout
      title={tr("管道 Pipelines", "Pipelines")}
      subtitle={tr("把可视化编排画布保存的拓扑作为可执行管道管理与运行", "Manage and run topologies saved from the visual orchestration canvas as executable pipelines")}
      actions={
        <>
          <Link to="/connections/flow"><Button variant="outline"><Workflow className="h-4 w-4" /> {tr("编排画布", "Flow Canvas")}</Button></Link>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tr("新建管道", "New Pipeline")}</Button>
        </>
      }
    >
      <SchedulerBanner />

      {items && (
        <StatCards items={[
          { label: tr("管道总数", "Total Pipelines"), value: items.length },
          { label: tr("草稿", "Draft"), value: items.filter((p) => p.status === "draft").length },
          { label: tr("已激活", "Active"), value: items.filter((p) => p.status === "active").length },
          { label: tr("总节点数", "Total Nodes"), value: items.reduce((a, p) => a + (p.node_count || 0), 0) },
        ]} />
      )}

      {err && <Card className="mb-4 p-4 text-sm text-red-600">{err}</Card>}
      {!items && !err && <div className="flex items-center gap-2 text-gray-500"><Spinner /> {tr("加载中…", "Loading…")}</div>}

      {items && items.length === 0 && (
        <EmptyState icon={RouteIcon} title={tr("还没有管道", "No pipelines yet")} desc={tr("在编排画布拖拽节点后保存为管道，或先新建一个空管道。", "Drag nodes onto the flow canvas and save as a pipeline, or create an empty pipeline first.")}
          action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tr("新建管道", "New Pipeline")}</Button>} />
      )}

      {items && items.length > 0 && (
        <Card className="p-2">
          <DataTable
            columns={[COL.name, COL.status, COL.nodes, COL.edges, COL.last]}
            rows={items.map((p) => ({
              [COL.name]: (
                <span className="inline-flex items-center gap-2 font-medium text-gray-900">
                  <RouteIcon className="h-4 w-4 text-brand-500" /> {p.pipeline_name}
                </span>
              ),
              [COL.status]: <StatusPill tone={tone(p.status)}>{p.status}</StatusPill>,
              [COL.nodes]: p.node_count || 0,
              [COL.edges]: p.edge_count || 0,
              [COL.last]: <span className="text-gray-500">{p.last_executed_time || "—"}</span>,
              _id: p.pipeline_id,
            }))}
            rowLink={(r) => `/connections/pipelines/${r._id}`}
          />
        </Card>
      )}

      <Modal open={open} title={tr("新建管道", "New Pipeline")} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <TextField label={tr("名称", "Name")} value={name} onChange={setName} placeholder={tr("如：CSV → 字段映射 → 对象表", "e.g. CSV → Field Mapping → Object Table")} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>{tr("取消", "Cancel")}</Button>
            <Button onClick={submit} disabled={busy || !name.trim()}>
              {busy ? <Spinner /> : <Plus className="h-4 w-4" />} {tr("创建", "Create")}
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
