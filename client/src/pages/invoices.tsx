import { useState } from "react";
import { PageHeader, useList, useSave, useRemove, StatusBadge } from "@/components/common";
import { DataTable } from "@/components/data-table";
import { FormDialog, FormFieldDef, LineItemsEditor } from "@/components/crud-kit";
import { PrintDialog, ItemsTable, TotalsBlock, SignatureLines, COMPANY } from "@/components/print-doc";
import { Button } from "@/components/ui/button";
import { Plus, Printer } from "lucide-react";
import { fmtDate, fmtAED, nextNumber, computeTotals } from "@/lib/nxs";

export default function Invoices() {
  const { data, isLoading } = useList("invoices");
  const { data: clients } = useList("clients");
  const { data: projects } = useList("projects");
  const save = useSave("invoices");
  const remove = useRemove("invoices");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [printing, setPrinting] = useState<any>(null);

  const clientName = (id: string) => (clients || []).find((c: any) => c.id === id)?.name || "—";
  const client = (id: string) => (clients || []).find((c: any) => c.id === id);
  const projName = (id: string) => (projects || []).find((p: any) => p.id === id)?.name || "—";

  const fields: FormFieldDef[] = [
    { name: "invoice_number", label: "Invoice No.", required: true },
    { name: "invoice_type", label: "Type", type: "select", required: true, options: ["advance", "progressive", "final", "standard"].map((s) => ({ value: s, label: s })) },
    { name: "client_id", label: "Client", type: "select", required: true, options: (clients || []).map((c: any) => ({ value: c.id, label: c.name })) },
    { name: "project_id", label: "Project", type: "select", options: (projects || []).map((p: any) => ({ value: p.id, label: p.name })) },
    { name: "invoice_date", label: "Invoice Date", type: "date" },
    { name: "due_date", label: "Due Date", type: "date" },
    { name: "status", label: "Status", type: "select", options: ["draft", "sent", "partial", "paid", "overdue", "cancelled"].map((s) => ({ value: s, label: s })) },
    { name: "progress_percent", label: "Progress %", type: "number" },
    { name: "retention_percent", label: "Retention %", type: "number" },
    { name: "amount_paid", label: "Amount Paid (AED)", type: "number" },
    { name: "subject", label: "Subject", col: 2 },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  const retentionAmt = (inv: any) => Math.round((inv.subtotal || 0) * (Number(inv.retention_percent) || 0) / 100 * 100) / 100;

  return (
    <div>
      <PageHeader title="Invoices" subtitle="Advance, progressive, final & standard tax invoices"
        actions={<Button onClick={() => { setEditing({ invoice_number: nextNumber("NXS-INV"), invoice_type: "standard", invoice_date: new Date().toISOString().slice(0, 10), status: "draft", items: [] }); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New Invoice</Button>} />
      <DataTable rows={data} loading={isLoading}
        columns={[
          { header: "Invoice No.", cell: (r: any) => <span className="font-mono text-xs">{r.invoice_number}</span> },
          { header: "Type", cell: (r: any) => <span className="capitalize">{r.invoice_type}</span> },
          { header: "Client", cell: (r: any) => clientName(r.client_id) },
          { header: "Date", cell: (r: any) => fmtDate(r.invoice_date) },
          { header: "Total", cell: (r: any) => fmtAED(r.total_amount) },
          { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
          { header: "", cell: (r: any) => <Button size="sm" variant="outline" onClick={() => setPrinting(r)}><Printer className="h-4 w-4" /></Button> },
        ]}
        onEdit={(r) => { setEditing(r); setOpen(true); }} onDelete={(r) => remove.mutate(r.id)} />

      <FormDialog open={open} onClose={() => setOpen(false)} title={editing?.id ? "Edit Invoice" : "New Invoice"}
        fields={fields} initial={editing} saving={save.isPending}
        onSave={(v) => { const t = computeTotals(v.items || []); save.mutate({ ...v, subtotal: t.subtotal, vat_amount: t.vat, total_amount: t.total }, { onSuccess: () => setOpen(false) }); }}
        extra={(values, set) => <LineItemsEditor items={values.items || []} onChange={(items) => set({ ...values, items })} />} />

      {printing && (
        <PrintDialog open={!!printing} onClose={() => setPrinting(null)} title={`Invoice ${printing.invoice_number}`}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0c1125", marginBottom: 4 }}>TAX INVOICE</h2>
          <div style={{ fontSize: 11, color: "#777", marginBottom: 10, textTransform: "capitalize" }}>{printing.invoice_type} Invoice · TRN: 100XXXXXXXXX0003</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
            <div>
              <div><b>Bill To:</b> {clientName(printing.client_id)}</div>
              <div>{client(printing.client_id)?.address || ""}</div>
              <div>TRN: {client(printing.client_id)?.trn || "—"}</div>
              <div><b>Project:</b> {projName(printing.project_id)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div><b>Invoice No:</b> {printing.invoice_number}</div>
              <div><b>Date:</b> {fmtDate(printing.invoice_date)}</div>
              <div><b>Due:</b> {fmtDate(printing.due_date)}</div>
              {printing.progress_percent ? <div><b>Progress:</b> {printing.progress_percent}%</div> : null}
            </div>
          </div>
          {printing.subject && <div style={{ fontSize: 14, fontWeight: 600, margin: "8px 0" }}>{printing.subject}</div>}
          <ItemsTable items={printing.items || []} />
          <TotalsBlock subtotal={printing.subtotal || 0} vat={printing.vat_amount || 0} total={printing.total_amount || 0}
            extra={printing.retention_percent ? (
              <tr><td style={{ padding: "4px 8px", fontSize: 13 }}>Retention ({printing.retention_percent}%)</td><td style={{ padding: "4px 8px", textAlign: "right", fontSize: 13 }}>-{fmtAED(retentionAmt(printing))}</td></tr>
            ) : undefined} />
          <div style={{ marginTop: 20, fontSize: 12, background: "#f7f7f7", padding: 12, borderRadius: 6 }}>
            <b>Payment Details</b><br />
            Bank: {COMPANY.bank.name} · A/C: {COMPANY.bank.account}<br />
            IBAN: {COMPANY.bank.iban} · SWIFT: {COMPANY.bank.swift}
          </div>
          {printing.notes && <div style={{ fontSize: 12, marginTop: 10 }}>{printing.notes}</div>}
          <SignatureLines left="For NXS Contracting" right="Received By" />
        </PrintDialog>
      )}
    </div>
  );
}
