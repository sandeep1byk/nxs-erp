/**
 * Bank Reconciliation — inline design with smart counterparty rules.
 *
 * Key design decisions:
 * - No popup for reconciling. Everything inline in the transaction row.
 * - Description wraps fully — no truncation, every word visible.
 * - Counterparty field is the only input. System remembers what category
 *   each name maps to. First time a new name is used → quick category picker.
 * - No GL account dropdown shown to user. Category → account mapping is automatic.
 */
import { useState, useRef, useEffect } from "react";
import { PageHeader, useList, StatusBadge } from "@/components/common";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { fmtDate, fmtAED } from "@/lib/nxs";
import { Upload, CheckCircle, FileSpreadsheet, Loader2, ArrowDownCircle, ArrowUpCircle, Plus } from "lucide-react";

// ---- Category definitions ---------------------------------------------------
const CATEGORIES = [
  { value: "client",      label: "Client",             desc: "Money received from a client",          account_code: "1100", account_name: "Accounts Receivable" },
  { value: "supplier",    label: "Supplier / Vendor",  desc: "Payment made to a supplier",            account_code: "2000", account_name: "Accounts Payable" },
  { value: "utility",     label: "Utility Bill",       desc: "DEWA, ETISALAT, DU, SALIK, RTA etc.",  account_code: "6200", account_name: "Utilities" },
  { value: "salary",      label: "Salary / Payroll",   desc: "Staff salary or wage payment",          account_code: "6000", account_name: "Salaries & Wages" },
  { value: "bank_charge", label: "Bank Charge / Fee",  desc: "Bank fees, VAT on bank charges",        account_code: "6300", account_name: "Office & Admin Expenses" },
  { value: "rent",        label: "Rent",               desc: "Office or site rent payment",           account_code: "6100", account_name: "Rent Expense" },
  { value: "petty_cash",  label: "Petty Cash",         desc: "Petty cash withdrawal or top-up",       account_code: "1000", account_name: "Cash & Bank" },
  { value: "other",       label: "Other Expense",      desc: "Any other business expense",            account_code: "6300", account_name: "Office & Admin Expenses" },
];

// ---- CSV helpers (same parser as before) ------------------------------------
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
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  return s;
}
interface RawTxn { txn_date:string; description:string; reference:string; debit:number; credit:number; balance:number; }
function parseStatementFile(text: string): RawTxn[] {
  const allLines = text.split(/\r?\n/);
  const first = allLines.find(l=>l.trim())||"";
  const delim = first.includes("\t") ? "\t" : first.includes(";") ? ";" : ",";
  const HKEYS = ["date","debit","credit","narration","description","amount","balance","reference","withdrawal","deposit","transaction","running"];
  let headerIdx = -1, best = 0;
  for (let i=0; i<Math.min(allLines.length,40); i++) {
    if (!allLines[i].trim()) continue;
    const cells = parseCsvLine(allLines[i],delim).map(c=>c.toLowerCase());
    const score = cells.reduce((s,c)=>s+(HKEYS.some(k=>c.includes(k))?1:0),0);
    if (score>best) { best=score; headerIdx=i; }
  }
  if (headerIdx<0||best<1) return [];
  const headers = parseCsvLine(allLines[headerIdx],delim).map(h=>h.toLowerCase().trim());
  const fc = (...keys:string[]) => { for(const k of keys){const i=headers.findIndex(h=>h.includes(k));if(i>=0)return i;} return -1; };
  const dateIdx=fc("transaction date","date","txndate","valuedate");
  const descIdx=fc("narration","description","particulars","details","remarks","memo");
  const refIdx=fc("transaction reference","reference","refno","chequeno");
  const debitIdx=fc("debit","withdrawal","dr","payment");
  const creditIdx=fc("credit","deposit","cr","receipt");
  const balIdx=fc("running balance","balance");
  const amtIdx=fc("amount");
  const txns:RawTxn[]=[];
  for (let i=headerIdx+1;i<allLines.length;i++) {
    const line=allLines[i].trim(); if(!line) continue;
    const cols=parseCsvLine(line,delim); if(cols.every(c=>!c)) continue;
    const firstCell=(cols[0]||"").toLowerCase();
    if(firstCell.includes("total")||firstCell.includes("opening balance")||firstCell.includes("closing balance")) continue;
    let debit=debitIdx>=0?parseAmount(cols[debitIdx]||""):0;
    let credit=creditIdx>=0?parseAmount(cols[creditIdx]||""):0;
    if(debit===0&&credit===0&&amtIdx>=0){const a=parseAmount(cols[amtIdx]||"");if(a<0)debit=Math.abs(a);else if(a>0)credit=a;}
    const rawDate=dateIdx>=0?cols[dateIdx]||"":cols[0]||"";
    const description=descIdx>=0?cols[descIdx]||"":cols[1]||"";
    const txn_date=parseDate(rawDate);
    if(!txn_date&&debit===0&&credit===0) continue;
    txns.push({txn_date,description,reference:refIdx>=0?cols[refIdx]||"":"",debit,credit,balance:balIdx>=0?parseAmount(cols[balIdx]||""):0});
  }
  return txns;
}

// ---- Upload Statement Dialog ------------------------------------------------
function UploadStatementDialog({ open, onClose, onImported }: { open:boolean; onClose:()=>void; onImported:(id:string)=>void; }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [bankName, setBankName] = useState("ENBD");
  const [accountNumber, setAccountNumber] = useState("");
  const [statementDate, setStatementDate] = useState(new Date().toISOString().slice(0,10));
  const [fileName, setFileName] = useState("");
  const [txns, setTxns] = useState<RawTxn[]>([]);
  const [saving, setSaving] = useState(false);

  function handleFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseStatementFile(e.target?.result as string);
      if (!parsed.length) { toast({title:"No transactions found",description:"Make sure this is a CSV from your bank.",variant:"destructive"}); return; }
      setTxns(parsed);
      toast({title:`${parsed.length} transactions found`,description:"Click Import below."});
    };
    reader.readAsText(file);
  }

  async function doImport() {
    if (!bankName.trim()) { toast({title:"Enter bank name",variant:"destructive"}); return; }
    setSaving(true);
    try {
      const stmt = await (await apiRequest("POST","/api/bank_statements",{bank_name:bankName.trim(),account_number:accountNumber.trim()||null,statement_date:statementDate,status:"pending"})).json();
      for (const t of txns) {
        await apiRequest("POST","/api/bank_transactions",{statement_id:stmt.id,txn_date:t.txn_date||statementDate,description:t.description||null,reference:t.reference||null,debit:t.debit>0?t.debit:null,credit:t.credit>0?t.credit:null,balance:t.balance||null,is_reconciled:false});
      }
      queryClient.invalidateQueries({queryKey:["/api/bank_statements"]});
      queryClient.invalidateQueries({queryKey:["/api/bank_transactions"]});
      toast({title:"Imported!",description:`${txns.length} transactions ready.`});
      onImported(stmt.id); onClose();
    } catch(e:any) { toast({title:"Import failed",description:e.message,variant:"destructive"}); }
    finally { setSaving(false); }
  }

  function reset() { setBankName("ENBD"); setAccountNumber(""); setStatementDate(new Date().toISOString().slice(0,10)); setFileName(""); setTxns([]); if(fileRef.current) fileRef.current.value=""; }

  return (
    <Dialog open={open} onOpenChange={(o)=>{if(!o){reset();onClose();}}}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Upload Bank Statement</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Bank Name *</Label><Input placeholder="e.g. ENBD" value={bankName} onChange={e=>setBankName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Account Number</Label><Input placeholder="e.g. 1015777252801" value={accountNumber} onChange={e=>setAccountNumber(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Statement Date</Label><Input type="date" value={statementDate} onChange={e=>setStatementDate(e.target.value)} /></div>
          </div>
          <div className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
            onClick={()=>fileRef.current?.click()} onDragOver={e=>e.preventDefault()}
            onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)handleFile(f);}}>
            {fileName ? (
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="h-6 w-6 text-primary" />
                <div className="text-left"><p className="font-medium text-sm">{fileName}</p><p className="text-xs text-muted-foreground">{txns.length} transactions — click to change</p></div>
              </div>
            ) : (
              <><Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="font-medium text-sm mb-1">Click to select your bank statement CSV</p><p className="text-xs text-muted-foreground">ENBD, FAB, ADIB — any CSV exported from online banking</p></>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f);}} />
          {txns.length>0 && (
            <div>
              <p className="text-sm font-medium mb-2">{txns.length} transactions — preview (first 5):</p>
              <div className="border rounded-lg overflow-hidden text-sm">
                <table className="w-full"><thead className="bg-muted/50"><tr>
                  <th className="text-left px-3 py-2 text-xs font-medium">Date</th>
                  <th className="text-left px-3 py-2 text-xs font-medium">Description</th>
                  <th className="text-right px-3 py-2 text-xs font-medium">Debit</th>
                  <th className="text-right px-3 py-2 text-xs font-medium">Credit</th>
                  <th className="text-right px-3 py-2 text-xs font-medium">Balance</th>
                </tr></thead><tbody>
                  {txns.slice(0,5).map((t,i)=>(
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5 text-xs">{t.txn_date}</td>
                      <td className="px-3 py-1.5 text-xs">{t.description||"—"}</td>
                      <td className="px-3 py-1.5 text-xs text-right text-red-600">{t.debit?fmtAED(t.debit):"—"}</td>
                      <td className="px-3 py-1.5 text-xs text-right text-green-600">{t.credit?fmtAED(t.credit):"—"}</td>
                      <td className="px-3 py-1.5 text-xs text-right text-muted-foreground">{t.balance?fmtAED(t.balance):"—"}</td>
                    </tr>
                  ))}
                  {txns.length>5&&<tr className="border-t bg-muted/30"><td colSpan={5} className="px-3 py-1.5 text-xs text-center text-muted-foreground">+ {txns.length-5} more</td></tr>}
                </tbody></table>
              </div>
            </div>
          )}
          {txns.length===0&&<div className="p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground"><p className="font-medium text-foreground mb-1">How to export from ENBD:</p><p>Online banking → Accounts → View Statement → Download → CSV</p></div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={()=>{reset();onClose();}}>Cancel</Button>
          <Button onClick={doImport} disabled={txns.length===0||saving}>
            {saving?<><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Importing…</>:<><Upload className="h-4 w-4 mr-1"/>Import {txns.length} Transactions</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- New Counterparty Dialog (first-time category picker) -------------------
function NewCounterpartyDialog({ name, onSaved, onClose }: { name:string; onSaved:(rule:any)=>void; onClose:()=>void; }) {
  const { toast } = useToast();
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  async function doSave() {
    if (!category) { toast({title:"Please pick a category",variant:"destructive"}); return; }
    setSaving(true);
    try {
      const cat = CATEGORIES.find(c=>c.value===category)!;
      const res = await apiRequest("POST","/api/counterparty_rules",{name:name.trim(),category,account_code:cat.account_code,account_name:cat.account_name});
      const rule = await res.json();
      queryClient.invalidateQueries({queryKey:["/api/counterparty_rules"]});
      toast({title:`"${name}" saved as ${cat.label}`});
      onSaved(rule);
    } catch(e:any) { toast({title:"Error",description:e.message,variant:"destructive"}); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={o=>!o&&onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>What is "{name}"?</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">This is the first time you're using this name. Pick a category — the system will remember it automatically next time.</p>
        <div className="space-y-2 py-1">
          {CATEGORIES.map(cat=>(
            <button key={cat.value} onClick={()=>setCategory(cat.value)}
              className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${category===cat.value?"border-primary bg-primary/10":"border-border hover:bg-muted/50"}`}>
              <p className="text-sm font-medium">{cat.label}</p>
              <p className="text-xs text-muted-foreground">{cat.desc}</p>
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={doSave} disabled={!category||saving}>
            {saving?<><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Saving…</>:"Save & Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Inline Transaction Row -------------------------------------------------
function TxnRow({ txn, rules }: { txn:any; rules:any[]; }) {
  const { toast } = useToast();
  const [counterparty, setCounterparty] = useState(txn.counterparty||"");
  const [saving, setSaving] = useState(false);
  const [showNewParty, setShowNewParty] = useState(false);
  const [pendingRule, setPendingRule] = useState<any>(null);

  const isDebit = (txn.debit||0)>0;
  const amount = isDebit ? txn.debit : txn.credit;

  // Find existing rule for typed counterparty name
  const matchedRule = rules.find(r=>r.name_lower===(counterparty||"").toLowerCase().trim());

  async function reconcile(rule?: any) {
    const activeRule = rule || matchedRule;
    if (!counterparty.trim()) { toast({title:"Enter a counterparty name first",variant:"destructive"}); return; }

    // First time this name is used — ask for category
    if (!activeRule) {
      setShowNewParty(true);
      return;
    }

    setSaving(true);
    try {
      await apiRequest("PUT",`/api/bank_transactions/${txn.id}`,{
        ...txn,
        counterparty: counterparty.trim(),
        account_id: null,
        notes: activeRule ? `${activeRule.account_code} — ${activeRule.account_name}` : null,
        is_reconciled: true,
      });
      queryClient.invalidateQueries({queryKey:["/api/bank_transactions"]});
      toast({title:"Reconciled ✓"});
    } catch(e:any) { toast({title:"Error",description:e.message,variant:"destructive"}); }
    finally { setSaving(false); }
  }

  function handleNewPartySaved(rule: any) {
    setPendingRule(rule);
    setShowNewParty(false);
    reconcile(rule);
  }

  if (txn.is_reconciled) {
    return (
      <tr className="border-b bg-green-50/30 dark:bg-green-900/10">
        <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(txn.txn_date)}</td>
        <td className="px-3 py-2 text-xs leading-relaxed">{txn.description}</td>
        <td className="px-3 py-2 text-xs text-right">{txn.debit?<span className="text-red-600 font-medium">{fmtAED(txn.debit)}</span>:<span className="text-muted-foreground">—</span>}</td>
        <td className="px-3 py-2 text-xs text-right">{txn.credit?<span className="text-green-600 font-medium">{fmtAED(txn.credit)}</span>:<span className="text-muted-foreground">—</span>}</td>
        <td className="px-3 py-2 text-xs">{txn.counterparty||"—"}</td>
        <td className="px-3 py-2 text-xs">{txn.notes||""}</td>
        <td className="px-3 py-2">
          <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium whitespace-nowrap">
            <CheckCircle className="h-3.5 w-3.5"/>Done
          </span>
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr className={`border-b ${isDebit?"bg-red-50/20 dark:bg-red-900/5":"bg-green-50/20 dark:bg-green-900/5"}`}>
        {/* Date */}
        <td className="px-3 py-2 text-xs whitespace-nowrap align-top">{fmtDate(txn.txn_date)}</td>

        {/* Description — fully visible, wraps */}
        <td className="px-3 py-2 text-xs leading-relaxed align-top" style={{maxWidth:"320px",wordBreak:"break-word",whiteSpace:"normal"}}>
          {txn.description}
          {txn.reference&&txn.reference!=="- -"&&<span className="block text-muted-foreground text-[10px] mt-0.5">Ref: {txn.reference}</span>}
        </td>

        {/* Amount */}
        <td className="px-3 py-2 text-xs text-right align-top whitespace-nowrap">
          {txn.debit?<span className="text-red-600 font-medium">{fmtAED(txn.debit)}</span>:<span className="text-muted-foreground">—</span>}
        </td>
        <td className="px-3 py-2 text-xs text-right align-top whitespace-nowrap">
          {txn.credit?<span className="text-green-600 font-medium">{fmtAED(txn.credit)}</span>:<span className="text-muted-foreground">—</span>}
        </td>

        {/* Inline counterparty + reconcile */}
        <td className="px-3 py-2 align-top" colSpan={2}>
          <div className="flex items-center gap-1.5">
            <div className="flex-1 relative">
              <Input
                className="h-7 text-xs pr-1"
                placeholder={isDebit?"Who did you pay?":"Who paid you?"}
                value={counterparty}
                onChange={e=>setCounterparty(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter") reconcile(); }}
              />
              {matchedRule && (
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-primary font-medium truncate max-w-[60px]">
                  {CATEGORIES.find(c=>c.value===matchedRule.category)?.label||matchedRule.category}
                </span>
              )}
            </div>
            <Button size="sm" className="h-7 text-xs px-2 whitespace-nowrap" onClick={()=>reconcile()} disabled={saving}>
              {saving?<Loader2 className="h-3 w-3 animate-spin"/>:<><CheckCircle className="h-3 w-3 mr-1"/>Done</>}
            </Button>
          </div>
          {matchedRule && (
            <p className="text-[10px] text-muted-foreground mt-0.5 ml-0.5">
              → {matchedRule.account_code} {matchedRule.account_name}
            </p>
          )}
        </td>

        <td className="px-2 py-2 align-top">
          <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isDebit?"bg-red-100 text-red-700 dark:bg-red-900/30":"bg-green-100 text-green-700 dark:bg-green-900/30"}`}>
            {isDebit?<ArrowUpCircle className="h-2.5 w-2.5"/>:<ArrowDownCircle className="h-2.5 w-2.5"/>}
            {isDebit?"Out":"In"}
          </span>
        </td>
      </tr>

      {showNewParty && (
        <NewCounterpartyDialog
          name={counterparty}
          onSaved={handleNewPartySaved}
          onClose={()=>setShowNewParty(false)}
        />
      )}
    </>
  );
}

// ---- Main Page --------------------------------------------------------------
export default function Bank() {
  const stmts    = useList("bank_statements");
  const txns     = useList("bank_transactions");
  const projects = useList("projects");
  const { data: rules = [] } = useQuery<any[]>({ queryKey: ["/api/counterparty_rules"] });

  const [uploadOpen, setUploadOpen] = useState(false);
  const [filterStmt, setFilterStmt] = useState<string>("all");

  const filteredTxns = (txns.data||[]).filter((t:any)=>filterStmt==="all"||t.statement_id===filterStmt);
  const pending    = filteredTxns.filter((t:any)=>!t.is_reconciled).length;
  const reconciled = filteredTxns.filter((t:any)=> t.is_reconciled).length;

  return (
    <div>
      <PageHeader
        title="Bank Reconciliation"
        subtitle="Upload your bank statement — reconcile each transaction in one line, no popups"
        actions={<Button onClick={()=>setUploadOpen(true)}><Upload className="h-4 w-4 mr-2"/>Upload Statement</Button>}
      />

      <Tabs defaultValue="txns">
        <TabsList><TabsTrigger value="txns">Transactions</TabsTrigger><TabsTrigger value="statements">Statements</TabsTrigger></TabsList>

        <TabsContent value="txns">
          <div className="flex items-center gap-4 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-xs shrink-0">Statement:</Label>
              <Select value={filterStmt} onValueChange={setFilterStmt}>
                <SelectTrigger className="h-8 text-xs w-52"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statements</SelectItem>
                  {(stmts.data||[]).map((s:any)=><SelectItem key={s.id} value={s.id}>{s.bank_name} — {fmtDate(s.statement_date)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {filteredTxns.length>0&&(
              <div className="flex gap-3 ml-auto text-xs text-muted-foreground">
                <span><strong className="text-amber-600">{pending}</strong> pending</span>
                <span><strong className="text-green-600">{reconciled}</strong> reconciled</span>
              </div>
            )}
          </div>

          {filteredTxns.length===0&&!txns.isLoading ? (
            <div className="text-center py-16 border-2 border-dashed rounded-xl">
              <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3"/>
              <p className="font-medium mb-1">No transactions yet</p>
              <p className="text-sm text-muted-foreground mb-4">Upload a bank statement CSV — each transaction will appear here</p>
              <Button onClick={()=>setUploadOpen(true)}><Upload className="h-4 w-4 mr-2"/>Upload Statement</Button>
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
                    <th className="px-2 py-2 text-xs font-semibold">Dir.</th>
                  </tr>
                </thead>
                <tbody>
                  {txns.isLoading
                    ? <tr><td colSpan={7} className="text-center py-8 text-sm text-muted-foreground">Loading…</td></tr>
                    : filteredTxns.map((t:any)=><TxnRow key={t.id} txn={t} rules={rules}/>)
                  }
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="statements">
          <div className="flex justify-end mb-3">
            <Button onClick={()=>setUploadOpen(true)}><Upload className="h-4 w-4 mr-2"/>Upload Statement</Button>
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
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {(stmts.data||[]).map((s:any)=>{
                  const total=(txns.data||[]).filter((t:any)=>t.statement_id===s.id).length;
                  const done=(txns.data||[]).filter((t:any)=>t.statement_id===s.id&&t.is_reconciled).length;
                  return (
                    <tr key={s.id} className="border-b">
                      <td className="px-3 py-2 text-sm font-medium">{s.bank_name}</td>
                      <td className="px-3 py-2 text-xs">{s.account_number||"—"}</td>
                      <td className="px-3 py-2 text-xs">{fmtDate(s.statement_date)}</td>
                      <td className="px-3 py-2 text-xs">{done}/{total} reconciled</td>
                      <td className="px-3 py-2"><StatusBadge status={s.status}/></td>
                      <td className="px-3 py-2"><Button size="sm" variant="ghost" className="text-xs h-7" onClick={()=>setFilterStmt(s.id)}>View Transactions</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <UploadStatementDialog open={uploadOpen} onClose={()=>setUploadOpen(false)} onImported={id=>setFilterStmt(id)}/>
    </div>
  );
}
