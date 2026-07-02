/**
 * My Shortcuts — engineer-friendly hub page
 * One tap to: log timesheet, submit site report, purchase request,
 * petty cash entry, or view your projects & tasks.
 */
import { useState } from "react";
import { PageHeader, useList } from "@/components/common";
import { FormDialog, FormFieldDef, LineItemsEditor } from "@/components/crud-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { nextNumber, fmtDate } from "@/lib/nxs";
import {
  Clock, HardHat, ShoppingCart, Wallet, FolderOpen,
  ChevronRight, Loader2, CheckCircle2, AlertCircle, Circle, X, Plus,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const DAILY_WORK_HOURS = 9;

function calcHours(startDt: string, endDt: string) {
  if (!startDt || !endDt) return { regular: 0, overtime: 0, totalHours: 0 };
  const start = new Date(startDt);
  const end = new Date(endDt);
  if (end <= start) return { regular: 0, overtime: 0, totalHours: 0 };
  const diffMs = end.getTime() - start.getTime();
  const totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
  const regular = Math.min(totalHours, DAILY_WORK_HOURS);
  const overtime = Math.max(0, Math.round((totalHours - DAILY_WORK_HOURS) * 100) / 100);
  return { regular, overtime, totalHours };
}

function fmtHours(h: number) {
  if (!h) return "0h";
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function nowLocal() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Shortcut card
// ---------------------------------------------------------------------------
function ShortcutCard({
  icon, title, description, badge, badgeClass, onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge: string;
  badgeClass: string;
  onClick: () => void;
}) {
  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
      onClick={onClick}
      data-testid={`card-shortcut-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-base">{title}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badgeClass}`}>{badge}</span>
          </div>
          <p className="text-sm text-muted-foreground leading-snug">{description}</p>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
type ActivePanel = "timesheet" | "site_report" | "purchase_request" | "petty_cash" | "projects" | null;

export default function MyShortcuts() {
  const [active, setActive] = useState<ActivePanel>(null);
  const close = () => setActive(null);

  return (
    <div>
      <PageHeader
        title="My Shortcuts"
        subtitle="Quick actions for site engineers — tap to open any form instantly"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
        <ShortcutCard
          icon={<Clock className="h-6 w-6 text-primary" />}
          title="Log Timesheet"
          description="Record your start & end time for today's work on site"
          badge="HR"
          badgeClass="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
          onClick={() => setActive("timesheet")}
        />
        <ShortcutCard
          icon={<HardHat className="h-6 w-6 text-primary" />}
          title="Site Report"
          description="Submit a daily progress report with photos and completion %"
          badge="Operations"
          badgeClass="bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300"
          onClick={() => setActive("site_report")}
        />
        <ShortcutCard
          icon={<ShoppingCart className="h-6 w-6 text-primary" />}
          title="Purchase Request"
          description="Request materials or tools needed from site immediately"
          badge="Procurement"
          badgeClass="bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
          onClick={() => setActive("purchase_request")}
        />
        <ShortcutCard
          icon={<Wallet className="h-6 w-6 text-primary" />}
          title="Petty Cash / Expense"
          description="Record a project-wise cash expense with amount and description"
          badge="Finance"
          badgeClass="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
          onClick={() => setActive("petty_cash")}
        />
        <ShortcutCard
          icon={<FolderOpen className="h-6 w-6 text-primary" />}
          title="My Projects & Tasks"
          description="View all projects assigned to you and their current tasks"
          badge="Overview"
          badgeClass="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
          onClick={() => setActive("projects")}
        />
      </div>

      {/* Panels */}
      <TimesheetPanel open={active === "timesheet"} onClose={close} />
      <SiteReportPanel open={active === "site_report"} onClose={close} />
      <PurchaseRequestPanel open={active === "purchase_request"} onClose={close} />
      <PettyCashPanel open={active === "petty_cash"} onClose={close} />
      <ProjectsPanel open={active === "projects"} onClose={close} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Timesheet panel
// ---------------------------------------------------------------------------
function TimesheetPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { data: employees } = useList("employees");
  const { data: projects } = useList("projects");
  const { toast } = useToast();

  const myEmployee = (employees || []).find((e: any) =>
    e.email?.toLowerCase() === user?.email?.toLowerCase()
  );

  const [startDt, setStartDt] = useState(nowLocal());
  const [endDt, setEndDt] = useState("");
  const [projectId, setProjectId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [notes, setNotes] = useState("");

  const { regular, overtime, totalHours } = calcHours(startDt, endDt);

  const save = useMutation({
    mutationFn: async () => {
      const empId = myEmployee?.id || employeeId;
      if (!empId) throw new Error("Select your employee record");
      if (!startDt || !endDt) throw new Error("Start and end time are required");
      const workDate = startDt.slice(0, 10);
      return (await apiRequest("POST", "/api/timesheets", {
        employee_id: empId,
        project_id: projectId || null,
        work_date: workDate,
        start_datetime: new Date(startDt).toISOString(),
        end_datetime: new Date(endDt).toISOString(),
        regular_hours: regular,
        overtime_hours: overtime,
        notes,
        status: "pending",
      })).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      toast({ title: "Timesheet logged", description: `${fmtHours(totalHours)} recorded (${fmtHours(overtime)} OT)` });
      setEndDt(""); setNotes(""); setProjectId("");
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> Log Timesheet
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Employee — auto if matched */}
          {!myEmployee && (
            <div className="space-y-1.5">
              <Label>Your Employee Record *</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger data-testid="select-employee">
                  <SelectValue placeholder="Select yourself" />
                </SelectTrigger>
                <SelectContent>
                  {(employees || []).map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {myEmployee && (
            <div className="text-sm bg-muted rounded-lg px-3 py-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>Logged as <strong>{myEmployee.full_name}</strong></span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Project (optional)</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger data-testid="select-project-ts">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {(projects || []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start Date & Time *</Label>
              <Input type="datetime-local" value={startDt} onChange={(e) => setStartDt(e.target.value)} data-testid="input-start-datetime" />
            </div>
            <div className="space-y-1.5">
              <Label>End Date & Time *</Label>
              <Input type="datetime-local" value={endDt} onChange={(e) => setEndDt(e.target.value)} data-testid="input-end-datetime" />
            </div>
          </div>

          {totalHours > 0 && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-bold text-primary">{fmtHours(totalHours)}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</div>
              </div>
              <div>
                <div className="text-lg font-bold">{fmtHours(regular)}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Regular</div>
              </div>
              <div>
                <div className="text-lg font-bold text-orange-600">{fmtHours(overtime)}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">OT</div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea placeholder="Work done today..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} data-testid="input-notes-ts" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-timesheet">
            {save.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : "Save Timesheet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 2. Site Report panel
// ---------------------------------------------------------------------------
function SiteReportPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { data: projects } = useList("projects");
  const { toast } = useToast();

  const [projectId, setProjectId] = useState("");
  const [progress, setProgress] = useState(0);
  const [workDone, setWorkDone] = useState("");
  const [issues, setIssues] = useState("");
  const [nextPlan, setNextPlan] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error("Select a project");
      if (!workDone.trim()) throw new Error("Describe work completed today");
      return (await apiRequest("POST", "/api/site_progress_reports", {
        report_number: nextNumber("NXS-SPR"),
        project_id: projectId,
        report_date: todayStr(),
        period_from: todayStr(),
        period_to: todayStr(),
        overall_progress: progress,
        work_completed: workDone,
        issues: issues || null,
        next_period_plan: nextPlan || null,
        status: "submitted",
        reported_by: user?.id,
        photos: [],
      })).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site_progress_reports"] });
      toast({ title: "Site report submitted", description: `Progress: ${progress}%` });
      setProjectId(""); setProgress(0); setWorkDone(""); setIssues(""); setNextPlan("");
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardHat className="h-5 w-5 text-primary" /> Daily Site Report
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Project *</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger data-testid="select-project-sr">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {(projects || []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Overall Progress</Label>
              <span className="text-sm font-bold text-primary">{progress}%</span>
            </div>
            <input
              type="range" min={0} max={100} value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full accent-primary"
              data-testid="input-progress"
            />
            <Progress value={progress} className="h-2" />
          </div>

          <div className="space-y-1.5">
            <Label>Work Completed Today *</Label>
            <Textarea
              placeholder="Describe what was done on site today..."
              value={workDone}
              onChange={(e) => setWorkDone(e.target.value)}
              rows={3}
              data-testid="input-work-done"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Issues / Delays (optional)</Label>
            <Textarea
              placeholder="Any problems or delays encountered..."
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
              rows={2}
              data-testid="input-issues"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Plan for Next Day (optional)</Label>
            <Textarea
              placeholder="What will be done tomorrow..."
              value={nextPlan}
              onChange={(e) => setNextPlan(e.target.value)}
              rows={2}
              data-testid="input-next-plan"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-report">
            {save.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 3. Purchase Request panel
// ---------------------------------------------------------------------------
function PurchaseRequestPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { data: projects } = useList("projects");
  const { toast } = useToast();

  const [projectId, setProjectId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<any[]>([{ description: "", quantity: 1, unit: "pcs", unit_price: 0 }]);

  function addItem() {
    setItems([...items, { description: "", quantity: 1, unit: "pcs", unit_price: 0 }]);
  }

  function removeItem(i: number) {
    setItems(items.filter((_, idx) => idx !== i));
  }

  function updateItem(i: number, field: string, value: any) {
    setItems(items.map((it, idx) => idx === i ? { ...it, [field]: value } : it));
  }

  const save = useMutation({
    mutationFn: async () => {
      const validItems = items.filter((it) => it.description?.trim());
      if (!validItems.length) throw new Error("Add at least one item");
      return (await apiRequest("POST", "/api/purchase_requests", {
        pr_number: nextNumber("NXS-PR"),
        project_id: projectId || null,
        request_date: todayStr(),
        status: "submitted",
        requested_by: user?.id,
        notes: notes || null,
        items: validItems,
      })).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase_requests"] });
      toast({ title: "Purchase request submitted", description: "Your request has been sent for approval" });
      setProjectId(""); setNotes("");
      setItems([{ description: "", quantity: 1, unit: "pcs", unit_price: 0 }]);
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" /> Purchase Request
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Project (optional)</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger data-testid="select-project-pr">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {(projects || []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items Needed *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem} data-testid="button-add-item">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
              </Button>
            </div>
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-start border rounded-lg p-3 bg-muted/30" data-testid={`row-item-${i}`}>
                <div className="col-span-12">
                  <Input
                    placeholder="Item description *"
                    value={item.description}
                    onChange={(e) => updateItem(i, "description", e.target.value)}
                    data-testid={`input-item-desc-${i}`}
                  />
                </div>
                <div className="col-span-4">
                  <Input
                    type="number" placeholder="Qty" min={1}
                    value={item.quantity}
                    onChange={(e) => updateItem(i, "quantity", Number(e.target.value))}
                    data-testid={`input-item-qty-${i}`}
                  />
                </div>
                <div className="col-span-4">
                  <Input
                    placeholder="Unit"
                    value={item.unit}
                    onChange={(e) => updateItem(i, "unit", e.target.value)}
                    data-testid={`input-item-unit-${i}`}
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    type="number" placeholder="Price" min={0} step={0.01}
                    value={item.unit_price || ""}
                    onChange={(e) => updateItem(i, "unit_price", Number(e.target.value))}
                    data-testid={`input-item-price-${i}`}
                  />
                </div>
                {items.length > 1 && (
                  <button type="button" className="col-span-1 flex items-center justify-center h-9 text-destructive hover:text-destructive/80" onClick={() => removeItem(i)} data-testid={`button-remove-item-${i}`}>
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>Notes / Urgency</Label>
            <Textarea
              placeholder="Any special notes or urgency..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              data-testid="input-notes-pr"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-pr">
            {save.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting…</> : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 4. Petty Cash / Expense panel
// ---------------------------------------------------------------------------
function PettyCashPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: projects } = useList("projects");
  const { data: expCats } = useList("expense_categories");
  const { toast } = useToast();

  const [projectId, setProjectId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [paidBy, setPaidBy] = useState("petty_cash");
  const [expDate, setExpDate] = useState(todayStr());

  const save = useMutation({
    mutationFn: async () => {
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) throw new Error("Enter a valid amount");
      if (!description.trim()) throw new Error("Description is required");
      // Save as a journal expense entry via petty cash
      return (await apiRequest("POST", "/api/journal_entries", {
        entry_number: nextNumber("NXS-EXP"),
        entry_date: expDate,
        description: `${description}${projectId ? " [Project expense]" : ""}`,
        reference: projectId || null,
        project_id: projectId || null,
        expense_category_id: categoryId || null,
        lines: [
          {
            account_id: "expenses",
            description,
            debit: Number(amount),
            credit: 0,
          },
          {
            account_id: paidBy === "petty_cash" ? "petty_cash" : "bank",
            description: `${paidBy === "petty_cash" ? "Petty cash" : "Bank"} payment`,
            debit: 0,
            credit: Number(amount),
          },
        ],
        total_debit: Number(amount),
        total_credit: Number(amount),
        status: "posted",
      })).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal_entries"] });
      toast({ title: "Expense recorded", description: `AED ${Number(amount).toFixed(2)} saved to journal` });
      setProjectId(""); setCategoryId(""); setAmount(""); setDescription("");
      setPaidBy("petty_cash"); setExpDate(todayStr());
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" /> Petty Cash / Expense Entry
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Project (optional)</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger data-testid="select-project-pc">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {(projects || []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Expense Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger data-testid="select-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {(expCats || []).map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount (AED) *</Label>
              <Input
                type="number" min={0} step={0.01}
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                data-testid="input-amount"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} data-testid="input-date-pc" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Paid By</Label>
            <Select value={paidBy} onValueChange={setPaidBy}>
              <SelectTrigger data-testid="select-paid-by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="petty_cash">Petty Cash</SelectItem>
                <SelectItem value="bank">Bank / Card</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Description *</Label>
            <Textarea
              placeholder="What was this expense for..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              data-testid="input-description-pc"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-expense">
            {save.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : "Save Expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 5. Projects & Tasks panel
// ---------------------------------------------------------------------------
function ProjectsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: projects, isLoading: pLoad } = useList("projects");
  const { data: tasks, isLoading: tLoad } = useList("project_tasks");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = (projects || []).find((p: any) => p.id === selectedId);
  const projectTasks = (tasks || []).filter((t: any) => t.project_id === selectedId);

  function taskStatusIcon(status: string) {
    switch (status?.toLowerCase()) {
      case "completed": return <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />;
      case "in progress": return <Circle className="h-4 w-4 text-amber-500 flex-shrink-0" />;
      default: return <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
    }
  }

  function priorityBadge(p: string) {
    const cls = p === "high"
      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
      : p === "medium"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
    return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${cls}`}>{p}</span>;
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            {selected ? selected.name : "My Projects & Tasks"}
          </DialogTitle>
        </DialogHeader>

        {!selected ? (
          <div className="space-y-2 py-2">
            {pLoad && <p className="text-sm text-muted-foreground text-center py-6">Loading projects…</p>}
            {!pLoad && (projects || []).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No projects found</p>
            )}
            {(projects || []).map((p: any) => (
              <button
                key={p.id}
                className="w-full text-left border rounded-lg px-4 py-3 hover:bg-muted/50 transition-colors flex items-center gap-3"
                onClick={() => setSelectedId(p.id)}
                data-testid={`card-project-${p.id}`}
              >
                <FolderOpen className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.client_name || p.client || "—"}</div>
                </div>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  p.status === "active"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                } capitalize`}>{p.status || "Active"}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)} className="text-muted-foreground">
              ← Back to projects
            </Button>

            <div className="rounded-lg bg-muted/40 px-4 py-3 space-y-1 text-sm">
              {selected.client_name && <div><span className="text-muted-foreground">Client: </span>{selected.client_name}</div>}
              {selected.location && <div><span className="text-muted-foreground">Location: </span>{selected.location}</div>}
              {selected.start_date && <div><span className="text-muted-foreground">Start: </span>{fmtDate(selected.start_date)}</div>}
            </div>

            <div className="font-semibold text-sm px-0.5">Tasks ({projectTasks.length})</div>
            {tLoad && <p className="text-sm text-muted-foreground">Loading tasks…</p>}
            {!tLoad && projectTasks.length === 0 && (
              <p className="text-sm text-muted-foreground">No tasks for this project</p>
            )}
            {projectTasks.map((t: any) => (
              <div key={t.id} className="border rounded-lg px-3 py-3 flex items-start gap-3" data-testid={`card-task-${t.id}`}>
                {taskStatusIcon(t.status)}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{t.title}</div>
                  {t.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</div>}
                  <div className="flex items-center gap-2 mt-1.5">
                    {priorityBadge(t.priority)}
                    <span className="text-xs text-muted-foreground capitalize">{t.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
