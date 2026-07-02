import { useState } from "react";
import { PageHeader, useList, useSave, useRemove } from "@/components/common";
import { DataTable } from "@/components/data-table";
import { FormDialog, FormFieldDef } from "@/components/crud-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, ExternalLink } from "lucide-react";
import { fmtDate } from "@/lib/nxs";
import { useAuth } from "@/lib/auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORIES = [
  "client_lpo",
  "supplier_invoice",
  "signed_invoice",
  "contract",
  "passport",
  "visa",
  "emirates_id",
  "labour_card",
  "medical_card",
  "vehicle_mulkiya",
  "vehicle_insurance",
  "vehicle_inspection",
  "other",
];

export default function Documents() {
  const { user } = useAuth();
  const { data, isLoading } = useList("document_vault");
  const { data: projects } = useList("projects");
  const { data: clients } = useList("clients");
  const { data: vendors } = useList("vendors");
  const save = useSave("document_vault");
  const remove = useRemove("document_vault");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");

  const fields: FormFieldDef[] = [
    { name: "title", label: "Title", required: true, col: 2 },
    { name: "doc_category", label: "Category", type: "select", required: true, options: CATEGORIES.map((c) => ({ value: c, label: c.replace(/_/g, " ") })) },
    { name: "reference_number", label: "Reference No." },
    { name: "doc_date", label: "Document Date", type: "date" },
    { name: "project_id", label: "Project", type: "select", options: (projects || []).map((p: any) => ({ value: p.id, label: p.name })) },
    { name: "client_id", label: "Client", type: "select", options: (clients || []).map((c: any) => ({ value: c.id, label: c.name })) },
    { name: "vendor_id", label: "Vendor", type: "select", options: (vendors || []).map((v: any) => ({ value: v.id, label: v.name })) },
    { name: "file_name", label: "File Name" },
    { name: "file_url", label: "File URL (Supabase storage)", col: 2, placeholder: "https://...supabase.co/storage/..." },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  const rows = (data || []).filter((d: any) =>
    (cat === "all" || d.doc_category === cat) &&
    (!q || `${d.title} ${d.reference_number} ${d.file_name}`.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div>
      <PageHeader title="Document Vault" subtitle="Central store for LPOs, supplier invoices, signed invoices & contracts"
        actions={<Button onClick={() => { setEditing({ doc_category: "other", uploaded_by: user?.id }); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Upload Document</Button>} />
      <div className="flex flex-wrap gap-2 mb-4">
        <Input placeholder="Search documents..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <DataTable rows={rows} loading={isLoading}
        columns={[
          { header: "Title", cell: (r: any) => <span className="font-medium">{r.title}</span> },
          { header: "Category", cell: (r: any) => <span className="capitalize">{(r.doc_category || "").replace(/_/g, " ")}</span> },
          { header: "Reference", cell: (r: any) => r.reference_number || "—" },
          { header: "Date", cell: (r: any) => fmtDate(r.doc_date) },
          { header: "File", cell: (r: any) => r.file_url ? <a href={r.file_url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1"><ExternalLink className="h-4 w-4" /> Open</a> : "—" },
        ]}
        onEdit={(r) => { setEditing(r); setOpen(true); }} onDelete={(r) => remove.mutate(r.id)} />
      <FormDialog open={open} onClose={() => setOpen(false)} title={editing?.id ? "Edit Document" : "Upload Document"}
        fields={fields} initial={editing} saving={save.isPending}
        onSave={(v) => save.mutate(v, { onSuccess: () => setOpen(false) })} />
    </div>
  );
}
