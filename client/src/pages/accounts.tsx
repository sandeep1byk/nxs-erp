import { useState } from "react";
import { PageHeader, useList, useSave, useRemove } from "@/components/common";
import { DataTable } from "@/components/data-table";
import { FormDialog, FormFieldDef } from "@/components/crud-kit";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const TYPES = ["asset", "liability", "equity", "revenue", "expense"];
const TYPE_COLORS: Record<string, string> = {
  asset: "text-blue-600", liability: "text-red-600", equity: "text-purple-600",
  revenue: "text-green-600", expense: "text-amber-600",
};

const FIELDS: FormFieldDef[] = [
  { name: "account_code", label: "Account Code", required: true },
  { name: "name", label: "Account Name", required: true },
  { name: "type", label: "Type", type: "select", required: true, options: TYPES.map((t) => ({ value: t, label: t })) },
];

export default function Accounts() {
  const { data, isLoading } = useList("accounts");
  const save = useSave("accounts");
  const remove = useRemove("accounts");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  return (
    <div>
      <PageHeader title="Chart of Accounts" subtitle="UAE construction standard chart of accounts"
        actions={<Button onClick={() => { setEditing({ is_active: true, type: "asset" }); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New Account</Button>} />
      <DataTable rows={data} loading={isLoading}
        columns={[
          { header: "Code", cell: (r: any) => <span className="font-mono">{r.account_code}</span> },
          { header: "Name", cell: (r: any) => <span className="font-medium">{r.name}</span> },
          { header: "Type", cell: (r: any) => <span className={`capitalize font-medium ${TYPE_COLORS[r.type] || ""}`}>{r.type}</span> },
          { header: "Active", cell: (r: any) => r.is_active ? "Yes" : "No" },
        ]}
        onEdit={(r) => { setEditing(r); setOpen(true); }} onDelete={(r) => remove.mutate(r.id)} />
      <FormDialog open={open} onClose={() => setOpen(false)} title={editing?.id ? "Edit Account" : "New Account"}
        fields={FIELDS} initial={editing} saving={save.isPending}
        onSave={(v) => save.mutate({ ...v, is_active: true }, { onSuccess: () => setOpen(false) })} />
    </div>
  );
}
