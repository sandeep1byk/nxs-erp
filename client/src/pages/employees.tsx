import { useState } from "react";
import { PageHeader, useList, useSave, useRemove } from "@/components/common";
import { DataTable } from "@/components/data-table";
import { FormDialog, FormFieldDef } from "@/components/crud-kit";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { fmtAED } from "@/lib/nxs";

const FIELDS: FormFieldDef[] = [
  { name: "employee_number", label: "Employee No.", required: true },
  { name: "full_name", label: "Full Name", required: true },
  { name: "nationality", label: "Nationality" },
  { name: "designation", label: "Designation" },
  { name: "department", label: "Department" },
  { name: "status", label: "Status", type: "select", options: ["active", "on_leave", "terminated"].map((s) => ({ value: s, label: s })) },
  { name: "join_date", label: "Join Date", type: "date" },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Phone" },
  { name: "emergency_contact", label: "Emergency Contact" },
  { name: "basic_salary", label: "Basic Salary (AED)", type: "number" },
  { name: "housing_allowance", label: "Housing Allowance", type: "number" },
  { name: "transport_allowance", label: "Transport Allowance", type: "number" },
  { name: "other_allowance", label: "Other Allowance", type: "number" },
  { name: "bank_name", label: "Bank Name" },
  { name: "bank_account", label: "Bank Account / IBAN" },
  { name: "passport_number", label: "Passport No." },
  { name: "passport_expiry", label: "Passport Expiry", type: "date" },
  { name: "visa_number", label: "Visa No." },
  { name: "visa_expiry", label: "Visa Expiry", type: "date" },
  { name: "emirates_id", label: "Emirates ID" },
  { name: "emirates_id_expiry", label: "Emirates ID Expiry", type: "date" },
  { name: "labour_card", label: "Labour Card" },
  { name: "labour_card_expiry", label: "Labour Card Expiry", type: "date" },
];

const DOC_FIELDS: FormFieldDef[] = [
  { name: "doc_type", label: "Document Type", type: "select", required: true, options: ["passport", "visa", "emirates_id", "labour_card", "other"].map((s) => ({ value: s, label: s })) },
  { name: "file_name", label: "File Name" },
  { name: "file_url", label: "File URL (Supabase storage)", col: 2, placeholder: "https://...supabase.co/storage/..." },
  { name: "expiry_date", label: "Expiry Date", type: "date" },
  { name: "notes", label: "Notes", type: "textarea" },
];

export default function Employees() {
  const { data, isLoading } = useList("employees");
  const save = useSave("employees");
  const remove = useRemove("employees");
  const saveDoc = useSave("employee_documents");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [docOpen, setDocOpen] = useState(false);
  const [docEmp, setDocEmp] = useState<any>(null);

  return (
    <div>
      <PageHeader title="Employees" subtitle="HR master with document expiry tracking"
        actions={<Button onClick={() => { setEditing({ status: "active" }); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New Employee</Button>} />
      <DataTable rows={data} loading={isLoading}
        columns={[
          { header: "No.", cell: (r: any) => <span className="font-mono text-xs">{r.employee_number}</span> },
          { header: "Name", cell: (r: any) => <span className="font-medium">{r.full_name}</span> },
          { header: "Designation", cell: (r: any) => r.designation || "—" },
          { header: "Dept.", cell: (r: any) => r.department || "—" },
          { header: "Salary", cell: (r: any) => fmtAED((r.basic_salary || 0) + (r.housing_allowance || 0) + (r.transport_allowance || 0) + (r.other_allowance || 0)) },
          { header: "Docs", cell: (r: any) => <Button size="sm" variant="outline" onClick={() => { setDocEmp(r); setDocOpen(true); }}>Upload</Button> },
        ]}
        onEdit={(r) => { setEditing(r); setOpen(true); }}
        onDelete={(r) => remove.mutate(r.id)} />
      <FormDialog open={open} onClose={() => setOpen(false)} title={editing?.id ? "Edit Employee" : "New Employee"}
        fields={FIELDS} initial={editing} saving={save.isPending}
        onSave={(v) => save.mutate(v, { onSuccess: () => setOpen(false) })} />
      <FormDialog open={docOpen} onClose={() => setDocOpen(false)} title={`Upload Document — ${docEmp?.full_name || ""}`}
        fields={DOC_FIELDS} initial={{ employee_id: docEmp?.id }} saving={saveDoc.isPending}
        onSave={(v) => saveDoc.mutate({ ...v, employee_id: docEmp?.id }, { onSuccess: () => setDocOpen(false) })} />
    </div>
  );
}
