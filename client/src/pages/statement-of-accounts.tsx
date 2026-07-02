/**
 * Statement of Accounts (SOA)
 *
 * Opens a full statement for any client, vendor, or account ledger.
 * Features:
 *  - Date range filter, debit/credit/all filter, keyword search
 *  - Bill-wise view: shows only open invoices; paid/allocated ones hidden
 *  - Temp-hide rows (click row to select, Hide Selected button, Restore All)
 *  - Payment allocation: link a bank receipt to specific invoices
 *  - Export to PDF (print) or Excel
 *  - Running balance column
 */
import { useState, useMemo } from "react";
import { PageHeader, useList } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { fmtDate, fmtAED, COMPANY } from "@/lib/nxs";
import { Download, FileText, EyeOff, RotateCcw, CheckCircle, Loader2, Link } from "lucide-react";
import * as XLSX from "xlsx";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Filters { dateFrom: string; dateTo: string; direction: "all"|"debit"|"credit"; keyword: string; }
const emptyFilters: Filters = { dateFrom: "", dateTo: "", direction: "all", keyword: "" };

// ── Filter bar ────────────────────────────────────────────────────────────────
function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const hasFilter = filters.dateFrom || filters.dateTo || filters.direction !== "all" || filters.keyword;
  return (
    <div className="flex flex-wrap items-end gap-3 p-3 bg-muted/30 rounded-lg border mb-3">
      <div className="space-y-1">
        <Label className="text-xs">From Date</Label>
        <Input type="date" className="h-8 text-xs w-36" value={filters.dateFrom}
          onChange={e => onChange({ ...filters, dateFrom: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">To Date</Label>
        <Input type="date" className="h-8 text-xs w-36" value={filters.dateTo}
          onChange={e => onChange({ ...filters, dateTo: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Show</Label>
        <Select value={filters.direction} onValueChange={v => onChange({ ...filters, direction: v as any })}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entries</SelectItem>
            <SelectItem value="debit">Debit Only</SelectItem>
            <SelectItem value="credit">Credit Only</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1 flex-1 min-w-36">
        <Label className="text-xs">Search Keywords</Label>
        <Input type="text" className="h-8 text-xs" placeholder="e.g. invoice, payment, NXS-INV-001..."
          value={filters.keyword}
          onChange={e => onChange({ ...filters, keyword: e.target.value })} />
      </div>
      {hasFilter && (
        <Button variant="ghost" size="sm" className="h-8 text-xs mt-5"
          onClick={() => onChange({ ...emptyFilters })}>Clear All</Button>
      )}
    </div>
  );
}

// ── Export helpers ─────────────────────────────────────────────────────────────
function exportExcel(rows: any[], title: string, cols: {key:string;label:string}[]) {
  const data = rows.map(r => { const o: any = {}; cols.forEach(c => { o[c.label] = r[c.key] ?? ""; }); return o; });
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "SOA");
  XLSX.writeFile(wb, `${title.replace(/\s+/g, "_")}.xlsx`);
}

function exportPDF(rows: any[], title: string, cols: {key:string;label:string}[], meta: string) {
  const numKeys = new Set(["debit","credit","balance","amount","allocated","outstanding"]);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:10px;margin:20px;color:#111}
    h1{font-size:14px;margin:0 0 2px} p.sub{font-size:9px;color:#666;margin:0 0 10px}
    table{width:100%;border-collapse:collapse}
    th{background:#0c1125;color:#fff;padding:4px 7px;font-size:9px;text-align:left}
    td{padding:3px 7px;border-bottom:1px solid #eee;font-size:9px}
    tr:nth-child(even) td{background:#f9f9f9}
    .num{text-align:right} .red{color:#c00} .green{color:#060}
    .footer{margin-top:12px;font-size:8px;color:#999}
  </style></head><body>
  <h1>${title}</h1><p class="sub">${meta} — Exported ${new Date().toLocaleDateString("en-AE")}</p>
  <table><thead><tr>${cols.map(c=>`<th class="${numKeys.has(c.key)?"num":""}">${c.label}</th>`).join("")}</tr></thead>
  <tbody>${rows.map(r=>`<tr>${cols.map(c=>{
    const v = r[c.key]??"";
    const cls = c.key==="debit"?"num red":c.key==="credit"?"num green":numKeys.has(c.key)?"num":"";
    return `<td class="${cls}">${v}</td>`;
  }).join("")}</tr>`).join("")}</tbody></table>
  <p class="footer">NXS Contracting &amp; Building Maintenance LLC | ${new Date().toISOString()}</p>
  </body></html>`;
  const w = window.open("","_blank");
  if (!w) return;
  w.document.write(html); w.document.close(); w.focus();
  setTimeout(()=>w.print(), 600);
}

// ── Payment Allocation Dialog ─────────────────────────────────────────────────
// Lets you link a received bank transaction to one or more invoices.
function AllocatePaymentDialog({
  txn, clientId, invoices, allocations, onClose
}: {
  txn: any; clientId: string; invoices: any[]; allocations: any[]; onClose: () => void;
}) {
  const { toast } = useToast();
  const [amounts, setAmounts] = useState<Record<string,string>>({});
  const [saving, setSaving] = useState(false);

  const txnAmount = txn.credit || 0;
  const clientInvoices = invoices.filter(inv =>
    inv.client_id === clientId &&
    !["paid","cancelled"].includes(inv.status)
  );

  const existingMap: Record<string,number> = {};
  allocations.filter(a => a.bank_txn_id === txn.id).forEach(a => {
    existingMap[a.invoice_id] = a.allocated_amount;
  });

  const totalAllocated = Object.values(amounts).reduce((s, v) => s + (parseFloat(v)||0), 0)
    + Object.entries(existingMap).filter(([id]) => !(id in amounts)).reduce((s,[,v])=>s+v, 0);

  async function doSave() {
    setSaving(true);
    try {
      for (const [invId, amtStr] of Object.entries(amounts)) {
        const amt = parseFloat(amtStr) || 0;
        if (amt <= 0) continue;
        const existing = allocations.find(a => a.bank_txn_id === txn.id && a.invoice_id === invId);
        if (existing) {
          await apiRequest("PUT", `/api/payment_allocations/${existing.id}`, { ...existing, allocated_amount: amt });
        } else {
          await apiRequest("POST", "/api/payment_allocations", {
            bank_txn_id: txn.id, invoice_id: invId, allocated_amount: amt,
          });
        }
        // Update invoice paid_amount
        const inv = invoices.find(i => i.id === invId);
        if (inv) {
          const prevAllocs = allocations.filter(a => a.invoice_id === invId && a.bank_txn_id !== txn.id);
          const prevTotal = prevAllocs.reduce((s:number,a:any)=>s+(a.allocated_amount||0),0);
          const newPaid = Math.min(prevTotal + amt, inv.total_amount || 0);
          const newStatus = newPaid >= (inv.total_amount || 0) ? "paid" : newPaid > 0 ? "partial" : inv.status;
          await apiRequest("PUT", `/api/invoices/${invId}`, { ...inv, paid_amount: newPaid, status: newStatus });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/payment_allocations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Payment allocated successfully" });
      onClose();
    } catch(e:any) { toast({ title:"Error", description:e.message, variant:"destructive"}); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={o=>!o&&onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Allocate Payment to Invoices</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <div className="p-3 bg-muted/40 rounded-lg flex justify-between text-xs">
            <span><b>Transaction:</b> {fmtDate(txn.txn_date)} — {txn.description?.slice(0,60)}</span>
            <span className="text-green-600 font-bold">{fmtAED(txnAmount)}</span>
          </div>
          <p className="text-xs text-muted-foreground">Enter the amount to allocate against each open invoice. Total must not exceed the payment amount.</p>
          {clientInvoices.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground text-sm">No open invoices for this client.</p>
          ) : (
            <div className="space-y-2">
              {clientInvoices.map(inv => {
                const outstanding = (inv.total_amount||0) - (inv.paid_amount||0);
                const existing = existingMap[inv.id] || 0;
                return (
                  <div key={inv.id} className="flex items-center gap-3 p-2.5 border rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{inv.invoice_number}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Total: {fmtAED(inv.total_amount)} | Paid: {fmtAED(inv.paid_amount||0)} | Due: {fmtAED(outstanding)} | Due date: {fmtDate(inv.due_date)}
                      </p>
                    </div>
                    <div className="w-28 shrink-0">
                      <Input type="number" className="h-7 text-xs text-right"
                        placeholder={existing ? String(existing) : "0.00"}
                        defaultValue={existing || ""}
                        min={0} max={outstanding}
                        onChange={e => setAmounts(prev => ({ ...prev, [inv.id]: e.target.value }))} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className={`flex justify-between text-xs p-2 rounded ${totalAllocated > txnAmount ? "bg-red-50 text-red-600" : "bg-muted/30"}`}>
            <span>Payment amount: {fmtAED(txnAmount)}</span>
            <span>Allocated so far: {fmtAED(totalAllocated)}</span>
            <span>Remaining: {fmtAED(txnAmount - totalAllocated)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={doSave} disabled={saving || totalAllocated > txnAmount}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Saving…</> : "Save Allocation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StatementOfAccounts() {
  const clients   = useList("clients");
  const invoices  = useList("invoices");
  const txnsAll   = useList("bank_transactions");
  const { data: allocations = [] } = useQuery<any[]>({ queryKey: ["/api/payment_allocations"] });

  const [ledgerType, setLedgerType] = useState<"client"|"vendor">("client");
  const [selectedId, setSelectedId]   = useState("");
  const [filters, setFilters]         = useState<Filters>({ ...emptyFilters });
  const [billwise, setBillwise]       = useState(false);
  const [hiddenRows, setHiddenRows]   = useState<Set<number>>(new Set());
  const [checkedRows, setCheckedRows] = useState<Set<number>>(new Set());
  const [allocateTxn, setAllocateTxn] = useState<any>(null);

  // ── Build SOA rows ──────────────────────────────────────────────────────────
  const { soaRows, openingBalance, meta } = useMemo(() => {
    if (!selectedId) return { soaRows: [], openingBalance: 0, meta: "" };

    const client = (clients.data||[]).find((c:any) => c.id === selectedId);
    if (!client) return { soaRows: [], openingBalance: 0, meta: "" };

    // All invoices for this client
    const clientInvoices = (invoices.data||[]).filter((i:any) => i.client_id === selectedId);

    // All bank receipts matched to this client (by counterparty name match)
    const clientPayments = (txnsAll.data||[]).filter((t:any) =>
      t.credit > 0 &&
      t.counterparty &&
      t.counterparty.toLowerCase().includes(client.name.toLowerCase().slice(0, 6))
    );

    // Build rows: invoices = debit (amount owed by client), payments = credit
    const rows: any[] = [];

    clientInvoices.forEach((inv:any) => {
      rows.push({
        _type: "invoice",
        _id: inv.id,
        _raw: inv,
        date: inv.invoice_date,
        description: `Invoice ${inv.invoice_number}`,
        reference: inv.invoice_number,
        debit: inv.total_amount || 0,
        credit: 0,
        status: inv.status,
        paid_amount: inv.paid_amount || 0,
        due_date: inv.due_date,
      });
    });

    clientPayments.forEach((t:any) => {
      rows.push({
        _type: "payment",
        _id: t.id,
        _raw: t,
        date: t.txn_date,
        description: t.description || "Payment received",
        reference: t.reference || "—",
        debit: 0,
        credit: t.credit || 0,
        status: t.is_reconciled ? "Reconciled" : "Pending",
        paid_amount: 0,
        due_date: null,
      });
    });

    // Sort by date
    rows.sort((a, b) => (a.date||"") < (b.date||"") ? -1 : 1);

    // Running balance
    let running = 0;
    rows.forEach(r => {
      running += (r.debit||0) - (r.credit||0);
      r.balance = running;
    });

    return {
      soaRows: rows,
      openingBalance: 0,
      meta: `${client.name} | TRN: ${client.trn||"—"} | ${client.phone||""}`,
    };
  }, [selectedId, clients.data, invoices.data, txnsAll.data, allocations]);

  // ── Apply filters ───────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    const kw = filters.keyword.toLowerCase().trim();
    return soaRows.filter(r => {
      const d = (r.date || "").slice(0, 10);
      if (filters.dateFrom && d < filters.dateFrom) return false;
      if (filters.dateTo   && d > filters.dateTo)   return false;
      if (filters.direction === "debit"  && !r.debit)  return false;
      if (filters.direction === "credit" && !r.credit) return false;
      if (billwise && r._type === "invoice" && r.status === "paid") return false;
      if (kw) {
        const hay = [r.description, r.reference, r.status, String(r.debit||""), String(r.credit||"")].join(" ").toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [soaRows, filters, billwise]);

  // ── Visible rows (after temp-hide) ──────────────────────────────────────────
  const visibleRows = filteredRows.filter((_, i) => !hiddenRows.has(i));

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totalDebit    = visibleRows.reduce((s, r) => s + (r.debit  || 0), 0);
  const totalCredit   = visibleRows.reduce((s, r) => s + (r.credit || 0), 0);
  const closingBal    = totalDebit - totalCredit;

  // ── Export columns ──────────────────────────────────────────────────────────
  const COLS = [
    { key: "date",        label: "Date"        },
    { key: "description", label: "Description" },
    { key: "reference",   label: "Reference"   },
    { key: "debitFmt",    label: "Debit (AED)" },
    { key: "creditFmt",   label: "Credit (AED)"},
    { key: "balanceFmt",  label: "Balance"     },
    { key: "status",      label: "Status"      },
  ];

  const exportRows = visibleRows.map(r => ({
    date:        fmtDate(r.date),
    description: r.description,
    reference:   r.reference,
    debitFmt:    r.debit  ? fmtAED(r.debit)   : "—",
    creditFmt:   r.credit ? fmtAED(r.credit)  : "—",
    balanceFmt:  fmtAED(r.balance || 0),
    status:      r.status,
  }));

  const title = selectedId
    ? `Statement of Accounts — ${(clients.data||[]).find((c:any)=>c.id===selectedId)?.name || ""}`
    : "Statement of Accounts";

  function resetHide() { setHiddenRows(new Set()); setCheckedRows(new Set()); }

  return (
    <div>
      <PageHeader
        title="Statement of Accounts"
        subtitle="Full ledger for any client or vendor — filter, hide rows temporarily, allocate payments, and export"
      />

      {/* ── Selector bar ── */}
      <div className="flex flex-wrap items-end gap-3 p-3 bg-muted/30 rounded-lg border mb-3">
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select value={ledgerType} onValueChange={v => { setLedgerType(v as any); setSelectedId(""); resetHide(); }}>
            <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="client">Client</SelectItem>
              <SelectItem value="vendor">Vendor</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Select {ledgerType === "client" ? "Client" : "Vendor"}</Label>
          <Select value={selectedId} onValueChange={v => { setSelectedId(v); resetHide(); setFilters({ ...emptyFilters }); }}>
            <SelectTrigger className="h-8 text-xs w-56"><SelectValue placeholder="Pick one…" /></SelectTrigger>
            <SelectContent>
              {(clients.data||[]).map((c:any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Bill-wise toggle */}
        {selectedId && (
          <div className="flex items-center gap-2 mt-5">
            <input type="checkbox" id="billwise" className="h-3.5 w-3.5 cursor-pointer"
              checked={billwise} onChange={e => setBillwise(e.target.checked)} />
            <label htmlFor="billwise" className="text-xs cursor-pointer select-none">
              Bill-wise only (hide paid invoices)
            </label>
          </div>
        )}

        {/* Export buttons */}
        {selectedId && visibleRows.length > 0 && (
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
              onClick={() => exportExcel(exportRows, title, COLS)}>
              <Download className="h-3.5 w-3.5" />Excel
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
              onClick={() => exportPDF(exportRows, title, COLS, meta)}>
              <FileText className="h-3.5 w-3.5" />PDF
            </Button>
          </div>
        )}
      </div>

      {!selectedId ? (
        <div className="text-center py-20 border-2 border-dashed rounded-xl text-muted-foreground">
          <p className="font-medium text-base">Select a client above to open their statement</p>
          <p className="text-sm mt-1">Shows all invoices and payments in one view with running balance</p>
        </div>
      ) : (
        <>
          {/* Filters */}
          <FilterBar filters={filters} onChange={f => { setFilters(f); resetHide(); }} />

          {/* Summary strip */}
          <div className="flex flex-wrap gap-6 text-xs mb-3 px-1">
            <span>Rows shown: <strong>{visibleRows.length}</strong>{hiddenRows.size > 0 && <span className="text-muted-foreground ml-1">({hiddenRows.size} hidden)</span>}</span>
            <span>Total Invoiced: <strong className="text-red-600">{fmtAED(totalDebit)}</strong></span>
            <span>Total Received: <strong className="text-green-600">{fmtAED(totalCredit)}</strong></span>
            <span>Balance Due: <strong className={closingBal > 0 ? "text-amber-600" : "text-green-600"}>{fmtAED(closingBal)}</strong></span>
          </div>

          {/* Temp-hide toolbar */}
          {(checkedRows.size > 0 || hiddenRows.size > 0) && (
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {checkedRows.size > 0 && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => {
                    setHiddenRows(prev => { const n = new Set(prev); checkedRows.forEach(i => n.add(i)); return n; });
                    setCheckedRows(new Set());
                  }}>
                  <EyeOff className="h-3.5 w-3.5" />Hide {checkedRows.size} selected
                </Button>
              )}
              {hiddenRows.size > 0 && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={resetHide}>
                  <RotateCcw className="h-3.5 w-3.5" />Restore all ({hiddenRows.size} hidden)
                </Button>
              )}
              <span className="text-xs text-muted-foreground">Click rows to select, then hide temporarily for focused tracking</span>
            </div>
          )}

          {/* SOA Table */}
          <div className="border rounded-lg overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-2 py-2 w-6">
                    <input type="checkbox" className="h-3 w-3 cursor-pointer"
                      onChange={e => {
                        if (e.target.checked) {
                          setCheckedRows(new Set(filteredRows.map((_,i)=>i).filter(i=>!hiddenRows.has(i))));
                        } else setCheckedRows(new Set());
                      }} />
                  </th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Date</th>
                  <th className="text-left px-3 py-2 font-semibold">Description</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Reference</th>
                  <th className="text-right px-3 py-2 font-semibold whitespace-nowrap">Debit (AED)</th>
                  <th className="text-right px-3 py-2 font-semibold whitespace-nowrap">Credit (AED)</th>
                  <th className="text-right px-3 py-2 font-semibold whitespace-nowrap">Balance</th>
                  <th className="text-left px-3 py-2 font-semibold">Status</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">No entries match the current filters.</td></tr>
                ) : (
                  filteredRows.map((r, i) => {
                    if (hiddenRows.has(i)) return null;
                    const isChecked = checkedRows.has(i);
                    const isInvoice = r._type === "invoice";
                    const isPaid    = r.status === "paid";
                    return (
                      <tr key={i}
                        className={`border-b cursor-pointer select-none ${isChecked ? "bg-primary/5" : isPaid ? "bg-green-50/40 dark:bg-green-900/10" : isInvoice ? "hover:bg-muted/30" : "bg-blue-50/20 dark:bg-blue-900/5 hover:bg-blue-50/40"}`}
                        onClick={() => setCheckedRows(prev => { const n = new Set(prev); isChecked ? n.delete(i) : n.add(i); return n; })}>
                        <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" className="h-3 w-3 cursor-pointer" checked={isChecked}
                            onChange={e => setCheckedRows(prev => { const n = new Set(prev); e.target.checked ? n.add(i) : n.delete(i); return n; })} />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.date)}</td>
                        <td className="px-3 py-2" style={{ maxWidth: 260, wordBreak: "break-word" }}>
                          {r.description}
                          {r.due_date && !isPaid && (
                            <span className={`ml-2 text-[10px] ${new Date(r.due_date) < new Date() ? "text-red-500" : "text-muted-foreground"}`}>
                              Due: {fmtDate(r.due_date)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{r.reference}</td>
                        <td className="px-3 py-2 text-right font-medium text-red-600">
                          {r.debit ? fmtAED(r.debit) : "—"}
                          {isInvoice && (r.paid_amount||0) > 0 && (
                            <span className="block text-[10px] text-green-600 font-normal">Paid: {fmtAED(r.paid_amount)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-green-600">
                          {r.credit ? fmtAED(r.credit) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className={`font-medium ${(r.balance||0) > 0 ? "text-amber-600" : "text-green-600"}`}>
                            {fmtAED(r.balance||0)}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                            r.status === "paid" ? "bg-green-100 text-green-700" :
                            r.status === "partial" ? "bg-blue-100 text-blue-700" :
                            r.status === "overdue" ? "bg-red-100 text-red-700" :
                            r.status === "Reconciled" ? "bg-green-100 text-green-700" :
                            "bg-amber-100 text-amber-700"
                          }`}>
                            {(r.status === "paid" || r.status === "Reconciled") && <CheckCircle className="h-2.5 w-2.5" />}
                            {r.status}
                          </span>
                        </td>
                        <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                          {r._type === "payment" && (
                            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1.5 gap-1"
                              title="Allocate this payment to invoices"
                              onClick={() => setAllocateTxn(r._raw)}>
                              <Link className="h-3 w-3" />Allocate
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
                {/* Totals row */}
                {visibleRows.length > 0 && (
                  <tr className="border-t-2 bg-muted/50 font-semibold">
                    <td colSpan={4} className="px-3 py-2 text-xs">Totals</td>
                    <td className="px-3 py-2 text-right text-xs text-red-600">{fmtAED(totalDebit)}</td>
                    <td className="px-3 py-2 text-right text-xs text-green-600">{fmtAED(totalCredit)}</td>
                    <td className="px-3 py-2 text-right text-xs">
                      <span className={closingBal > 0 ? "text-amber-600" : "text-green-600"}>{fmtAED(closingBal)}</span>
                    </td>
                    <td colSpan={2} className="px-3 py-2 text-xs text-muted-foreground">
                      {closingBal > 0 ? "Balance due from client" : closingBal < 0 ? "Credit balance" : "Fully settled"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Payment allocation dialog */}
      {allocateTxn && (
        <AllocatePaymentDialog
          txn={allocateTxn}
          clientId={selectedId}
          invoices={invoices.data || []}
          allocations={allocations as any[]}
          onClose={() => setAllocateTxn(null)}
        />
      )}
    </div>
  );
}
