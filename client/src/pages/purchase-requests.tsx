import { useState } from "react";
import { PageHeader, useList, useSave, useRemove, StatusBadge } from "@/components/common";
import { DataTable } from "@/components/data-table";
import { FormDialog, FormFieldDef, LineItemsEditor } from "@/components/crud-kit";
import { Button } from "@/components/ui/button";
import { Plus, ArrowRightLeft } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { fmtDate, nextNumber } from "@/lib/nxs";
import { useAuth } from "@/lib/auth";
import { QuickAddSelect } from "@/components/quick-add-select";

export default function PurchaseRequests() {
  const { user } = useAuth();
  const { data, isLoading } = useList("purchase_requests");
  const { data: projects } = useList("projects");
  const save = useSave("purchase_requests");
  const remove = useRemove("purchase_requests");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const projName = (id: string) => (projects || []).find((p: any) => p.id === id)?.name || "—";

  const convert = useMutation({
    mutationFn: async (id: string) => (await apiRequest("POST", `/api/purchase_requests/${id}/convert`)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/purchase_requests"] }); queryClient.invalidateQueries({ queryKey: ["/api/purchase_orders"] }); },
  });

  const fields: FormFieldDef[] = [
    { name: "pr_number", label: "PR Number", required: true },
    { name: "request_date", label: "Request Date", type: "date" },
    { name: "status", label: "Status", type: "select", options: ["draft", "submitted", "approved", "rejected", "converted"].map((s) => ({ value: s, label: s })) },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  return (
    <div>
      <PageHeader title="Purchase Requests" subtitle="Material requisitions — submit for approval, convert to PO"
        actions={<Button onClick={() => { setEditing({ pr_number: nextNumber("NXS-PR"), request_date: new Date().toISOString().slice(0, 10), status: "draft", requested_by: user?.id, items: [] }); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New PR</Button>} />
      <DataTable rows={data} loading={isLoading}
        columns={[
          { header: "PR No.", cell: (r: any) => <span className="font-mono text-xs">{r.pr_number}</span> },
          { header: "Project", cell: (r: any) => projName(r.project_id) },
          { header: "Date", cell: (r: any) => fmtDate(r.request_date) },
          { header: "Items", cell: (r: any) => (r.items || []).length },
          { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
          { header: "", cell: (r: any) => r.status !== "converted" ? <Button size="sm" variant="outline" onClick={() => convert.mutate(r.id)}><ArrowRightLeft className="h-4 w-4 mr-1" /> To PO</Button> : <span className="text-xs text-muted-foreground">Converted</span> },
        ]}
        onEdit={(r) => { setEditing(r); setOpen(true); }}
        onDelete={(r) => remove.mutate(r.id)} />
      <FormDialog open={open} onClose={() => setOpen(false)} title={editing?.id ? "Edit PR" : "New Purchase Request"}
        fields={fields} initial={editing} saving={save.isPending}
        onSave={(v) => save.mutate(v, { onSuccess: () => setOpen(false) })}
        extra={(values, set) => (
          <div className="space-y-4">
            {/* Project quick-add */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Project</label>
              <QuickAddSelect
                type="project"
                options={(projects || []).map((p: any) => ({ value: p.id, label: p.name }))}
                value={values.project_id || ""}
                onChange={(v) => set({ ...values, project_id: v })}
                placeholder="Select project…"
                data-testid="select-project"
              />
            </div>
            {/* Line items */}
            <LineItemsEditor items={values.items || []} onChange={(items) => set({ ...values, items })} />
          </div>
        )} />
    </div>
  );
}
