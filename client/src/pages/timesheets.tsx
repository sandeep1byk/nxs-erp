import { useState } from "react";
import { PageHeader, useList, useRemove } from "@/components/common";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { Plus, Loader2, Clock } from "lucide-react";
import { fmtDate } from "@/lib/nxs";
import { useToast } from "@/hooks/use-toast";

// OT Calculation:
// Mandatory hours/month = 9 hrs/day × 26 working days (4 holidays/month) = 234 hrs
// OT = total hours worked - 9 (daily basis per entry)
// Hourly OT rate = (basic_salary / 234) * 1.5
const DAILY_WORK_HOURS = 9;

function calcHours(startDt: string, endDt: string): { regular: number; overtime: number; totalHours: number } {
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

function toLocalDatetime(dt: string | null | undefined): string {
  if (!dt) return "";
  // Parse existing ISO string and convert to local datetime-local input format
  const d = new Date(dt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtHours(h: number) {
  if (!h) return "0h";
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function fmtDatetime(dt: string | null | undefined) {
  if (!dt) return "—";
  const d = new Date(dt);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + " " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

interface TimesheetForm {
  id?: string;
  employee_id: string;
  project_id: string;
  start_datetime: string;
  end_datetime: string;
  notes: string;
}

export default function Timesheets() {
  const { data, isLoading } = useList("timesheets");
  const { data: employees } = useList("employees");
  const { data: projects } = useList("projects");
  const remove = useRemove("timesheets");
  const { toast } = useToast();

  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const defaultStart = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T08:00`;
  const defaultEnd = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T17:00`;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TimesheetForm>({
    employee_id: "", project_id: "",
    start_datetime: defaultStart,
    end_datetime: defaultEnd,
    notes: "",
  });

  const empName = (id: string) => (employees || []).find((e: any) => e.id === id)?.full_name || "—";
  const projName = (id: string) => (projects || []).find((p: any) => p.id === id)?.name || "—";

  const { regular, overtime, totalHours } = calcHours(form.start_datetime, form.end_datetime);

  const save = useMutation({
    mutationFn: async (values: any) => {
      if (values.id) {
        return (await apiRequest("PUT", `/api/timesheets/${values.id}`, values)).json();
      }
      return (await apiRequest("POST", "/api/timesheets", values)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      setOpen(false);
      resetForm();
      toast({ title: "Timesheet entry saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function resetForm() {
    setForm({ employee_id: "", project_id: "", start_datetime: defaultStart, end_datetime: defaultEnd, notes: "" });
  }

  function handleStartChange(val: string) {
    // When start changes, keep same-day end date if end was same day as old start
    setForm((f) => {
      const oldStartDate = f.start_datetime.slice(0, 10);
      const endDate = f.end_datetime.slice(0, 10);
      const newStartDate = val.slice(0, 10);
      // If end date was same as old start date, update end date to match new start date
      const newEndDate = endDate === oldStartDate ? newStartDate : endDate;
      const newEndTime = f.end_datetime.slice(11) || "17:00";
      return { ...f, start_datetime: val, end_datetime: `${newEndDate}T${newEndTime}` };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employee_id) return toast({ title: "Please select an employee", variant: "destructive" });
    if (!form.start_datetime || !form.end_datetime) return toast({ title: "Please fill start and end date/time", variant: "destructive" });
    if (new Date(form.end_datetime) <= new Date(form.start_datetime))
      return toast({ title: "End time must be after start time", variant: "destructive" });

    const { regular: reg, overtime: ot } = calcHours(form.start_datetime, form.end_datetime);
    save.mutate({
      ...form,
      // also store legacy columns so payroll generate still works
      work_date: form.start_datetime.slice(0, 10),
      hours_regular: reg,
      hours_overtime: ot,
    });
  }

  return (
    <div>
      <PageHeader
        title="Timesheets"
        subtitle="Daily hours per employee — start/end times auto-calculate regular & overtime"
        actions={
          <Button data-testid="button-add-timesheet" onClick={() => { resetForm(); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Entry
          </Button>
        }
      />

      <DataTable
        rows={data}
        loading={isLoading}
        columns={[
          { header: "Date", cell: (r: any) => fmtDate(r.work_date || r.start_datetime) },
          { header: "Employee", cell: (r: any) => empName(r.employee_id) },
          { header: "Project", cell: (r: any) => projName(r.project_id) },
          { header: "Start", cell: (r: any) => r.start_datetime ? fmtDatetime(r.start_datetime) : (r.work_date ? fmtDate(r.work_date) + " (legacy)" : "—") },
          { header: "End", cell: (r: any) => r.end_datetime ? fmtDatetime(r.end_datetime) : "—" },
          { header: "Regular", cell: (r: any) => fmtHours(Number(r.hours_regular) || 0) },
          { header: "Overtime", cell: (r: any) => <span className={Number(r.hours_overtime) > 0 ? "text-amber-600 font-semibold" : ""}>{fmtHours(Number(r.hours_overtime) || 0)}</span> },
          { header: "Notes", cell: (r: any) => <span className="text-xs text-muted-foreground truncate max-w-32 block">{r.notes || ""}</span> },
        ]}
        onDelete={(r) => remove.mutate(r.id)}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" /> Add Timesheet Entry
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label htmlFor="ts-employee">Employee *</Label>
                <Select value={form.employee_id} onValueChange={(v) => setForm((f) => ({ ...f, employee_id: v }))}>
                  <SelectTrigger id="ts-employee" data-testid="select-employee">
                    <SelectValue placeholder="Select employee…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(employees || []).map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <Label htmlFor="ts-project">Project (optional)</Label>
                <Select value={form.project_id} onValueChange={(v) => setForm((f) => ({ ...f, project_id: v }))}>
                  <SelectTrigger id="ts-project" data-testid="select-project">
                    <SelectValue placeholder="Select project…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(projects || []).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="ts-start">Start Date & Time *</Label>
                <Input
                  id="ts-start"
                  data-testid="input-start-datetime"
                  type="datetime-local"
                  value={form.start_datetime}
                  onChange={(e) => handleStartChange(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="ts-end">End Date & Time *</Label>
                <Input
                  id="ts-end"
                  data-testid="input-end-datetime"
                  type="datetime-local"
                  value={form.end_datetime}
                  onChange={(e) => setForm((f) => ({ ...f, end_datetime: e.target.value }))}
                  required
                />
                <p className="text-[11px] text-muted-foreground mt-1">Can be next day for overnight shifts</p>
              </div>
            </div>

            {/* Auto-calculated hours display */}
            {totalHours > 0 && (
              <div className="rounded-lg border bg-muted/40 p-3 grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-lg font-bold text-foreground">{fmtHours(totalHours)}</div>
                  <div className="text-[11px] text-muted-foreground">Total Hours</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-700">{fmtHours(regular)}</div>
                  <div className="text-[11px] text-muted-foreground">Regular (≤9h)</div>
                </div>
                <div>
                  <div className={`text-lg font-bold ${overtime > 0 ? "text-amber-600" : "text-muted-foreground"}`}>{fmtHours(overtime)}</div>
                  <div className="text-[11px] text-muted-foreground">Overtime</div>
                </div>
              </div>
            )}

            {totalHours > 0 && (
              <p className="text-[11px] text-muted-foreground">
                OT basis: 9 hrs/day regular. Overtime = hours beyond 9. Monthly OT rate = (basic ÷ 234) × 1.5
              </p>
            )}

            <div>
              <Label htmlFor="ts-notes">Notes</Label>
              <Textarea
                id="ts-notes"
                data-testid="input-notes"
                placeholder="Work done, location, etc."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={save.isPending} data-testid="button-save-timesheet">
                {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Save Entry
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
