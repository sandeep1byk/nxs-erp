/**
 * Bank — Transactions, Reconciliation, and Ledger
 *
 * Tabs:
 *  1. Transactions — upload CSV, reconcile inline (no popups)
 *  2. Ledger       — pick any account/client/bank, filter by date & type, export PDF/Excel
 *  3. Statements   — list of uploaded bank statement files
 *
 * Counterparty rules: type a name → system remembers category forever.
 * + button always visible — opens category picker immediately without typing required.
 */
import { useState, useRef } from "react";
import { PageHeader, useList } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { fmtDate, fmtAED, COMPANY } from "@/lib/nxs";
import { Upload, CheckCircle, FileSpreadsheet, Loader2, Plus, Download, FileText, BookOpen } from "lucide-react";
import * as XLSX from "xlsx";

// ── Main category definitions ─────────────────────────────────────────────────
// These are the fixed top-level categories. Custom sub-categories (saved in DB)
// always belong to one of these parents.
const MAIN_CATEGORIES = [
  { value: "client",              label: "Client / Customer",         desc: "Money received from a client",                    account_code: "1100", account_name: "Accounts Receivable",          type: "asset"     },
  { value: "supplier",            label: "Supplier / Vendor",         desc: "Payment to a supplier or vendor",                 account_code: "2000", account_name: "Accounts Payable",             type: "liability" },
  { value: "temp_loan_liability", label: "Temp Loan — You Owe Them",  desc: "Cash from friend/personal — company will repay",  account_code: "2400", account_name: "Temp Loans — Payable",         type: "liability" },
  { value: "temp_loan_asset",     label: "Temp Loan — They Owe You",  desc: "Company lent money out — to be returned",         account_code: "1600", account_name: "Temp Loans — Receivable",      type: "asset"     },
  { value: "utility",             label: "Utility Bill",              desc: "DEWA, ETISALAT, DU, SALIK, RTA etc.",            account_code: "6200", account_name: "Utilities",                    type: "expense"   },
  { value: "salary",              label: "Salary / Payroll",          desc: "Staff salary or wage payment",                   account_code: "6000", account_name: "Salaries & Wages",             type: "expense"   },
  { value: "bank_charge",         label: "Bank Charge / Fee",         desc: "Bank fees, VAT on bank charges",                 account_code: "6300", account_name: "Office & Admin",               type: "expense"   },
  { value: "rent",                label: "Rent",                      desc: "Office or site rent payment",                    account_code: "6100", account_name: "Rent Expense",                 type: "expense"   },
  { value: "petty_cash",          label: "Petty Cash",                desc: "Petty cash withdrawal or top-up",                account_code: "1000", account_name: "Cash & Bank",                  type: "asset"     },
  { value: "other",               label: "Other Expense",             desc: "Any other business expense",                     account_code: "6300", account_name: "Office & Admin",               type: "expense"   },
];
// Kept for legacy references
const CATEGORIES = MAIN_CATEGORIES;

// ── CSV parsing helpers ───────────────────────────────────────────────────────
function parseCsvLine(line: string, delim: string): string[] {
  const cols: string[] = [];
  let cur = "", inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === delim && !inQ) { cols.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}
function parseAmount(s: string) { return parseFloat((s || "").replace(/[^0-9.\-]/g, "")) || 0; }
function parseDate(s: string) {
  s = (s || "").trim();
  const dmy = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/);
  if (dmy) { const y = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]; return `${y}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`; }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}
interface RawTxn { txn_date: string; description: string; reference: string; debit: number; credit: number; balance: number; }
function parseStatementFile(text: string): RawTxn[] {
  const allLines = text.split(/\r?\n/);
  const first = allLines.find(l => l.trim()) || "";
  const delim = first.includes("\t") ? "\t" : first.includes(";") ? ";" : ",";
  const HKEYS = ["date","debit","credit","narration","description","amount","balance","reference","withdrawal","deposit","transaction","running"];
  let headerIdx = -1, best = 0;
  for (let i = 0; i < Math.min(allLines.length, 40); i++) {
    if (!allLines[i].trim()) continue;
    const cells = parseCsvLine(allLines[i], delim).map(c => c.toLowerCase());
    const score = cells.reduce((s, c) => s + (HKEYS.some(k => c.includes(k)) ? 1 : 0), 0);
    if (score > best) { best = score; headerIdx = i; }
  }
  if (headerIdx < 0 || best < 1) return [];
  const headers = parseCsvLine(allLines[headerIdx], delim).map(h => h.toLowerCase().trim());
  const fc = (...keys: string[]) => { for (const k of keys) { const i = headers.findIndex(h => h.includes(k)); if (i >= 0) return i; } return -1; };
  const dateIdx  = fc("transaction date","date","txndate","valuedate");
  const descIdx  = fc("narration","description","particulars","details","remarks","memo");
  const refIdx   = fc("transaction reference","reference","refno","chequeno");
  const debitIdx = fc("debit","withdrawal","dr","payment");
  const creditIdx= fc("credit","deposit","cr","receipt");
  const balIdx   = fc("running balance","balance");
  const amtIdx   = fc("amount");
  const txns: RawTxn[] = [];
  for (let i = headerIdx + 1; i < allLines.length; i++) {
    const line = allLines[i].trim(); if (!line) continue;
    const cols = parseCsvLine(line, delim); if (cols.every(c => !c)) continue;
    const fc0 = (cols[0] || "").toLowerCase();
    if (fc0.includes("total") || fc0.includes("opening balance") || fc0.includes("closing balance")) continue;
    let debit  = debitIdx  >= 0 ? parseAmount(cols[debitIdx]  || "") : 0;
    let credit = creditIdx >= 0 ? parseAmount(cols[creditIdx] || "") : 0;
    if (debit === 0 && credit === 0 && amtIdx >= 0) { const a = parseAmount(cols[amtIdx] || ""); if (a < 0) debit = Math.abs(a); else if (a > 0) credit = a; }
    const rawDate   = dateIdx >= 0 ? cols[dateIdx]  || "" : cols[0] || "";
    const description = descIdx >= 0 ? cols[descIdx] || "" : cols[1] || "";
    const txn_date  = parseDate(rawDate);
    if (!txn_date && debit === 0 && credit === 0) continue;
    txns.push({ txn_date, description, reference: refIdx >= 0 ? cols[refIdx] || "" : "", debit, credit, balance: balIdx >= 0 ? parseAmount(cols[balIdx] || "") : 0 });
  }
  return txns;
}

// ── Filter bar (reusable) ─────────────────────────────────────────────────────
interface Filters { dateFrom: string; dateTo: string; direction: "all"|"debit"|"credit"; }
function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-3 mb-3 p-3 bg-muted/30 rounded-lg border">
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
          <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Transactions</SelectItem>
            <SelectItem value="debit">Money Out (Debit)</SelectItem>
            <SelectItem value="credit">Money In (Credit)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {(filters.dateFrom || filters.dateTo || filters.direction !== "all") && (
        <Button variant="ghost" size="sm" className="h-8 text-xs mt-5"
          onClick={() => onChange({ dateFrom: "", dateTo: "", direction: "all" })}>
          Clear Filters
        </Button>
      )}
    </div>
  );
}

function applyFilters(rows: any[], filters: Filters) {
  return rows.filter((t: any) => {
    const d = (t.txn_date || t.date || "").slice(0, 10);
    if (filters.dateFrom && d < filters.dateFrom) return false;
    if (filters.dateTo   && d > filters.dateTo)   return false;
    if (filters.direction === "debit"  && !((t.debit  || 0) > 0)) return false;
    if (filters.direction === "credit" && !((t.credit || 0) > 0)) return false;
    return true;
  });
}

// ── Export helpers ────────────────────────────────────────────────────────────
function exportExcel(rows: any[], title: string, columns: {key:string; label:string}[]) {
  const data = rows.map(r => {
    const row: any = {};
    columns.forEach(c => { row[c.label] = r[c.key] ?? ""; });
    return row;
  });
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ledger");
  XLSX.writeFile(wb, `${title.replace(/\s+/g, "_")}.xlsx`);
}

function exportPDF(rows: any[], title: string, columns: {key:string; label:string}[], subtitle?: string) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${title}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:11px;margin:24px;color:#222}
      h1{font-size:16px;margin:0 0 4px}
      p.sub{font-size:10px;color:#666;margin:0 0 12px}
      table{width:100%;border-collapse:collapse}
      th{background:#0c1125;color:#fff;padding:5px 8px;text-align:left;font-size:10px}
      td{padding:4px 8px;border-bottom:1px solid #eee;font-size:10px}
      tr:nth-child(even) td{background:#f9f9f9}
      .num{text-align:right}
      .red{color:#c00}
      .green{color:#060}
      .footer{margin-top:16px;font-size:9px;color:#999}
    </style></head><body>
    <h1>${title}</h1>
    <p class="sub">${subtitle || ""} — Exported ${new Date().toLocaleDateString("en-AE")}</p>
    <table>
      <thead><tr>${columns.map(c => `<th>${c.label}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(r => `<tr>${columns.map(c => {
        const v = r[c.key] ?? "";
        const isNum = c.key === "debit" || c.key === "credit" || c.key === "balance";
        const cls = c.key === "debit" ? "num red" : c.key === "credit" ? "num green" : c.key === "balance" ? "num" : "";
        return `<td class="${cls}">${v}</td>`;
      }).join("")}</tr>`).join("")}</tbody>
    </table>
    <p class="footer">NXS Contracting & Building Maintenance LLC | ${new Date().toISOString()}</p>
    </body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 600);
}

// ── Category picker dialog ────────────────────────────────────────────────
// Shows main categories + custom sub-categories from DB.
// Has a “+” at the bottom to create new sub-categories under any main category.
function CategoryPickerDialog({
  name, onSaved, onClose
}: { name: string; onSaved: (rule: any) => void; onClose: () => void }) {
  const { toast } = useToast();

  const { data: customCats = [] } = useQuery<any[]>({ queryKey: ["/api/custom_categories"] });

  // selected = { value: mainCategoryValue | customCatId, isCustom: bool }
  const [selected, setSelected] = useState<{ value: string; isCustom: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  // Sub-form to create a new sub-category
  const [showAddSub, setShowAddSub] = useState(false);
  const [subName, setSubName]       = useState("");
  const [subParent, setSubParent]   = useState("");
  const [savingSub, setSavingSub]   = useState(false);

  function resolveAccount(sel: { value: string; isCustom: boolean }) {
    if (sel.isCustom) {
      const c = (customCats as any[]).find((c: any) => c.id === sel.value);
      return c ? { category: c.parent_category, account_code: c.account_code, account_name: c.account_name, label: c.name } : null;
    }
    const m = MAIN_CATEGORIES.find(m => m.value === sel.value);
    return m ? { category: m.value, account_code: m.account_code, account_name: m.account_name, label: m.label } : null;
  }

  async function doSave() {
    if (!selected) { toast({ title: "Please pick a category", variant: "destructive" }); return; }
    const acc = resolveAccount(selected);
    if (!acc) { toast({ title: "Invalid selection", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await apiRequest("POST", "/api/counterparty_rules", {
        name: name.trim(),
        category: acc.category,
        account_code: acc.account_code,
        account_name: acc.account_name,
        parent_category: acc.category,
      });
      const rule = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/counterparty_rules"] });
      toast({ title: `“${name}” saved under ${acc.label}` });
      onSaved(rule);
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  }

  async function doSaveSub() {
    if (!subName.trim()) { toast({ title: "Enter a name for the sub-category", variant: "destructive" }); return; }
    if (!subParent)      { toast({ title: "Choose which main category it belongs to", variant: "destructive" }); return; }
    const parent = MAIN_CATEGORIES.find(m => m.value === subParent)!;
    setSavingSub(true);
    try {
      await apiRequest("POST", "/api/custom_categories", {
        name: subName.trim(),
        parent_category: subParent,
        account_code: parent.account_code,
        account_name: parent.account_name,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/custom_categories"] });
      toast({ title: `Sub-category “${subName}” created` });
      setShowAddSub(false); setSubName(""); setSubParent("");
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setSavingSub(false); }
  }

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{name ? `What is “${name}”?` : "Pick Category"}</DialogTitle>
        </DialogHeader>
        {name && <p className="text-sm text-muted-foreground -mt-2">Pick once — remembered automatically next time.</p>}

        {/* Add sub-category inline form */}
        {showAddSub ? (
          <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
            <p className="text-sm font-semibold">Create New Sub-Category</p>
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input className="text-sm" placeholder='e.g. "Temp Loan — Raju" or "Personal — Sandeep"' value={subName} onChange={e => setSubName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Falls under (main category)</Label>
              <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto">
                {MAIN_CATEGORIES.map(m => (
                  <button key={m.value} onClick={() => setSubParent(m.value)}
                    className={`w-full text-left rounded-md border px-2.5 py-1.5 text-xs transition-colors ${subParent === m.value ? "border-primary bg-primary/10 font-semibold" : "border-border hover:bg-muted/50"}`}>
                    {m.label}
                    <span className="text-muted-foreground ml-1.5">→ {m.account_code} {m.account_name}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => { setShowAddSub(false); setSubName(""); setSubParent(""); }}>Cancel</Button>
              <Button size="sm" className="flex-1" onClick={doSaveSub} disabled={!subName.trim() || !subParent || savingSub}>
                {savingSub ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-1 max-h-[55vh] overflow-y-auto pr-1">
            {MAIN_CATEGORIES.map(cat => {
              const subs = (customCats as any[]).filter((c: any) => c.parent_category === cat.value);
              const isMainSel = selected?.value === cat.value && !selected?.isCustom;
              return (
                <div key={cat.value}>
                  <button onClick={() => setSelected({ value: cat.value, isCustom: false })}
                    className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${isMainSel ? "border-primary bg-primary/10" : "border-border hover:bg-muted/40"}`}>
                    <div className="flex items-baseline justify-between">
                      <p className="text-sm font-medium">{cat.label}</p>
                      <span className="text-[10px] text-muted-foreground ml-2">{cat.account_code}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{cat.desc}</p>
                  </button>
                  {subs.map((sub: any) => {
                    const isSubSel = selected?.value === sub.id && selected?.isCustom;
                    return (
                      <button key={sub.id} onClick={() => setSelected({ value: sub.id, isCustom: true })}
                        className={`w-full text-left rounded-lg border ml-5 mt-0.5 px-3 py-1.5 text-xs transition-colors ${isSubSel ? "border-primary bg-primary/10" : "border-border hover:bg-muted/40"}`}>
                        <span className="text-muted-foreground mr-1">└</span>
                        <span className="font-medium">{sub.name}</span>
                        <span className="text-muted-foreground ml-2">→ {sub.account_code}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {/* Add sub-category button */}
            <button onClick={() => setShowAddSub(true)}
              className="w-full text-left rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center gap-1.5 mt-1">
              <Plus className="h-3.5 w-3.5" />
              Add a custom sub-category (e.g. "Temp Loan — Raju", "Personal — Sandeep")
            </button>
          </div>
        )}

        {!showAddSub && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={doSave} disabled={!selected || saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : "Save & Continue"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Inline transaction row ────────────────────────────────────────────────────
function TxnRow({ txn, rules }: { txn: any; rules: any[] }) {
  const { toast } = useToast();
  const [counterparty, setCounterparty] = useState(txn.counterparty || "");
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const isDebit = (txn.debit || 0) > 0;
  const matchedRule = rules.find(r => r.name_lower === (counterparty || "").toLowerCase().trim());

  async function reconcile(rule?: any) {
    const activeRule = rule || matchedRule;
    if (!counterparty.trim()) { toast({ title: "Enter a counterparty name first", variant: "destructive" }); return; }
    if (!activeRule) { setShowPicker(true); return; }   // unknown name → pick category first
    setSaving(true);
    try {
      await apiRequest("PUT", `/api/bank_transactions/${txn.id}`, {
        ...txn,
        counterparty: counterparty.trim(),
        account_id: null,
        notes: `${activeRule.account_code} — ${activeRule.account_name}`,
        is_reconciled: true,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bank_transactions"] });
      toast({ title: "Reconciled ✓" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  }

  function handleRuleSaved(rule: any) { setShowPicker(false); reconcile(rule); }

  // ── Already reconciled — show read-only row ──
  if (txn.is_reconciled) {
    return (
      <tr className="border-b bg-green-50/40 dark:bg-green-900/10">
        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(txn.txn_date)}</td>
        <td className="px-3 py-2 text-xs" style={{ maxWidth: 320, wordBreak: "break-word" }}>{txn.description}</td>
        <td className="px-3 py-2 text-xs text-right">{txn.debit  ? <span className="text-red-600 font-medium">{fmtAED(txn.debit)}</span>  : <span className="text-muted-foreground">—</span>}</td>
        <td className="px-3 py-2 text-xs text-right">{txn.credit ? <span className="text-green-600 font-medium">{fmtAED(txn.credit)}</span> : <span className="text-muted-foreground">—</span>}</td>
        <td className="px-3 py-2 text-xs" colSpan={2}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{txn.counterparty || "—"}</span>
            {txn.notes && <span className="text-[10px] text-muted-foreground">({txn.notes})</span>}
            <span className="ml-auto inline-flex items-center gap-1 text-green-600 text-xs font-medium">
              <CheckCircle className="h-3 w-3" />Reconciled
            </span>
          </div>
        </td>
      </tr>
    );
  }

  // ── Pending — inline reconcile row ──
  return (
    <>
      <tr className={`border-b ${isDebit ? "bg-red-50/20 dark:bg-red-900/5" : "bg-green-50/20 dark:bg-green-900/5"}`}>
        <td className="px-3 py-2 text-xs whitespace-nowrap align-top">{fmtDate(txn.txn_date)}</td>
        <td className="px-3 py-2 text-xs align-top" style={{ maxWidth: 320, wordBreak: "break-word", whiteSpace: "normal" }}>
          {txn.description}
          {txn.reference && txn.reference !== "- -" &&
            <span className="block text-[10px] text-muted-foreground mt-0.5">Ref: {txn.reference}</span>}
        </td>
        <td className="px-3 py-2 text-xs text-right align-top whitespace-nowrap">
          {txn.debit  ? <span className="text-red-600 font-medium">{fmtAED(txn.debit)}</span>  : <span className="text-muted-foreground">—</span>}
        </td>
        <td className="px-3 py-2 text-xs text-right align-top whitespace-nowrap">
          {txn.credit ? <span className="text-green-600 font-medium">{fmtAED(txn.credit)}</span> : <span className="text-muted-foreground">—</span>}
        </td>
        {/* Counterparty input + buttons — spans remaining columns */}
        <td className="px-3 py-2 align-top" colSpan={2}>
          <div className="flex items-center gap-1">
            <div className="flex-1 relative min-w-0">
              <Input
                className="h-7 text-xs"
                placeholder={isDebit ? "Who did you pay?" : "Who paid you?"}
                value={counterparty}
                onChange={e => setCounterparty(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") reconcile(); }}
              />
              {matchedRule && (
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-primary font-medium pointer-events-none truncate max-w-[60px]">
                  {CATEGORIES.find(c => c.value === matchedRule.category)?.label || matchedRule.category}
                </span>
              )}
            </div>
            {/* + button — ALWAYS active, opens category picker */}
            <Button size="sm" variant="outline" className="h-7 w-7 p-0 flex-shrink-0"
              title="Add or change category for this counterparty"
              onClick={() => setShowPicker(true)}
              disabled={saving}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" className="h-7 text-xs px-2 whitespace-nowrap flex-shrink-0"
              onClick={() => reconcile()} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <><CheckCircle className="h-3 w-3 mr-1" />Done</>}
            </Button>
          </div>
          {matchedRule && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              → {matchedRule.account_code} {matchedRule.account_name}
            </p>
          )}
        </td>
      </tr>

      {showPicker && (
        <CategoryPickerDialog
          name={counterparty}
          onSaved={handleRuleSaved}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );
}

// ── Upload statement dialog ───────────────────────────────────────────────────
function UploadStatementDialog({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: (id: string) => void }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [bankName, setBankName] = useState("ENBD");
  const [accountNumber, setAccountNumber] = useState("");
  const [statementDate, setStatementDate] = useState(new Date().toISOString().slice(0, 10));
  const [fileName, setFileName] = useState("");
  const [txns, setTxns] = useState<RawTxn[]>([]);
  const [saving, setSaving] = useState(false);

  function handleFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      const parsed = parseStatementFile(e.target?.result as string);
      if (!parsed.length) { toast({ title: "No transactions found", description: "Make sure this is a CSV from your bank.", variant: "destructive" }); return; }
      setTxns(parsed);
      toast({ title: `${parsed.length} transactions found`, description: "Click Import below." });
    };
    reader.readAsText(file);
  }

  async function doImport() {
    if (!bankName.trim()) { toast({ title: "Enter bank name", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const stmt = await (await apiRequest("POST", "/api/bank_statements", { bank_name: bankName.trim(), account_number: accountNumber.trim() || null, statement_date: statementDate, status: "pending" })).json();
      for (const t of txns) {
        await apiRequest("POST", "/api/bank_transactions", { statement_id: stmt.id, txn_date: t.txn_date || statementDate, description: t.description || null, reference: t.reference || null, debit: t.debit > 0 ? t.debit : null, credit: t.credit > 0 ? t.credit : null, balance: t.balance || null, is_reconciled: false });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/bank_statements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank_transactions"] });
      toast({ title: "Imported!", description: `${txns.length} transactions ready.` });
      onImported(stmt.id); onClose();
    } catch (e: any) { toast({ title: "Import failed", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  }

  function reset() { setBankName("ENBD"); setAccountNumber(""); setStatementDate(new Date().toISOString().slice(0, 10)); setFileName(""); setTxns([]); if (fileRef.current) fileRef.current.value = ""; }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Upload Bank Statement</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Bank Name *</Label><Input placeholder="e.g. ENBD" value={bankName} onChange={e => setBankName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Account Number</Label><Input placeholder="e.g. 1015777252801" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Statement Date</Label><Input type="date" value={statementDate} onChange={e => setStatementDate(e.target.value)} /></div>
          </div>
          <div className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
            onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}>
            {fileName ? (
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="h-6 w-6 text-primary" />
                <div className="text-left"><p className="font-medium text-sm">{fileName}</p><p className="text-xs text-muted-foreground">{txns.length} transactions — click to change</p></div>
              </div>
            ) : (
              <><Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="font-medium text-sm mb-1">Click to select your bank statement CSV</p><p className="text-xs text-muted-foreground">ENBD, FAB, ADIB — any CSV exported from online banking</p></>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          {txns.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">{txns.length} transactions — preview (first 5):</p>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full"><thead className="bg-muted/50"><tr>
                  <th className="text-left px-3 py-2 text-xs font-medium">Date</th>
                  <th className="text-left px-3 py-2 text-xs font-medium">Description</th>
                  <th className="text-right px-3 py-2 text-xs font-medium">Debit</th>
                  <th className="text-right px-3 py-2 text-xs font-medium">Credit</th>
                  <th className="text-right px-3 py-2 text-xs font-medium">Balance</th>
                </tr></thead><tbody>
                  {txns.slice(0, 5).map((t, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5 text-xs">{t.txn_date}</td>
                      <td className="px-3 py-1.5 text-xs">{t.description || "—"}</td>
                      <td className="px-3 py-1.5 text-xs text-right text-red-600">{t.debit ? fmtAED(t.debit) : "—"}</td>
                      <td className="px-3 py-1.5 text-xs text-right text-green-600">{t.credit ? fmtAED(t.credit) : "—"}</td>
                      <td className="px-3 py-1.5 text-xs text-right text-muted-foreground">{t.balance ? fmtAED(t.balance) : "—"}</td>
                    </tr>
                  ))}
                  {txns.length > 5 && <tr className="border-t bg-muted/30"><td colSpan={5} className="px-3 py-1.5 text-xs text-center text-muted-foreground">+ {txns.length - 5} more</td></tr>}
                </tbody></table>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button onClick={doImport} disabled={txns.length === 0 || saving}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing…</> : <><Upload className="h-4 w-4 mr-1" />Import {txns.length} Transactions</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Ledger Tab ────────────────────────────────────────────────────────────────
function LedgerTab() {
  const { toast } = useToast();
  const stmts    = useList("bank_statements");
  const txnsAll  = useList("bank_transactions");
  const accounts = useList("accounts");
  const clients  = useList("clients");

  const [ledgerType, setLedgerType] = useState<"bank"|"account"|"client">("bank");
  const [selectedId, setSelectedId] = useState<string>("");
  const [filters, setFilters] = useState<Filters>({ dateFrom: "", dateTo: "", direction: "all" });

  // Build ledger rows based on type
  let ledgerRows: any[] = [];
  let ledgerTitle = "";
  let ledgerSubtitle = "";

  if (ledgerType === "bank") {
    const stmt = (stmts.data || []).find((s: any) => s.id === selectedId);
    const all  = (txnsAll.data || []).filter((t: any) => selectedId === "all" || t.statement_id === selectedId);
    ledgerRows = applyFilters(all, filters).map((t: any) => ({
      date: fmtDate(t.txn_date),
      description: t.description || "—",
      reference: t.reference || "—",
      debit:   t.debit  ? fmtAED(t.debit)  : "—",
      credit:  t.credit ? fmtAED(t.credit) : "—",
      balance: t.balance ? fmtAED(t.balance) : "—",
      counterparty: t.counterparty || "—",
      status: t.is_reconciled ? "Reconciled" : "Pending",
    }));
    ledgerTitle = stmt ? `Bank Ledger — ${stmt.bank_name}` : selectedId === "all" ? "Bank Ledger — All Statements" : "Bank Ledger";
    ledgerSubtitle = stmt ? `Account: ${stmt.account_number || "N/A"} | ${fmtDate(stmt.statement_date)}` : "";
  } else if (ledgerType === "account") {
    const acc = (accounts.data || []).find((a: any) => a.id === selectedId);
    // For accounts: use journal entries (simplified — show bank_transactions linked to this account)
    const all = (txnsAll.data || []).filter((t: any) => t.account_id === selectedId);
    ledgerRows = applyFilters(all, filters).map((t: any) => ({
      date: fmtDate(t.txn_date),
      description: t.description || t.notes || "—",
      reference: t.reference || "—",
      debit:   t.debit  ? fmtAED(t.debit)  : "—",
      credit:  t.credit ? fmtAED(t.credit) : "—",
      balance: "—",
      counterparty: t.counterparty || "—",
      status: t.is_reconciled ? "Reconciled" : "Pending",
    }));
    ledgerTitle = acc ? `Account Ledger — ${acc.account_code} ${acc.account_name}` : "Account Ledger";
    ledgerSubtitle = acc ? `Type: ${acc.account_type || "—"}` : "";
  } else {
    const client = (clients.data || []).find((c: any) => c.id === selectedId);
    // Client ledger: from invoices/transactions tagged to this client
    const all = (txnsAll.data || []).filter((t: any) => t.counterparty && client && t.counterparty.toLowerCase().includes((client.name || "").toLowerCase()));
    ledgerRows = applyFilters(all, filters).map((t: any) => ({
      date: fmtDate(t.txn_date),
      description: t.description || "—",
      reference: t.reference || "—",
      debit:   t.debit  ? fmtAED(t.debit)  : "—",
      credit:  t.credit ? fmtAED(t.credit) : "—",
      balance: "—",
      counterparty: t.counterparty || "—",
      status: t.is_reconciled ? "Reconciled" : "Pending",
    }));
    ledgerTitle = client ? `Client Ledger — ${client.name}` : "Client Ledger";
    ledgerSubtitle = client ? `Client account statement` : "";
  }

  const LEDGER_COLS = [
    { key: "date",         label: "Date"         },
    { key: "description",  label: "Description"  },
    { key: "reference",    label: "Reference"    },
    { key: "counterparty", label: "Counterparty" },
    { key: "debit",        label: "Debit (AED)"  },
    { key: "credit",       label: "Credit (AED)" },
    { key: "balance",      label: "Balance"      },
    { key: "status",       label: "Status"       },
  ];

  // Totals
  const allTxns  = ledgerType === "bank"
    ? (txnsAll.data || []).filter((t: any) => selectedId === "all" || t.statement_id === selectedId)
    : (txnsAll.data || []);
  const filtered = applyFilters(
    ledgerType === "bank"
      ? (txnsAll.data || []).filter((t: any) => selectedId === "all" || t.statement_id === selectedId)
      : ledgerRows,  // for non-bank, ledgerRows is already filtered below
    filters
  );

  // Sum raw numbers from original txns (not formatted)
  const rawRows = ledgerType === "bank"
    ? applyFilters((txnsAll.data || []).filter((t: any) => selectedId === "all" || t.statement_id === selectedId), filters)
    : [];
  const totalDebit  = rawRows.reduce((s: number, t: any) => s + (t.debit  || 0), 0);
  const totalCredit = rawRows.reduce((s: number, t: any) => s + (t.credit || 0), 0);

  return (
    <div>
      {/* Ledger selector */}
      <div className="flex flex-wrap items-end gap-3 mb-3 p-3 bg-muted/30 rounded-lg border">
        <div className="space-y-1">
          <Label className="text-xs">Ledger Type</Label>
          <Select value={ledgerType} onValueChange={v => { setLedgerType(v as any); setSelectedId(""); }}>
            <SelectTrigger className="h-8 text-xs w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bank">Bank Statement</SelectItem>
              <SelectItem value="account">Chart of Accounts</SelectItem>
              <SelectItem value="client">Client / Customer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {ledgerType === "bank" && (
          <div className="space-y-1">
            <Label className="text-xs">Select Bank Statement</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="h-8 text-xs w-56"><SelectValue placeholder="Pick a statement…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statements</SelectItem>
                {(stmts.data || []).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.bank_name} — {fmtDate(s.statement_date)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {ledgerType === "account" && (
          <div className="space-y-1">
            <Label className="text-xs">Select Account</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="h-8 text-xs w-64"><SelectValue placeholder="Pick an account…" /></SelectTrigger>
              <SelectContent>
                {(accounts.data || []).map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>{a.account_code} — {a.account_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {ledgerType === "client" && (
          <div className="space-y-1">
            <Label className="text-xs">Select Client</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="h-8 text-xs w-56"><SelectValue placeholder="Pick a client…" /></SelectTrigger>
              <SelectContent>
                {(clients.data || []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Export buttons — only when a ledger is selected */}
        {(selectedId || ledgerType === "bank") && ledgerRows.length > 0 && (
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
              onClick={() => exportExcel(ledgerRows, ledgerTitle, LEDGER_COLS)}>
              <Download className="h-3.5 w-3.5" />Excel
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
              onClick={() => exportPDF(ledgerRows, ledgerTitle, LEDGER_COLS, ledgerSubtitle)}>
              <FileText className="h-3.5 w-3.5" />PDF
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      {(selectedId || ledgerType === "bank") && (
        <FilterBar filters={filters} onChange={setFilters} />
      )}

      {/* Summary strip */}
      {ledgerRows.length > 0 && ledgerType === "bank" && (
        <div className="flex gap-6 text-xs mb-3 px-1">
          <span>Rows: <strong>{ledgerRows.length}</strong></span>
          <span>Total Out: <strong className="text-red-600">{fmtAED(totalDebit)}</strong></span>
          <span>Total In: <strong className="text-green-600">{fmtAED(totalCredit)}</strong></span>
          <span>Net: <strong className={totalCredit - totalDebit >= 0 ? "text-green-600" : "text-red-600"}>{fmtAED(totalCredit - totalDebit)}</strong></span>
        </div>
      )}

      {/* Ledger table */}
      {!selectedId && ledgerType !== "bank" ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl text-muted-foreground">
          <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Select a {ledgerType === "account" ? "chart of accounts entry" : "client"} above to open its ledger</p>
        </div>
      ) : ledgerRows.length === 0 ? (
        <div className="text-center py-12 border rounded-xl text-muted-foreground text-sm">
          No entries found for the selected filters.
        </div>
      ) : (
        <div className="border rounded-lg overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b">
              <tr>
                {LEDGER_COLS.map(c => (
                  <th key={c.key} className={`px-3 py-2 font-semibold whitespace-nowrap ${c.key === "debit" || c.key === "credit" || c.key === "balance" ? "text-right" : "text-left"}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledgerRows.map((r, i) => (
                <tr key={i} className={`border-b ${r.status === "Reconciled" ? "bg-green-50/30 dark:bg-green-900/10" : ""}`}>
                  <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                  <td className="px-3 py-2" style={{ maxWidth: 280, wordBreak: "break-word" }}>{r.description}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.reference}</td>
                  <td className="px-3 py-2">{r.counterparty}</td>
                  <td className="px-3 py-2 text-right font-medium text-red-600">{r.debit}</td>
                  <td className="px-3 py-2 text-right font-medium text-green-600">{r.credit}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{r.balance}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${r.status === "Reconciled" ? "bg-green-100 text-green-700 dark:bg-green-900/30" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30"}`}>
                      {r.status === "Reconciled" && <CheckCircle className="h-2.5 w-2.5" />}
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Bank() {
  const stmts   = useList("bank_statements");
  const txnsAll = useList("bank_transactions");
  const { data: rules = [] } = useQuery<any[]>({ queryKey: ["/api/counterparty_rules"] });

  const [uploadOpen, setUploadOpen]   = useState(false);
  const [filterStmt, setFilterStmt]   = useState<string>("all");
  const [txnFilters, setTxnFilters]   = useState<Filters>({ dateFrom: "", dateTo: "", direction: "all" });

  const allTxns = (txnsAll.data || []).filter((t: any) => filterStmt === "all" || t.statement_id === filterStmt);
  const filteredTxns = applyFilters(allTxns, txnFilters);
  const pending    = allTxns.filter((t: any) => !t.is_reconciled).length;
  const reconciled = allTxns.filter((t: any) =>  t.is_reconciled).length;

  return (
    <div>
      <PageHeader
        title="Bank"
        subtitle="Reconcile transactions line by line — no popups"
        actions={<Button onClick={() => setUploadOpen(true)}><Upload className="h-4 w-4 mr-2" />Upload Statement</Button>}
      />

      <Tabs defaultValue="txns">
        <TabsList>
          <TabsTrigger value="txns">Transactions</TabsTrigger>
          <TabsTrigger value="ledger"><BookOpen className="h-3.5 w-3.5 mr-1" />Ledger</TabsTrigger>
          <TabsTrigger value="statements">Statements</TabsTrigger>
        </TabsList>

        {/* ── Transactions tab ── */}
        <TabsContent value="txns">
          {/* Statement selector */}
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <Label className="text-xs shrink-0">Statement:</Label>
            <Select value={filterStmt} onValueChange={setFilterStmt}>
              <SelectTrigger className="h-8 text-xs w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statements</SelectItem>
                {(stmts.data || []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.bank_name} — {fmtDate(s.statement_date)}</SelectItem>)}
              </SelectContent>
            </Select>
            {allTxns.length > 0 && (
              <div className="flex gap-3 ml-auto text-xs text-muted-foreground">
                <span><strong className="text-amber-600">{pending}</strong> pending</span>
                <span><strong className="text-green-600">{reconciled}</strong> reconciled</span>
              </div>
            )}
          </div>

          {/* Date + direction filters */}
          <FilterBar filters={txnFilters} onChange={setTxnFilters} />

          {filteredTxns.length === 0 && !txnsAll.isLoading ? (
            <div className="text-center py-16 border-2 border-dashed rounded-xl">
              <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium mb-1">No transactions found</p>
              <p className="text-sm text-muted-foreground mb-4">
                {allTxns.length > 0 ? "Try adjusting your filters" : "Upload a bank statement CSV to get started"}
              </p>
              {allTxns.length === 0 && <Button onClick={() => setUploadOpen(true)}><Upload className="h-4 w-4 mr-2" />Upload Statement</Button>}
            </div>
          ) : (
            <div className="border rounded-lg overflow-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold whitespace-nowrap">Date</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold">Description</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold whitespace-nowrap">Money Out</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold whitespace-nowrap">Money In</th>
                    <th className="px-3 py-2 text-xs font-semibold" colSpan={2}>Counterparty → Category</th>
                  </tr>
                </thead>
                <tbody>
                  {txnsAll.isLoading
                    ? <tr><td colSpan={6} className="text-center py-8 text-sm text-muted-foreground">Loading…</td></tr>
                    : filteredTxns.map((t: any) => <TxnRow key={t.id} txn={t} rules={rules} />)
                  }
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Ledger tab ── */}
        <TabsContent value="ledger">
          <LedgerTab />
        </TabsContent>

        {/* ── Statements tab ── */}
        <TabsContent value="statements">
          <div className="flex justify-end mb-3">
            <Button onClick={() => setUploadOpen(true)}><Upload className="h-4 w-4 mr-2" />Upload Statement</Button>
          </div>
          <div className="border rounded-lg overflow-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold">Bank</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold">Account</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold">Date</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold">Progress</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {(stmts.data || []).map((s: any) => {
                  const total = (txnsAll.data || []).filter((t: any) => t.statement_id === s.id).length;
                  const done  = (txnsAll.data || []).filter((t: any) => t.statement_id === s.id && t.is_reconciled).length;
                  return (
                    <tr key={s.id} className="border-b">
                      <td className="px-3 py-2 text-sm font-medium">{s.bank_name}</td>
                      <td className="px-3 py-2 text-xs">{s.account_number || "—"}</td>
                      <td className="px-3 py-2 text-xs">{fmtDate(s.statement_date)}</td>
                      <td className="px-3 py-2 text-xs">{done}/{total} reconciled</td>
                      <td className="px-3 py-2 text-xs capitalize">{s.status}</td>
                      <td className="px-3 py-2">
                        <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setFilterStmt(s.id)}>
                          View Transactions
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <UploadStatementDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onImported={id => setFilterStmt(id)}
      />
    </div>
  );
}
