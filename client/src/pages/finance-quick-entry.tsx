/**
 * Finance Quick Entry — three tabs only:
 *   1. Sales Invoice
 *   2. Purchase Invoice
 *   3. Expense / Journal Entry  (DR / CR against any Chart-of-Accounts row;
 *      posts to journal_entries with status = "posted".)
 *
 * The old Petty Cash & Provisional flows have been folded into tab 3 — they
 * are simply special-case journal entries that anyone can now compose with
 * arbitrary debit/credit lines.
 */

import { useMemo, useState } from "react";
import { PageHeader, useList } from "@/components/common";
import { LineItemsEditor } from "@/components/crud-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Receipt, ShoppingCart, BookOpen, Loader2, Plus, Trash2 } from "lucide-react";
import { fmtAED, nextNumber, computeTotals, todayLocal } from "@/lib/nxs";

// ── Inline Project Picker ────────────────────────────────────────────────────
function ProjectPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const projects = useList("projects");
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const addProject = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/projects", { name: newName, status: "active", start_date: todayLocal() })).json(),
    onSuccess: (p: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      onChange(p.id); setAdding(false); setNewName("");
      toast({ title: "Project added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (adding) {
    return (
      <div className="flex gap-1">
        <Input placeholder="Project name" value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
        <Button size="sm" onClick={() => addProject.mutate()} disabled={!newName || addProject.isPending}>
          {addProject.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
      </div>
    );
  }

  return (
    <div className="flex gap-1">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Select project…" /></SelectTrigger>
        <SelectContent>
          {(projects.data || []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button type="button" size="sm" variant="outline" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /></Button>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function FinanceQuickEntry() {
  const [tab, setTab] = useState<"sales" | "purchase" | "je">("sales");

  return (
    <div>
      <PageHeader
        title="Quick Entry"
        subtitle="Three tabs — Sales Invoice, Purchase Invoice, Expense / Journal Entry. All entries save as Posted."
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mt-2">
        <TabsList className="grid grid-cols-3 max-w-xl">
          <TabsTrigger value="sales"><Receipt className="h-4 w-4 mr-1" /> Sales Invoice</TabsTrigger>
          <TabsTrigger value="purchase"><ShoppingCart className="h-4 w-4 mr-1" /> Purchase Invoice</TabsTrigger>
          <TabsTrigger value="je"><BookOpen className="h-4 w-4 mr-1" /> Expense / Journal</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="mt-5"><SalesInvoiceForm /></TabsContent>
        <TabsContent value="purchase" className="mt-5"><PurchaseInvoiceForm /></TabsContent>
        <TabsContent value="je" className="mt-5"><ExpenseJournalForm /></TabsContent>
      </Tabs>
    </div>
  );
}

// ── Sales Invoice ────────────────────────────────────────────────────────────
function SalesInvoiceForm() {
  const clients = useList("clients");
  const { toast } = useToast();
  const today = todayLocal();

  const [form, setForm] = useState({
    invoice_number: nextNumber("NXS-INV"),
    invoice_type: "standard",
    client_id: "",
    project_id: "",
    invoice_date: today,
    due_date: plusDays(30),
    status: "posted",
    subject: "",
    notes: "",
    items: [] as any[],
  });

  const save = useMutation({
    mutationFn: async (values: any) => (await apiRequest("POST", "/api/invoices", values)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Sales invoice saved as Posted", description: form.invoice_number });
      setForm(f => ({ ...f, invoice_number: nextNumber("NXS-INV"), subject: "", notes: "", items: [] }));
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.client_id) return toast({ title: "Please select a client", variant: "destructive" });
    const t = computeTotals(form.items);
    save.mutate({ ...form, subtotal: t.subtotal, vat_amount: t.vat, total_amount: t.total });
  }

  const totals = computeTotals(form.items);

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-4xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Invoice No.</Label>
          <Input value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} required />
        </div>
        <div>
          <Label>Type</Label>
          <Select value={form.invoice_type} onValueChange={v => setForm(f => ({ ...f, invoice_type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["standard", "advance", "progressive", "final"].map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Client *</Label>
          <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
            <SelectTrigger><SelectValue placeholder="Select client…" /></SelectTrigger>
            <SelectContent>
              {(clients.data || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Project</Label>
          <ProjectPicker value={form.project_id} onChange={v => setForm(f => ({ ...f, project_id: v }))} />
        </div>
        <div>
          <Label>Invoice Date</Label>
          <Input type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} />
        </div>
        <div>
          <Label>Due Date</Label>
          <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
        </div>
        <div className="sm:col-span-2">
          <Label>Subject / Description of Work</Label>
          <Input placeholder="e.g. Civil works — Al Quoz Tower Phase 2" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
        </div>
        <div className="sm:col-span-2">
          <Label>Notes</Label>
          <Textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
      </div>
      <div>
        <Label className="mb-2 block font-semibold">Line Items</Label>
        <LineItemsEditor items={form.items} onChange={items => setForm(f => ({ ...f, items }))} />
      </div>
      {form.items.length > 0 && (
        <div className="rounded-lg border p-4 bg-muted/30 text-sm space-y-1 max-w-xs ml-auto">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmtAED(totals.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">VAT (5%)</span><span>{fmtAED(totals.vat)}</span></div>
          <div className="flex justify-between font-bold text-primary border-t pt-1"><span>Total</span><span>{fmtAED(totals.total)}</span></div>
        </div>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          Save Sales Invoice (Posted)
        </Button>
      </div>
    </form>
  );
}

// ── Purchase Invoice ─────────────────────────────────────────────────────────
function PurchaseInvoiceForm() {
  const vendors = useList("vendors");
  const { toast } = useToast();
  const today = todayLocal();

  const [form, setForm] = useState({
    invoice_number: nextNumber("NXS-PINV"),
    vendor_id: "",
    project_id: "",
    invoice_date: today,
    due_date: plusDays(30),
    notes: "",
    items: [] as any[],
  });

  const save = useMutation({
    mutationFn: async () => {
      const t = computeTotals(form.items);
      return (await apiRequest("POST", "/api/invoices", {
        ...form,
        invoice_type: "purchase",
        client_id: null,
        subtotal: t.subtotal,
        vat_amount: t.vat,
        total_amount: t.total,
        status: "posted",
      })).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Purchase invoice saved as Posted", description: form.invoice_number });
      setForm(f => ({ ...f, invoice_number: nextNumber("NXS-PINV"), notes: "", items: [] }));
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vendor_id) return toast({ title: "Please select a vendor", variant: "destructive" });
    save.mutate();
  }

  const totals = computeTotals(form.items);

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-4xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Reference No.</Label>
          <Input value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} />
        </div>
        <div>
          <Label>Vendor *</Label>
          <Select value={form.vendor_id} onValueChange={v => setForm(f => ({ ...f, vendor_id: v }))}>
            <SelectTrigger><SelectValue placeholder="Select vendor…" /></SelectTrigger>
            <SelectContent>
              {(vendors.data || []).map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Invoice Date</Label>
          <Input type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} />
        </div>
        <div>
          <Label>Due Date</Label>
          <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
        </div>
        <div className="sm:col-span-2">
          <Label>Project</Label>
          <ProjectPicker value={form.project_id} onChange={v => setForm(f => ({ ...f, project_id: v }))} />
        </div>
        <div className="sm:col-span-2">
          <Label>Notes</Label>
          <Textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
      </div>
      <div>
        <Label className="mb-2 block font-semibold">Line Items</Label>
        <LineItemsEditor items={form.items} onChange={items => setForm(f => ({ ...f, items }))} />
      </div>
      {form.items.length > 0 && (
        <div className="rounded-lg border p-4 bg-muted/30 text-sm space-y-1 max-w-xs ml-auto">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmtAED(totals.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">VAT (5%)</span><span>{fmtAED(totals.vat)}</span></div>
          <div className="flex justify-between font-bold text-primary border-t pt-1"><span>Total</span><span>{fmtAED(totals.total)}</span></div>
        </div>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          Save Purchase Invoice (Posted)
        </Button>
      </div>
    </form>
  );
}

// ── Expense / Journal Entry (DR / CR, any account) ───────────────────────────
type Line = { account_id: string; account_code: string; account_name: string; description: string; debit: number; credit: number };

function ExpenseJournalForm() {
  const { data: accounts = [] } = useQuery<any[]>({ queryKey: ["/api/accounts"] });
  const { toast } = useToast();
  const today = todayLocal();

  const [form, setForm] = useState({
    entry_number: nextNumber("NXS-JV"),
    entry_date: today,
    reference: "",
    project_id: "",
    description: "",
  });
  const [lines, setLines] = useState<Line[]>([
    { account_id: "", account_code: "", account_name: "", description: "", debit: 0, credit: 0 },
    { account_id: "", account_code: "", account_name: "", description: "", debit: 0, credit: 0 },
  ]);

  const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const isBalanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.005;

  function updateLine(i: number, patch: Partial<Line>) {
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }
  function addLine() { setLines(ls => [...ls, { account_id: "", account_code: "", account_name: "", description: "", debit: 0, credit: 0 }]); }
  function removeLine(i: number) { setLines(ls => ls.filter((_, idx) => idx !== i)); }

  function pickAccount(i: number, acctId: string) {
    const a = (accounts as any[]).find(x => x.id === acctId);
    updateLine(i, {
      account_id: acctId,
      account_code: a?.account_code || "",
      account_name: a?.name || "",
    });
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!isBalanced) throw new Error("Debit total must equal credit total (and be > 0).");
      const linesClean = lines
        .filter(l => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0))
        .map(l => ({
          account_code: l.account_code, account_name: l.account_name,
          description: l.description || form.description,
          debit: Number(l.debit || 0), credit: Number(l.credit || 0),
        }));
      if (linesClean.length < 2) throw new Error("At least two lines required (one debit and one credit).");

      const entry = {
        entry_number: form.entry_number,
        entry_date: form.entry_date,
        reference: form.reference,
        description: form.description,
        project_id: form.project_id || null,
        status: "posted",
        total_debit: totalDebit,
        lines: JSON.stringify(linesClean),
      };
      return (await apiRequest("POST", "/api/journal_entries", entry)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal_entries"] });
      toast({ title: "Journal entry posted", description: form.entry_number });
      // reset
      setForm(f => ({ ...f, entry_number: nextNumber("NXS-JV"), reference: "", description: "" }));
      setLines([
        { account_id: "", account_code: "", account_name: "", description: "", debit: 0, credit: 0 },
        { account_id: "", account_code: "", account_name: "", description: "", debit: 0, credit: 0 },
      ]);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const sortedAccounts = useMemo(
    () => [...(accounts as any[])].sort((a, b) => (a.account_code || "").localeCompare(b.account_code || "")),
    [accounts],
  );

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <Label>Entry No.</Label>
          <Input value={form.entry_number} onChange={e => setForm(f => ({ ...f, entry_number: e.target.value }))} />
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={form.entry_date} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} />
        </div>
        <div>
          <Label>Reference</Label>
          <Input placeholder="Optional receipt / doc #" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
        </div>
        <div>
          <Label>Project</Label>
          <ProjectPicker value={form.project_id} onChange={v => setForm(f => ({ ...f, project_id: v }))} />
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <Label>Description</Label>
          <Input placeholder="What was this entry for?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="font-semibold">Journal Lines (any account, any DR / CR)</Label>
          <Button type="button" size="sm" variant="outline" onClick={addLine}><Plus className="h-4 w-4 mr-1" /> Add Line</Button>
        </div>
        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2">Account</th>
                <th className="text-left p-2">Line Description</th>
                <th className="text-right p-2 w-32">Debit (AED)</th>
                <th className="text-right p-2 w-32">Credit (AED)</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">
                    <Select value={l.account_id} onValueChange={(v) => pickAccount(i, v)}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Choose account…" /></SelectTrigger>
                      <SelectContent className="max-h-80">
                        {sortedAccounts.map(a => (
                          <SelectItem key={a.id} value={a.id}>
                            <span className="font-mono text-xs mr-2">{a.account_code}</span>{a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <Input className="h-9" placeholder="—" value={l.description} onChange={e => updateLine(i, { description: e.target.value })} />
                  </td>
                  <td className="p-2">
                    <Input className="h-9 text-right font-mono" type="number" step="0.01" min={0}
                      value={l.debit || ""} onChange={e => updateLine(i, { debit: Number(e.target.value), credit: Number(e.target.value) > 0 ? 0 : l.credit })} />
                  </td>
                  <td className="p-2">
                    <Input className="h-9 text-right font-mono" type="number" step="0.01" min={0}
                      value={l.credit || ""} onChange={e => updateLine(i, { credit: Number(e.target.value), debit: Number(e.target.value) > 0 ? 0 : l.debit })} />
                  </td>
                  <td className="p-2">
                    <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => removeLine(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/50 border-t">
              <tr>
                <td colSpan={2} className="p-2 text-right font-semibold">Totals</td>
                <td className="p-2 text-right font-mono">{fmtAED(totalDebit)}</td>
                <td className="p-2 text-right font-mono">{fmtAED(totalCredit)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className={`text-xs mt-1 ${isBalanced ? "text-emerald-600" : "text-destructive"}`}>
          {isBalanced ? "✓ Balanced — ready to post." : `Debit / Credit differ by ${fmtAED(Math.abs(totalDebit - totalCredit))} — balance the entry to post.`}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          Saves to Journal Entries as <b className="text-foreground">Posted</b>. Also flows into the Daybook and Ledger reports.
        </div>
        <Button onClick={() => save.mutate()} disabled={!isBalanced || save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          Post Journal Entry
        </Button>
      </div>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────
function plusDays(n: number): string {
  const d = new Date(); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
