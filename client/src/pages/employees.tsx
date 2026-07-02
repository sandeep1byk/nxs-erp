import { useState, useCallback } from "react";
import { PageHeader, useList, useSave, useRemove } from "@/components/common";
import { DataTable } from "@/components/data-table";
import { FormDialog, FormFieldDef } from "@/components/crud-kit";
import { DocUploader, DocSlot } from "@/components/doc-uploader";
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

// Document slots for employee — each maps to document_vault category
const EMP_DOC_SLOTS: DocSlot[] = [
  { key: "passport", label: "Passport Copy", doc_category: "passport", expiryField: "passport_expiry" },
  { key: "visa", label: "Visa Copy", doc_category: "visa", expiryField: "visa_expiry" },
  { key: "emirates_id", label: "Emirates ID Copy", doc_category: "emirates_id", expiryField: "emirates_id_expiry" },
  { key: "labour_card", label: "Labour Card Copy", doc_category: "labour_card", expiryField: "labour_card_expiry" },
  { key: "medical_card", label: "Medical Card", doc_category: "medical_card" },
  { key: "other", label: "Other Document", doc_category: "other" },
];

export default function Employees() {
  const { data, isLoading } = useList("employees");
  const save = useSave("employees");
  const remove = useRemove("employees");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  // Auto-filled expiry dates from uploaded docs
  const [autoFill, setAutoFill] = useState<Record<string, string>>({});

  // When a doc is uploaded with an expiry date, auto-fill the form field
  const handleUploaded = useCallback((slot: DocSlot, _doc: any, expiryDate?: string) => {
    if (slot.expiryField && expiryDate) {
      setAutoFill((prev) => ({ ...prev, [slot.expiryField!]: expiryDate }));
    }
  }, []);

  // Merge auto-filled values into editing state
  const editingWithAutoFill = { ...editing, ...autoFill };

  function openNew() {
    setEditing({ status: "active" });
    setAutoFill({});
    setOpen(true);
  }

  function openEdit(r: any) {
    setEditing(r);
    setAutoFill({});
    setOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="HR master with document expiry tracking"
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New Employee</Button>}
      />
      <DataTable
        rows={data}
        loading={isLoading}
        columns={[
          { header: "No.", cell: (r: any) => <span className="font-mono text-xs">{r.employee_number}</span> },
          { header: "Name", cell: (r: any) => <span className="font-medium">{r.full_name}</span> },
          { header: "Designation", cell: (r: any) => r.designation || "—" },
          { header: "Dept.", cell: (r: any) => r.department || "—" },
          { header: "Salary", cell: (r: any) => fmtAED((r.basic_salary || 0) + (r.housing_allowance || 0) + (r.transport_allowance || 0) + (r.other_allowance || 0)) },
        ]}
        onEdit={openEdit}
        onDelete={(r) => remove.mutate(r.id)}
      />

      <FormDialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing?.id ? "Edit Employee" : "New Employee"}
        fields={FIELDS}
        initial={editingWithAutoFill}
        saving={save.isPending}
        onSave={(v) => save.mutate(v, { onSuccess: () => { setOpen(false); setAutoFill({}); } })}
        extra={() => (
          <DocUploader
            slots={EMP_DOC_SLOTS}
            entityType="employee"
            entityId={editing?.id}
            entityLabel={editing?.full_name || editingWithAutoFill?.full_name}
            onUploaded={handleUploaded}
            existingUrls={
              editing?.id
                ? {
                    passport: editing.passport_file_url,
                    visa: editing.visa_file_url,
                    emirates_id: editing.eid_file_url,
                    labour_card: editing.labour_card_file_url,
                  }
                : {}
            }
          />
        )}
      />
    </div>
  );
}
