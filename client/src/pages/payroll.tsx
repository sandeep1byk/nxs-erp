import { useState } from "react";
import { PageHeader, useList } from "@/components/common";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { fmtAED, COMPANY } from "@/lib/nxs";
import { StatusBadge } from "@/components/common";
import { Loader2, Wallet, Edit2, FileDown } from "lucide-react";
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

function generatePayslipHTML(row: any, empName: string, month: number, year: number): string {
  const housing = Number(row.housing_allowance) || 0;
  const transport = Number(row.transport_allowance) || 0;
  const other = Number(row.other_allowance) || 0;
  const basic = Number(row.basic_salary) || 0;
  const otPay = Number(row.overtime_pay) || 0;
  const bonus = Number(row.special_bonus) || 0;
  const leaveDeduct = Number(row.leave_deduction) || 0;
  const net = Number(row.net_salary) || 0;
  const totalEarnings = basic + housing + transport + other + otPay + bonus;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;color:#1a1a2e;margin:0;padding:20px;}
  .hdr{background:#0c1125;color:white;padding:20px 24px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:center;}
  .hdr h1{margin:0;font-size:20px;color:#bd7214;}
  .hdr .sub{font-size:11px;opacity:0.8;margin-top:4px;}
  .badge{background:#bd7214;color:white;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:bold;}
  .body{border:1px solid #ddd;border-top:none;padding:20px 24px;}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;padding-bottom:16px;border-bottom:2px solid #bd7214;}
  .ml{font-size:10px;color:#666;text-transform:uppercase;}
  .mv{font-weight:bold;font-size:13px;}
  table{width:100%;border-collapse:collapse;margin-bottom:12px;}
  th{background:#f5f5f0;text-align:left;padding:7px 10px;font-size:11px;color:#555;}
  td{padding:6px 10px;border-bottom:1px solid #eee;}
  .tr td{font-weight:bold;background:#f9f8f5;border-top:2px solid #ccc;}
  .net{background:#0c1125;color:white;padding:14px 20px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;margin-top:12px;}
  .net .lbl{font-size:12px;opacity:0.8;}
  .net .amt{font-size:22px;font-weight:bold;color:#bd7214;}
  .footer{margin-top:16px;font-size:10px;color:#999;text-align:center;border-top:1px solid #eee;padding-top:10px;}
  .status{display:inline-block;background:#d4edda;color:#155724;padding:2px 10px;border-radius:10px;font-size:10px;font-weight:bold;}
</style></head>
<body>
<div class="hdr">
  <div><h1>${COMPANY.shortName} ERP</h1><div class="sub">${COMPANY.name}</div><div class="sub">${COMPANY.address}</div></div>
  <div style="text-align:right"><div class="badge">PAYSLIP</div><div class="sub" style="margin-top:6px">${MONTHS[month-1]} ${year}</div></div>
</div>
<div class="body">
  <div class="meta">
    <div><span class="ml">Employee</span><div class="mv">${empName}</div></div>
    <div><span class="ml">Pay Period</span><div class="mv">${MONTHS[month-1]} ${year}</div></div>
    <div><span class="ml">Status</span><div><span class="status">${(row.status||'draft').toUpperCase()}</span></div></div>
    <div><span class="ml">OT Hours</span><div class="mv">${Number(row.overtime_hours||0).toFixed(2)} hrs</div></div>
  </div>
  <table><thead><tr><th>Earnings</th><th style="text-align:right">Amount (AED)</th></tr></thead><tbody>
    <tr><td>Basic Salary</td><td style="text-align:right">${fmtAED(basic)}</td></tr>
    ${housing>0?`<tr><td>Housing Allowance</td><td style="text-align:right">${fmtAED(housing)}</td></tr>`:''}
    ${transport>0?`<tr><td>Transport Allowance</td><td style="text-align:right">${fmtAED(transport)}</td></tr>`:''}
    ${other>0?`<tr><td>Other Allowance</td><td style="text-align:right">${fmtAED(other)}</td></tr>`:''}
    ${otPay>0?`<tr><td>Overtime Pay (${Number(row.overtime_hours||0).toFixed(2)} hrs)</td><td style="text-align:right">${fmtAED(otPay)}</td></tr>`:''}
    ${bonus>0?`<tr><td>Special Bonus</td><td style="text-align:right">${fmtAED(bonus)}</td></tr>`:''}
    <tr class="tr"><td>Total Earnings</td><td style="text-align:right">${fmtAED(totalEarnings)}</td></tr>
  </tbody></table>
  <table><thead><tr><th>Deductions</th><th style="text-align:right">Amount (AED)</th></tr></thead><tbody>
    ${leaveDeduct>0?`<tr><td>Leave Deduction (${row.annual_leave_days||0} days)</td><td style="text-align:right">- ${fmtAED(leaveDeduct)}</td></tr>`:'<tr><td colspan="2" style="color:#999">No deductions</td></tr>'}
    <tr class="tr"><td>Total Deductions</td><td style="text-align:right">- ${fmtAED(leaveDeduct)}</td></tr>
  </tbody></table>
  <div class="net">
    <div><div class="lbl">NET SALARY PAYABLE</div><div style="font-size:10px;opacity:0.6">${MONTHS[month-1]} ${year}</div></div>
    <div class="amt">${fmtAED(net)}</div>
  </div>
  <div class="footer">${COMPANY.name} | ${COMPANY.address} | ${COMPANY.phone} | ${COMPANY.email}<br/>Computer-generated payslip — no signature required.</div>
</div></body></html>`;
}

function downloadPayslip(row: any, empName: string, month: number, year: number) {
  const html = generatePayslipHTML(row, empName, month, year);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Payslip_${empName.replace(/\s+/g,'_')}_${MONTHS[month-1]}_${year}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

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
                {r.status === "approved" && (
                  <Button size="sm" variant="outline" className="text-primary border-primary/40" onClick={() => downloadPayslip(r, empName(r.employee_id), month, year)}>
                    <FileDown className="h-3 w-3 mr-1" /> Payslip
                  </Button>
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
