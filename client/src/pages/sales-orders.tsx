import { useState } from "react";
import { PageHeader, useList, useSave, useRemove, StatusBadge } from "@/components/common";
import { DataTable } from "@/components/data-table";
import { FormDialog, FormFieldDef } from "@/components/crud-kit";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { fmtDate, fmtAED, nextNumber } from "@/lib/nxs";

export default function SalesOrders() {
  const { data, isLoading } = useList("sales_orders");
  const { data: clients } = useList("clients");
  const { data: projects } = useList("projects");
  const { data: quotations } = useList("quotations");
  const save = useSave("sales_orders");
  const remove = useRemove("sales_orders");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const clientName = (id: string) => (clients || []).find((c: any) => c.id === id)?.name || "—";
  const projName = (id: string) => (projects || []).find((p: any) => p.id === id)?.name || "—";

  const fields: FormFieldDef[] = [
    { name: "so_number", label: "SO Number", required: true },
    { name: "client_id", label: "Client", type: "select", required: true, options: (clients || []).map((c: any) => ({ value: c.id, label: c.name })) },
    { name: "quot_id", label: "From Quotation", type: "select", options: (quotations || []).map((q: any) => ({ value: q.id, label: q.quot_number })) },
    { name: "project_id", label: "Project", type: "select", options: (projects || []).map((p: any) => ({ value: p.id, label: p.name })) },
    { name: "order_date", label: "Order Date", type: "date" },
    { name: "contract_value", label: "Contract Value (AED)", type: "number" },
    { name: "status", label: "Status", type: "select", options: ["draft", "active", "completed", "cancelled"].map((s) => ({ value: s, label: s })) },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  return (
    <div>
      <PageHeader title="Sales Orders / Contracts" subtitle="Confirmed client contracts"
        actions={<Button onClick={() => { setEditing({ so_number: nextNumber("NXS-SO"), order_date: new Date().toISOString().slice(0, 10), status: "draft" }); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New Sales Order</Button>} />
      <DataTable rows={data} loading={isLoading}
        columns={[
          { header: "SO No.", cell: (r: any) => <span className="font-mono text-xs">{r.so_number}</span> },
          { header: "Client", cell: (r: any) => clientName(r.client_id) },
          { header: "Project", cell: (r: any) => projName(r.project_id) },
          { header: "Date", cell: (r: any) => fmtDate(r.order_date) },
          { header: "Value", cell: (r: any) => fmtAED(r.contract_value) },
          { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
        ]}
        onEdit={(r) => { setEditing(r); setOpen(true); }} onDelete={(r) => remove.mutate(r.id)} />
      <FormDialog open={open} onClose={() => setOpen(false)} title={editing?.id ? "Edit Sales Order" : "New Sales Order"}
        fields={fields} initial={editing} saving={save.isPending}
        onSave={(v) => save.mutate(v, { onSuccess: () => setOpen(false) })} />
    </div>
  );
}
