import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useOne, useList, useSave, useRemove, PageHeader, Loader, KV, StatusBadge } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FormDialog, FormFieldDef } from "@/components/crud-kit";
import { fmtAED, fmtDate } from "@/lib/nxs";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const id = params?.id;
  const { data: project, isLoading } = useOne<any>("projects", id);
  const { data: clients } = useList("clients");
  const { data: tasks } = useList("project_tasks", id ? { project_id: id } : undefined);
  const { data: updates } = useList("project_daily_updates", id ? { project_id: id } : undefined);
  const { data: reports } = useList("site_progress_reports", id ? { project_id: id } : undefined);
  const { data: ledger } = useList("stock_ledger", id ? { project_id: id } : undefined);

  const saveTask = useSave("project_tasks");
  const removeTask = useRemove("project_tasks");
  const saveUpdate = useSave("project_daily_updates");
  const [taskOpen, setTaskOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);

  if (isLoading) return <Loader />;
  if (!project) return <div className="text-muted-foreground">Project not found.</div>;
  const clientName = (clients || []).find((c: any) => c.id === project.client_id)?.name || "—";
  const expenses = (ledger || []).reduce((s: number, l: any) => s + (Number(l.total_cost) || 0), 0);

  const taskFields: FormFieldDef[] = [
    { name: "title", label: "Task Title", required: true, col: 2 },
    { name: "status", label: "Status", type: "select", options: ["pending", "in_progress", "completed"].map((s) => ({ value: s, label: s })) },
    { name: "due_date", label: "Due Date", type: "date" },
    { name: "description", label: "Description", type: "textarea" },
  ];
  const updateFields: FormFieldDef[] = [
    { name: "update_date", label: "Date", type: "date", required: true },
    { name: "weather", label: "Weather" },
    { name: "work_done", label: "Work Done", type: "textarea" },
    { name: "issues", label: "Issues", type: "textarea" },
    { name: "next_day_plan", label: "Next Day Plan", type: "textarea" },
  ];

  return (
    <div>
      <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="h-4 w-4" /> Back to projects
      </Link>
      <PageHeader title={`${project.project_number} — ${project.name}`}
        subtitle={project.location} actions={<StatusBadge status={project.status} />} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card><CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent>
            <KV label="Client" value={clientName} />
            <KV label="Location" value={project.location} />
            <KV label="Start" value={fmtDate(project.start_date)} />
            <KV label="End" value={fmtDate(project.end_date)} />
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="text-base">Financials</CardTitle></CardHeader>
          <CardContent>
            <KV label="Contract Value" value={fmtAED(project.contract_value)} />
            <KV label="Budgeted Cost" value={fmtAED(project.budgeted_cost)} />
            <KV label="Material Consumed" value={fmtAED(expenses)} />
            <KV label="Gross Margin" value={fmtAED((project.contract_value || 0) - (project.budgeted_cost || 0))} />
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">{project.description || "No description."}</p></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">Tasks ({(tasks || []).length})</TabsTrigger>
          <TabsTrigger value="updates">Daily Updates ({(updates || []).length})</TabsTrigger>
          <TabsTrigger value="reports">Progress Reports ({(reports || []).length})</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setTaskOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Task</Button>
          </div>
          <div className="space-y-2">
            {(tasks || []).map((t: any) => (
              <Card key={t.id}><CardContent className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{t.title}</div>
                  <div className="text-xs text-muted-foreground">{t.description} {t.due_date && `· Due ${fmtDate(t.due_date)}`}</div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={t.status} />
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeTask.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent></Card>
            ))}
            {(!tasks || tasks.length === 0) && <p className="text-sm text-muted-foreground py-4">No tasks yet.</p>}
          </div>
        </TabsContent>

        <TabsContent value="updates">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setUpdateOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Daily Update</Button>
          </div>
          <div className="space-y-2">
            {(updates || []).map((u: any) => (
              <Card key={u.id}><CardContent className="py-3">
                <div className="flex justify-between mb-1">
                  <span className="font-medium text-sm">{fmtDate(u.update_date)}</span>
                  <span className="text-xs text-muted-foreground">{u.weather}</span>
                </div>
                <p className="text-sm"><b>Work:</b> {u.work_done || "—"}</p>
                {u.issues && <p className="text-sm text-destructive"><b>Issues:</b> {u.issues}</p>}
                {u.next_day_plan && <p className="text-sm text-muted-foreground"><b>Next:</b> {u.next_day_plan}</p>}
              </CardContent></Card>
            ))}
            {(!updates || updates.length === 0) && <p className="text-sm text-muted-foreground py-4">No daily updates yet.</p>}
          </div>
        </TabsContent>

        <TabsContent value="reports">
          <div className="space-y-2">
            {(reports || []).map((r: any) => (
              <Card key={r.id}><CardContent className="py-3 flex justify-between items-center">
                <div>
                  <div className="font-medium text-sm">{r.report_number} · {r.overall_progress}% complete</div>
                  <div className="text-xs text-muted-foreground">{fmtDate(r.report_date)}</div>
                </div>
                <StatusBadge status={r.status} />
              </CardContent></Card>
            ))}
            {(!reports || reports.length === 0) && <p className="text-sm text-muted-foreground py-4">No progress reports. Create them in Site Reports.</p>}
          </div>
        </TabsContent>
      </Tabs>

      <FormDialog open={taskOpen} onClose={() => setTaskOpen(false)} title="Add Task" fields={taskFields}
        initial={{ project_id: id, status: "pending" }} saving={saveTask.isPending}
        onSave={(v) => saveTask.mutate({ ...v, project_id: id }, { onSuccess: () => setTaskOpen(false) })} />
      <FormDialog open={updateOpen} onClose={() => setUpdateOpen(false)} title="Daily Update" fields={updateFields}
        initial={{ project_id: id, update_date: new Date().toISOString().slice(0, 10) }} saving={saveUpdate.isPending}
        onSave={(v) => saveUpdate.mutate({ ...v, project_id: id }, { onSuccess: () => setUpdateOpen(false) })} />
    </div>
  );
}
