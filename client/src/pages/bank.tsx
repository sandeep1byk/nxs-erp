/**
 * Bank Reconciliation — rebuilt with proper file upload
 * Handles ENBD CSV format (2 info rows, then header row, then data)
 * and standard single-header-row CSV formats.
 */
import { useState, useRef } from "react";
import { PageHeader, useList, useSave, StatusBadge } from "@/components/common";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { fmtDate, fmtAED } from "@/lib/nxs";
import {
  Upload, CheckCircle, FileSpreadsheet, Loader2,
  ArrowDownCircle, ArrowUpCircle
} from "lucide-react";

// ---- CSV helpers ------------------------------------------------------------
function parseCsvLine(line: string, delim: string): string[] {
  const cols: string[] = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === delim && !inQ) { cols.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}

function parseAmount(s: string): number {
  if (!s) return 0;
  return parseFloat(s.replace(/[^0-9.\-]/g, "")) || 0;
}

function parseDate(s: string): string {
  if (!s) return "";
  s = s.trim();
  // DD-MM-YYYY or DD/MM/YYYY  →  YYYY-MM-DD
  const dmy = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/);
  if (dmy) {
    const y = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${y}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

interface RawTxn {
  txn_date: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
}

/**
 * Smart parser — finds the real header row (the one with "date", "debit",
 * "credit" etc.) even if there are metadata rows above it (like ENBD).
 * Everything after the header row is treated as transaction data.
 */
function parseStatementFile(text: string): RawTxn[] {
  const allLines = text.split(/\r?\n/);

  // Detect delimiter
  const firstNonEmpty = allLines.find((l) => l.trim()) || "";
  const delim = firstNonEmpty.includes("\t") ? "\t"
    : firstNonEmpty.includes(";") ? ";"
    : ",";

  // Keywords that appear in a transaction header row
  const HEADER_KEYWORDS = ["date", "debit", "credit", "description", "narration",
    "amount", "balance", "particulars", "reference", "withdrawal", "deposit",
    "transaction", "remarks", "detail", "running"];

  // Find the row with the most header keywords (skip up to first 40 rows)
  let headerLineIdx = -1;
  let bestScore = 0;
  for (let i = 0; i < Math.min(allLines.length, 40); i++) {
    const line = allLines[i].trim();
    if (!line) continue;
    const cells = parseCsvLine(line, delim).map((c) => c.toLowerCase());
    const score = cells.reduce((s, c) =>
      s + (HEADER_KEYWORDS.some((k) => c.includes(k)) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; headerLineIdx = i; }
  }

  if (headerLineIdx < 0 || bestScore < 1) return [];

  const headers = parseCsvLine(allLines[headerLineIdx], delim)
    .map((h) => h.toLowerCase().trim());

  const findCol = (...keys: string[]) => {
    for (const k of keys) {
      const idx = headers.findIndex((h) => h.includes(k));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  // ENBD columns: Account Number, Transaction Date, Value Date, Narration,
  //               Transaction Reference, Debit, Credit, Running Balance
  const dateIdx   = findCol("transaction date", "date", "txndate", "valuedate", "postingdate");
  const descIdx   = findCol("narration", "description", "particulars", "details", "remarks", "memo", "detail");
  const refIdx    = findCol("transaction reference", "reference", "refno", "chequeno", "txnid");
  const debitIdx  = findCol("debit", "withdrawal", "dr", "payment");
  const creditIdx = findCol("credit", "deposit", "cr", "receipt");
  const balIdx    = findCol("running balance", "balance", "closingbalance");
  const amtIdx    = findCol("amount");

  const txns: RawTxn[] = [];

  for (let i = headerLineIdx + 1; i < allLines.length; i++) {
    const line = allLines[i].trim();
    if (!line) continue;
    const cols = parseCsvLine(line, delim);
    if (cols.every((c) => !c)) continue;

    // Skip footer/total rows
    const firstCell = (cols[0] || "").toLowerCase();
    if (firstCell.includes("total") || firstCell.includes("opening balance")
      || firstCell.includes("closing balance")) continue;

    let debit  = debitIdx  >= 0 ? parseAmount(cols[debitIdx]  || "") : 0;
    let credit = creditIdx >= 0 ? parseAmount(cols[creditIdx] || "") : 0;

    // Single amount column
    if (debit === 0 && credit === 0 && amtIdx >= 0) {
      const amt = parseAmount(cols[amtIdx] || "");
      if (amt < 0) debit = Math.abs(amt);
      else if (amt > 0) credit = amt;
    }

    const rawDate     = dateIdx >= 0 ? cols[dateIdx] || "" : cols[0] || "";
    const description = descIdx >= 0 ? cols[descIdx] || "" : cols[1] || "";
    const txn_date    = parseDate(rawDate);

    // Skip rows that have no date AND no amounts — metadata / blank
    if (!txn_date && debit === 0 && credit === 0) continue;

    txns.push({
      txn_date,
      description,
      reference: refIdx >= 0 ? cols[refIdx] || "" : "",
      debit,
      credit,
      balance: balIdx >= 0 ? parseAmount(cols[balIdx] || "") : 0,
    });
  }
  return txns;
}

// ---- Upload Statement Dialog ------------------------------------------------
interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: (statementId: string) => void;
}

function UploadStatementDialog({ open, onClose, onImported }: UploadDialogProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [bankName, setBankName]         = useState("ENBD");
  const [accountNumber, setAccountNumber] = useState("");
  const [statementDate, setStatementDate] = useState(new Date().toISOString().slice(0, 10));
  const [fileName, setFileName]         = useState("");
  const [txns, setTxns]                 = useState<RawTxn[]>([]);
  const [saving, setSaving]             = useState(false);

  function handleFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseStatementFile(text);
      if (parsed.length === 0) {
        toast({
          title: "No transactions found",
          description: "Make sure this is a CSV file exported from your bank.",
          variant: "destructive",
        });
        return;
      }
      setTxns(parsed);
      toast({ title: `${parsed.length} transactions found`, description: "Review below and click Import." });
    };
    reader.readAsText(file);
  }

  async function doImport() {
    if (!bankName.trim()) {
      toast({ title: "Please enter the bank name", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // 1. Create statement record — only columns that exist in the DB
      const stmtRes = await apiRequest("POST", "/api/bank_statements", {
        bank_name: bankName.trim(),
        account_number: accountNumber.trim() || null,
        statement_date: statementDate,
        status: "pending",
      });
      const stmt = await stmtRes.json();

      // 2. Insert transactions one by one — only real DB columns
      for (const t of txns) {
        await apiRequest("POST", "/api/bank_transactions", {
          statement_id: stmt.id,
          txn_date:     t.txn_date || statementDate,
          description:  t.description || null,
          reference:    t.reference   || null,
          debit:        t.debit  > 0 ? t.debit  : null,
          credit:       t.credit > 0 ? t.credit : null,
          balance:      t.balance     || null,
          is_reconciled: false,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/bank_statements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank_transactions"] });
      toast({ title: "Statement imported!", description: `${txns.length} transactions ready to reconcile.` });
      onImported(stmt.id);
      onClose();
    } catch (e: any) {
      toast({ title: "Import failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setBankName("ENBD");
    setAccountNumber("");
    setStatementDate(new Date().toISOString().slice(0, 10));
    setFileName("");
    setTxns([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Bank Statement</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Bank details */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Bank Name <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. ENBD" value={bankName}
                onChange={(e) => setBankName(e.target.value)} data-testid="input-bank-name" />
            </div>
            <div className="space-y-1.5">
              <Label>Account Number</Label>
              <Input placeholder="e.g. 1015777252801" value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Statement Date</Label>
              <Input type="date" value={statementDate}
                onChange={(e) => setStatementDate(e.target.value)} />
            </div>
          </div>

          {/* Drop zone */}
          <div
            className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          >
            {fileName ? (
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="h-6 w-6 text-primary" />
                <div className="text-left">
                  <p className="font-medium text-sm">{fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {txns.length} transactions found — click to change file
                  </p>
                </div>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="font-medium text-sm mb-1">Click here to select your bank statement CSV</p>
                <p className="text-xs text-muted-foreground">
                  ENBD, FAB, ADIB — any CSV exported from your bank's online banking
                </p>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

          {/* Preview table */}
          {txns.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">
                {txns.length} transactions found — preview (first 5):
              </p>
              <div className="border rounded-lg overflow-hidden text-sm">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-xs">Date</th>
                      <th className="text-left px-3 py-2 font-medium text-xs">Description</th>
                      <th className="text-right px-3 py-2 font-medium text-xs">Debit</th>
                      <th className="text-right px-3 py-2 font-medium text-xs">Credit</th>
                      <th className="text-right px-3 py-2 font-medium text-xs">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txns.slice(0, 5).map((t, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-1.5 text-xs">{t.txn_date}</td>
                        <td className="px-3 py-1.5 text-xs max-w-[200px] truncate" title={t.description}>
                          {t.description || "—"}
                        </td>
                        <td className="px-3 py-1.5 text-xs text-right text-red-600">
                          {t.debit ? fmtAED(t.debit) : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-xs text-right text-green-600">
                          {t.credit ? fmtAED(t.credit) : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-xs text-right text-muted-foreground">
                          {t.balance ? fmtAED(t.balance) : "—"}
                        </td>
                      </tr>
                    ))}
                    {txns.length > 5 && (
                      <tr className="border-t bg-muted/30">
                        <td colSpan={5} className="px-3 py-1.5 text-xs text-center text-muted-foreground">
                          + {txns.length - 5} more transactions
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* How-to note */}
          {txns.length === 0 && (
            <div className="p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">How to export from ENBD:</p>
              <p>Online banking → Accounts → View Statement → Download → CSV</p>
              <p className="mt-1">The CSV file from ENBD works directly — no changes needed.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button onClick={doImport} disabled={txns.length === 0 || saving}
            data-testid="button-import-statement">
            {saving
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing…</>
              : <><Upload className="h-4 w-4 mr-1" /> Import {txns.length} Transactions</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Reconcile Dialog -------------------------------------------------------
interface ReconcileDialogProps {
  txn: any;
  projects: any[];
  accounts: any[];
  onClose: () => void;
}

function ReconcileDialog({ txn, projects, accounts, onClose }: ReconcileDialogProps) {
  const { toast } = useToast();
  const [counterparty, setCounterparty] = useState(txn.counterparty || "");
  const [projectId, setProjectId]       = useState(txn.project_id  || "");
  const [accountId, setAccountId]       = useState(txn.account_id  || "");
  const [notes, setNotes]               = useState(txn.notes       || "");

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/bank_transactions/${txn.id}`, {
        ...txn,
        counterparty: counterparty || null,
        project_id:   projectId   || null,
        account_id:   accountId   || null,
        notes:        notes       || null,
        is_reconciled: true,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank_transactions"] });
      toast({ title: "Transaction reconciled" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isDebit = (txn.debit || 0) > 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reconcile Transaction</DialogTitle>
        </DialogHeader>

        {/* Transaction summary card */}
        <div className={`rounded-lg p-3 mb-1 border ${isDebit
          ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
          : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"}`}>
          <div className="flex items-center gap-2 mb-1">
            {isDebit
              ? <ArrowUpCircle className="h-4 w-4 text-red-600 shrink-0" />
              : <ArrowDownCircle className="h-4 w-4 text-green-600 shrink-0" />}
            <span className="text-sm font-medium">{isDebit ? "Money Out" : "Money In"}</span>
            <span className={`ml-auto font-bold ${isDebit ? "text-red-600" : "text-green-600"}`}>
              {fmtAED(isDebit ? txn.debit : txn.credit)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{txn.description}</p>
          <p className="text-xs text-muted-foreground">
            {fmtDate(txn.txn_date)}{txn.reference ? ` · Ref: ${txn.reference}` : ""}
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{isDebit ? "Who did you pay?" : "Who paid you?"}</Label>
            <Input
              placeholder={isDebit ? "Vendor / supplier name" : "Client / payer name"}
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              data-testid="input-counterparty"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Link to Project (optional)</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="— no project —" /></SelectTrigger>
              <SelectContent>
                {projects.map((p: any) =>
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>GL Account (Chart of Accounts)</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="— select account —" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a: any) =>
                  <SelectItem key={a.id} value={a.id}>{a.account_code} — {a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Input placeholder="Any notes" value={notes}
              onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}
            data-testid="button-reconcile">
            {save.isPending
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
              : <><CheckCircle className="h-4 w-4 mr-1" /> Mark Reconciled</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Main Page --------------------------------------------------------------
export default function Bank() {
  const stmts    = useList("bank_statements");
  const txns     = useList("bank_transactions");
  const projects = useList("projects");
  const accounts = useList("accounts");

  const [uploadOpen, setUploadOpen]   = useState(false);
  const [reconcile, setReconcile]     = useState<any>(null);
  const [filterStmt, setFilterStmt]   = useState<string>("all");

  const filteredTxns = (txns.data || []).filter((t: any) =>
    filterStmt === "all" || t.statement_id === filterStmt
  );

  const pendingCount    = filteredTxns.filter((t: any) => !t.is_reconciled).length;
  const reconciledCount = filteredTxns.filter((t: any) =>  t.is_reconciled).length;

  return (
    <div>
      <PageHeader
        title="Bank Reconciliation"
        subtitle="Upload your bank statement — each transaction appears line by line to reconcile"
        actions={
          <Button onClick={() => setUploadOpen(true)} data-testid="button-upload-statement">
            <Upload className="h-4 w-4 mr-2" /> Upload Statement
          </Button>
        }
      />

      <Tabs defaultValue="txns">
        <TabsList>
          <TabsTrigger value="txns">Transactions</TabsTrigger>
          <TabsTrigger value="statements">Statements</TabsTrigger>
        </TabsList>

        {/* TRANSACTIONS TAB */}
        <TabsContent value="txns">
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-sm shrink-0">Filter by statement:</Label>
              <Select value={filterStmt} onValueChange={setFilterStmt}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statements</SelectItem>
                  {(stmts.data || []).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.bank_name} — {fmtDate(s.statement_date)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {filteredTxns.length > 0 && (
              <div className="flex gap-4 ml-auto text-sm">
                <span className="text-muted-foreground">
                  <span className="font-semibold text-amber-600">{pendingCount}</span> pending
                </span>
                <span className="text-muted-foreground">
                  <span className="font-semibold text-green-600">{reconciledCount}</span> reconciled
                </span>
              </div>
            )}
          </div>

          {filteredTxns.length === 0 && !txns.isLoading ? (
            <div className="text-center py-16 border-2 border-dashed rounded-xl">
              <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium mb-1">No transactions yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Upload a bank statement CSV and each transaction will appear here
              </p>
              <Button onClick={() => setUploadOpen(true)}>
                <Upload className="h-4 w-4 mr-2" /> Upload Statement
              </Button>
            </div>
          ) : (
            <DataTable
              rows={filteredTxns}
              loading={txns.isLoading}
              columns={[
                {
                  header: "Date",
                  cell: (r: any) => <span className="text-sm">{fmtDate(r.txn_date)}</span>
                },
                {
                  header: "Description",
                  cell: (r: any) => (
                    <div>
                      <p className="text-sm max-w-xs truncate" title={r.description}>
                        {r.description || "—"}
                      </p>
                      {r.reference && r.reference !== "- -" && (
                        <p className="text-xs text-muted-foreground">Ref: {r.reference}</p>
                      )}
                    </div>
                  )
                },
                {
                  header: "Money Out",
                  cell: (r: any) => r.debit
                    ? <span className="text-red-600 font-medium">{fmtAED(r.debit)}</span>
                    : <span className="text-muted-foreground">—</span>
                },
                {
                  header: "Money In",
                  cell: (r: any) => r.credit
                    ? <span className="text-green-600 font-medium">{fmtAED(r.credit)}</span>
                    : <span className="text-muted-foreground">—</span>
                },
                {
                  header: "Balance",
                  cell: (r: any) => r.balance
                    ? <span className="text-sm text-muted-foreground">{fmtAED(r.balance)}</span>
                    : <span className="text-muted-foreground">—</span>
                },
                {
                  header: "Counterparty",
                  cell: (r: any) => r.counterparty
                    ? <span className="text-sm">{r.counterparty}</span>
                    : <span className="text-xs text-muted-foreground italic">Not set</span>
                },
                {
                  header: "Status",
                  cell: (r: any) => r.is_reconciled
                    ? <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                        <CheckCircle className="h-4 w-4" /> Done
                      </span>
                    : <Button size="sm" variant="outline" className="h-7 text-xs px-2"
                        onClick={() => setReconcile(r)}
                        data-testid={`button-reconcile-${r.id}`}>
                        Reconcile
                      </Button>
                },
              ]}
            />
          )}
        </TabsContent>

        {/* STATEMENTS TAB */}
        <TabsContent value="statements">
          <div className="flex justify-end mb-3">
            <Button onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-2" /> Upload Statement
            </Button>
          </div>
          <DataTable
            rows={stmts.data}
            loading={stmts.isLoading}
            columns={[
              { header: "Bank",    cell: (r: any) => <span className="font-medium">{r.bank_name}</span> },
              { header: "Account", cell: (r: any) => r.account_number || "—" },
              { header: "Date",    cell: (r: any) => fmtDate(r.statement_date) },
              {
                header: "Transactions",
                cell: (r: any) => {
                  const count = (txns.data || []).filter((t: any) => t.statement_id === r.id).length;
                  const done  = (txns.data || []).filter((t: any) => t.statement_id === r.id && t.is_reconciled).length;
                  return <span className="text-sm">{done} / {count} reconciled</span>;
                }
              },
              { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
              {
                header: "",
                cell: (r: any) => (
                  <Button size="sm" variant="ghost" className="text-xs"
                    onClick={() => setFilterStmt(r.id)}>
                    View Transactions
                  </Button>
                )
              },
            ]}
          />
        </TabsContent>
      </Tabs>

      <UploadStatementDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onImported={(id) => setFilterStmt(id)}
      />

      {reconcile && (
        <ReconcileDialog
          txn={reconcile}
          projects={projects.data || []}
          accounts={accounts.data || []}
          onClose={() => setReconcile(null)}
        />
      )}
    </div>
  );
}
