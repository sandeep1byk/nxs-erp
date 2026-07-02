import { useState } from "react";
import { PageHeader, useList, useSave, useRemove, StatusBadge } from "@/components/common";
import { DataTable } from "@/components/data-table";
import { FormDialog, FormFieldDef } from "@/components/crud-kit";
import { SignatureCapture } from "@/components/signature-pad";
import { PrintDialog, SignatureLines } from "@/components/print-doc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Printer, X } from "lucide-react";
import { fmtDate, nextNumber } from "@/lib/nxs";
import { useAuth } from "@/lib/auth";
import { Progress } from "@/components/ui/progress";

function PhotoUrls({ photos, onChange }: { photos: string[]; onChange: (p: string[]) => void }) {
  const list = photos || [];
  return (
    <div className="space-y-2 sm:col-span-2">
      <div className="text-sm font-medium">Photo URLs</div>
      {list.map((p, i) => (
        <div key={i} className="flex gap-2">
          <Input value={p} onChange={(e) => onChange(list.map((x, idx) => idx === i ? e.target.value : x))} placeholder="https://...supabase.co/storage/..." />
          <button type="button" className="text-destructive" onClick={() => onChange(list.filter((_, idx) => idx !== i))}><X className="h-4 w-4" /></button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...list, ""])}>+ Add photo URL</Button>
    </div>
  );
}

export default function SiteReports() {
  const { user } = useAuth();
  const { data, isLoading } = useList("site_progress_reports");
  const { data: projects } = useList("projects");
  const save = useSave("site_progress_reports");
  const remove = useRemove("site_progress_reports");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [printing, setPrinting] = useState<any>(null);

  const projName = (id: string) => (projects || []).find((p: any) => p.id === id)?.name || "—";

  const fields: FormFieldDef[] = [
    { name: "report_number", label: "Report No.", required: true },
    { name: "project_id", label: "Project", type: "select", required: true, options: (projects || []).map((p: any) => ({ value: p.id, label: p.name })) },
    { name: "report_date", label: "Report Date", type: "date" },
    { name: "period_from", label: "Period From", type: "date" },
    { name: "period_to", label: "Period To", type: "date" },
    { name: "overall_progress", label: "Overall Progress %", type: "number" },
    { name: "status", label: "Status", type: "select", options: ["draft", "signed", "submitted"].map((s) => ({ value: s, label: s })) },
    { name: "work_completed", label: "Work Completed", type: "textarea" },
    { name: "work_in_progress", label: "Work In Progress", type: "textarea" },
    { name: "issues", label: "Issues / Delays", type: "textarea" },
    { name: "next_period_plan", label: "Next Period Plan", type: "textarea" },
    { name: "authorized_by", label: "Authorized By" },
    { name: "authorized_title", label: "Authorized Title" },
  ];

  return (
    <div>
      <PageHeader title="Site Progress Reports" subtitle="Mobile-friendly reports with photos & digital signature"
        actions={<Button onClick={() => { setEditing({ report_number: nextNumber("NXS-SPR"), report_date: new Date().toISOString().slice(0, 10), status: "draft", overall_progress: 0, reported_by: user?.id, photos: [] }); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New Report</Button>} />
      <DataTable rows={data} loading={isLoading}
        columns={[
          { header: "Report No.", cell: (r: any) => <span className="font-mono text-xs">{r.report_number}</span> },
          { header: "Project", cell: (r: any) => projName(r.project_id) },
          { header: "Date", cell: (r: any) => fmtDate(r.report_date) },
          { header: "Progress", cell: (r: any) => <div className="flex items-center gap-2 w-32"><Progress value={r.overall_progress || 0} className="h-2" /><span className="text-xs">{r.overall_progress || 0}%</span></div> },
          { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
          { header: "", cell: (r: any) => <Button size="sm" variant="outline" onClick={() => setPrinting(r)}><Printer className="h-4 w-4" /></Button> },
        ]}
        onEdit={(r) => { setEditing(r); setOpen(true); }} onDelete={(r) => remove.mutate(r.id)} />

      <FormDialog open={open} onClose={() => setOpen(false)} title={editing?.id ? "Edit Report" : "New Site Progress Report"}
        fields={fields} initial={editing} saving={save.isPending}
        onSave={(v) => save.mutate(v, { onSuccess: () => setOpen(false) })}
        extra={(values, set) => (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PhotoUrls photos={values.photos || []} onChange={(photos) => set({ ...values, photos })} />
            </div>
            <SignatureCapture value={values.signature_url} onChange={(sig) => set({ ...values, signature_url: sig, status: sig ? "signed" : values.status })} />
          </div>
        )} />

      {printing && (
        <PrintDialog open={!!printing} onClose={() => setPrinting(null)} title={`Site Report ${printing.report_number}`}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0c1125", marginBottom: 4 }}>SITE PROGRESS REPORT</h2>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
            <div><b>Project:</b> {projName(printing.project_id)}</div>
            <div style={{ textAlign: "right" }}>
              <div><b>Report No:</b> {printing.report_number}</div>
              <div><b>Date:</b> {fmtDate(printing.report_date)}</div>
              <div><b>Period:</b> {fmtDate(printing.period_from)} – {fmtDate(printing.period_to)}</div>
            </div>
          </div>
          <div style={{ margin: "12px 0", fontSize: 14 }}><b>Overall Progress: {printing.overall_progress || 0}%</b>
            <div style={{ height: 10, background: "#eee", borderRadius: 5, marginTop: 4 }}>
              <div style={{ height: 10, width: `${printing.overall_progress || 0}%`, background: "#bd7214", borderRadius: 5 }} />
            </div>
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.6 }}>
            <p><b>Work Completed:</b> {printing.work_completed || "—"}</p>
            <p><b>Work In Progress:</b> {printing.work_in_progress || "—"}</p>
            <p><b>Issues / Delays:</b> {printing.issues || "—"}</p>
            <p><b>Next Period Plan:</b> {printing.next_period_plan || "—"}</p>
          </div>
          {(printing.photos || []).length > 0 && (
            <div style={{ marginTop: 12 }}>
              <b style={{ fontSize: 13 }}>Site Photos</b>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 6 }}>
                {(printing.photos || []).map((url: string, i: number) => (
                  <img key={i} src={url} alt={`Photo ${i + 1}`} style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 4, border: "1px solid #ddd" }} />
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40, fontSize: 12 }}>
            <div style={{ width: "40%" }}>
              {printing.signature_url && <img src={printing.signature_url} alt="signature" style={{ height: 60 }} />}
              <div style={{ borderTop: "1px solid #333", paddingTop: 6 }}>{printing.authorized_by || "Reported By"}<br />{printing.authorized_title || ""}</div>
            </div>
            <div style={{ width: "40%", textAlign: "right" }}>
              <div style={{ borderTop: "1px solid #333", paddingTop: 6, marginTop: 60 }}>Client Representative</div>
            </div>
          </div>
        </PrintDialog>
      )}
    </div>
  );
}
