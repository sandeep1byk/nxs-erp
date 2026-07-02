/**
 * Finance Quick Entry — shortcut buttons for:
 *  1. Sales Invoice (tax invoice to client)
 *  2. Purchase Invoice (from vendor) or Expense Entry
 */
import { useState } from "react";
import { PageHeader, useList } from "@/components/common";
import { LineItemsEditor } from "@/components/crud-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Receipt, ShoppingCart, CreditCard, Plus, Loader2, ChevronRight, ArrowLeft } from "lucide-react";
import { fmtAED, nextNumber, computeTotals } from "@/lib/nxs";

type EntryMode = "sales_invoice" | "purchase_expense" | null;
type EntryKind = "purchase" | "expense";

// ---- Landing ---------------------------------------------------------------
export default function FinanceQuickEntry() {
  const [mode, setMode] = useState<EntryMode>(null);
  const [expenseDefault, setExpenseDefault] = useState<EntryKind>("purchase");

  function goMode(m: EntryMode, kind?: EntryKind) {
    if (kind) setExpenseDefault(kind);
    setMode(m);
  }

  return (
    <div>
      <PageHeader
        title="Finance Quick Entry"
        subtitle="Quickly create sales invoices, purchase invoices, or expense entries"
        actions={
          mode ? (
            <Button variant="outline" onClick={() => setMode(null)} data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          ) : undefined
        }
      />

      {!mode && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
          <QuickCard
            icon={<Receipt className="h-8 w-8 text-primary" />}
            title="Sales Invoice"
            description="Issue a VAT tax invoice to a client for completed work or services rendered"
            badge="Revenue"
            badgeColor="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
            onClick={() => goMode("sales_invoice")}
            testId="button-quick-sales-invoice"
          />
          <QuickCard
            icon={<ShoppingCart className="h-8 w-8 text-blue-600" />}
            title="Purchase Invoice"
            description="Record an invoice received from a vendor or supplier with line items"
            badge="Purchase"
            badgeColor="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
            onClick={() => goMode("purchase_expense", "purchase")}
            testId="button-quick-purchase-invoice"
          />
          <QuickCard
            icon={<CreditCard className="h-8 w-8 text-amber-600" />}
            title="Expense Entry"
            description="Record a direct expense with category — fuel, office supplies, meals, etc."
            badge="Expense"
            badgeColor="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
            onClick={() => goMode("purchase_expense", "expense")}
            testId="button-quick-expense"
          />
        </div>
      )}

      {mode === "sales_invoice" && <SalesInvoiceForm onBack={() => setMode(null)} />}
      {mode === "purchase_expense" && <PurchaseExpenseForm onBack={() => setMode(null)} defaultKind={expenseDefault} />}
    </div>
  );
}

// ---- Quick Card component --------------------------------------------------
function QuickCard({ icon, title, description, badge, badgeColor, onClick, testId }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge: string;
  badgeColor: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <Card
      className="cursor-pointer hover:border-primary hover:shadow-md transition-all group"
      onClick={onClick}
      data-testid={testId}
    >
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
          Create now <ChevronRight className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Sales Invoice Form ----------------------------------------------------
function SalesInvoiceForm({ onBack }: { onBack: () => void }) {
  const { data: clients } = useList("clients");
  const { data: projects } = useList("projects");
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
      toast({ title: "Sales invoice created", description: `Invoice ${form.invoice_number} saved as draft.` });
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
    <form onSubmit={handleSubmit} className="space-y-5 mt-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Invoice No.</Label>
          <Input value={form.invoice_number} onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))} required />
        </div>
        <div>
          <Label>Type</Label>
          <Select value={form.invoice_type} onValueChange={(v) => setForm((f) => ({ ...f, invoice_type: v }))}>
            <SelectTrigger data-testid="select-invoice-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["standard", "advance", "progressive", "final"].map((t) => (
                <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Client *</Label>
          <Select value={form.client_id} onValueChange={(v) => setForm((f) => ({ ...f, client_id: v }))}>
            <SelectTrigger data-testid="select-client"><SelectValue placeholder="Select client…" /></SelectTrigger>
            <SelectContent>
              {(clients || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Project (optional)</Label>
          <Select value={form.project_id} onValueChange={(v) => setForm((f) => ({ ...f, project_id: v }))}>
            <SelectTrigger><SelectValue placeholder="Select project…" /></SelectTrigger>
            <SelectContent>
              {(projects || []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Invoice Date</Label>
          <Input type="date" value={form.invoice_date} onChange={(e) => setForm((f) => ({ ...f, invoice_date: e.target.value }))} />
        </div>
        <div>
          <Label>Due Date</Label>
          <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
        </div>
        <div className="sm:col-span-2">
          <Label>Subject / Description of Work</Label>
          <Input placeholder="e.g. Civil works — Downtown Tower Phase 2" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
        </div>
        <div className="sm:col-span-2">
          <Label>Notes</Label>
          <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
      </div>

      <div>
        <Label className="mb-2 block font-semibold">Line Items</Label>
        <LineItemsEditor items={form.items} onChange={(items) => setForm((f) => ({ ...f, items }))} />
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
        <Button type="submit" disabled={save.isPending} data-testid="button-save-sales-invoice">
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          Save Invoice
        </Button>
      </div>
    </form>
  );
}

// ---- Purchase Invoice / Expense Entry (combined with toggle) ---------------
function PurchaseExpenseForm({ onBack, defaultKind }: { onBack: () => void; defaultKind: EntryKind }) {
  const { data: vendors } = useList("vendors");
  const { data: projects } = useList("projects");
  const { data: expCats } = useList("expense_categories");
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);

  const [kind, setKind] = useState<EntryKind>(defaultKind);
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  // Purchase invoice state
  const [pinvForm, setPinvForm] = useState({
    invoice_number: nextNumber("NXS-PINV"),
    vendor_id: "",
    project_id: "",
    invoice_date: today,
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    notes: "",
    items: [] as any[],
  });

  // Expense state
  const [expForm, setExpForm] = useState({
    category_id: "",
    amount: "" as string | number,
    date: today,
    vendor_id: "",
    description: "",
    reference: "",
  });

  const saveCat = useMutation({
    mutationFn: async (name: string) => (await apiRequest("POST", "/api/expense_categories", { name })).json(),
    onSuccess: (cat) => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense_categories"] });
      setExpForm((f) => ({ ...f, category_id: cat.id }));
      setAddingCat(false);
      setNewCatName("");
      toast({ title: `Category "${cat.name}" created` });
    },
    onError: (e: any) => toast({ title: "Error saving category", description: e.message, variant: "destructive" }),
  });

  const saveInv = useMutation({
    mutationFn: async (values: any) => (await apiRequest("POST", "/api/invoices", values)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Purchase invoice saved as draft" });
      onBack();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveExp = useMutation({
    mutationFn: async (values: any) => (await apiRequest("POST", "/api/journal_entries", values)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal_entries"] });
      toast({ title: "Expense entry saved to journal" });
      onBack();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function handlePurchaseSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = computeTotals(pinvForm.items);
    saveInv.mutate({
      ...pinvForm,
      invoice_type: "purchase",
      client_id: null,
      subtotal: t.subtotal,
      vat_amount: t.vat,
      total_amount: t.total,
      status: "draft",
    });
  }

  function handleExpenseSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(expForm.amount);
    if (!amt || amt <= 0) return toast({ title: "Please enter a valid amount", variant: "destructive" });
    if (!expForm.category_id) return toast({ title: "Please select a category", variant: "destructive" });
    const catName = (expCats || []).find((c: any) => c.id === expForm.category_id)?.name || "Expense";
    saveExp.mutate({
      entry_date: expForm.date,
      reference: expForm.reference || nextNumber("NXS-EXP"),
      description: expForm.description || catName,
      status: "posted",
      lines: [
        { account_name: catName, description: expForm.description, debit: amt, credit: 0 },
        { account_name: "Cash & Bank", description: "Payment", debit: 0, credit: amt },
      ],
    });
  }

  const totals = computeTotals(pinvForm.items);

  return (
    <div className="mt-4 space-y-5">
      {/* Toggle */}
      <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
        <Button
          type="button"
          size="sm"
          variant={kind === "purchase" ? "default" : "ghost"}
          onClick={() => setKind("purchase")}
          data-testid="button-toggle-purchase"
        >
          <ShoppingCart className="h-4 w-4 mr-1" /> Purchase Invoice
        </Button>
        <Button
          type="button"
          size="sm"
          variant={kind === "expense" ? "default" : "ghost"}
          onClick={() => setKind("expense")}
          data-testid="button-toggle-expense"
        >
          <CreditCard className="h-4 w-4 mr-1" /> Expense Entry
        </Button>
      </div>

      {/* Purchase Invoice */}
      {kind === "purchase" && (
        <form onSubmit={handlePurchaseSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Reference No.</Label>
              <Input value={pinvForm.invoice_number} onChange={(e) => setPinvForm((f) => ({ ...f, invoice_number: e.target.value }))} />
            </div>
            <div>
              <Label>Invoice Date</Label>
              <Input type="date" value={pinvForm.invoice_date} onChange={(e) => setPinvForm((f) => ({ ...f, invoice_date: e.target.value }))} />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={pinvForm.due_date} onChange={(e) => setPinvForm((f) => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div>
              <Label>Vendor / Supplier</Label>
              <Select value={pinvForm.vendor_id} onValueChange={(v) => setPinvForm((f) => ({ ...f, vendor_id: v }))}>
                <SelectTrigger data-testid="select-vendor"><SelectValue placeholder="Select vendor…" /></SelectTrigger>
                <SelectContent>
                  {(vendors || []).map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Project (optional)</Label>
              <Select value={pinvForm.project_id} onValueChange={(v) => setPinvForm((f) => ({ ...f, project_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select project…" /></SelectTrigger>
                <SelectContent>
                  {(projects || []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={pinvForm.notes} onChange={(e) => setPinvForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label className="mb-2 block font-semibold">Line Items</Label>
            <LineItemsEditor items={pinvForm.items} onChange={(items) => setPinvForm((f) => ({ ...f, items }))} />
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
            <Button type="submit" disabled={saveInv.isPending} data-testid="button-save-purchase-invoice">
              {saveInv.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Save Purchase Invoice
            </Button>
          </div>
        </form>
      )}

      {/* Expense Entry */}
      {kind === "expense" && (
        <form onSubmit={handleExpenseSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Date *</Label>
              <Input type="date" value={expForm.date} onChange={(e) => setExpForm((f) => ({ ...f, date: e.target.value }))} required />
            </div>
            <div>
              <Label>Amount (AED) *</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                data-testid="input-expense-amount"
                value={expForm.amount}
                onChange={(e) => setExpForm((f) => ({ ...f, amount: e.target.value }))}
                required
              />
            </div>

            {/* Category with inline create */}
            <div className="sm:col-span-2">
              <Label>Expense Category *</Label>
              {!addingCat ? (
                <div className="flex gap-2">
                  <Select value={expForm.category_id} onValueChange={(v) => setExpForm((f) => ({ ...f, category_id: v }))}>
                    <SelectTrigger data-testid="select-expense-category" className="flex-1">
                      <SelectValue placeholder="Select category…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(expCats || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    data-testid="button-add-category"
                    onClick={() => setAddingCat(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" /> New Category
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    data-testid="input-new-category"
                    placeholder="New category name…"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    autoFocus
                  />
                  <Button
                    type="button"
                    disabled={!newCatName.trim() || saveCat.isPending}
                    onClick={() => saveCat.mutate(newCatName.trim())}
                    data-testid="button-save-category"
                  >
                    {saveCat.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => { setAddingCat(false); setNewCatName(""); }}>Cancel</Button>
                </div>
              )}
            </div>

            <div className="sm:col-span-2">
              <Label>Description</Label>
              <Input
                data-testid="input-expense-description"
                placeholder="What was this expense for?"
                value={expForm.description}
                onChange={(e) => setExpForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <Label>Reference / Receipt No.</Label>
              <Input
                placeholder="Receipt or reference number"
                value={expForm.reference}
                onChange={(e) => setExpForm((f) => ({ ...f, reference: e.target.value }))}
              />
            </div>
            <div>
              <Label>Vendor (optional)</Label>
              <Select value={expForm.vendor_id} onValueChange={(v) => setExpForm((f) => ({ ...f, vendor_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select vendor…" /></SelectTrigger>
                <SelectContent>
                  {(vendors || []).map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onBack}>Cancel</Button>
            <Button type="submit" disabled={saveExp.isPending} data-testid="button-save-expense">
              {saveExp.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Save Expense
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
