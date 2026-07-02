import { useState } from "react";
import { PageHeader, useList } from "@/components/common";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { fmtAED } from "@/lib/nxs";
import { StatusBadge } from "@/components/common";
import { Loader2, Wallet, Edit2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

// OT Formula:
// Mandatory hrs/month = 9hrs/day × 26 working days (4 holidays/month) = 234 hrs
// OT hourly rate = basic_salary / 234 * 1.5
// OT pay = OT_rate × overtime_hours
// Medical leave = PAID (no deduction)
// Annual/normal leave = UNPAID (deducted at basic/30 per day)
const MONTHLY_MANDATORY_HRS = 234; // 9 × 26

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

interface EditPayrollForm {
  id: string;
  employee_name: string;
  special_bonus: number;
  medical_leave_days: number;
  annual_leave_days: number;
  basic_salary: number;
}

export default function Payroll() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const { data, isLoading } = useList("payroll");
  const { data: employees } = useList("employees");
  const { toast } = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditPayrollForm | null>(null);

  const empName = (id: string) => (employees || []).find((e: any) => e.id === id)?.full_name || "—";

  const gen = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/payroll/generate", { month, year })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
      toast({ title: "Payroll generated", description: `${MONTHS[month - 1]} ${year} payroll created as drafts.` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const approve = useMutation({
    mutationFn: async (row: any) => (await apiRequest("PUT", `/api/payroll/${row.id}`, { status: "approved" })).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/payroll"] }),
  });

  const updateRow = useMutation({
    mutationFn: async (values: any) => {
      const { id, ...rest } = values;
      return (await apiRequest("PUT", `/api/payroll/${id}`, rest)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
      setEditOpen(false);
      toast({ title: "Payroll entry updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openEdit(row: any) {
    setEditForm({
      id: row.id,
      employee_name: empName(row.employee_id),
      special_bonus: Number(row.special_bonus) || 0,
      medical_leave_days: Number(row.medical_leave_days) || 0,
      annual_leave_days: Number(row.annual_leave_days) || 0,
      basic_salary: Number(row.basic_salary) || 0,
    });
    setEditOpen(true);
  }

  function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editForm) return;
    const daily = editForm.basic_salary / 30;
    const leaveDeduction = Math.round(editForm.annual_leave_days * daily * 100) / 100;
    // recalc net — we need the existing row
    const row = (rows || []).find((r: any) => r.id === editForm.id);
    if (!row) return;
    const otRate = editForm.basic_salary / MONTHLY_MANDATORY_HRS * 1.5;
    const otPay = Math.round((Number(row.overtime_hours) || 0) * otRate * 100) / 100;
    const housing = Number(row.housing_allowance) || 0;
    const transport = Number(row.transport_allowance) || 0;
    const other = Number(row.other_allowance) || 0;
    const net = editForm.basic_salary + housing + transport + other + otPay + editForm.special_bonus - leaveDeduction;
    updateRow.mutate({
      id: editForm.id,
      special_bonus: editForm.special_bonus,
      medical_leave_days: editForm.medical_leave_days,
      annual_leave_days: editForm.annual_leave_days,
      leave_deduction: leaveDeduction,
      overtime_pay: otPay,
      net_salary: Math.max(0, Math.round(net * 100) / 100),
    });
  }

  const rows = (data || []).filter((p: any) => p.month === month && p.year === year);
  const total = rows.reduce((s: number, r: any) => s + (Number(r.net_salary) || 0), 0);

  return (
    <div>
      <PageHeader
        title="Payroll"
        subtitle={`OT rate = Basic ÷ ${MONTHLY_MANDATORY_HRS} hrs × 1.5 | Medical leave = paid | Annual leave = unpaid deduction`}
        actions={
          <div className="flex gap-2 items-center flex-wrap">
            <select
              data-testid="select-month"
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <Input
              data-testid="input-year"
              type="number"
              className="w-24"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
            <Button data-testid="button-generate-payroll" onClick={() => gen.mutate()} disabled={gen.isPending}>
              {gen.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              <Wallet className="h-4 w-4 mr-1" /> Generate
            </Button>
          </div>
        }
      />

      {rows.length > 0 && (
        <Card className="mb-4">
          <CardContent className="py-4 flex flex-wrap justify-between items-center gap-3">
            <span className="text-sm text-muted-foreground">{MONTHS[month - 1]} {year} — {rows.length} employees</span>
            <span className="text-lg font-bold">Total Net Payroll: {fmtAED(total)}</span>
          </CardContent>
        </Card>
      )}

      <DataTable
        rows={rows}
        loading={isLoading}
        columns={[
          { header: "Employee", cell: (r: any) => <span className="font-medium">{empName(r.employee_id)}</span> },
          { header: "Basic", cell: (r: any) => fmtAED(r.basic_salary) },
          { header: "Allowances", cell: (r: any) => fmtAED((Number(r.housing_allowance) || 0) + (Number(r.transport_allowance) || 0) + (Number(r.other_allowance) || 0)) },
          { header: "OT Pay", cell: (r: any) => <span className={Number(r.overtime_pay) > 0 ? "text-amber-600 font-medium" : ""}>{fmtAED(r.overtime_pay || 0)}</span> },
          { header: "Bonus", cell: (r: any) => Number(r.special_bonus) > 0 ? <span className="text-green-700 font-medium">{fmtAED(r.special_bonus)}</span> : <span className="text-muted-foreground">—</span> },
          { header: "Leave Deduct.", cell: (r: any) => Number(r.leave_deduction) > 0 ? <span className="text-red-600">-{fmtAED(r.leave_deduction)}</span> : <span className="text-muted-foreground">—</span> },
          { header: "Med. Leave", cell: (r: any) => Number(r.medical_leave_days) > 0 ? <span className="text-blue-600">{r.medical_leave_days}d (paid)</span> : <span className="text-muted-foreground">—</span> },
          { header: "Net Salary", cell: (r: any) => <span className="font-semibold text-primary">{fmtAED(r.net_salary)}</span> },
          { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
          {
            header: "", cell: (r: any) => (
              <div className="flex gap-1">
                {r.status === "draft" && (
                  <Button size="sm" variant="ghost" data-testid={`button-edit-payroll-${r.id}`} onClick={() => openEdit(r)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                )}
                {r.status === "draft" && (
                  <Button size="sm" variant="outline" onClick={() => approve.mutate(r)}>Approve</Button>
                )}
              </div>
            )
          },
        ]}
        emptyMessage="No payroll for this period. Click Generate to create it."
      />

      {/* Edit payroll row dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Payroll — {editForm?.employee_name}</DialogTitle>
          </DialogHeader>
          {editForm && (
            <form onSubmit={saveEdit} className="space-y-4">
              <div className="rounded-lg bg-muted/40 border p-3 text-sm">
                <div className="font-medium mb-1">OT Rate Formula</div>
                <div className="text-muted-foreground text-xs">
                  Basic ({fmtAED(editForm.basic_salary)}) ÷ {MONTHLY_MANDATORY_HRS} mandatory hrs × 1.5 = {fmtAED(editForm.basic_salary / MONTHLY_MANDATORY_HRS * 1.5)} per OT hour
                </div>
              </div>

              <div>
                <Label htmlFor="pe-bonus">Special Bonus (AED)</Label>
                <Input
                  id="pe-bonus"
                  data-testid="input-special-bonus"
                  type="number"
                  min={0}
                  step={0.01}
                  value={editForm.special_bonus}
                  onChange={(e) => setEditForm((f) => f ? { ...f, special_bonus: Number(e.target.value) } : f)}
                />
                <p className="text-xs text-muted-foreground mt-1">Performance bonus, Eid bonus, etc.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="pe-medical">Medical Leave (days)</Label>
                  <Input
                    id="pe-medical"
                    data-testid="input-medical-leave"
                    type="number"
                    min={0}
                    step={0.5}
                    value={editForm.medical_leave_days}
                    onChange={(e) => setEditForm((f) => f ? { ...f, medical_leave_days: Number(e.target.value) } : f)}
                  />
                  <p className="text-xs text-green-700 mt-1">Paid — no deduction</p>
                </div>
                <div>
                  <Label htmlFor="pe-annual">Annual/Normal Leave (days)</Label>
                  <Input
                    id="pe-annual"
                    data-testid="input-annual-leave"
                    type="number"
                    min={0}
                    step={0.5}
                    value={editForm.annual_leave_days}
                    onChange={(e) => setEditForm((f) => f ? { ...f, annual_leave_days: Number(e.target.value) } : f)}
                  />
                  <p className="text-xs text-red-600 mt-1">
                    Unpaid — deducts {fmtAED(editForm.basic_salary / 30)}/day
                  </p>
                </div>
              </div>

              {/* Preview */}
              <div className="rounded-lg border bg-primary/5 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Leave deduction</span>
                  <span className="text-red-600">-{fmtAED(editForm.annual_leave_days * (editForm.basic_salary / 30))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Special bonus</span>
                  <span className="text-green-700">+{fmtAED(editForm.special_bonus)}</span>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={updateRow.isPending} data-testid="button-save-payroll-edit">
                  {updateRow.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
