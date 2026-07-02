import { useState } from "react";
import { PageHeader, useList } from "@/components/common";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { fmtAED } from "@/lib/nxs";
import { StatusBadge } from "@/components/common";
import { Loader2, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function Payroll() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const { data, isLoading } = useList("payroll");
  const { data: employees } = useList("employees");
  const empName = (id: string) => (employees || []).find((e: any) => e.id === id)?.full_name || "—";

  const gen = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/payroll/generate", { month, year })).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/payroll"] }),
  });

  const approve = useMutation({
    mutationFn: async (row: any) => (await apiRequest("PUT", `/api/payroll/${row.id}`, { status: "approved" })).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/payroll"] }),
  });

  const rows = (data || []).filter((p: any) => p.month === month && p.year === year);
  const total = rows.reduce((s: number, r: any) => s + (Number(r.net_salary) || 0), 0);

  return (
    <div>
      <PageHeader title="Payroll" subtitle="Auto-generate monthly payroll from salaries and overtime"
        actions={
          <div className="flex gap-2 items-center">
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <Input type="number" className="w-24" value={year} onChange={(e) => setYear(Number(e.target.value))} />
            <Button onClick={() => gen.mutate()} disabled={gen.isPending}>
              {gen.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}<Wallet className="h-4 w-4 mr-1" /> Generate
            </Button>
          </div>
        } />
      {rows.length > 0 && (
        <Card className="mb-4"><CardContent className="py-4 flex justify-between items-center">
          <span className="text-sm text-muted-foreground">{MONTHS[month - 1]} {year} — {rows.length} employees</span>
          <span className="text-lg font-bold">Total Net Payroll: {fmtAED(total)}</span>
        </CardContent></Card>
      )}
      <DataTable rows={rows} loading={isLoading}
        columns={[
          { header: "Employee", cell: (r: any) => <span className="font-medium">{empName(r.employee_id)}</span> },
          { header: "Basic", cell: (r: any) => fmtAED(r.basic_salary) },
          { header: "Allowances", cell: (r: any) => fmtAED((r.housing_allowance || 0) + (r.transport_allowance || 0) + (r.other_allowance || 0)) },
          { header: "Overtime", cell: (r: any) => fmtAED(r.overtime_pay) },
          { header: "Net Salary", cell: (r: any) => <span className="font-semibold">{fmtAED(r.net_salary)}</span> },
          { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
          { header: "", cell: (r: any) => r.status === "draft" ? <Button size="sm" variant="outline" onClick={() => approve.mutate(r)}>Approve</Button> : null },
        ]}
        emptyMessage="No payroll for this period. Click Generate to create it." />
    </div>
  );
}
