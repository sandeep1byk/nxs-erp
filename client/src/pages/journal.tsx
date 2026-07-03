import { useState } from "react";
import { PageHeader, useList, useSave, useRemove, StatusBadge } from "@/components/common";
import { DataTable } from "@/components/data-table";
import { FormDialog, FormFieldDef } from "@/components/crud-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { fmtDate, fmtAED, nextNumber } from "@/lib/nxs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

function LinesEditor({ lines, accounts, onChange }: { lines: any[]; accounts: any[]; onChange: (l: any[]) => void }) {
  const rows = lines || [];
  const upd = (i: number, k: string, v: any) => onChange(rows.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const totalD = rows.reduce((s, r) => s + Number(r.debit || 0), 0);
  const totalC = rows.reduce((s, r) => s + Number(r.credit || 0), 0);
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Journal Lines</div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center">
          <div className="col-span-6">
            <Select value={r.account_id ?? ""} onValueChange={(v) => { const a = accounts.find((x) => x.id === v); onChange(rows.map((row, idx) => idx === i ? { ...row, account_id: v, account_name: a?.name } : row)); }}>
              <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
              <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.account_code} — {a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Input className="col-span-3" type="number" placeholder="Debit" value={r.debit ?? ""} onChange={(e) => upd(i, "debit", Number(e.target.value))} />
          <Input className="col-span-2" type="number" placeholder="Credit" value={r.credit ?? ""} onChange={(e) => upd(i, "credit", Number(e.target.value))} />
          <button type="button" className="col-span-1 text-destructive" onClick={() => onChange(rows.filter((_, idx) => idx !== i))}>✕</button>
        </div>
      ))}
      <div className="flex justify-between text-xs text-muted-foreground">
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, { debit: 0, credit: 0 }])}>+ Add line</Button>
        <span className={totalD === totalC ? "text-green-600" : "text-destructive"}>Dr {fmtAED(totalD)} / Cr {fmtAED(totalC)} {totalD === totalC ? "✓ balanced" : "✗ unbalanced"}</span>
      </div>
    </div>
  );
}

function ViewPanel({ entry, accounts, onEdit, onDelete, onClose }: { entry: any; accounts: any[]; onEdit: () => void; onDelete: () => void; onClose: () => void }) {
  if (!entry) return null;
  const lines: any[] = Array.isArray(entry.lines) ? entry.lines : (typeof entry.lines === "string" ? (() => { try { return JSON.parse(entry.lines); } catch { return []; } })() : []);
  const totalD = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalC = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const acctName = (id: string, fallback?: string) => {
    if (fallback) return fallback;
    const a = (accounts || []).find((x: any) => x.id === id);
    return a ? `${a.account_code} — ${a.name}` : "—";
  };
  return (
    <Dialog open={!!entry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="font-mono text-sm">{entry.entry_number}</span>
            <StatusBadge status={entry.status} />
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><div className="text-muted-foreground text-xs">Date</div><div>{fmtDate(entry.entry_date)}</div></div>
            <div><div className="text-muted-foreground text-xs">Reference</div><div>{entry.reference || "—"}</div></div>
            <div className="col-span-2"><div className="text-muted-foreground text-xs">Description</div><div>{entry.description || "—"}</div></div>
          </div>
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr><th className="text-left p-2">Account</th><th className="text-right p-2 w-32">Debit</th><th className="text-right p-2 w-32">Credit</th></tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr><td colSpan={3} className="text-center p-4 text-muted-foreground">No lines</td></tr>
                ) : lines.map((l, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{acctName(l.account_id, l.account_name)}</td>
                    <td className="p-2 text-right font-mono">{Number(l.debit || 0) ? fmtAED(l.debit) : ""}</td>
                    <td className="p-2 text-right font-mono">{Number(l.credit || 0) ? fmtAED(l.credit) : ""}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30 font-medium">
                <tr><td className="p-2">Total</td><td className="p-2 text-right font-mono">{fmtAED(totalD)}</td><td className="p-2 text-right font-mono">{fmtAED(totalC)}</td></tr>
              </tfoot>
            </table>
          </div>
        </div>
        <DialogFooter className="flex sm:justify-between gap-2">
          <Button variant="destructive" onClick={onDelete}><Trash2 className="h-4 w-4 mr-1" /> Delete</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={onEdit}><Pencil className="h-4 w-4 mr-1" /> Edit</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Journal() {
  const { data, isLoading } = useList("journal_entries");
  const { data: accounts } = useList("accounts");
  const { data: projects } = useList("projects");
  const save = useSave("journal_entries");
  const remove = useRemove("journal_entries");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [viewing, setViewing] = useState<any>(null);

  const fields: FormFieldDef[] = [
    { name: "entry_number", label: "Entry No.", required: true },
    { name: "entry_date", label: "Date", type: "date", required: true },
    { name: "reference", label: "Reference" },
    { name: "project_id", label: "Project", type: "select", options: (projects || []).map((p: any) => ({ value: p.id, label: p.name })) },
    { name: "status", label: "Status", type: "select", options: [{ value: "posted", label: "Posted" }, { value: "draft", label: "Draft" }] },
    { name: "description", label: "Description", type: "textarea", col: 2 },
  ];

  return (
    <div>
      <PageHeader title="Journal Entries" subtitle="General ledger postings"
        actions={<Button onClick={() => { setEditing({ entry_number: nextNumber("NXS-JV"), entry_date: new Date().toISOString().slice(0, 10), status: "posted", lines: [] }); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New Entry</Button>} />
      <DataTable rows={data} loading={isLoading}
        columns={[
          { header: "Entry No.", cell: (r: any) => <span className="font-mono text-xs">{r.entry_number}</span> },
          { header: "Date", cell: (r: any) => fmtDate(r.entry_date) },
          { header: "Description", cell: (r: any) => r.description || "—" },
          { header: "Debit", cell: (r: any) => fmtAED(r.total_debit) },
          { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
        ]}
        onRowClick={(r) => setViewing(r)} />
      <ViewPanel entry={viewing} accounts={accounts || []}
        onEdit={() => { setEditing(viewing); setViewing(null); setOpen(true); }}
        onDelete={() => { if (confirm("Delete this entry?")) { remove.mutate(viewing.id); setViewing(null); } }}
        onClose={() => setViewing(null)} />
      <FormDialog open={open} onClose={() => setOpen(false)} title={editing?.id ? "Edit Entry" : "New Journal Entry"}
        fields={fields} initial={editing} saving={save.isPending}
        onSave={(v) => { const td = (v.lines || []).reduce((s: number, l: any) => s + Number(l.debit || 0), 0); const tc = (v.lines || []).reduce((s: number, l: any) => s + Number(l.credit || 0), 0); save.mutate({ ...v, total_debit: td, total_credit: tc, status: v.status || "posted" }, { onSuccess: () => setOpen(false) }); }}
        extra={(values, set) => <LinesEditor lines={values.lines || []} accounts={accounts || []} onChange={(lines) => set({ ...values, lines })} />} />
    </div>
  );
}
