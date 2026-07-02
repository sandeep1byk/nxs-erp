import { useState } from "react";
import { PageHeader, useList, useSave, useRemove } from "@/components/common";
import { DataTable } from "@/components/data-table";
import { FormDialog, FormFieldDef } from "@/components/crud-kit";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const FIELDS: FormFieldDef[] = [
  { name: "name", label: "Client Name", required: true, col: 2 },
  { name: "contact_person", label: "Contact Person" },
  { name: "trn", label: "TRN" },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Phone" },
  { name: "address", label: "Address", type: "textarea" },
];

export default function Clients() {
  const { data, isLoading } = useList("clients");
  const save = useSave("clients");
  const remove = useRemove("clients");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  return (
    <div>
      <PageHeader title="Clients" subtitle="Customer master records"
        actions={<Button onClick={() => { setEditing({}); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New Client</Button>} />
      <DataTable rows={data} loading={isLoading}
        columns={[
          { header: "Name", cell: (r: any) => <span className="font-medium">{r.name}</span> },
          { header: "Contact", cell: (r: any) => r.contact_person || "—" },
          { header: "Email", cell: (r: any) => r.email || "—" },
          { header: "Phone", cell: (r: any) => r.phone || "—" },
          { header: "TRN", cell: (r: any) => r.trn || "—" },
        ]}
        onEdit={(r) => { setEditing(r); setOpen(true); }}
        onDelete={(r) => remove.mutate(r.id)} />
      <FormDialog open={open} onClose={() => setOpen(false)} title={editing?.id ? "Edit Client" : "New Client"}
        fields={FIELDS} initial={editing} saving={save.isPending}
        onSave={(v) => save.mutate(v, { onSuccess: () => setOpen(false) })} />
    </div>
  );
}
