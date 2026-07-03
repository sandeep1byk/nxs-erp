/**
 * Finance Quick Entry
 * 1. Sales Invoice
 * 2. Purchase Invoice
 * 3. Expense Entry — with Chart of Accounts linkage, project picker, paid-by (Temp Loan / Cash / Bank)
 * 4. Petty Cash Disbursement — transfer to employee temp loan, then clear with expense bills
 * 5. Provisional / Accrual Journals — salary provision, prepaid rent, payable clearance
 */
import { useState, useMemo } from "react";
import { PageHeader, useList } from "@/components/common";
import { LineItemsEditor } from "@/components/crud-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Receipt, ShoppingCart, CreditCard, Plus, Loader2, ChevronRight, ArrowLeft,
  Wallet, BookOpen, Zap, RefreshCw, Sparkles,
} from "lucide-react";
import { fmtAED, nextNumber, computeTotals } from "@/lib/nxs";

type EntryMode = "sales_invoice" | "purchase_expense" | "petty_cash" | "provisional" | null;
type EntryKind = "purchase" | "expense";

// ── Landing ──────────────────────────────────────────────────────────────────
export default function FinanceQuickEntry() {
  const [mode, setMode] = useState<EntryMode>(null);
  const [expenseDefault, setExpenseDefault] = useState<EntryKind>("purchase");

  return (
    <div>
      <PageHeader
        title="Finance Quick Entry"
        subtitle="All financial entries in one place — invoices, expenses, petty cash, provisions"
        actions={
          mode ? (
            <Button variant="outline" onClick={() => setMode(null)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          ) : undefined
        }
      />

      {!mode && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
          <QuickCard
            icon={<Receipt className="h-8 w-8 text-primary" />}
            title="Sales Invoice"
            description="Issue a VAT tax invoice to a client"
            badge="Revenue"
            badgeColor="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
            onClick={() => { setMode("sales_invoice"); }}
          />
          <QuickCard
            icon={<ShoppingCart className="h-8 w-8 text-blue-600" />}
            title="Purchase Invoice"
            description="Record a vendor invoice with line items and project allocation"
            badge="Purchase"
            badgeColor="bg-blue-100 text-blue-800"
            onClick={() => { setExpenseDefault("purchase"); setMode("purchase_expense"); }}
          />
          <QuickCard
            icon={<CreditCard className="h-8 w-8 text-amber-600" />}
            title="Expense Entry"
            description="Record direct expense — fuel, office, site costs — charged to temp loan or bank"
            badge="Expense"
            badgeColor="bg-amber-100 text-amber-800"
            onClick={() => { setExpenseDefault("expense"); setMode("purchase_expense"); }}
          />
          <QuickCard
            icon={<Wallet className="h-8 w-8 text-purple-600" />}
            title="Petty Cash"
            description="Transfer cash to employee (temp loan), then clear bills against their account"
            badge="Petty Cash"
            badgeColor="bg-purple-100 text-purple-800"
            onClick={() => setMode("petty_cash")}
          />
          <QuickCard
            icon={<RefreshCw className="h-8 w-8 text-rose-600" />}
            title="Provisional / Accrual"
            description="Salary provision, prepaid rent amortisation, payable clearance — month-end entries"
            badge="Accrual"
            badgeColor="bg-rose-100 text-rose-800"
            onClick={() => setMode("provisional")}
          />
          <QuickCard
            icon={<BookOpen className="h-8 w-8 text-teal-600" />}
            title="Journal Entry"
            description="Full flexible double-entry journal — any debit/credit combination"
            badge="Journal"
            badgeColor="bg-teal-100 text-teal-800"
            onClick={() => window.location.hash = "/journal"}
          />
        </div>
      )}

      {mode === "sales_invoice"    && <SalesInvoiceForm    onBack={() => setMode(null)} />}
      {mode === "purchase_expense" && <PurchaseExpenseForm onBack={() => setMode(null)} defaultKind={expenseDefault} />}
      {mode === "petty_cash"       && <PettyCashForm       onBack={() => setMode(null)} />}
      {mode === "provisional"      && <ProvisionalForm     onBack={() => setMode(null)} />}
    </div>
  );
}

// ── Quick Card ────────────────────────────────────────────────────────────────
function QuickCard({ icon, title, description, badge, badgeColor, onClick }: any) {
  return (
    <Card className="cursor-pointer hover:border-primary hover:shadow-md transition-all group" onClick={onClick}>
      <CardContent className="p-6 flex flex-col gap-3">
        <div className="flex items-start justify-between">
          {icon}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColor}`}>{badge}</span>
        </div>
        <div>
          <h3 className="font-semibold text-foreground mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>
        <div className="flex items-center text-primary text-sm font-medium gap-1 group-hover:gap-2 transition-all mt-auto">
          Open <ChevronRight className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Inline Project Picker (with + Add button) ────────────────────────────────
function ProjectPicker({ value, onChange, required }: { value: string; onChange: (v: string) => void; required?: boolean }) {
  const projects = useList("projects");
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const addProject = useMutation({
    mutationFn: async (name: string) => (await apiRequest("POST", "/api/projects", {
      name,
      project_number: nextNumber("NXS-PRJ"),
      status: "active",
      start_date: new Date().toISOString().slice(0, 10),
    })).json(),
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      onChange(p.id);
      setAdding(false);
      setNewName("");
      toast({ title: `Project "${p.name}" created` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (adding) {
    return (
      <div className="flex gap-2">
        <Input autoFocus placeholder="New project name…" value={newName} onChange={e => setNewName(e.target.value)} className="h-9 text-sm" />
        <Button size="sm" type="button" disabled={!newName.trim() || addProject.isPending}
          onClick={() => addProject.mutate(newName.trim())}>
          {addProject.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
        </Button>
        <Button size="sm" type="button" variant="ghost" onClick={() => { setAdding(false); setNewName(""); }}>Cancel</Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder={required ? "Select project *" : "Select project (optional)"} />
        </SelectTrigger>
        <SelectContent>
          {!required && <SelectItem value="none">— No project —</SelectItem>}
          {/* General buckets */}
          <SelectItem value="__office__">General Office Expense (Indirect)</SelectItem>
          <SelectItem value="__site_visit__">Site Visit / Preliminary</SelectItem>
          {(projects.data || []).map((p: any) => (
            <SelectItem key={p.id} value={p.id}>{p.project_number} — {p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" type="button" variant="outline" onClick={() => setAdding(true)}>
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ── Expense Category Picker (with Chart of Accounts linkage) ──────────────────
function CategoryPicker({
  value, onChange, onAccountChange,
}: {
  value: string;
  onChange: (catId: string) => void;
  onAccountChange: (code: string, name: string) => void;
}) {
  const { data: cats = [] } = useQuery<any[]>({ queryKey: ["/api/expense_categories"] });
  const { data: accounts = [] } = useQuery<any[]>({ queryKey: ["/api/accounts"] });
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAccount, setNewAccount] = useState("");
  const [newType, setNewType] = useState<"direct" | "indirect">("indirect");

  const expenseAccounts = (accounts as any[]).filter((a: any) => a.type === "expense");

  const addCat = useMutation({
    mutationFn: async () => {
      const acc = expenseAccounts.find((a: any) => a.id === newAccount);
      return (await apiRequest("POST", "/api/expense_categories", {
        name: newName.trim(),
        account_code: acc?.account_code || "6300",
        account_name: acc?.name || "Office & Admin Expenses",
        expense_type: newType,
      })).json();
    },
    onSuccess: (cat) => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense_categories"] });
      onChange(cat.id);
      onAccountChange(cat.account_code, cat.account_name);
      setAdding(false);
      setNewName(""); setNewAccount(""); setNewType("indirect");
      toast({ title: `Category "${cat.name}" created` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Group by parent
  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    (cats as any[]).forEach((c: any) => {
      const g = c.parent_category || "Other";
      if (!groups[g]) groups[g] = [];
      groups[g].push(c);
    });
    return groups;
  }, [cats]);

  if (adding) {
    return (
      <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
        <p className="text-xs font-semibold text-muted-foreground">New Expense Category</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <Label className="text-xs">Category Name *</Label>
            <Input autoFocus placeholder="e.g. Fuel - Ranger" value={newName} onChange={e => setNewName(e.target.value)} className="h-8 text-sm mt-1" />
          </div>
          <div>
            <Label className="text-xs">Chart of Accounts *</Label>
            <Select value={newAccount} onValueChange={setNewAccount}>
              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Pick account…" /></SelectTrigger>
              <SelectContent>
                {expenseAccounts.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>{a.account_code} — {a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={newType} onValueChange={v => setNewType(v as any)}>
              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="direct">Direct (Project Cost)</SelectItem>
                <SelectItem value="indirect">Indirect (Overhead)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" type="button" disabled={!newName.trim() || !newAccount || addCat.isPending} onClick={() => addCat.mutate()}>
            {addCat.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Category"}
          </Button>
          <Button size="sm" type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Select value={value} onValueChange={(v) => {
        const cat = (cats as any[]).find((c: any) => c.id === v);
        if (cat) onAccountChange(cat.account_code || "6300", cat.account_name || "Office & Admin Expenses");
        onChange(v);
      }}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Select expense category…" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/50">{group}</div>
              {items.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2">
                    {c.name}
                    <span className="text-[10px] text-muted-foreground">({c.account_code})</span>
                    {c.expense_type === "direct" && <Badge variant="outline" className="text-[9px] h-4 px-1">Direct</Badge>}
                  </span>
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" type="button" variant="outline" onClick={() => setAdding(true)} title="Add new category">
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ── Sales Invoice Form ────────────────────────────────────────────────────────
function SalesInvoiceForm({ onBack }: { onBack: () => void }) {
  const clients = useList("clients");
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    invoice_number: nextNumber("NXS-INV"),
    invoice_type: "standard",
    client_id: "",
    project_id: "",
    invoice_date: today,
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    status: "draft",
    subject: "",
    notes: "",
    items: [] as any[],
  });

  const save = useMutation({
    mutationFn: async (values: any) => (await apiRequest("POST", "/api/invoices", values)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Sales invoice created", description: `${form.invoice_number} saved as draft.` });
      onBack();
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
    <form onSubmit={handleSubmit} className="space-y-5 mt-4 max-w-4xl">
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
        <Button type="button" variant="outline" onClick={onBack}>Cancel</Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          Save Invoice
        </Button>
      </div>
    </form>
  );
}

// ── Purchase Invoice / Expense Entry ─────────────────────────────────────────
function PurchaseExpenseForm({ onBack, defaultKind }: { onBack: () => void; defaultKind: EntryKind }) {
  const vendors = useList("vendors");
  const employees = useList("employees");
  const { data: accounts = [] } = useQuery<any[]>({ queryKey: ["/api/accounts"] });
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);

  const [kind, setKind] = useState<EntryKind>(defaultKind);

  // Expense form
  const [expForm, setExpForm] = useState({
    category_id: "",
    account_code: "6300",
    account_name: "Office & Admin Expenses",
    amount: "" as string | number,
    date: today,
    project_id: "",
    vendor_id: "",
    description: "",
    reference: "",
    paid_by: "bank",           // bank | temp_loan | cash
    paid_by_employee_id: "",   // if temp_loan
  });

  // Purchase invoice form
  const [pinvForm, setPinvForm] = useState({
    invoice_number: nextNumber("NXS-PINV"),
    vendor_id: "",
    project_id: "",
    invoice_date: today,
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    notes: "",
    items: [] as any[],
  });

  const bankAccounts = (accounts as any[]).filter((a: any) => a.type === "asset" && (a.account_code === "1000" || a.name?.toLowerCase().includes("bank") || a.name?.toLowerCase().includes("cash")));

  const saveExp = useMutation({
    mutationFn: async () => {
      const amt = Number(expForm.amount);
      if (!amt || amt <= 0) throw new Error("Please enter a valid amount");
      if (!expForm.category_id) throw new Error("Please select a category");
      if (!expForm.project_id) throw new Error("Please select a project");

      let creditAccount = { code: "1000", name: "Cash & Bank" };
      if (expForm.paid_by === "temp_loan" && expForm.paid_by_employee_id) {
        const emp = (employees.data || []).find((e: any) => e.id === expForm.paid_by_employee_id);
        creditAccount = { code: "1600", name: `Temp Loan — ${emp?.full_name || "Employee"}` };
      } else if (expForm.paid_by === "cash") {
        creditAccount = { code: "1000", name: "Cash" };
      }

      const entry = {
        entry_date: expForm.date,
        reference: expForm.reference || nextNumber("NXS-EXP"),
        description: expForm.description || expForm.account_name,
        project_id: !["__office__", "__site_visit__", "none"].includes(expForm.project_id) ? expForm.project_id : null,
        status: "posted",
        total_debit: amt,
        lines: JSON.stringify([
          { account_code: expForm.account_code, account_name: expForm.account_name, description: expForm.description, debit: amt, credit: 0 },
          { account_code: creditAccount.code, account_name: creditAccount.name, description: "Payment", debit: 0, credit: amt },
        ]),
      };
      return (await apiRequest("POST", "/api/journal_entries", entry)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal_entries"] });
      toast({ title: "Expense entry posted to journal" });
      onBack();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveInv = useMutation({
    mutationFn: async () => {
      const t = computeTotals(pinvForm.items);
      return (await apiRequest("POST", "/api/invoices", {
        ...pinvForm,
        invoice_type: "purchase",
        client_id: null,
        subtotal: t.subtotal,
        vat_amount: t.vat,
        total_amount: t.total,
        status: "draft",
      })).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Purchase invoice saved as draft" });
      onBack();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const totals = computeTotals(pinvForm.items);

  return (
    <div className="mt-4 space-y-5 max-w-3xl">
      {/* Toggle */}
      <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
        <Button type="button" size="sm" variant={kind === "purchase" ? "default" : "ghost"} onClick={() => setKind("purchase")}>
          <ShoppingCart className="h-4 w-4 mr-1" /> Purchase Invoice
        </Button>
        <Button type="button" size="sm" variant={kind === "expense" ? "default" : "ghost"} onClick={() => setKind("expense")}>
          <CreditCard className="h-4 w-4 mr-1" /> Expense Entry
        </Button>
      </div>

      {/* Purchase Invoice */}
      {kind === "purchase" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Reference No.</Label>
              <Input value={pinvForm.invoice_number} onChange={e => setPinvForm(f => ({ ...f, invoice_number: e.target.value }))} />
            </div>
            <div>
              <Label>Invoice Date</Label>
              <Input type="date" value={pinvForm.invoice_date} onChange={e => setPinvForm(f => ({ ...f, invoice_date: e.target.value }))} />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={pinvForm.due_date} onChange={e => setPinvForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div>
              <Label>Vendor / Supplier</Label>
              <Select value={pinvForm.vendor_id} onValueChange={v => setPinvForm(f => ({ ...f, vendor_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select vendor…" /></SelectTrigger>
                <SelectContent>
                  {(vendors.data || []).map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Project</Label>
              <ProjectPicker value={pinvForm.project_id} onChange={v => setPinvForm(f => ({ ...f, project_id: v }))} />
            </div>
            <div className="sm:col-span-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={pinvForm.notes} onChange={e => setPinvForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label className="mb-2 block font-semibold">Line Items</Label>
            <LineItemsEditor items={pinvForm.items} onChange={items => setPinvForm(f => ({ ...f, items }))} />
          </div>
          {pinvForm.items.length > 0 && (
            <div className="rounded-lg border p-4 bg-muted/30 text-sm space-y-1 max-w-xs ml-auto">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmtAED(totals.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">VAT (5%)</span><span>{fmtAED(totals.vat)}</span></div>
              <div className="flex justify-between font-bold text-primary border-t pt-1"><span>Total</span><span>{fmtAED(totals.total)}</span></div>
            </div>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onBack}>Cancel</Button>
            <Button onClick={() => saveInv.mutate()} disabled={saveInv.isPending}>
              {saveInv.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Save Purchase Invoice
            </Button>
          </div>
        </div>
      )}

      {/* Expense Entry */}
      {kind === "expense" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Date *</Label>
              <Input type="date" value={expForm.date} onChange={e => setExpForm(f => ({ ...f, date: e.target.value }))} required />
            </div>
            <div>
              <Label>Amount (AED) *</Label>
              <Input type="number" min={0} step={0.01} value={expForm.amount}
                onChange={e => setExpForm(f => ({ ...f, amount: e.target.value }))} required />
            </div>

            <div className="sm:col-span-2">
              <Label>Expense Category * (linked to Chart of Accounts)</Label>
              <CategoryPicker
                value={expForm.category_id}
                onChange={v => setExpForm(f => ({ ...f, category_id: v }))}
                onAccountChange={(code, name) => setExpForm(f => ({ ...f, account_code: code, account_name: name }))}
              />
              {expForm.account_code && (
                <p className="text-xs text-muted-foreground mt-1">
                  Posts to: <span className="font-medium">{expForm.account_code} — {expForm.account_name}</span>
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <Label>Project / Cost Centre *</Label>
              <ProjectPicker value={expForm.project_id} onChange={v => setExpForm(f => ({ ...f, project_id: v }))} required />
            </div>

            <div className="sm:col-span-2">
              <Label>Paid By</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {[
                  { val: "bank", label: "Bank / Transfer" },
                  { val: "temp_loan", label: "Employee (Temp Loan)" },
                  { val: "cash", label: "Cash" },
                ].map(opt => (
                  <button key={opt.val} type="button"
                    className={`rounded-md border p-2.5 text-sm text-center transition-all ${expForm.paid_by === opt.val ? "border-primary bg-primary/5 font-medium" : "hover:border-muted-foreground"}`}
                    onClick={() => setExpForm(f => ({ ...f, paid_by: opt.val }))}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {expForm.paid_by === "temp_loan" && (
              <div className="sm:col-span-2">
                <Label>Employee whose temp loan account to charge *</Label>
                <Select value={expForm.paid_by_employee_id} onValueChange={v => setExpForm(f => ({ ...f, paid_by_employee_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select employee…" /></SelectTrigger>
                  <SelectContent>
                    {(employees.data || []).map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>{e.full_name} — {e.designation || "Employee"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  This will credit the employee's Temp Loan account (1600), reducing what they owe you.
                </p>
              </div>
            )}

            <div className="sm:col-span-2">
              <Label>Description</Label>
              <Input placeholder="What was this for?" value={expForm.description}
                onChange={e => setExpForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <Label>Receipt / Reference No.</Label>
              <Input placeholder="Receipt number" value={expForm.reference}
                onChange={e => setExpForm(f => ({ ...f, reference: e.target.value }))} />
            </div>
            <div>
              <Label>Vendor (optional)</Label>
              <Select value={expForm.vendor_id} onValueChange={v => setExpForm(f => ({ ...f, vendor_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select vendor…" /></SelectTrigger>
                <SelectContent>
                  {(vendors.data || []).map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Journal preview */}
          {expForm.account_code && Number(expForm.amount) > 0 && (
            <div className="border rounded-lg p-3 bg-muted/20 text-xs space-y-1">
              <p className="font-semibold text-muted-foreground mb-2">Journal preview:</p>
              <div className="grid grid-cols-3 gap-1 font-medium text-muted-foreground border-b pb-1">
                <span>Account</span><span className="text-right">Debit</span><span className="text-right">Credit</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span>{expForm.account_code} — {expForm.account_name}</span>
                <span className="text-right font-medium">{fmtAED(Number(expForm.amount))}</span>
                <span className="text-right text-muted-foreground">—</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span>
                  {expForm.paid_by === "temp_loan"
                    ? `1600 — Temp Loan (${(employees.data || []).find((e: any) => e.id === expForm.paid_by_employee_id)?.full_name || "Employee"})`
                    : "1000 — Cash & Bank"}
                </span>
                <span className="text-right text-muted-foreground">—</span>
                <span className="text-right font-medium">{fmtAED(Number(expForm.amount))}</span>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onBack}>Cancel</Button>
            <Button onClick={() => saveExp.mutate()} disabled={saveExp.isPending}>
              {saveExp.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Post Expense
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Advance Balance Display ─────────────────────────────────────────────────
function AdvanceBalance({ employeeId, employees }: { employeeId: string; employees: any[] }) {
  const { data: jEntries = [] } = useQuery<any[]>({ queryKey: ["/api/journal_entries"] });
  if (!employeeId) return null;
  const emp = employees.find((x: any) => x.id === employeeId);
  const balance = (jEntries as any[]).reduce((sum: number, je: any) => {
    const lines = typeof je.lines === "string" ? JSON.parse(je.lines || "[]") : (je.lines || []);
    return sum + lines.reduce((s: number, l: any) => {
      if (l.account_code === "1600" && (l.account_name || "").includes(emp?.full_name || "__none__")) {
        return s + (Number(l.debit) || 0) - (Number(l.credit) || 0);
      }
      return s;
    }, 0);
  }, 0);
  const bal = Math.max(0, balance);
  return (
    <div className={`p-3 rounded-lg border text-sm font-medium flex items-center justify-between ${
      bal > 0 ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:text-green-300"
              : "bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-900/20 dark:text-slate-400"
    }`}>
      <span>Outstanding advance — {emp?.full_name || "Employee"}</span>
      <span className="text-lg font-bold">{fmtAED(bal)}</span>
    </div>
  );
}

// ── Petty Cash Form ──────────────────────────────────────────────────────────
function PettyCashForm({ onBack }: { onBack: () => void }) {
  const employees = useList("employees");
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [tab, setTab] = useState<"disburse" | "clear">("disburse");

  // Disburse: Bank → Employee Temp Loan
  const [disbForm, setDisbForm] = useState({
    date: today, amount: "", employee_id: "", description: "", reference: "",
  });

  // Clear: Expense → Employee Temp Loan (bill entry)
  const { data: expCats = [] } = useQuery<any[]>({ queryKey: ["/api/expense_categories"] });
  const [clearForm, setClearForm] = useState({
    date: today, amount: "", employee_id: "", category_id: "", account_code: "6300",
    account_name: "Office & Admin Expenses", description: "", reference: "", project_id: "",
  });

  const postJournal = useMutation({
    mutationFn: async (entry: any) => (await apiRequest("POST", "/api/journal_entries", entry)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal_entries"] });
      toast({ title: "Journal entry posted" });
      onBack();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function handleDisburse(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(disbForm.amount);
    if (!amt || !disbForm.employee_id) return toast({ title: "Fill all required fields", variant: "destructive" });
    const emp = (employees.data || []).find((x: any) => x.id === disbForm.employee_id);
    postJournal.mutate({
      entry_date: disbForm.date,
      reference: disbForm.reference || nextNumber("NXS-PC"),
      description: `Petty cash to ${emp?.full_name || "employee"} — ${disbForm.description || "advance"}`,
      status: "posted",
      total_debit: amt,
      lines: JSON.stringify([
        { account_code: "1600", account_name: `Temp Loan — ${emp?.full_name}`, description: "Advance given", debit: amt, credit: 0 },
        { account_code: "1000", account_name: "Cash & Bank", description: "Transferred", debit: 0, credit: amt },
      ]),
    });
  }

  function handleClear(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(clearForm.amount);
    const emp = (employees.data || []).find((x: any) => x.id === clearForm.employee_id);
    if (!amt || !clearForm.employee_id || !clearForm.category_id) return toast({ title: "Fill all required fields", variant: "destructive" });
    postJournal.mutate({
      entry_date: clearForm.date,
      reference: clearForm.reference || nextNumber("NXS-EXP"),
      description: clearForm.description || `Expense against ${emp?.full_name} temp loan`,
      status: "posted",
      total_debit: amt,
      lines: JSON.stringify([
        { account_code: clearForm.account_code, account_name: clearForm.account_name, description: clearForm.description, debit: amt, credit: 0 },
        { account_code: "1600", account_name: `Temp Loan — ${emp?.full_name}`, description: "Bill against advance", debit: 0, credit: amt },
      ]),
    });
  }

  return (
    <div className="mt-4 max-w-2xl space-y-4">
      <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
        <Button type="button" size="sm" variant={tab === "disburse" ? "default" : "ghost"} onClick={() => setTab("disburse")}>
          Give Advance to Employee
        </Button>
        <Button type="button" size="sm" variant={tab === "clear" ? "default" : "ghost"} onClick={() => setTab("clear")}>
          Clear Bill Against Advance
        </Button>
      </div>

      {tab === "disburse" && (
        <form onSubmit={handleDisburse} className="space-y-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-300">
            Bank → Employee Temp Loan Account. Use when you transfer petty cash to an employee via bank.
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Date *</Label>
              <Input type="date" value={disbForm.date} onChange={e => setDisbForm(f => ({ ...f, date: e.target.value }))} required />
            </div>
            <div>
              <Label>Amount (AED) *</Label>
              <Input type="number" min={0} step={0.01} value={disbForm.amount}
                onChange={e => setDisbForm(f => ({ ...f, amount: e.target.value }))} required />
            </div>
            <div className="col-span-2">
              <Label>Employee *</Label>
              <Select value={disbForm.employee_id} onValueChange={v => setDisbForm(f => ({ ...f, employee_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select employee…" /></SelectTrigger>
                <SelectContent>
                  {(employees.data || []).map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Reference</Label><Input value={disbForm.reference} onChange={e => setDisbForm(f => ({ ...f, reference: e.target.value }))} placeholder="Transfer reference" /></div>
            <div><Label>Description</Label><Input value={disbForm.description} onChange={e => setDisbForm(f => ({ ...f, description: e.target.value }))} placeholder="Purpose" /></div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onBack}>Cancel</Button>
            <Button type="submit" disabled={postJournal.isPending}>
              {postJournal.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Post Advance
            </Button>
          </div>
        </form>
      )}

      {tab === "clear" && (
        <form onSubmit={handleClear} className="space-y-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-xs text-amber-700 dark:text-amber-300">
            Expense Account ← Employee Temp Loan. Use when employee submits bills. Reduces their advance balance.
          </div>
          {/* Advance balance display */}
          <AdvanceBalance employeeId={clearForm.employee_id} employees={employees.data || []} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Date *</Label>
              <Input type="date" value={clearForm.date} onChange={e => setClearForm(f => ({ ...f, date: e.target.value }))} required />
            </div>
            <div>
              <Label>Amount (AED) *</Label>
              <Input type="number" min={0} step={0.01} value={clearForm.amount}
                onChange={e => setClearForm(f => ({ ...f, amount: e.target.value }))} required />
            </div>
            <div className="col-span-2">
              <Label>Employee (whose advance is being cleared) *</Label>
              <Select value={clearForm.employee_id} onValueChange={v => setClearForm(f => ({ ...f, employee_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select employee…" /></SelectTrigger>
                <SelectContent>
                  {(employees.data || []).map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Expense Category *</Label>
              <CategoryPicker
                value={clearForm.category_id}
                onChange={v => setClearForm(f => ({ ...f, category_id: v }))}
                onAccountChange={(code, name) => setClearForm(f => ({ ...f, account_code: code, account_name: name }))}
              />
            </div>
            <div><Label>Receipt / Ref.</Label><Input value={clearForm.reference} onChange={e => setClearForm(f => ({ ...f, reference: e.target.value }))} /></div>
            <div><Label>Description</Label><Input value={clearForm.description} onChange={e => setClearForm(f => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onBack}>Cancel</Button>
            <Button type="submit" disabled={postJournal.isPending}>
              {postJournal.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Post Expense
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Provisional / Accrual Form ────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: "salary_provision",
    label: "Monthly Salary Provision",
    description: "Record salary expense this month before actually paying. Dr Salary Expense → Cr Accrued Salaries.",
    lines: (amt: number, desc: string) => [
      { account_code: "6000", account_name: "Salaries & Wages", description: desc || "Salary provision", debit: amt, credit: 0 },
      { account_code: "2403", account_name: "Accrued Salaries", description: "Payable", debit: 0, credit: amt },
    ],
  },
  {
    id: "salary_payment",
    label: "Salary Payment (Clear Provision)",
    description: "When you actually pay salaries. Dr Accrued Salaries → Cr Bank.",
    lines: (amt: number, desc: string) => [
      { account_code: "2403", account_name: "Accrued Salaries", description: desc || "Salary paid", debit: amt, credit: 0 },
      { account_code: "1000", account_name: "Cash & Bank", description: "Payment", debit: 0, credit: amt },
    ],
  },
  {
    id: "prepaid_rent_payment",
    label: "Prepaid Rent — Annual Payment",
    description: "Pay annual rent upfront. Dr Prepaid Expenses (Asset) → Cr Bank.",
    lines: (amt: number, desc: string) => [
      { account_code: "1601", account_name: "Prepaid Expenses", description: desc || "Annual rent paid", debit: amt, credit: 0 },
      { account_code: "1000", account_name: "Cash & Bank", description: "Payment", debit: 0, credit: amt },
    ],
  },
  {
    id: "prepaid_rent_amortise",
    label: "Prepaid Rent — Monthly Amortisation",
    description: "Recognise one month's rent expense. Dr Rent Expense → Cr Prepaid Expenses.",
    lines: (amt: number, desc: string) => [
      { account_code: "6100", account_name: "Rent Expense", description: desc || "Monthly rent", debit: amt, credit: 0 },
      { account_code: "1601", account_name: "Prepaid Expenses", description: "Amortisation", debit: 0, credit: amt },
    ],
  },
  {
    id: "utility_provision",
    label: "Utility Bill Provision",
    description: "Record utility expense before paying. Dr Utilities → Cr Accrued Expenses.",
    lines: (amt: number, desc: string) => [
      { account_code: "6200", account_name: "Utilities", description: desc || "Utility bill", debit: amt, credit: 0 },
      { account_code: "2100", account_name: "Accrued Expenses", description: "Payable", debit: 0, credit: amt },
    ],
  },
  {
    id: "payable_payment",
    label: "Pay Accrued / Payable",
    description: "Clear any accrued expense when actually paid. Dr Accrued Expenses → Cr Bank.",
    lines: (amt: number, desc: string) => [
      { account_code: "2100", account_name: "Accrued Expenses", description: desc || "Payment", debit: amt, credit: 0 },
      { account_code: "1000", account_name: "Cash & Bank", description: "Payment", debit: 0, credit: amt },
    ],
  },
  {
    id: "custom",
    label: "Custom Journal",
    description: "Full flexibility — pick any debit and credit accounts.",
    lines: () => [],
  },
];

function ProvisionalForm({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();
  const { data: accounts = [] } = useQuery<any[]>({ queryKey: ["/api/accounts"] });
  const today = new Date().toISOString().slice(0, 10);

  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [form, setForm] = useState({
    date: today,
    amount: "",
    description: "",
    reference: "",
    project_id: "",
  });
  const [customLines, setCustomLines] = useState<any[]>([
    { account_id: "", account_code: "", account_name: "", debit: 0, credit: 0 },
    { account_id: "", account_code: "", account_name: "", debit: 0, credit: 0 },
  ]);

  const tmpl = TEMPLATES.find(t => t.id === selectedTemplate);

  const postJournal = useMutation({
    mutationFn: async () => {
      const amt = Number(form.amount);
      if (!form.date) throw new Error("Select a date");
      let lines: any[] = [];
      if (selectedTemplate === "custom") {
        lines = customLines.filter(l => l.account_code);
        const totalD = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
        const totalC = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
        if (Math.abs(totalD - totalC) > 0.01) throw new Error("Journal not balanced (Debits ≠ Credits)");
      } else {
        if (!tmpl) throw new Error("Select a template");
        if (!amt || amt <= 0) throw new Error("Enter a valid amount");
        lines = tmpl.lines(amt, form.description);
      }
      const totalD = lines.reduce((s: number, l: any) => s + Number(l.debit || 0), 0);
      return (await apiRequest("POST", "/api/journal_entries", {
        entry_date: form.date,
        reference: form.reference || nextNumber("NXS-JV"),
        description: form.description || tmpl?.label || "Journal entry",
        project_id: form.project_id && !["none", "__office__", "__site_visit__"].includes(form.project_id) ? form.project_id : null,
        status: "posted",
        total_debit: totalD,
        lines: JSON.stringify(lines),
      })).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal_entries"] });
      toast({ title: "Journal entry posted" });
      onBack();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updCustomLine = (i: number, k: string, v: any) => {
    setCustomLines(prev => prev.map((l, idx) => {
      if (idx !== i) return l;
      if (k === "account_id") {
        const acc = (accounts as any[]).find((a: any) => a.id === v);
        return { ...l, account_id: v, account_code: acc?.account_code || "", account_name: acc?.name || "" };
      }
      return { ...l, [k]: v };
    }));
  };

  return (
    <div className="mt-4 max-w-3xl space-y-5">
      {/* Template picker */}
      <div>
        <Label className="mb-2 block">Select Entry Type</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TEMPLATES.map(t => (
            <button key={t.id} type="button"
              className={`text-left rounded-lg border p-3 transition-all ${selectedTemplate === t.id ? "border-primary bg-primary/5" : "hover:border-muted-foreground"}`}
              onClick={() => setSelectedTemplate(t.id)}>
              <p className="text-sm font-medium">{t.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
            </button>
          ))}
        </div>
      </div>

      {selectedTemplate && (
        <div className="space-y-4 border rounded-lg p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Date *</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
            </div>
            {selectedTemplate !== "custom" && (
              <div>
                <Label>Amount (AED) *</Label>
                <Input type="number" min={0} step={0.01} value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
            )}
            <div>
              <Label>Reference</Label>
              <Input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="JV reference" />
            </div>
            <div>
              <Label>Project (optional)</Label>
              <ProjectPicker value={form.project_id} onChange={v => setForm(f => ({ ...f, project_id: v }))} />
            </div>
            <div className="col-span-2">
              <Label>Description / Narration</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g. June 2026 salary provision" />
            </div>
          </div>

          {/* Custom lines editor */}
          {selectedTemplate === "custom" && (
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
                <span className="col-span-6">Account</span>
                <span className="col-span-3 text-right">Debit</span>
                <span className="col-span-2 text-right">Credit</span>
                <span className="col-span-1" />
              </div>
              {customLines.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-6">
                    <Select value={line.account_id} onValueChange={v => updCustomLine(i, "account_id", v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pick account…" /></SelectTrigger>
                      <SelectContent>
                        {(accounts as any[]).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.account_code} — {a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input className="col-span-3 h-8 text-xs text-right" type="number" placeholder="Debit"
                    value={line.debit || ""} onChange={e => updCustomLine(i, "debit", Number(e.target.value))} />
                  <Input className="col-span-2 h-8 text-xs text-right" type="number" placeholder="Credit"
                    value={line.credit || ""} onChange={e => updCustomLine(i, "credit", Number(e.target.value))} />
                  <button type="button" className="col-span-1 text-destructive text-sm"
                    onClick={() => setCustomLines(prev => prev.filter((_, idx) => idx !== i))}>✕</button>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <Button type="button" variant="outline" size="sm"
                  onClick={() => setCustomLines(prev => [...prev, { account_id: "", account_code: "", account_name: "", debit: 0, credit: 0 }])}>
                  + Add Line
                </Button>
                <span className={`text-xs ${Math.abs(customLines.reduce((s, l) => s + l.debit, 0) - customLines.reduce((s, l) => s + l.credit, 0)) < 0.01 ? "text-green-600" : "text-destructive"}`}>
                  Dr {fmtAED(customLines.reduce((s, l) => s + Number(l.debit || 0), 0))} / Cr {fmtAED(customLines.reduce((s, l) => s + Number(l.credit || 0), 0))}
                </span>
              </div>
            </div>
          )}

          {/* Preview for template-based */}
          {selectedTemplate !== "custom" && tmpl && Number(form.amount) > 0 && (
            <div className="border rounded-lg p-3 bg-muted/20 text-xs">
              <p className="font-semibold text-muted-foreground mb-2">Journal preview:</p>
              {tmpl.lines(Number(form.amount), form.description).map((l, i) => (
                <div key={i} className="grid grid-cols-3 gap-1">
                  <span>{l.account_code} — {l.account_name}</span>
                  <span className="text-right">{l.debit ? fmtAED(l.debit) : "—"}</span>
                  <span className="text-right">{l.credit ? fmtAED(l.credit) : "—"}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onBack}>Cancel</Button>
            <Button onClick={() => postJournal.mutate()} disabled={postJournal.isPending}>
              {postJournal.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Post Journal
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
