import { useState } from "react";
import { PageHeader, useList, useSave, useRemove, StatusBadge } from "@/components/common";
import { DataTable } from "@/components/data-table";
import { FormDialog, FormFieldDef, LineItemsEditor } from "@/components/crud-kit";
import { QuickAddSelect } from "@/components/quick-add-select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Printer, X, ExternalLink } from "lucide-react";
import { fmtDate, fmtAED, nextNumber, computeTotals, COMPANY } from "@/lib/nxs";
import { amountInWords } from "@/lib/amount-to-words";
import { openPrintTab } from "@/components/print-doc";

export default function Invoices() {
  const { data, isLoading } = useList("invoices");
  const { data: clients } = useList("clients");
  const { data: projects } = useList("projects");
  const save = useSave("invoices");
  const remove = useRemove("invoices");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [printing, setPrinting] = useState<any>(null);

  const client = (id: string) => (clients || []).find((c: any) => c.id === id);
  const project = (id: string) => (projects || []).find((p: any) => p.id === id);

  const fields: FormFieldDef[] = [
    { name: "invoice_number", label: "Invoice No.", required: true },
    { name: "invoice_type", label: "Type", type: "select", required: true, options: ["standard", "advance", "progressive", "final"].map((s) => ({ value: s, label: s })) },
    { name: "invoice_date", label: "Invoice Date", type: "date" },
    { name: "due_date", label: "Due Date", type: "date" },
    { name: "status", label: "Status", type: "select", options: ["draft", "sent", "partial", "paid", "overdue", "cancelled"].map((s) => ({ value: s, label: s })) },
    { name: "progress_percent", label: "Progress %", type: "number" },
    { name: "retention_percent", label: "Retention %", type: "number" },
    { name: "advance_received", label: "Advance Received (AED)", type: "number" },
    { name: "amount_paid", label: "Amount Paid (AED)", type: "number" },
    { name: "subject", label: "Subject", col: 2 },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  return (
    <div>
      <PageHeader title="Invoices" subtitle="Advance, progressive, final & standard tax invoices"
        actions={<Button onClick={() => { setEditing({ invoice_number: nextNumber("NXS-INV"), invoice_type: "standard", invoice_date: new Date().toISOString().slice(0, 10), status: "draft", items: [] }); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New Invoice</Button>} />
      <DataTable rows={data} loading={isLoading}
        columns={[
          { header: "Invoice No.", cell: (r: any) => <span className="font-mono text-xs">{r.invoice_number}</span> },
          { header: "Type", cell: (r: any) => <span className="capitalize">{r.invoice_type}</span> },
          { header: "Client", cell: (r: any) => client(r.client_id)?.name || "—" },
          { header: "Date", cell: (r: any) => fmtDate(r.invoice_date) },
          { header: "Total", cell: (r: any) => fmtAED(r.total_amount) },
          { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
          { header: "", cell: (r: any) => <Button size="sm" variant="outline" onClick={() => setPrinting(r)}><Printer className="h-4 w-4" /></Button> },
        ]}
        onEdit={(r) => { setEditing(r); setOpen(true); }} onDelete={(r) => remove.mutate(r.id)} />

      <FormDialog open={open} onClose={() => setOpen(false)} title={editing?.id ? "Edit Invoice" : "New Invoice"}
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
        <InvoicePrintDialog inv={printing} client={client(printing.client_id)} project={project(printing.project_id)} onClose={() => setPrinting(null)} />
      )}
    </div>
  );
}

// ─── Invoice Print Dialog ─────────────────────────────────────────────────────
function InvoicePrintDialog({ inv, client, project, onClose }: { inv: any; client: any; project: any; onClose: () => void }) {
  const [showSignStamp, setShowSignStamp] = useState(true);
  const [showBank, setShowBank] = useState(true);

  const html = buildInvoiceHtml({ inv, client, project, showSignStamp, showBank });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl p-0 flex flex-col" style={{ height: "92vh", maxHeight: "92vh" }}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0">
          <span className="font-semibold text-sm">Invoice Preview — {inv.invoice_number}</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch id="inv-bank" checked={showBank} onCheckedChange={setShowBank} />
              <Label htmlFor="inv-bank" className="text-xs cursor-pointer select-none">Bank Details</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="inv-ss" checked={showSignStamp} onCheckedChange={setShowSignStamp} />
              <Label htmlFor="inv-ss" className="text-xs cursor-pointer select-none">Sign &amp; Stamp</Label>
            </div>
            <Button size="sm" onClick={() => openPrintTab(html, `Invoice ${inv.invoice_number}`)} className="bg-amber-600 hover:bg-amber-700 text-white">
              <ExternalLink className="h-4 w-4 mr-1" /> Open Print View
            </Button>
            <Button size="sm" variant="outline" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto bg-slate-100 p-4">
          <iframe title="Invoice preview" style={{ width: "100%", height: "100%", minHeight: 900, border: 0, background: "#fff" }} srcDoc={html} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function buildInvoiceHtml({ inv, client, project, showSignStamp, showBank }: { inv: any; client: any; project: any; showSignStamp: boolean; showBank: boolean }) {
  const items = inv.items || [];
  const subtotal = Number(inv.subtotal || 0);
  const vat = Number(inv.vat_amount || 0);
  const total = Number(inv.total_amount || 0);
  const retentionPct = Number(inv.retention_percent || 0);
  const retentionAmt = Math.round(subtotal * retentionPct) / 100;
  const advance = Number(inv.advance_received || 0);
  const paid = Number(inv.amount_paid || 0);
  const balanceDue = Math.max(0, total - retentionAmt - advance - paid);

  const rowsHtml = items.length === 0
    ? `<tr><td colspan="6" style="text-align:center;padding:16px;color:#999;">No items</td></tr>`
    : items.map((it: any, i: number) => `
      <tr style="border-bottom:1px solid #e5e7eb; ${i % 2 ? 'background:#fafafa;' : ''}">
        <td style="padding:6px 8px; vertical-align:top;">${i + 1}</td>
        <td style="padding:6px 8px; vertical-align:top;">${escapeHtml(it.description || "")}</td>
        <td style="padding:6px 8px; text-align:center; vertical-align:top;">${Number(it.quantity || 0)}</td>
        <td style="padding:6px 8px; text-align:center; vertical-align:top;">${escapeHtml(it.unit || "—")}</td>
        <td style="padding:6px 8px; text-align:right; vertical-align:top;">${fmtN(Number(it.unit_price || 0))}</td>
        <td style="padding:6px 8px; text-align:right; vertical-align:top; font-weight:600;">${fmtN(Number(it.amount ?? Number(it.quantity || 0) * Number(it.unit_price || 0)))}</td>
      </tr>`).join("");

  const totalsExtras: string[] = [];
  if (retentionPct > 0) totalsExtras.push(`<tr><td style="padding:3px 12px 3px 0; color:#555;">Retention (${retentionPct}%)</td><td style="text-align:right; font-family:monospace; color:#c00;">- AED ${fmtN(retentionAmt)}</td></tr>`);
  if (advance > 0) totalsExtras.push(`<tr><td style="padding:3px 12px 3px 0; color:#555;">Less: Advance Received</td><td style="text-align:right; font-family:monospace; color:#c00;">- AED ${fmtN(advance)}</td></tr>`);
  if (paid > 0) totalsExtras.push(`<tr><td style="padding:3px 12px 3px 0; color:#555;">Less: Amount Paid</td><td style="text-align:right; font-family:monospace; color:#c00;">- AED ${fmtN(paid)}</td></tr>`);

  const signStampHtml = showSignStamp
    ? `<div style="position:relative; height:100px;">
         <img src="/assets/signature.png" alt="" style="position:absolute; top:0; left:0; height:60px; object-fit:contain;" onerror="this.style.display='none'" />
         <img src="/assets/stamp.png" alt="" style="position:absolute; top:6px; left:120px; height:90px; object-fit:contain; opacity:0.9;" onerror="this.style.display='none'" />
       </div>`
    : `<div style="height:100px; border:1px dashed #ccc; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:10px; color:#bbb;">Signature &amp; Stamp</div>`;

  const bankBlock = showBank ? `
    <div style="margin-top:14px; padding:10px 12px; background:#f9f6ef; border-left:3px solid #bd7214; font-size:11px;">
      <div style="font-weight:700; color:#0c1125; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px; font-size:10px;">Payment / Bank Details</div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
        <div><b>Beneficiary:</b> ${escapeHtml(COMPANY.name)}</div>
        <div><b>Bank:</b> ${escapeHtml(COMPANY.bank.name)}</div>
        <div><b>Account No:</b> ${escapeHtml(COMPANY.bank.account)}</div>
        <div><b>IBAN:</b> ${escapeHtml(COMPANY.bank.iban)}</div>
        <div><b>SWIFT:</b> ${escapeHtml(COMPANY.bank.swift)}</div>
        <div><b>Currency:</b> AED</div>
      </div>
    </div>` : "";

  const invoiceTypeLabel = (inv.invoice_type || "standard").toString().toUpperCase();

  return `
  <div class="page">
    <!-- Letterhead -->
    <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #bd7214; padding-bottom:12px; margin-bottom:14px;">
      <div style="display:flex; align-items:center; gap:12px;">
        <img src="${COMPANY.logo}" alt="NXS" style="height:56px; object-fit:contain;" onerror="this.style.display='none'" />
        <div>
          <div style="color:#0c1125; font-weight:800; font-size:16px;">${escapeHtml(COMPANY.name)}</div>
          <div style="color:#555; font-size:10px;">${escapeHtml(COMPANY.address)}</div>
          <div style="color:#555; font-size:10px;">Tel: ${escapeHtml(COMPANY.landline)} · ${escapeHtml(COMPANY.phone)} · ${escapeHtml(COMPANY.email)}</div>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:22px; font-weight:800; color:#bd7214; letter-spacing:2px;">TAX INVOICE</div>
        <div style="font-size:10px; color:#555; margin-top:2px;">${invoiceTypeLabel} · TRN: 100XXXXXXXXX0003</div>
        <div style="font-size:11px; color:#555; margin-top:4px;">Invoice No: <b>${escapeHtml(inv.invoice_number || "—")}</b></div>
        <div style="font-size:11px; color:#555;">Date: ${fmtDate(inv.invoice_date)}</div>
        ${inv.due_date ? `<div style="font-size:11px; color:#555;">Due: ${fmtDate(inv.due_date)}</div>` : ""}
      </div>
    </div>

    <!-- Client / project block -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; font-size:11px; margin-bottom:12px;">
      <div style="border:1px solid #e5e7eb; border-radius:4px; padding:8px 10px;">
        <div style="font-size:9px; color:#bd7214; font-weight:700; letter-spacing:1px; text-transform:uppercase;">Bill To</div>
        <div style="font-weight:700; font-size:12px; margin-top:2px;">${escapeHtml(client?.name || "—")}</div>
        ${client?.address ? `<div style="color:#555;">${escapeHtml(client.address)}</div>` : ""}
        ${client?.contact_person ? `<div>Attn: ${escapeHtml(client.contact_person)}</div>` : ""}
        ${client?.phone ? `<div>Tel: ${escapeHtml(client.phone)}</div>` : ""}
        ${client?.email ? `<div>Email: ${escapeHtml(client.email)}</div>` : ""}
        ${client?.trn ? `<div><b>TRN:</b> ${escapeHtml(client.trn)}</div>` : ""}
      </div>
      <div style="border:1px solid #e5e7eb; border-radius:4px; padding:8px 10px;">
        <div style="font-size:9px; color:#bd7214; font-weight:700; letter-spacing:1px; text-transform:uppercase;">Project / Reference</div>
        <div style="margin-top:2px;"><b>Project:</b> ${escapeHtml(project?.name || "—")}</div>
        ${inv.progress_percent ? `<div><b>Work Progress:</b> ${inv.progress_percent}%</div>` : ""}
        ${inv.subject ? `<div style="margin-top:4px;"><b>Subject:</b> ${escapeHtml(inv.subject)}</div>` : ""}
      </div>
    </div>

    <!-- Items -->
    <table style="width:100%; border-collapse:collapse; font-size:11px;">
      <thead>
        <tr style="background:#0c1125; color:#fff;">
          <th style="padding:7px 8px; text-align:left; width:32px;">#</th>
          <th style="padding:7px 8px; text-align:left;">Description</th>
          <th style="padding:7px 8px; text-align:center; width:60px;">Qty</th>
          <th style="padding:7px 8px; text-align:center; width:60px;">Unit</th>
          <th style="padding:7px 8px; text-align:right; width:90px;">Unit Price (AED)</th>
          <th style="padding:7px 8px; text-align:right; width:100px;">Amount (AED)</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>

    <!-- Totals -->
    <div style="display:flex; justify-content:flex-end; margin-top:12px;">
      <table style="font-size:12px; min-width:320px;">
        <tbody>
          <tr><td style="padding:3px 12px 3px 0; color:#555;">Subtotal</td><td style="text-align:right; font-family:monospace;">AED ${fmtN(subtotal)}</td></tr>
          <tr><td style="padding:3px 12px 3px 0; color:#555;">VAT (5%)</td><td style="text-align:right; font-family:monospace;">AED ${fmtN(vat)}</td></tr>
          <tr style="border-top:2px solid #0c1125;">
            <td style="padding:6px 12px 6px 0; font-weight:700; font-size:13px;">TOTAL (incl. VAT)</td>
            <td style="text-align:right; font-weight:800; font-size:13px; color:#bd7214; font-family:monospace;">AED ${fmtN(total)}</td>
          </tr>
          ${totalsExtras.join("")}
          <tr style="border-top:2px solid #0c1125; background:#fff8ee;">
            <td style="padding:8px 12px 8px 0; font-weight:800; font-size:14px; color:#0c1125;">BALANCE DUE</td>
            <td style="text-align:right; font-weight:800; font-size:14px; color:#0c1125; font-family:monospace;">AED ${fmtN(balanceDue)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Amount in words -->
    <div style="margin-top:12px; font-size:11px;">
      <div style="font-weight:700; color:#0c1125; margin-bottom:2px;">Amount in Words (Total):</div>
      <div style="border:1px solid #e5e7eb; padding:6px 10px; border-radius:4px; background:#fafafa; font-style:italic;">
        ${escapeHtml(amountInWords(total))}
      </div>
    </div>

    ${bankBlock}

    ${inv.notes ? `
    <div style="margin-top:12px; font-size:11px; color:#555;">
      <b>Notes:</b> ${escapeHtml(inv.notes)}
    </div>` : ""}

    <div style="margin-top:8px; font-size:9px; color:#888; font-style:italic;">
      All amounts are in UAE Dirhams (AED) and inclusive of 5% VAT where applicable, as per UAE Federal Tax Authority regulations.
    </div>

    <!-- Signatures -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:30px; margin-top:22px; page-break-inside:avoid;">
      <div>
        <div style="font-size:10px; color:#666; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">For &amp; on behalf of</div>
        <div style="font-weight:700; color:#bd7214; font-size:11px; margin-top:2px;">${escapeHtml(COMPANY.name)}</div>
        <div style="margin-top:6px;">${signStampHtml}</div>
        <div style="border-top:1px solid #333; padding-top:4px; font-size:11px;">
          <div style="font-weight:600;">Sandeep</div>
          <div style="font-size:10px; color:#666;">Managing Director</div>
        </div>
      </div>
      <div>
        <div style="font-size:10px; color:#666; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Received By (Client)</div>
        <div style="font-weight:700; font-size:11px; margin-top:2px;">${escapeHtml(client?.name || "Client")}</div>
        <div style="margin-top:6px; height:100px; border:1px dashed #ccc; border-radius:4px;"></div>
        <div style="border-top:1px solid #333; padding-top:4px; font-size:11px;">
          <div>Name / Signature &amp; Stamp</div>
          <div style="font-size:10px; color:#666;">Date: _______________________</div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="margin-top:16px; padding-top:8px; border-top:1px solid #e5e7eb; display:flex; justify-content:space-between; font-size:9px; color:#aaa;">
      <span>${escapeHtml(COMPANY.name)} | ${escapeHtml(COMPANY.address)}</span>
      <span>T: ${escapeHtml(COMPANY.phone)} | ${escapeHtml(COMPANY.email)} | ${escapeHtml(COMPANY.website)}</span>
    </div>
  </div>`;
}

function escapeHtml(s: any): string {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function fmtN(n: number): string {
  return Number(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
