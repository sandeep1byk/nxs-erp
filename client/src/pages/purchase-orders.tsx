import { useState } from "react";
import { PageHeader, useList, useSave, useRemove, StatusBadge } from "@/components/common";
import { DataTable } from "@/components/data-table";
import { FormDialog, FormFieldDef, LineItemsEditor } from "@/components/crud-kit";
import { PrintDialog, ItemsTable, TotalsBlock, SignatureLines } from "@/components/print-doc";
import { Button } from "@/components/ui/button";
import { Plus, Printer } from "lucide-react";
import { fmtDate, fmtAED, nextNumber, computeTotals } from "@/lib/nxs";

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
        <PrintDialog open={!!printing} onClose={() => setPrinting(null)} title={`Purchase Order ${printing.po_number}`}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0c1125", marginBottom: 12 }}>PURCHASE ORDER</h2>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
            <div>
              <div><b>To Vendor:</b> {vendorName(printing.vendor_id)}</div>
              <div>{vendor(printing.vendor_id)?.address || ""}</div>
              <div>TRN: {vendor(printing.vendor_id)?.trn || "—"}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div><b>PO No:</b> {printing.po_number}</div>
              <div><b>Date:</b> {fmtDate(printing.order_date)}</div>
              <div><b>Delivery:</b> {fmtDate(printing.delivery_date)}</div>
              <div><b>Project:</b> {projName(printing.project_id)}</div>
            </div>
          </div>
          {printing.delivery_address && <div style={{ fontSize: 12, marginBottom: 6 }}><b>Deliver To:</b> {printing.delivery_address}</div>}
          <ItemsTable items={printing.items || []} />
          <TotalsBlock subtotal={printing.subtotal || 0} vat={printing.vat_amount || 0} total={printing.total_amount || 0} />
          {printing.notes && <div style={{ fontSize: 12, marginTop: 16 }}><b>Terms & Notes:</b><br />{printing.notes}</div>}
          <SignatureLines left="Prepared By" right="Approved By" />
        </PrintDialog>
      )}
    </div>
  );
}
