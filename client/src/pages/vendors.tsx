import { useState } from "react";
import { PageHeader, useList, useSave, useRemove } from "@/components/common";
import { DataTable } from "@/components/data-table";
import { FormDialog, FormFieldDef } from "@/components/crud-kit";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const FIELDS: FormFieldDef[] = [
  { name: "name", label: "Vendor Name", required: true, col: 2 },
  { name: "contact_person", label: "Contact Person" },
  { name: "trn", label: "TRN" },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Phone" },
  { name: "payment_terms", label: "Payment Terms", placeholder: "e.g. 30 days" },
  { name: "address", label: "Address", type: "textarea" },
];

export default function Vendors() {
  const { data, isLoading } = useList("vendors");
  const save = useSave("vendors");
  const remove = useRemove("vendors");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  return (
    <div>
      <PageHeader title="Vendors" subtitle="Supplier & subcontractor master records"
        actions={<Button onClick={() => { setEditing({}); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New Vendor</Button>} />
      <DataTable rows={data} loading={isLoading}
        columns={[
          { header: "Name", cell: (r: any) => <span className="font-medium">{r.name}</span> },
          { header: "Contact", cell: (r: any) => r.contact_person || "—" },
          { header: "Email", cell: (r: any) => r.email || "—" },
          { header: "Phone", cell: (r: any) => r.phone || "—" },
          { header: "Terms", cell: (r: any) => r.payment_terms || "—" },
        ]}
        onEdit={(r) => { setEditing(r); setOpen(true); }}
        onDelete={(r) => remove.mutate(r.id)} />
      <FormDialog open={open} onClose={() => setOpen(false)} title={editing?.id ? "Edit Vendor" : "New Vendor"}
        fields={FIELDS} initial={editing} saving={save.isPending}
        onSave={(v) => save.mutate(v, { onSuccess: () => setOpen(false) })} />
    </div>
  );
}
