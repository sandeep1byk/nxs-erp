import { useState } from "react";
import { PageHeader, useList, useSave, useRemove } from "@/components/common";
import { DataTable } from "@/components/data-table";
import { FormDialog, FormFieldDef } from "@/components/crud-kit";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { fmtDate } from "@/lib/nxs";

export default function Timesheets() {
  const { data, isLoading } = useList("timesheets");
  const { data: employees } = useList("employees");
  const { data: projects } = useList("projects");
  const save = useSave("timesheets");
  const remove = useRemove("timesheets");
  const [open, setOpen] = useState(false);

  const empName = (id: string) => (employees || []).find((e: any) => e.id === id)?.full_name || "—";
  const projName = (id: string) => (projects || []).find((p: any) => p.id === id)?.name || "—";

  const fields: FormFieldDef[] = [
    { name: "employee_id", label: "Employee", type: "select", required: true, options: (employees || []).map((e: any) => ({ value: e.id, label: e.full_name })) },
    { name: "project_id", label: "Project", type: "select", options: (projects || []).map((p: any) => ({ value: p.id, label: p.name })) },
    { name: "work_date", label: "Work Date", type: "date", required: true },
    { name: "hours_regular", label: "Regular Hours", type: "number" },
    { name: "hours_overtime", label: "Overtime Hours", type: "number" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  return (
    <div>
      <PageHeader title="Timesheets" subtitle="Daily hours per employee per project"
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Entry</Button>} />
      <DataTable rows={data} loading={isLoading}
        columns={[
          { header: "Date", cell: (r: any) => fmtDate(r.work_date) },
          { header: "Employee", cell: (r: any) => empName(r.employee_id) },
          { header: "Project", cell: (r: any) => projName(r.project_id) },
          { header: "Regular", cell: (r: any) => r.hours_regular ?? 0 },
          { header: "Overtime", cell: (r: any) => r.hours_overtime ?? 0 },
        ]}
        onDelete={(r) => remove.mutate(r.id)} />
      <FormDialog open={open} onClose={() => setOpen(false)} title="Add Timesheet Entry"
        fields={fields} initial={{ work_date: new Date().toISOString().slice(0, 10), hours_regular: 8, hours_overtime: 0 }}
        saving={save.isPending}
        onSave={(v) => save.mutate(v, { onSuccess: () => setOpen(false) })} />
    </div>
  );
}
