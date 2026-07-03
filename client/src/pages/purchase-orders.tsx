import { useState } from "react";
import { PageHeader, useList, useSave, useRemove, StatusBadge } from "@/components/common";
import { DataTable } from "@/components/data-table";
import { FormDialog, FormFieldDef, LineItemsEditor } from "@/components/crud-kit";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Printer, X, ExternalLink } from "lucide-react";
import { fmtDate, fmtAED, nextNumber, computeTotals, COMPANY } from "@/lib/nxs";
import { amountInWords } from "@/lib/amount-to-words";
import { openPrintTab } from "@/components/print-doc";

export default function PurchaseOrders() {
  const { data, isLoading } = useList("purchase_orders");
  const { data: vendors } = useList("vendors");
  const { data: projects } = useList("projects");
  const save = useSave("purchase_orders");
  const remove = useRemove("purchase_orders");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [printing, setPrinting] = useState<any>(null);

  const vendorName = (id: string) => (vendors || []).find((v: any) => v.id === id)?.name || "—";
  const projName = (id: string) => (projects || []).find((p: any) => p.id === id)?.name || "—";
  const vendor = (id: string) => (vendors || []).find((v: any) => v.id === id);
  const project = (id: string) => (projects || []).find((p: any) => p.id === id);

  const fields: FormFieldDef[] = [
    { name: "po_number", label: "PO Number", required: true },
    { name: "vendor_id", label: "Vendor", type: "select", required: true, options: (vendors || []).map((v: any) => ({ value: v.id, label: v.name })) },
    { name: "project_id", label: "Project", type: "select", options: (projects || []).map((p: any) => ({ value: p.id, label: p.name })) },
    { name: "order_date", label: "Order Date", type: "date" },
    { name: "delivery_date", label: "Delivery Date", type: "date" },
    { name: "status", label: "Status", type: "select", options: ["draft", "sent", "partial", "received", "cancelled"].map((s) => ({ value: s, label: s })) },
    { name: "delivery_address", label: "Delivery Address", type: "textarea" },
    { name: "notes", label: "Notes / Terms", type: "textarea" },
  ];

  return (
    <div>
      <PageHeader title="Purchase Orders" subtitle="Supplier orders with VAT & line items"
        actions={<Button onClick={() => { setEditing({ po_number: nextNumber("NXS-PO"), order_date: new Date().toISOString().slice(0, 10), status: "draft", items: [] }); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New PO</Button>} />
      <DataTable rows={data} loading={isLoading}
        columns={[
          { header: "PO No.", cell: (r: any) => <span className="font-mono text-xs">{r.po_number}</span> },
          { header: "Vendor", cell: (r: any) => vendorName(r.vendor_id) },
          { header: "Project", cell: (r: any) => projName(r.project_id) },
          { header: "Date", cell: (r: any) => fmtDate(r.order_date) },
          { header: "Total", cell: (r: any) => fmtAED(r.total_amount) },
          { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
          { header: "", cell: (r: any) => <Button size="sm" variant="outline" onClick={() => setPrinting(r)}><Printer className="h-4 w-4" /></Button> },
        ]}
        onEdit={(r) => { setEditing(r); setOpen(true); }}
        onDelete={(r) => remove.mutate(r.id)} />

      <FormDialog open={open} onClose={() => setOpen(false)} title={editing?.id ? "Edit PO" : "New Purchase Order"}
        fields={fields} initial={editing} saving={save.isPending}
        onSave={(v) => { const t = computeTotals(v.items || []); save.mutate({ ...v, subtotal: t.subtotal, vat_amount: t.vat, total_amount: t.total }, { onSuccess: () => setOpen(false) }); }}
        extra={(values, set) => <LineItemsEditor items={values.items || []} onChange={(items) => set({ ...values, items })} />} />

      {printing && (
        <PoPrintDialog po={printing} vendor={vendor(printing.vendor_id)} project={project(printing.project_id)} onClose={() => setPrinting(null)} />
      )}
    </div>
  );
}

// ─── LPO Print Dialog ─────────────────────────────────────────────────────────
function PoPrintDialog({ po, vendor, project, onClose }: { po: any; vendor: any; project: any; onClose: () => void }) {
  const [showSignStamp, setShowSignStamp] = useState(true);
  const items = po.items || [];
  const subtotal = po.subtotal || 0;
  const vat = po.vat_amount || 0;
  const total = po.total_amount || 0;

  const html = buildPoHtml({ po, vendor, project, showSignStamp });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl p-0 flex flex-col" style={{ height: "92vh", maxHeight: "92vh" }}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0">
          <span className="font-semibold text-sm">LPO Preview — {po.po_number}</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch id="po-ss" checked={showSignStamp} onCheckedChange={setShowSignStamp} />
              <Label htmlFor="po-ss" className="text-xs cursor-pointer select-none">Sign &amp; Stamp</Label>
            </div>
            <Button size="sm" onClick={() => openPrintTab(html, `LPO ${po.po_number}`)} className="bg-amber-600 hover:bg-amber-700 text-white">
              <ExternalLink className="h-4 w-4 mr-1" /> Open Print View
            </Button>
            <Button size="sm" variant="outline" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto bg-slate-100 p-4">
          <iframe title="LPO preview" style={{ width: "100%", height: "100%", minHeight: 900, border: 0, background: "#fff" }} srcDoc={html} />
          <div className="text-xs text-slate-600 text-center mt-3 max-w-lg mx-auto leading-relaxed">
            Preview above is exactly how it will print (A4). Click <b>Open Print View</b> to print or save as PDF.
            Totals — Subtotal {fmtAED(subtotal)} · VAT {fmtAED(vat)} · <b>Total {fmtAED(total)}</b> ({items.length} line{items.length === 1 ? "" : "s"}).
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function buildPoHtml({ po, vendor, project, showSignStamp }: { po: any; vendor: any; project: any; showSignStamp: boolean }) {
  const items = po.items || [];
  const subtotal = Number(po.subtotal || 0);
  const vat = Number(po.vat_amount || 0);
  const total = Number(po.total_amount || 0);

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

  const signStampHtml = showSignStamp
    ? `<div style="position:relative; height:100px;">
         <img src="/assets/signature.png" alt="" style="position:absolute; top:0; left:0; height:60px; object-fit:contain;" onerror="this.style.display='none'" />
         <img src="/assets/stamp.png" alt="" style="position:absolute; top:6px; left:120px; height:90px; object-fit:contain; opacity:0.9;" onerror="this.style.display='none'" />
       </div>`
    : `<div style="height:100px; border:1px dashed #ccc; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:10px; color:#bbb;">Signature &amp; Stamp</div>`;

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
        <div style="font-size:22px; font-weight:800; color:#bd7214; letter-spacing:2px;">PURCHASE ORDER</div>
        <div style="font-size:11px; color:#555; margin-top:2px;">LPO No: <b>${escapeHtml(po.po_number || "—")}</b></div>
        <div style="font-size:11px; color:#555;">Date: ${fmtDate(po.order_date)}</div>
      </div>
    </div>

    <!-- Vendor / project block -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; font-size:11px; margin-bottom:12px;">
      <div style="border:1px solid #e5e7eb; border-radius:4px; padding:8px 10px;">
        <div style="font-size:9px; color:#bd7214; font-weight:700; letter-spacing:1px; text-transform:uppercase;">Supplier</div>
        <div style="font-weight:700; font-size:12px; margin-top:2px;">${escapeHtml(vendor?.name || "—")}</div>
        ${vendor?.address ? `<div style="color:#555;">${escapeHtml(vendor.address)}</div>` : ""}
        ${vendor?.contact_person ? `<div>Attn: ${escapeHtml(vendor.contact_person)}</div>` : ""}
        ${vendor?.phone ? `<div>Tel: ${escapeHtml(vendor.phone)}</div>` : ""}
        ${vendor?.email ? `<div>Email: ${escapeHtml(vendor.email)}</div>` : ""}
        ${vendor?.trn ? `<div>TRN: ${escapeHtml(vendor.trn)}</div>` : ""}
      </div>
      <div style="border:1px solid #e5e7eb; border-radius:4px; padding:8px 10px;">
        <div style="font-size:9px; color:#bd7214; font-weight:700; letter-spacing:1px; text-transform:uppercase;">Order Details</div>
        <div style="margin-top:2px;"><b>Project:</b> ${escapeHtml(project?.name || "—")}</div>
        <div><b>Delivery Date:</b> ${fmtDate(po.delivery_date)}</div>
        ${po.delivery_address ? `<div><b>Deliver To:</b> ${escapeHtml(po.delivery_address)}</div>` : ""}
        <div><b>Status:</b> <span style="text-transform:capitalize;">${escapeHtml(po.status || "draft")}</span></div>
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

    <!-- Totals + amount in words -->
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-top:14px; gap:20px;">
      <div style="flex:1; font-size:11px;">
        <div style="font-weight:700; color:#0c1125; margin-bottom:4px;">Amount in Words:</div>
        <div style="border:1px solid #e5e7eb; padding:6px 10px; border-radius:4px; background:#fafafa; font-style:italic;">
          ${escapeHtml(amountInWords(total))}
        </div>
      </div>
      <table style="font-size:12px; min-width:260px;">
        <tbody>
          <tr><td style="padding:3px 12px 3px 0; color:#555;">Subtotal</td><td style="text-align:right; font-family:monospace;">AED ${fmtN(subtotal)}</td></tr>
          <tr><td style="padding:3px 12px 3px 0; color:#555;">VAT (5%)</td><td style="text-align:right; font-family:monospace;">AED ${fmtN(vat)}</td></tr>
          <tr style="border-top:2px solid #0c1125;">
            <td style="padding:6px 12px 6px 0; font-weight:700; font-size:13px;">TOTAL</td>
            <td style="text-align:right; font-weight:800; font-size:13px; color:#bd7214; font-family:monospace;">AED ${fmtN(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Notes / terms -->
    ${po.notes ? `
    <div style="margin-top:14px; padding:10px 12px; border-left:3px solid #bd7214; background:#f9f6ef; font-size:11px;">
      <div style="font-weight:700; margin-bottom:4px;">Terms &amp; Notes:</div>
      <div style="white-space:pre-wrap; color:#333;">${escapeHtml(po.notes)}</div>
    </div>` : ""}

    <!-- Standard terms -->
    <div style="margin-top:12px; font-size:10px; color:#555; line-height:1.6;">
      <div style="font-weight:700; color:#0c1125; margin-bottom:2px;">Standard Terms:</div>
      <ol style="padding-left:16px; margin:0;">
        <li>Please quote our PO number on all delivery notes, invoices &amp; correspondence.</li>
        <li>Goods to be delivered to the site address above during working hours only.</li>
        <li>All materials must match approved samples / brand mentioned above; sub-standard supply will be rejected.</li>
        <li>Payment 30 days after receipt of tax invoice, subject to full delivery &amp; inspection.</li>
      </ol>
    </div>

    <!-- Signatures -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:30px; margin-top:26px;">
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
        <div style="font-size:10px; color:#666; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Received / Accepted By (Supplier)</div>
        <div style="font-weight:700; font-size:11px; margin-top:2px;">${escapeHtml(vendor?.name || "Supplier")}</div>
        <div style="margin-top:6px; height:100px; border:1px dashed #ccc; border-radius:4px;"></div>
        <div style="border-top:1px solid #333; padding-top:4px; font-size:11px;">
          <div>Name / Signature &amp; Stamp</div>
          <div style="font-size:10px; color:#666;">Date: _______________________</div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="margin-top:20px; padding-top:8px; border-top:1px solid #e5e7eb; display:flex; justify-content:space-between; font-size:9px; color:#aaa;">
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
