/**
 * Daybook — chronological register of every posted financial event.
 *
 * Combines rows from:
 *   • journal_entries  (all types)
 *   • invoices         (sales / advance / progressive / final / purchase)
 *   • purchase_orders  (LPOs — kept for reference; excluded by default)
 *   • payroll          (salary runs, once posted)
 *
 * Features:
 *   • Type filter (multi-select style toggle chips)
 *   • Date range filter
 *   • Text search (number, description, party)
 *   • Click a row to open the View panel; from there, click Edit to load the
 *     underlying record's native edit dialog on its own page.
 *   • CSV export of the filtered view.
 */

import { useMemo, useState } from "react";
import { PageHeader, useList, StatusBadge } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Download, Filter, ExternalLink, X, Loader2 } from "lucide-react";
import { fmtDate, fmtAED } from "@/lib/nxs";
import { Link } from "wouter";

type DaybookRow = {
  key: string;
  source: "journal" | "sales_invoice" | "purchase_invoice" | "purchase_order" | "payroll";
  source_id: string;
  date: string;             // ISO date (YYYY-MM-DD)
  number: string;           // Invoice #, JV #, PO #
  type_label: string;       // "Sales Invoice", "Purchase Invoice", "Journal Voucher", "LPO", "Payroll"
  description: string;
  party: string;            // vendor / client / employee / project
  debit: number;
  credit: number;
  status?: string;
  raw: any;                 // original record
  edit_href: string;        // /invoices, /journal, ...
};

const TYPES: { key: DaybookRow["source"]; label: string; color: string }[] = [
  { key: "journal", label: "Journal", color: "bg-teal-100 text-teal-800 border-teal-200" },
  { key: "sales_invoice", label: "Sales Inv", color: "bg-green-100 text-green-800 border-green-200" },
  { key: "purchase_invoice", label: "Purchase Inv", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { key: "purchase_order", label: "LPO", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { key: "payroll", label: "Payroll", color: "bg-purple-100 text-purple-800 border-purple-200" },
];

export default function Daybook() {
  const je = useList("journal_entries");
  const inv = useList("invoices");
  const po = useList("purchase_orders");
  const pay = useList("payroll");
  const clients = useList("clients");
  const vendors = useList("vendors");
  const projects = useList("projects");
  const employees = useList("employees");

  const [enabled, setEnabled] = useState<Record<DaybookRow["source"], boolean>>({
    journal: true, sales_invoice: true, purchase_invoice: true, purchase_order: false, payroll: true,
  });
  const [from, setFrom] = useState<string>(defaultFromDate());
  const [to, setTo] = useState<string>(todayIso());
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DaybookRow | null>(null);

  const isLoading = je.isLoading || inv.isLoading || po.isLoading || pay.isLoading;

  const rows: DaybookRow[] = useMemo(() => {
    const clientName = (id: string) => (clients.data || []).find((c: any) => c.id === id)?.name || "";
    const vendorName = (id: string) => (vendors.data || []).find((v: any) => v.id === id)?.name || "";
    const projectName = (id: string) => (projects.data || []).find((p: any) => p.id === id)?.name || "";

    const out: DaybookRow[] = [];

    // Journal entries — every posting shows here
    for (const j of (je.data || []) as any[]) {
      out.push({
        key: `je-${j.id}`,
        source: "journal",
        source_id: j.id,
        date: (j.entry_date || j.created_at || "").toString().slice(0, 10),
        number: j.entry_number || "—",
        type_label: "Journal Voucher",
        description: j.description || j.reference || "",
        party: projectName(j.project_id) || "",
        debit: Number(j.total_debit || 0),
        credit: Number(j.total_debit || 0),      // balanced JE: total = both sides
        status: j.status,
        raw: j,
        edit_href: "/journal",
      });
    }

    // Invoices — split by sales vs purchase (purchase invoice_type === "purchase")
    for (const i of (inv.data || []) as any[]) {
      const isPurchase = i.invoice_type === "purchase";
      out.push({
        key: `inv-${i.id}`,
        source: isPurchase ? "purchase_invoice" : "sales_invoice",
        source_id: i.id,
        date: (i.invoice_date || i.created_at || "").toString().slice(0, 10),
        number: i.invoice_number || "—",
        type_label: isPurchase ? "Purchase Invoice" : `${(i.invoice_type || "standard")[0].toUpperCase()}${(i.invoice_type || "standard").slice(1)} Invoice`,
        description: i.subject || i.notes || "",
        party: isPurchase ? vendorName(i.vendor_id) : clientName(i.client_id),
        debit: isPurchase ? Number(i.total_amount || 0) : 0,
        credit: isPurchase ? 0 : Number(i.total_amount || 0),
        status: i.status,
        raw: i,
        edit_href: "/invoices",
      });
    }

    // Purchase orders (LPOs) — off by default
    for (const p of (po.data || []) as any[]) {
      out.push({
        key: `po-${p.id}`,
        source: "purchase_order",
        source_id: p.id,
        date: (p.order_date || p.created_at || "").toString().slice(0, 10),
        number: p.po_number || "—",
        type_label: "LPO / Purchase Order",
        description: p.notes || "",
        party: vendorName(p.vendor_id),
        debit: 0,
        credit: 0,
        status: p.status,
        raw: p,
        edit_href: "/purchase-orders",
      });
    }

    // Payroll runs
    for (const p of (pay.data || []) as any[]) {
      const emp = (employees.data || []).find((e: any) => e.id === p.employee_id);
      out.push({
        key: `pay-${p.id}`,
        source: "payroll",
        source_id: p.id,
        date: (p.pay_date || p.created_at || "").toString().slice(0, 10),
        number: `PAY-${p.month || ""}${p.year || ""}`,
        type_label: "Payroll",
        description: `Salary ${p.month}/${p.year}`,
        party: emp?.full_name || "",
        debit: Number(p.net_salary || p.gross_salary || 0),
        credit: 0,
        status: p.status,
        raw: p,
        edit_href: "/payroll",
      });
    }

    return out;
  }, [je.data, inv.data, po.data, pay.data, clients.data, vendors.data, projects.data, employees.data]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const fromT = from ? new Date(from).getTime() : -Infinity;
    const toT = to ? new Date(to).getTime() + 86400000 : Infinity; // inclusive end
    return rows
      .filter(r => enabled[r.source])
      .filter(r => {
        if (!r.date) return true;
        const t = new Date(r.date).getTime();
        if (isNaN(t)) return true;
        return t >= fromT && t < toT;
      })
      .filter(r => !s
        || r.number.toLowerCase().includes(s)
        || r.description.toLowerCase().includes(s)
        || r.party.toLowerCase().includes(s)
        || r.type_label.toLowerCase().includes(s))
      .sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.number.localeCompare(a.number));
  }, [rows, enabled, from, to, search]);

  const totals = useMemo(() => filtered.reduce((s, r) => ({
    debit: s.debit + r.debit, credit: s.credit + r.credit, count: s.count + 1,
  }), { debit: 0, credit: 0, count: 0 }), [filtered]);

  function exportCsv() {
    const header = ["Date", "Type", "Number", "Party", "Description", "Debit (AED)", "Credit (AED)", "Status"];
    const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rowsCsv = filtered.map(r => [
      r.date, r.type_label, r.number, r.party, r.description,
      r.debit ? r.debit.toFixed(2) : "", r.credit ? r.credit.toFixed(2) : "",
      r.status || "",
    ].map(escape).join(","));
    const csv = [header.map(escape).join(","), ...rowsCsv].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = `${from}_to_${to}`.replace(/-/g, "");
    a.href = url;
    a.download = `NXS-Daybook-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader title="Daybook"
        subtitle="Chronological register of every posted financial event — filter, search, drill in, export."
        actions={
          <Button onClick={exportCsv} disabled={filtered.length === 0} variant="outline">
            <Download className="h-4 w-4 mr-1" /> Export CSV ({filtered.length})
          </Button>
        }
      />

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" className="h-9 w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" className="h-9 w-40" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="flex-1 min-w-[220px] space-y-1">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8 h-9" placeholder="Number, description or party…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Presets</Label>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => { setFrom(firstOfMonth()); setTo(todayIso()); }}>This Month</Button>
                <Button size="sm" variant="outline" onClick={() => { const d = new Date(); d.setMonth(d.getMonth() - 1); const from = new Date(d.getFullYear(), d.getMonth(), 1); const to = new Date(d.getFullYear(), d.getMonth() + 1, 0); setFrom(toIso(from)); setTo(toIso(to)); }}>Last Month</Button>
                <Button size="sm" variant="outline" onClick={() => { setFrom(firstOfYear()); setTo(todayIso()); }}>YTD</Button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground pr-2">
              <Filter className="h-3.5 w-3.5" /> Types:
            </div>
            {TYPES.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setEnabled(e => ({ ...e, [t.key]: !e[t.key] }))}
                className={`text-xs px-2.5 py-1 rounded-full border transition ${enabled[t.key] ? t.color + " border" : "bg-transparent text-muted-foreground border-slate-200 opacity-60 hover:opacity-100"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3 text-sm">
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Entries</div><div className="text-xl font-bold">{totals.count}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Total Debit</div><div className="text-xl font-bold text-emerald-700">{fmtAED(totals.debit)}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Total Credit</div><div className="text-xl font-bold text-rose-700">{fmtAED(totals.credit)}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Net</div><div className="text-xl font-bold">{fmtAED(totals.debit - totals.credit)}</div></CardContent></Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-14 text-muted-foreground text-sm">No entries in the selected range.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground bg-muted/40">
                  <th className="p-3 w-24">Date</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Number</th>
                  <th className="p-3">Party</th>
                  <th className="p-3">Description</th>
                  <th className="p-3 text-right w-28">Debit</th>
                  <th className="p-3 text-right w-28">Credit</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.key}
                    onClick={() => setSelected(r)}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/40 cursor-pointer">
                    <td className="p-3 whitespace-nowrap text-xs">{fmtDate(r.date)}</td>
                    <td className="p-3"><TypeBadge source={r.source} label={r.type_label} /></td>
                    <td className="p-3 font-mono text-xs text-amber-700">{r.number}</td>
                    <td className="p-3">{r.party || <span className="text-muted-foreground">—</span>}</td>
                    <td className="p-3 max-w-[280px] truncate text-muted-foreground text-xs">{r.description || "—"}</td>
                    <td className="p-3 text-right font-mono text-xs">{r.debit ? fmtAED(r.debit) : "—"}</td>
                    <td className="p-3 text-right font-mono text-xs">{r.credit ? fmtAED(r.credit) : "—"}</td>
                    <td className="p-3">{r.status ? <StatusBadge status={r.status} /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {selected && <DaybookRowDialog row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function TypeBadge({ source, label }: { source: DaybookRow["source"]; label: string }) {
  const t = TYPES.find(x => x.key === source);
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${t?.color || "bg-slate-100 text-slate-700"}`}>{label}</span>;
}

// ─── Row detail dialog ───────────────────────────────────────────────────────
function DaybookRowDialog({ row, onClose }: { row: DaybookRow; onClose: () => void }) {
  const isJE = row.source === "journal";
  const isInv = row.source === "sales_invoice" || row.source === "purchase_invoice";
  const isPO = row.source === "purchase_order";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TypeBadge source={row.source} label={row.type_label} />
            <span className="font-mono text-amber-700">{row.number}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Info label="Date">{fmtDate(row.date)}</Info>
            <Info label="Party">{row.party || "—"}</Info>
            <Info label="Debit">{row.debit ? fmtAED(row.debit) : "—"}</Info>
            <Info label="Credit">{row.credit ? fmtAED(row.credit) : "—"}</Info>
            {row.status && <Info label="Status"><StatusBadge status={row.status} /></Info>}
            {row.raw.reference && <Info label="Reference">{row.raw.reference}</Info>}
          </div>

          {row.description && (
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <div className="mt-1 p-2 border rounded bg-muted/30 text-sm whitespace-pre-wrap">{row.description}</div>
            </div>
          )}

          {isJE && Array.isArray(row.raw.lines) && row.raw.lines.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">Journal Lines</Label>
              <div className="mt-1 border rounded overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2">Account</th>
                      <th className="text-left p-2">Description</th>
                      <th className="text-right p-2 w-24">Debit</th>
                      <th className="text-right p-2 w-24">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.raw.lines.map((l: any, i: number) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{l.account_code ? `${l.account_code} — ` : ""}{l.account_name || "—"}</td>
                        <td className="p-2 text-muted-foreground">{l.description || "—"}</td>
                        <td className="p-2 text-right font-mono">{l.debit ? fmtAED(l.debit) : ""}</td>
                        <td className="p-2 text-right font-mono">{l.credit ? fmtAED(l.credit) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(isInv || isPO) && Array.isArray(row.raw.items) && row.raw.items.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">Line Items</Label>
              <div className="mt-1 border rounded overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2">Description</th>
                      <th className="text-right p-2 w-16">Qty</th>
                      <th className="text-right p-2 w-24">Unit Price</th>
                      <th className="text-right p-2 w-24">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.raw.items.map((it: any, i: number) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{it.description || "—"}</td>
                        <td className="p-2 text-right">{it.quantity ?? "—"}</td>
                        <td className="p-2 text-right font-mono">{fmtAED(Number(it.unit_price || 0))}</td>
                        <td className="p-2 text-right font-mono">{fmtAED(Number(it.amount || Number(it.quantity || 0) * Number(it.unit_price || 0)))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" onClick={onClose}><X className="h-4 w-4 mr-1" /> Close</Button>
          <Link href={row.edit_href} onClick={onClose}>
            <Button>
              <ExternalLink className="h-4 w-4 mr-1" /> Open &amp; Edit
            </Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-0.5 font-medium">{children}</div>
    </div>
  );
}

// ─── date utils ───────────────────────────────────────────────────────────────
function toIso(d: Date): string {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayIso(): string { return toIso(new Date()); }
function defaultFromDate(): string {
  const d = new Date(); d.setDate(1); return toIso(d);
}
function firstOfMonth(): string { const d = new Date(); return toIso(new Date(d.getFullYear(), d.getMonth(), 1)); }
function firstOfYear(): string { const d = new Date(); return toIso(new Date(d.getFullYear(), 0, 1)); }
