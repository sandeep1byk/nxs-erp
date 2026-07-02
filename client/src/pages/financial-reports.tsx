/**
 * Financial Reports
 * - Trial Balance
 * - Profit & Loss (Income Statement)
 * - Balance Sheet
 * All built from journal_entries lines + accounts
 */
import { useState, useMemo } from "react";
import { PageHeader, useList } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileText, TrendingUp, TrendingDown, Scale } from "lucide-react";
import { fmtAED } from "@/lib/nxs";
import * as XLSX from "xlsx";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const now = new Date();

// ── helpers ─────────────────────────────────────────────────────────────────
function exportExcel(rows: any[], title: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
  XLSX.writeFile(wb, `${title.replace(/\s+/g,"_")}_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function exportPDF(html: string, title: string) {
  const w = window.open("","_blank");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:10px;margin:20px;color:#111}
    h1{font-size:14px;margin:0 0 2px} p.sub{font-size:9px;color:#666;margin:0 0 10px}
    table{width:100%;border-collapse:collapse;margin-top:8px}
    th{background:#0c1125;color:#fff;padding:4px 8px;font-size:9px;text-align:left}
    td{padding:3px 8px;border-bottom:1px solid #eee;font-size:9px}
    .section-hdr td{background:#f0f0f0;font-weight:bold;font-size:10px;padding:6px 8px}
    .total-row td{border-top:2px solid #333;font-weight:bold}
    .num{text-align:right} .indent{padding-left:20px!important}
    .green{color:#076} .red{color:#c00}
    .footer{margin-top:12px;font-size:8px;color:#999}
  </style></head><body>${html}<p class="footer">NXS Contracting & Building Maintenance LLC | Generated ${new Date().toLocaleDateString("en-AE")}</p></body></html>`);
  w.document.close(); w.focus(); setTimeout(()=>w.print(), 600);
}

// ── Build accounting data ────────────────────────────────────────────────────
function buildLedgerMap(journalEntries: any[], dateFrom: string, dateTo: string) {
  // ledgerMap: account_code → { name, type, debit, credit }
  const map: Record<string, { name: string; type: string; debit: number; credit: number }> = {};

  for (const entry of journalEntries) {
    const d = (entry.entry_date || "").slice(0, 10);
    if (dateFrom && d < dateFrom) continue;
    if (dateTo   && d > dateTo)   continue;
    if (entry.status === "draft") continue;

    const lines = Array.isArray(entry.lines) ? entry.lines : [];
    for (const line of lines) {
      const code = line.account_code || "9999";
      const name = line.account_name || "Unknown";
      if (!map[code]) map[code] = { name, type: "", debit: 0, credit: 0 };
      map[code].debit  += Number(line.debit  || 0);
      map[code].credit += Number(line.credit || 0);
    }
  }
  return map;
}

// ── Trial Balance ─────────────────────────────────────────────────────────────
function TrialBalance({ accounts, journalEntries }: { accounts: any[]; journalEntries: any[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState(today);

  const rows = useMemo(() => {
    const lm = buildLedgerMap(journalEntries, dateFrom, dateTo);
    return accounts
      .map((acc: any) => {
        const m = lm[acc.account_code] || { debit: 0, credit: 0 };
        const net = m.debit - m.credit;
        return {
          code: acc.account_code,
          name: acc.name,
          type: acc.type,
          debit:  net > 0 ? net : 0,
          credit: net < 0 ? -net : 0,
        };
      })
      .filter(r => r.debit !== 0 || r.credit !== 0)
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [accounts, journalEntries, dateFrom, dateTo]);

  const totalDr = rows.reduce((s, r) => s + r.debit,  0);
  const totalCr = rows.reduce((s, r) => s + r.credit, 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.01;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-muted/30 rounded-lg border">
        <div className="space-y-1">
          <Label className="text-xs">From Date</Label>
          <Input type="date" className="h-8 text-xs w-36" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To Date</Label>
          <Input type="date" className="h-8 text-xs w-36" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <div className="flex gap-2 ml-auto">
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
            onClick={() => exportExcel(rows.map(r => ({ "Code": r.code, "Account": r.name, "Type": r.type, "Debit (AED)": r.debit || "", "Credit (AED)": r.credit || "" })), "Trial_Balance")}>
            <Download className="h-3.5 w-3.5" />Excel
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
            onClick={() => {
              const html = `<h1>Trial Balance</h1><p class="sub">Period: ${dateFrom || "All time"} to ${dateTo}</p><table><thead><tr><th>Code</th><th>Account</th><th class="num">Debit (AED)</th><th class="num">Credit (AED)</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.code}</td><td>${r.name}</td><td class="num">${r.debit?fmtAED(r.debit):""}</td><td class="num">${r.credit?fmtAED(r.credit):""}</td></tr>`).join("")}<tr class="total-row"><td colspan="2"><strong>TOTAL</strong></td><td class="num"><strong>${fmtAED(totalDr)}</strong></td><td class="num"><strong>${fmtAED(totalCr)}</strong></td></tr></tbody></table>`;
              exportPDF(html, "Trial Balance");
            }}>
            <FileText className="h-3.5 w-3.5" />PDF
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl text-muted-foreground">
          No posted journal entries in this period. Post some journal entries first.
        </div>
      ) : (
        <>
          <div className="flex gap-6 mb-3 text-sm">
            <span>Total Debit: <strong>{fmtAED(totalDr)}</strong></span>
            <span>Total Credit: <strong>{fmtAED(totalCr)}</strong></span>
            <span className={balanced ? "text-green-600 font-medium" : "text-destructive font-medium"}>
              {balanced ? "✓ Balanced" : `✗ Difference: ${fmtAED(Math.abs(totalDr - totalCr))}`}
            </span>
          </div>
          <div className="border rounded-lg overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold w-20">Code</th>
                  <th className="text-left px-3 py-2 font-semibold">Account Name</th>
                  <th className="text-left px-3 py-2 font-semibold w-24">Type</th>
                  <th className="text-right px-3 py-2 font-semibold w-36">Debit (AED)</th>
                  <th className="text-right px-3 py-2 font-semibold w-36">Credit (AED)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono text-muted-foreground">{r.code}</td>
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2 capitalize text-muted-foreground">{r.type}</td>
                    <td className="px-3 py-2 text-right font-medium">{r.debit  ? fmtAED(r.debit)  : "—"}</td>
                    <td className="px-3 py-2 text-right font-medium">{r.credit ? fmtAED(r.credit) : "—"}</td>
                  </tr>
                ))}
                <tr className="border-t-2 bg-muted/50 font-bold">
                  <td colSpan={3} className="px-3 py-2">TOTAL</td>
                  <td className="px-3 py-2 text-right">{fmtAED(totalDr)}</td>
                  <td className="px-3 py-2 text-right">{fmtAED(totalCr)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Profit & Loss ─────────────────────────────────────────────────────────────
function ProfitAndLoss({ accounts, journalEntries }: { accounts: any[]; journalEntries: any[] }) {
  const [period, setPeriod] = useState<"month" | "quarter" | "ytd" | "custom">("month");
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [selYear,  setSelYear]  = useState(now.getFullYear());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState(now.toISOString().slice(0, 10));

  const { from, to } = useMemo(() => {
    if (period === "custom") return { from: dateFrom, to: dateTo };
    const y = selYear;
    const m = selMonth;
    if (period === "month") {
      const last = new Date(y, m, 0).getDate();
      return { from: `${y}-${String(m).padStart(2,"0")}-01`, to: `${y}-${String(m).padStart(2,"0")}-${last}` };
    }
    if (period === "quarter") {
      const q = Math.ceil(m / 3);
      const qStart = (q - 1) * 3 + 1;
      const qEnd = q * 3;
      const last = new Date(y, qEnd, 0).getDate();
      return { from: `${y}-${String(qStart).padStart(2,"0")}-01`, to: `${y}-${String(qEnd).padStart(2,"0")}-${last}` };
    }
    // ytd
    return { from: `${y}-01-01`, to: `${y}-${String(m).padStart(2,"0")}-${new Date(y, m, 0).getDate()}` };
  }, [period, selMonth, selYear, dateFrom, dateTo]);

  const { revenue, directCosts, indirectCosts, grossProfit, netProfit, revenueRows, directRows, indirectRows } = useMemo(() => {
    const lm = buildLedgerMap(journalEntries, from, to);
    const accMap = Object.fromEntries(accounts.map((a: any) => [a.account_code, a]));

    const revenueRows: any[] = [];
    const directRows: any[] = [];
    const indirectRows: any[] = [];

    for (const [code, data] of Object.entries(lm)) {
      const acc = accMap[code];
      if (!acc) continue;
      const net = data.credit - data.debit; // revenue natural = credit balance
      if (acc.type === "revenue") revenueRows.push({ code, name: acc.name, amount: net });
      else if (acc.type === "expense" && Number(code) >= 5000 && Number(code) < 6000) {
        directRows.push({ code, name: acc.name, amount: data.debit - data.credit });
      } else if (acc.type === "expense") {
        indirectRows.push({ code, name: acc.name, amount: data.debit - data.credit });
      }
    }
    revenueRows.sort((a, b) => a.code.localeCompare(b.code));
    directRows.sort((a, b) => a.code.localeCompare(b.code));
    indirectRows.sort((a, b) => a.code.localeCompare(b.code));

    const revenue = revenueRows.reduce((s, r) => s + r.amount, 0);
    const directCosts = directRows.reduce((s, r) => s + r.amount, 0);
    const indirectCosts = indirectRows.reduce((s, r) => s + r.amount, 0);
    const grossProfit = revenue - directCosts;
    const netProfit = grossProfit - indirectCosts;

    return { revenue, directCosts, indirectCosts, grossProfit, netProfit, revenueRows, directRows, indirectRows };
  }, [accounts, journalEntries, from, to]);

  const margin = revenue ? Math.round((netProfit / revenue) * 100) : 0;

  return (
    <div>
      {/* Period selector */}
      <div className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-muted/30 rounded-lg border">
        <div className="space-y-1">
          <Label className="text-xs">Period</Label>
          <Select value={period} onValueChange={v => setPeriod(v as any)}>
            <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Monthly</SelectItem>
              <SelectItem value="quarter">Quarterly</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {period !== "custom" && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Month</Label>
              <Select value={String(selMonth)} onValueChange={v => setSelMonth(Number(v))}>
                <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Year</Label>
              <Input type="number" className="h-8 text-xs w-24" value={selYear} onChange={e => setSelYear(Number(e.target.value))} />
            </div>
          </>
        )}
        {period === "custom" && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" className="h-8 text-xs w-36" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" className="h-8 text-xs w-36" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </>
        )}
        <div className="flex gap-2 ml-auto">
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
            onClick={() => {
              const rows = [
                { "Section": "Revenue", "Account": "", "Amount (AED)": "" },
                ...revenueRows.map(r => ({ "Section": "", "Account": r.name, "Amount (AED)": r.amount })),
                { "Section": "Total Revenue", "Account": "", "Amount (AED)": revenue },
                { "Section": "Direct Costs", "Account": "", "Amount (AED)": "" },
                ...directRows.map(r => ({ "Section": "", "Account": r.name, "Amount (AED)": r.amount })),
                { "Section": "Gross Profit", "Account": "", "Amount (AED)": grossProfit },
                { "Section": "Indirect Costs", "Account": "", "Amount (AED)": "" },
                ...indirectRows.map(r => ({ "Section": "", "Account": r.name, "Amount (AED)": r.amount })),
                { "Section": "Net Profit", "Account": "", "Amount (AED)": netProfit },
              ];
              exportExcel(rows, "Profit_and_Loss");
            }}>
            <Download className="h-3.5 w-3.5" />Excel
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
            onClick={() => {
              const section = (title: string, rows: any[], total: number, totalLabel: string) =>
                `<tr class="section-hdr"><td colspan="2"><strong>${title}</strong></td></tr>
                ${rows.map(r=>`<tr><td class="indent">${r.code} — ${r.name}</td><td class="num">${fmtAED(r.amount)}</td></tr>`).join("")}
                <tr class="total-row"><td><strong>${totalLabel}</strong></td><td class="num"><strong>${fmtAED(total)}</strong></td></tr>`;
              const html = `<h1>Profit & Loss Statement</h1><p class="sub">${from} to ${to} | Net Margin: ${margin}%</p>
              <table><thead><tr><th>Account</th><th class="num">Amount (AED)</th></tr></thead><tbody>
              ${section("Revenue", revenueRows, revenue, "Total Revenue")}
              ${section("Direct / Project Costs", directRows, directCosts, "Total Direct Costs")}
              <tr class="total-row"><td><strong>GROSS PROFIT</strong></td><td class="num ${grossProfit>=0?"green":"red"}"><strong>${fmtAED(grossProfit)}</strong></td></tr>
              ${section("Indirect / Overhead Expenses", indirectRows, indirectCosts, "Total Overheads")}
              <tr class="total-row"><td><strong>NET PROFIT / (LOSS)</strong></td><td class="num ${netProfit>=0?"green":"red"}"><strong>${fmtAED(netProfit)}</strong></td></tr>
              </tbody></table>`;
              exportPDF(html, "Profit and Loss");
            }}>
            <FileText className="h-3.5 w-3.5" />PDF
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Revenue</p>
          <p className="text-xl font-bold text-green-600">{fmtAED(revenue)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Direct Costs</p>
          <p className="text-xl font-bold text-red-600">{fmtAED(directCosts)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Gross Profit</p>
          <p className={`text-xl font-bold ${grossProfit >= 0 ? "text-primary" : "text-destructive"}`}>{fmtAED(grossProfit)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Net Profit <span className="font-normal">({margin}% margin)</span></p>
          <p className={`text-xl font-bold ${netProfit >= 0 ? "text-primary" : "text-destructive"}`}>{fmtAED(netProfit)}</p>
        </CardContent></Card>
      </div>

      {/* P&L table */}
      <div className="border rounded-lg overflow-auto text-xs">
        <table className="w-full">
          <colgroup><col className="w-8/12" /><col className="w-4/12" /></colgroup>
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-2 font-semibold">Account</th>
              <th className="text-right px-4 py-2 font-semibold">Amount (AED)</th>
            </tr>
          </thead>
          <tbody>
            {/* Revenue */}
            <tr className="bg-green-50/50 dark:bg-green-900/10">
              <td colSpan={2} className="px-4 py-2 font-bold text-sm text-green-800 dark:text-green-300">Revenue</td>
            </tr>
            {revenueRows.map((r, i) => (
              <tr key={i} className="border-b">
                <td className="px-4 py-1.5 pl-8">{r.code} — {r.name}</td>
                <td className="px-4 py-1.5 text-right text-green-700">{fmtAED(r.amount)}</td>
              </tr>
            ))}
            <tr className="bg-green-50 dark:bg-green-900/20 font-semibold">
              <td className="px-4 py-2">Total Revenue</td>
              <td className="px-4 py-2 text-right text-green-700">{fmtAED(revenue)}</td>
            </tr>

            {/* Direct costs */}
            <tr className="bg-red-50/50 dark:bg-red-900/10">
              <td colSpan={2} className="px-4 py-2 font-bold text-sm text-red-800 dark:text-red-300">Direct / Project Costs</td>
            </tr>
            {directRows.map((r, i) => (
              <tr key={i} className="border-b">
                <td className="px-4 py-1.5 pl-8">{r.code} — {r.name}</td>
                <td className="px-4 py-1.5 text-right text-red-700">{fmtAED(r.amount)}</td>
              </tr>
            ))}
            <tr className="bg-red-50 dark:bg-red-900/20 font-semibold">
              <td className="px-4 py-2">Total Direct Costs</td>
              <td className="px-4 py-2 text-right text-red-700">{fmtAED(directCosts)}</td>
            </tr>

            {/* Gross profit */}
            <tr className={`font-bold text-sm border-y-2 ${grossProfit >= 0 ? "bg-primary/5" : "bg-destructive/5"}`}>
              <td className="px-4 py-3">GROSS PROFIT</td>
              <td className={`px-4 py-3 text-right ${grossProfit >= 0 ? "text-primary" : "text-destructive"}`}>{fmtAED(grossProfit)}</td>
            </tr>

            {/* Indirect / overhead */}
            <tr className="bg-amber-50/50 dark:bg-amber-900/10">
              <td colSpan={2} className="px-4 py-2 font-bold text-sm text-amber-800 dark:text-amber-300">Indirect / Overhead Expenses</td>
            </tr>
            {indirectRows.map((r, i) => (
              <tr key={i} className="border-b">
                <td className="px-4 py-1.5 pl-8">{r.code} — {r.name}</td>
                <td className="px-4 py-1.5 text-right text-amber-700">{fmtAED(r.amount)}</td>
              </tr>
            ))}
            <tr className="bg-amber-50 dark:bg-amber-900/20 font-semibold">
              <td className="px-4 py-2">Total Overheads</td>
              <td className="px-4 py-2 text-right text-amber-700">{fmtAED(indirectCosts)}</td>
            </tr>

            {/* Net profit */}
            <tr className={`font-bold text-base border-y-2 ${netProfit >= 0 ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
              <td className="px-4 py-3">NET PROFIT / (LOSS)</td>
              <td className={`px-4 py-3 text-right ${netProfit >= 0 ? "text-green-700" : "text-destructive"}`}>{fmtAED(netProfit)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Balance Sheet ─────────────────────────────────────────────────────────────
function BalanceSheet({ accounts, journalEntries }: { accounts: any[]; journalEntries: any[] }) {
  const [asAt, setAsAt] = useState(now.toISOString().slice(0, 10));

  const { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity, assetRows, liabilityRows, equityRows } = useMemo(() => {
    const lm = buildLedgerMap(journalEntries, "", asAt);
    const accMap = Object.fromEntries(accounts.map((a: any) => [a.account_code, a]));

    const assetRows: any[] = [];
    const liabilityRows: any[] = [];
    const equityRows: any[] = [];

    for (const [code, data] of Object.entries(lm)) {
      const acc = accMap[code];
      if (!acc) continue;
      const net = data.debit - data.credit; // assets have debit natural balance
      if (acc.type === "asset") assetRows.push({ code, name: acc.name, amount: net });
      else if (acc.type === "liability") liabilityRows.push({ code, name: acc.name, amount: data.credit - data.debit });
      else if (acc.type === "equity") equityRows.push({ code, name: acc.name, amount: data.credit - data.debit });
    }

    // Add retained earnings (from P&L — sum of revenue - expenses)
    let netProfit = 0;
    for (const [code, data] of Object.entries(lm)) {
      const acc = accMap[code];
      if (!acc) continue;
      if (acc.type === "revenue") netProfit += data.credit - data.debit;
      if (acc.type === "expense") netProfit -= data.debit - data.credit;
    }
    if (netProfit !== 0) {
      equityRows.push({ code: "NET", name: "Current Year Profit / (Loss)", amount: netProfit });
    }

    assetRows.sort((a, b) => a.code.localeCompare(b.code));
    liabilityRows.sort((a, b) => a.code.localeCompare(b.code));
    equityRows.sort((a, b) => a.code.localeCompare(b.code));

    const totalAssets = assetRows.reduce((s, r) => s + r.amount, 0);
    const totalLiabilities = liabilityRows.reduce((s, r) => s + r.amount, 0);
    const totalEquity = equityRows.reduce((s, r) => s + r.amount, 0);

    return { assets: totalAssets, liabilities: totalLiabilities, equity: totalEquity, totalAssets, totalLiabilities, totalEquity, assetRows, liabilityRows, equityRows };
  }, [accounts, journalEntries, asAt]);

  const balanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1;

  function Section({ title, rows, total, colorClass }: any) {
    return (
      <>
        <tr className={`${colorClass} border-b`}>
          <td colSpan={2} className="px-4 py-2 font-bold text-sm">{title}</td>
        </tr>
        {rows.map((r: any, i: number) => (
          <tr key={i} className="border-b hover:bg-muted/20">
            <td className="px-4 py-1.5 pl-8 text-xs">{r.code !== "NET" ? `${r.code} — ` : ""}{r.name}</td>
            <td className="px-4 py-1.5 text-right text-xs">{fmtAED(r.amount)}</td>
          </tr>
        ))}
        <tr className="font-semibold bg-muted/30">
          <td className="px-4 py-2 text-xs">Total {title}</td>
          <td className="px-4 py-2 text-right text-xs">{fmtAED(total)}</td>
        </tr>
      </>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-muted/30 rounded-lg border">
        <div className="space-y-1">
          <Label className="text-xs">As at Date</Label>
          <Input type="date" className="h-8 text-xs w-36" value={asAt} onChange={e => setAsAt(e.target.value)} />
        </div>
        <div className={`ml-2 text-sm font-medium ${balanced ? "text-green-600" : "text-destructive"}`}>
          {balanced ? "✓ Balanced" : `✗ Out of balance by ${fmtAED(Math.abs(totalAssets - totalLiabilities - totalEquity))}`}
        </div>
        <div className="flex gap-2 ml-auto">
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
            onClick={() => {
              const rows = [
                ...assetRows.map(r => ({ Section: "Assets", Account: r.name, "Amount (AED)": r.amount })),
                { Section: "Total Assets", Account: "", "Amount (AED)": totalAssets },
                ...liabilityRows.map(r => ({ Section: "Liabilities", Account: r.name, "Amount (AED)": r.amount })),
                { Section: "Total Liabilities", Account: "", "Amount (AED)": totalLiabilities },
                ...equityRows.map(r => ({ Section: "Equity", Account: r.name, "Amount (AED)": r.amount })),
                { Section: "Total Equity", Account: "", "Amount (AED)": totalEquity },
              ];
              exportExcel(rows, "Balance_Sheet");
            }}>
            <Download className="h-3.5 w-3.5" />Excel
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
            onClick={() => {
              const sec = (t: string, rows: any[], total: number) =>
                `<tr class="section-hdr"><td colspan="2">${t}</td></tr>${rows.map(r=>`<tr><td class="indent">${r.code !== "NET" ? r.code+" — " : ""}${r.name}</td><td class="num">${fmtAED(r.amount)}</td></tr>`).join("")}<tr class="total-row"><td>Total ${t}</td><td class="num"><strong>${fmtAED(total)}</strong></td></tr>`;
              const html = `<h1>Balance Sheet</h1><p class="sub">As at ${asAt}</p><table><thead><tr><th>Account</th><th class="num">AED</th></tr></thead><tbody>${sec("Assets",assetRows,totalAssets)}${sec("Liabilities",liabilityRows,totalLiabilities)}${sec("Equity",equityRows,totalEquity)}</tbody></table>`;
              exportPDF(html, "Balance Sheet");
            }}>
            <FileText className="h-3.5 w-3.5" />PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Total Assets</p>
          <p className="text-xl font-bold text-blue-600">{fmtAED(totalAssets)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Total Liabilities</p>
          <p className="text-xl font-bold text-red-600">{fmtAED(totalLiabilities)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Total Equity</p>
          <p className="text-xl font-bold text-primary">{fmtAED(totalEquity)}</p>
        </CardContent></Card>
      </div>

      <div className="border rounded-lg overflow-auto text-xs">
        <table className="w-full">
          <colgroup><col className="w-8/12" /><col className="w-4/12" /></colgroup>
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-2 font-semibold">Account</th>
              <th className="text-right px-4 py-2 font-semibold">Amount (AED)</th>
            </tr>
          </thead>
          <tbody>
            <Section title="Assets" rows={assetRows} total={totalAssets} colorClass="bg-blue-50/60 dark:bg-blue-900/10 text-blue-800 dark:text-blue-200" />
            <Section title="Liabilities" rows={liabilityRows} total={totalLiabilities} colorClass="bg-red-50/60 dark:bg-red-900/10 text-red-800 dark:text-red-200" />
            <Section title="Equity" rows={equityRows} total={totalEquity} colorClass="bg-purple-50/60 dark:bg-purple-900/10 text-purple-800 dark:text-purple-200" />
            <tr className={`font-bold border-t-2 text-sm ${balanced ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"}`}>
              <td className="px-4 py-3">LIABILITIES + EQUITY</td>
              <td className="px-4 py-3 text-right">{fmtAED(totalLiabilities + totalEquity)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FinancialReports() {
  const { data: accounts = [] } = useList("accounts");
  const { data: journalEntries = [], isLoading } = useList("journal_entries");

  // Parse lines from JSON if needed
  const entries = useMemo(() => (journalEntries as any[]).map((e: any) => ({
    ...e,
    lines: Array.isArray(e.lines) ? e.lines : (typeof e.lines === "string" ? JSON.parse(e.lines || "[]") : []),
  })), [journalEntries]);

  return (
    <div>
      <PageHeader
        title="Financial Reports"
        subtitle="Trial Balance · Profit & Loss · Balance Sheet — from your posted journal entries"
      />
      <Tabs defaultValue="pl">
        <TabsList className="mb-4">
          <TabsTrigger value="tb" className="gap-1.5"><Scale className="h-3.5 w-3.5" />Trial Balance</TabsTrigger>
          <TabsTrigger value="pl" className="gap-1.5"><TrendingUp className="h-3.5 w-3.5" />Profit & Loss</TabsTrigger>
          <TabsTrigger value="bs" className="gap-1.5"><TrendingDown className="h-3.5 w-3.5" />Balance Sheet</TabsTrigger>
        </TabsList>
        <TabsContent value="tb"><TrialBalance accounts={accounts as any[]} journalEntries={entries} /></TabsContent>
        <TabsContent value="pl"><ProfitAndLoss accounts={accounts as any[]} journalEntries={entries} /></TabsContent>
        <TabsContent value="bs"><BalanceSheet accounts={accounts as any[]} journalEntries={entries} /></TabsContent>
      </Tabs>
    </div>
  );
}
