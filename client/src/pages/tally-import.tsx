/**
 * Tally Import — two modes:
 * 1. CSV: export invoice list from Tally → upload here → preview → confirm → creates invoices + clients
 * 2. PDF: upload multiple Tally invoice PDFs → server extracts text → parse → review cards → confirm
 */
import { useState, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getAuthToken } from "@/lib/queryClient";
import {
  Upload, FileText, CheckCircle2, AlertCircle, Loader2,
  FileSpreadsheet, ChevronRight, RotateCcw, Download
} from "lucide-react";

// ---- Types ------------------------------------------------------------------
interface ParsedInvoice {
  invoice_number: string;
  invoice_date: string;
  client_name: string;
  amount: number;
  vat_amount: number;
  total_amount: number;
  status: "draft";
  notes?: string;
  _rowIndex?: number;
  _error?: string;
  _selected?: boolean;
}

// ---- Helper: format AED amounts --------------------------------------------
function fmtAed(n: number) {
  return `AED ${(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ============================================================================
// CSV IMPORT TAB
// ============================================================================
const CSV_COLUMNS = [
  { key: "invoice_number", label: "Invoice Number", required: true },
  { key: "invoice_date", label: "Invoice Date", required: true },
  { key: "client_name", label: "Client Name", required: true },
  { key: "amount", label: "Amount (excl. VAT)", required: true },
  { key: "vat_amount", label: "VAT Amount" },
  { key: "total_amount", label: "Total Amount" },
  { key: "notes", label: "Notes / Description" },
];

function CsvImportTab() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [parsed, setParsed] = useState<ParsedInvoice[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  // -- Step 1: Parse CSV file locally ----------------------------------------
  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) throw new Error("File must have at least a header row and one data row");

        // Detect delimiter: comma or semicolon (Tally sometimes uses semicolon)
        const delim = lines[0].includes(";") ? ";" : ",";
        const parseRow = (line: string) => {
          const cols: string[] = [];
          let cur = "";
          let inQuote = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') { inQuote = !inQuote; continue; }
            if (ch === delim && !inQuote) { cols.push(cur.trim()); cur = ""; continue; }
            cur += ch;
          }
          cols.push(cur.trim());
          return cols;
        };

        const hdrs = parseRow(lines[0]);
        const rows = lines.slice(1).map(parseRow);
        setHeaders(hdrs);
        setRawRows(rows);

        // Auto-map columns by name similarity
        const autoMap: Record<string, string> = {};
        for (const col of CSV_COLUMNS) {
          const match = hdrs.find((h) => {
            const hl = h.toLowerCase().replace(/[\s_-]/g, "");
            const kl = col.key.toLowerCase().replace(/[\s_-]/g, "");
            const ll = col.label.toLowerCase().replace(/[\s_-]/g, "");
            return hl.includes(kl) || hl.includes(ll) || kl.includes(hl) || ll.includes(hl);
          });
          if (match) autoMap[col.key] = match;
        }
        setMapping(autoMap);
        setStep("map");
      } catch (err: any) {
        toast({ title: "Could not read file", description: err.message, variant: "destructive" });
      }
    };
    reader.readAsText(file);
  }

  // -- Step 2: Apply mapping and build preview --------------------------------
  function applyMapping() {
    const required = CSV_COLUMNS.filter((c) => c.required).map((c) => c.key);
    const missing = required.filter((k) => !mapping[k]);
    if (missing.length) {
      toast({ title: "Missing required columns", description: missing.join(", "), variant: "destructive" });
      return;
    }

    const rows: ParsedInvoice[] = rawRows.map((row, i) => {
      const get = (key: string) => {
        const hdr = mapping[key];
        if (!hdr) return "";
        const idx = headers.indexOf(hdr);
        return idx >= 0 ? (row[idx] || "").trim() : "";
      };

      const amountStr = get("amount").replace(/[,\s]/g, "");
      const vatStr = get("vat_amount").replace(/[,\s]/g, "");
      const totalStr = get("total_amount").replace(/[,\s]/g, "");

      const amount = parseFloat(amountStr) || 0;
      const vatAmount = parseFloat(vatStr) || Math.round(amount * 0.05 * 100) / 100;
      const totalAmount = parseFloat(totalStr) || Math.round((amount + vatAmount) * 100) / 100;

      // Parse date — handle DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY
      let invoice_date = get("invoice_date");
      const dmy = invoice_date.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (dmy) {
        const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
        invoice_date = `${year}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
      }

      const inv: ParsedInvoice = {
        invoice_number: get("invoice_number"),
        invoice_date,
        client_name: get("client_name"),
        amount,
        vat_amount: vatAmount,
        total_amount: totalAmount,
        status: "draft",
        notes: get("notes") || undefined,
        _rowIndex: i,
        _selected: true,
      };

      if (!inv.invoice_number) inv._error = "Missing invoice number";
      else if (!inv.client_name) inv._error = "Missing client name";

      return inv;
    }).filter((r) => r.client_name || r.invoice_number); // skip blank rows

    setParsed(rows);
    setSelected(new Set(rows.filter((r) => !r._error).map((_, i) => i)));
    setStep("preview");
  }

  // -- Step 3: Import confirmed rows -----------------------------------------
  async function doImport() {
    const toImport = parsed.filter((_, i) => selected.has(i));
    if (!toImport.length) { toast({ title: "Nothing selected" }); return; }

    setImporting(true);
    try {
      const res = await apiRequest("POST", "/api/tally/import", { invoices: toImport });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Import failed");
      setResult({ created: data.created, skipped: data.skipped });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setStep("done");
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setStep("upload");
    setHeaders([]);
    setRawRows([]);
    setMapping({});
    setParsed([]);
    setSelected(new Set());
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  // ---- Render ---------------------------------------------------------------
  if (step === "done" && result) return (
    <div className="flex flex-col items-center gap-6 py-12">
      <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
        <CheckCircle2 className="h-12 w-12 text-green-600" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-1">Import Complete</h3>
        <p className="text-muted-foreground">{result.created} invoice{result.created !== 1 ? "s" : ""} created successfully.</p>
        {result.skipped > 0 && <p className="text-sm text-muted-foreground mt-1">{result.skipped} skipped (already exist or errors).</p>}
      </div>
      <Button onClick={reset} variant="outline"><RotateCcw className="h-4 w-4 mr-2" /> Import Another File</Button>
    </div>
  );

  if (step === "upload") return (
    <div className="max-w-xl mx-auto py-8">
      <div
        className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      >
        <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="font-medium mb-1">Drop your Tally CSV export here</p>
        <p className="text-sm text-muted-foreground mb-4">or click to browse — supports .csv and .txt files</p>
        <Button type="button" variant="outline" size="sm"><Upload className="h-4 w-4 mr-2" /> Browse File</Button>
      </div>
      <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

      <div className="mt-6 p-4 bg-muted/40 rounded-lg text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-2">How to export from Tally:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Open Tally → Gateway of Tally → Display → Account Books → Sales Register</li>
          <li>Press <kbd className="bg-background border rounded px-1 text-xs">Alt+E</kbd> to export</li>
          <li>Choose <strong>Excel / CSV</strong> format and save</li>
          <li>Upload that file here</li>
        </ol>
        <p className="mt-2">Columns needed: <strong>Invoice No., Date, Party Name, Amount, VAT</strong> (any order, any column name — you will map them next).</p>
      </div>
    </div>
  );

  if (step === "map") return (
    <div className="max-w-2xl mx-auto py-6 space-y-6">
      <div>
        <h3 className="font-semibold mb-1">Match your columns</h3>
        <p className="text-sm text-muted-foreground">Your file has {headers.length} columns and {rawRows.length} data rows. Tell us which column is which.</p>
      </div>

      <div className="space-y-3">
        {CSV_COLUMNS.map((col) => (
          <div key={col.key} className="flex items-center gap-3">
            <Label className="w-44 shrink-0 text-sm">
              {col.label}{col.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Select value={mapping[col.key] || ""} onValueChange={(v) => setMapping((m) => ({ ...m, [col.key]: v }))}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="— skip —" />
              </SelectTrigger>
              <SelectContent>
                {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Button onClick={applyMapping}><ChevronRight className="h-4 w-4 mr-1" /> Preview Data</Button>
        <Button variant="outline" onClick={reset}>Back</Button>
      </div>
    </div>
  );

  // step === "preview"
  const errorCount = parsed.filter((_, i) => !selected.has(i) || parsed[i]._error).length;
  const validSelected = parsed.filter((_, i) => selected.has(i) && !parsed[i]._error).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{parsed.length} rows found</h3>
          <p className="text-sm text-muted-foreground">{validSelected} selected for import. Uncheck any you want to skip.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={reset}><RotateCcw className="h-4 w-4 mr-1" /> Start Over</Button>
          <Button onClick={doImport} disabled={importing || validSelected === 0} data-testid="button-import-csv">
            {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing…</> : <><Upload className="h-4 w-4 mr-1" /> Import {validSelected} Invoice{validSelected !== 1 ? "s" : ""}</>}
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-auto max-h-[55vh]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <input type="checkbox" checked={validSelected === parsed.filter((r) => !r._error).length}
                  onChange={(e) => {
                    if (e.target.checked) setSelected(new Set(parsed.map((_, i) => i).filter((i) => !parsed[i]._error)));
                    else setSelected(new Set());
                  }} />
              </TableHead>
              <TableHead>Invoice No.</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">VAT</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parsed.map((row, i) => (
              <TableRow key={i} className={row._error ? "opacity-50" : ""}>
                <TableCell>
                  <input type="checkbox" checked={selected.has(i)} disabled={!!row._error}
                    onChange={(e) => {
                      const s = new Set(selected);
                      if (e.target.checked) s.add(i); else s.delete(i);
                      setSelected(s);
                    }} />
                </TableCell>
                <TableCell className="font-mono text-xs">{row.invoice_number || <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-sm">{row.invoice_date}</TableCell>
                <TableCell className="text-sm">{row.client_name}</TableCell>
                <TableCell className="text-right text-sm">{fmtAed(row.amount)}</TableCell>
                <TableCell className="text-right text-sm">{fmtAed(row.vat_amount)}</TableCell>
                <TableCell className="text-right text-sm font-medium">{fmtAed(row.total_amount)}</TableCell>
                <TableCell>
                  {row._error
                    ? <Badge variant="destructive" className="text-xs"><AlertCircle className="h-3 w-3 mr-1" />{row._error}</Badge>
                    : <Badge variant="outline" className="text-xs text-green-700 border-green-300">Ready</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ============================================================================
// PDF IMPORT TAB
// ============================================================================
interface PdfFileState {
  file: File;
  status: "pending" | "parsing" | "parsed" | "error";
  parsed?: ParsedInvoice;
  error?: string;
  selected?: boolean;
}

function PdfImportTab() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<PdfFileState[]>([]);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  function addFiles(newFiles: FileList) {
    const arr = Array.from(newFiles).filter((f) => f.type === "application/pdf" || f.name.endsWith(".pdf"));
    if (!arr.length) { toast({ title: "Please select PDF files only", variant: "destructive" }); return; }
    setFiles((prev) => [...prev, ...arr.map((f) => ({ file: f, status: "pending" as const, selected: true }))]);
    setResult(null);
  }

  async function parseAll() {
    const pending = files.filter((f) => f.status === "pending" || f.status === "error");
    if (!pending.length) return;

    setParsing(true);
    setProgress(0);

    for (let i = 0; i < pending.length; i++) {
      const idx = files.findIndex((f) => f.file === pending[i].file);
      // Set status to parsing
      setFiles((prev) => prev.map((f, fi) => fi === idx ? { ...f, status: "parsing" } : f));

      try {
        const formData = new FormData();
        formData.append("pdf", pending[i].file);

        const token = getAuthToken();
        // Replicate the API_BASE logic from queryClient — resolves __PORT_5000__ at deploy time
        const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";
        const res = await fetch(`${API_BASE}/api/tally/parse-pdf`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.message || "Parse failed");

        setFiles((prev) => prev.map((f, fi) => fi === idx ? { ...f, status: "parsed", parsed: data, selected: true } : f));
      } catch (err: any) {
        setFiles((prev) => prev.map((f, fi) => fi === idx ? { ...f, status: "error", error: err.message } : f));
      }

      setProgress(Math.round(((i + 1) / pending.length) * 100));
    }

    setParsing(false);
  }

  async function doImport() {
    const toImport = files.filter((f) => f.status === "parsed" && f.selected && f.parsed).map((f) => f.parsed!);
    if (!toImport.length) { toast({ title: "Nothing to import" }); return; }

    setImporting(true);
    try {
      const res = await apiRequest("POST", "/api/tally/import", { invoices: toImport });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Import failed");
      setResult({ created: data.created, skipped: data.skipped });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  function toggleFile(idx: number) {
    setFiles((prev) => prev.map((f, i) => i === idx ? { ...f, selected: !f.selected } : f));
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  const readyCount = files.filter((f) => f.status === "parsed" && f.selected).length;
  const parsedCount = files.filter((f) => f.status === "parsed").length;

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
      >
        <FileText className="h-9 w-9 mx-auto text-muted-foreground mb-3" />
        <p className="font-medium mb-1">Drop Tally invoice PDFs here</p>
        <p className="text-sm text-muted-foreground mb-3">You can drop multiple files at once</p>
        <Button type="button" variant="outline" size="sm"><Upload className="h-4 w-4 mr-2" /> Browse PDFs</Button>
      </div>
      <input ref={fileRef} type="file" accept="application/pdf,.pdf" multiple className="hidden"
        onChange={(e) => { if (e.target.files) addFiles(e.target.files); }} />

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{files.length} PDF{files.length !== 1 ? "s" : ""} added</p>
            <div className="flex gap-2">
              {files.some((f) => f.status === "pending" || f.status === "error") && (
                <Button onClick={parseAll} disabled={parsing} size="sm">
                  {parsing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Reading PDFs…</> : "Extract Invoice Data"}
                </Button>
              )}
              {parsedCount > 0 && (
                <Button onClick={doImport} disabled={importing || readyCount === 0} size="sm" data-testid="button-import-pdf">
                  {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing…</> : <><Upload className="h-4 w-4 mr-1" /> Import {readyCount} Selected</>}
                </Button>
              )}
            </div>
          </div>

          {parsing && (
            <div className="space-y-1">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground">Reading {progress}% done…</p>
            </div>
          )}

          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {files.map((f, i) => (
              <div key={i} className={`border rounded-lg p-3 flex gap-3 items-start ${f.status === "error" ? "border-destructive/40 bg-destructive/5" : f.status === "parsed" ? "border-green-300/50 bg-green-50/30 dark:bg-green-900/10" : ""}`}>
                {f.status === "parsed" && (
                  <input type="checkbox" className="mt-1" checked={f.selected} onChange={() => toggleFile(i)} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm font-medium truncate">{f.file.name}</span>
                    <span className="text-xs text-muted-foreground">({(f.file.size / 1024).toFixed(0)} KB)</span>
                    {f.status === "parsing" && <Loader2 className="h-3 w-3 animate-spin text-primary ml-auto" />}
                    {f.status === "parsed" && <CheckCircle2 className="h-4 w-4 text-green-600 ml-auto" />}
                    {f.status === "error" && <AlertCircle className="h-4 w-4 text-destructive ml-auto" />}
                  </div>

                  {f.status === "parsed" && f.parsed && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-1 ml-6">
                      <span>Invoice: <strong className="text-foreground">{f.parsed.invoice_number || "—"}</strong></span>
                      <span>Date: <strong className="text-foreground">{f.parsed.invoice_date || "—"}</strong></span>
                      <span>Client: <strong className="text-foreground">{f.parsed.client_name || "—"}</strong></span>
                      <span>Total: <strong className="text-foreground">{fmtAed(f.parsed.total_amount)}</strong></span>
                    </div>
                  )}

                  {f.status === "error" && (
                    <p className="text-xs text-destructive ml-6 mt-0.5">{f.error}</p>
                  )}
                </div>

                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeFile(i)}>
                  <span className="text-muted-foreground text-xs">✕</span>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <div>
            <p className="font-medium text-green-800 dark:text-green-200">{result.created} invoice{result.created !== 1 ? "s" : ""} imported successfully</p>
            {result.skipped > 0 && <p className="text-sm text-green-700 dark:text-green-300">{result.skipped} skipped (duplicates or errors)</p>}
          </div>
        </div>
      )}

      {files.length === 0 && (
        <div className="p-4 bg-muted/40 rounded-lg text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-2">How to print PDFs from Tally:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Open Tally → Display → Account Books → Sales Register</li>
            <li>Open each invoice and press <kbd className="bg-background border rounded px-1 text-xs">Alt+P</kbd> (Print)</li>
            <li>Select <strong>PDF</strong> as the printer and save</li>
            <li>Upload all PDFs here — we will read the details automatically</li>
          </ol>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================
export default function TallyImport() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold">Tally Import</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bring your 2026 Tally invoices into NXS ERP. New clients are created automatically — you can update missing details from the Clients page later.
        </p>
      </div>

      <Tabs defaultValue="csv">
        <TabsList className="mb-6">
          <TabsTrigger value="csv" data-testid="tab-csv">
            <FileSpreadsheet className="h-4 w-4 mr-2" /> CSV / Excel List
          </TabsTrigger>
          <TabsTrigger value="pdf" data-testid="tab-pdf">
            <FileText className="h-4 w-4 mr-2" /> Bulk PDF Upload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="csv">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Import from Tally Invoice List (CSV)</CardTitle>
            </CardHeader>
            <CardContent>
              <CsvImportTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pdf">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Import from Tally Invoice PDFs</CardTitle>
            </CardHeader>
            <CardContent>
              <PdfImportTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
