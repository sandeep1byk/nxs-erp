import { useState } from "react";
import { PageHeader, useList, useSave, useRemove, StatusBadge } from "@/components/common";
import { DataTable } from "@/components/data-table";
import { FormDialog, FormFieldDef, LineItemsEditor } from "@/components/crud-kit";
import { PrintDialog, ItemsTable, TotalsBlock, SignatureLines } from "@/components/print-doc";
import { QuickAddSelect } from "@/components/quick-add-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Printer } from "lucide-react";
import { fmtDate, fmtAED, nextNumber, computeTotals } from "@/lib/nxs";

export default function Quotations() {
  const { data, isLoading } = useList("quotations");
  const { data: clients } = useList("clients");
  const { data: projects } = useList("projects");
  const save = useSave("quotations");
  const remove = useRemove("quotations");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [printing, setPrinting] = useState<any>(null);

  const clientName = (id: string) => (clients || []).find((c: any) => c.id === id)?.name || "—";
  const client = (id: string) => (clients || []).find((c: any) => c.id === id);

  const fields: FormFieldDef[] = [
    { name: "quot_number", label: "Quotation No.", required: true },
    // client_id and project_id handled via extra (QuickAddSelect)
    { name: "quot_date", label: "Date", type: "date" },
    { name: "valid_until", label: "Valid Until", type: "date" },
    { name: "status", label: "Status", type: "select", options: ["draft", "sent", "accepted", "rejected", "expired"].map((s) => ({ value: s, label: s })) },
    { name: "subject", label: "Subject", col: 2 },
    { name: "scope_of_work", label: "Scope of Work", type: "textarea" },
    { name: "terms_conditions", label: "Terms & Conditions", type: "textarea" },
    { name: "payment_terms", label: "Payment Terms", type: "textarea" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  return (
    <div>
      <PageHeader title="Quotations" subtitle="Client quotations with scope of work & VAT"
        actions={<Button onClick={() => { setEditing({ quot_number: nextNumber("NXS-QT"), quot_date: new Date().toISOString().slice(0, 10), status: "draft", items: [] }); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New Quotation</Button>} />
      <DataTable rows={data} loading={isLoading}
        columns={[
          { header: "Quot No.", cell: (r: any) => <span className="font-mono text-xs">{r.quot_number}</span> },
          { header: "Client", cell: (r: any) => clientName(r.client_id) },
          { header: "Subject", cell: (r: any) => r.subject || "—" },
          { header: "Date", cell: (r: any) => fmtDate(r.quot_date) },
          { header: "Total", cell: (r: any) => fmtAED(r.total_amount) },
          { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
          { header: "", cell: (r: any) => <Button size="sm" variant="outline" onClick={() => setPrinting(r)}><Printer className="h-4 w-4" /></Button> },
        ]}
        onEdit={(r) => { setEditing(r); setOpen(true); }} onDelete={(r) => remove.mutate(r.id)} />

      <FormDialog open={open} onClose={() => setOpen(false)} title={editing?.id ? "Edit Quotation" : "New Quotation"}
        fields={fields} initial={editing} saving={save.isPending}
        onSave={(v) => { const t = computeTotals(v.items || []); save.mutate({ ...v, subtotal: t.subtotal, vat_amount: t.vat, total_amount: t.total }, { onSuccess: () => setOpen(false) }); }}
        extra={(values, set) => (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Client *</Label>
                <QuickAddSelect
                  type="client"
                  options={(clients || []).map((c: any) => ({ value: c.id, label: c.name }))}
                  value={values.client_id || ""}
                  onChange={(v) => set({ ...values, client_id: v })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Project</Label>
                <QuickAddSelect
                  type="project"
                  options={(projects || []).map((p: any) => ({ value: p.id, label: p.name }))}
                  value={values.project_id || ""}
                  onChange={(v) => set({ ...values, project_id: v })}
                />
              </div>
            </div>
            <LineItemsEditor items={values.items || []} onChange={(items) => set({ ...values, items })} />
          </div>
        )} />

      {printing && (
        <PrintDialog open={!!printing} onClose={() => setPrinting(null)} title={`Quotation ${printing.quot_number}`}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0c1125", marginBottom: 12 }}>QUOTATION</h2>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
            <div>
              <div><b>To:</b> {clientName(printing.client_id)}</div>
              <div>{client(printing.client_id)?.address || ""}</div>
              <div>Attn: {client(printing.client_id)?.contact_person || "—"}</div>
              <div>TRN: {client(printing.client_id)?.trn || "—"}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div><b>Quotation No:</b> {printing.quot_number}</div>
              <div><b>Date:</b> {fmtDate(printing.quot_date)}</div>
              <div><b>Valid Until:</b> {fmtDate(printing.valid_until)}</div>
            </div>
          </div>
          {printing.subject && <div style={{ fontSize: 14, fontWeight: 600, margin: "8px 0" }}>Subject: {printing.subject}</div>}
          {printing.scope_of_work && <div style={{ fontSize: 12, marginBottom: 8 }}><b>Scope of Work:</b><br />{printing.scope_of_work}</div>}
          <ItemsTable items={printing.items || []} />
          <TotalsBlock subtotal={printing.subtotal || 0} vat={printing.vat_amount || 0} total={printing.total_amount || 0} />
          {printing.payment_terms && <div style={{ fontSize: 12, marginTop: 12 }}><b>Payment Terms:</b> {printing.payment_terms}</div>}
          {printing.terms_conditions && <div style={{ fontSize: 11, marginTop: 8, color: "#555" }}><b>Terms & Conditions:</b><br />{printing.terms_conditions}</div>}
          <SignatureLines left="For NXS Contracting" right="Client Acceptance" />
        </PrintDialog>
      )}
    </div>
  );
}
