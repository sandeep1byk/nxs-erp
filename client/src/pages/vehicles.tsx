import { useState } from "react";
import { PageHeader, useList, useSave, useRemove } from "@/components/common";
import { DataTable } from "@/components/data-table";
import { FormDialog, FormFieldDef } from "@/components/crud-kit";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { fmtDate } from "@/lib/nxs";
import { cn } from "@/lib/utils";

function ExpiryCell({ date }: { date?: string }) {
  if (!date) return <span className="text-muted-foreground">—</span>;
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  const color = days < 30 ? "text-destructive font-medium" : days < 60 ? "text-amber-600" : "";
  return <span className={cn(color)}>{fmtDate(date)}</span>;
}

const FIELDS: FormFieldDef[] = [
  { name: "plate_number", label: "Plate Number", required: true },
  { name: "type", label: "Type", placeholder: "Pickup / Van / Truck" },
  { name: "make", label: "Make" },
  { name: "model", label: "Model" },
  { name: "year", label: "Year", type: "number" },
  { name: "status", label: "Status", type: "select", options: ["active", "maintenance", "off_road"].map((s) => ({ value: s, label: s })) },
  { name: "registration_expiry", label: "Registration Expiry", type: "date" },
  { name: "insurance_expiry", label: "Insurance Expiry", type: "date" },
  { name: "assigned_to", label: "Assigned To" },
  { name: "mulkiya_file_url", label: "Mulkiya File URL", col: 2 },
];

export default function Vehicles() {
  const { data, isLoading } = useList("vehicles");
  const save = useSave("vehicles");
  const remove = useRemove("vehicles");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  return (
    <div>
      <PageHeader title="Vehicles" subtitle="Fleet with registration & insurance expiry tracking"
        actions={<Button onClick={() => { setEditing({ status: "active" }); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New Vehicle</Button>} />
      <DataTable rows={data} loading={isLoading}
        columns={[
          { header: "Plate", cell: (r: any) => <span className="font-medium">{r.plate_number}</span> },
          { header: "Vehicle", cell: (r: any) => `${r.make || ""} ${r.model || ""} ${r.year || ""}`.trim() || "—" },
          { header: "Type", cell: (r: any) => r.type || "—" },
          { header: "Registration Exp.", cell: (r: any) => <ExpiryCell date={r.registration_expiry} /> },
          { header: "Insurance Exp.", cell: (r: any) => <ExpiryCell date={r.insurance_expiry} /> },
          { header: "Assigned", cell: (r: any) => r.assigned_to || "—" },
        ]}
        onEdit={(r) => { setEditing(r); setOpen(true); }}
        onDelete={(r) => remove.mutate(r.id)} />
      <FormDialog open={open} onClose={() => setOpen(false)} title={editing?.id ? "Edit Vehicle" : "New Vehicle"}
        fields={FIELDS} initial={editing} saving={save.isPending}
        onSave={(v) => save.mutate(v, { onSuccess: () => setOpen(false) })} />
    </div>
  );
}
