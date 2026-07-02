import { useState } from "react";
import { useLocation } from "wouter";
import { PageHeader, useList, useSave, useRemove, StatusBadge } from "@/components/common";
import { DataTable } from "@/components/data-table";
import { FormDialog, FormFieldDef } from "@/components/crud-kit";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { fmtAED } from "@/lib/nxs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS = ["planning", "active", "on_hold", "completed", "cancelled"];

export default function Projects() {
  const { data, isLoading } = useList("projects");
  const { data: clients } = useList("clients");
  const { data: engineers } = useList("users");
  const save = useSave("projects");
  const remove = useRemove("projects");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [filter, setFilter] = useState("all");
  const [, nav] = useLocation();

  const clientName = (id: string) => (clients || []).find((c: any) => c.id === id)?.name || "—";

  const fields: FormFieldDef[] = [
    { name: "project_number", label: "Project Number", required: true },
    { name: "name", label: "Project Name", required: true },
    { name: "client_id", label: "Client", type: "select", options: (clients || []).map((c: any) => ({ value: c.id, label: c.name })) },
    { name: "assigned_engineer_id", label: "Assigned Engineer", type: "select", options: (engineers || []).filter((u: any) => u.role === "engineer" || u.role === "admin").map((u: any) => ({ value: u.id, label: u.full_name })) },
    { name: "location", label: "Location" },
    { name: "status", label: "Status", type: "select", required: true, options: STATUS.map((s) => ({ value: s, label: s })) },
    { name: "start_date", label: "Start Date", type: "date" },
    { name: "end_date", label: "End Date", type: "date" },
    { name: "contract_value", label: "Contract Value (AED)", type: "number" },
    { name: "budgeted_cost", label: "Budgeted Cost (AED)", type: "number" },
    { name: "description", label: "Description", type: "textarea" },
  ];

  const rows = (data || []).filter((p: any) => filter === "all" || p.status === filter);

  return (
    <div>
      <PageHeader title="Projects" subtitle="Contracting & maintenance projects"
        actions={
          <div className="flex gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUS.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => { setEditing({ status: "planning" }); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New Project</Button>
          </div>
        } />
      <DataTable rows={rows} loading={isLoading} onRowClick={(r) => nav(`/projects/${r.id}`)}
        columns={[
          { header: "Number", cell: (r: any) => <span className="font-mono text-xs">{r.project_number}</span> },
          { header: "Name", cell: (r: any) => <span className="font-medium">{r.name}</span> },
          { header: "Client", cell: (r: any) => clientName(r.client_id) },
          { header: "Location", cell: (r: any) => r.location || "—" },
          { header: "Contract", cell: (r: any) => fmtAED(r.contract_value) },
          { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
        ]}
        onEdit={(r) => { setEditing(r); setOpen(true); }}
        onDelete={(r) => remove.mutate(r.id)} />
      <FormDialog open={open} onClose={() => setOpen(false)} title={editing?.id ? "Edit Project" : "New Project"}
        fields={fields} initial={editing} saving={save.isPending}
        onSave={(v) => save.mutate(v, { onSuccess: () => setOpen(false) })} />
    </div>
  );
}
