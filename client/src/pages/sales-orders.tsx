import { useState } from "react";
import { PageHeader, useList, useSave, useRemove, StatusBadge } from "@/components/common";
import { DataTable } from "@/components/data-table";
import { DocUploader, DocSlot } from "@/components/doc-uploader";
import { QuickAddSelect } from "@/components/quick-add-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2 } from "lucide-react";
import { fmtDate, fmtAED, nextNumber } from "@/lib/nxs";

const SO_DOC_SLOTS: DocSlot[] = [
  { key: "client_lpo", label: "Client LPO", doc_category: "client_lpo" },
  { key: "signed_contract", label: "Signed Contract", doc_category: "contract" },
  { key: "signed_invoice", label: "Signed Invoice / Delivery Note", doc_category: "signed_invoice" },
  { key: "other", label: "Other Document", doc_category: "other" },
];

const STATUSES = ["draft", "active", "completed", "cancelled"];

export default function SalesOrders() {
  const { data, isLoading } = useList("sales_orders");
  const { data: clients } = useList("clients");
  const { data: projects } = useList("projects");
  const { data: quotations } = useList("quotations");
  const remove = useRemove("sales_orders");
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});

  const clientName = (id: string) => (clients || []).find((c: any) => c.id === id)?.name || "—";
  const projName = (id: string) => (projects || []).find((p: any) => p.id === id)?.name || "—";

  const save = useMutation({
    mutationFn: async () => {
      if (!form.so_number) throw new Error("SO Number is required");
      if (!form.client_id) throw new Error("Client is required");
      const method = form.id ? "PUT" : "POST";
      const url = form.id ? `/api/sales_orders/${form.id}` : "/api/sales_orders";
      return (await apiRequest(method, url, form)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales_orders"] });
      toast({ title: "Sales order saved" });
      setOpen(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openNew() {
    setForm({ so_number: nextNumber("NXS-SO"), order_date: new Date().toISOString().slice(0, 10), status: "draft" });
    setOpen(true);
  }

  function openEdit(r: any) {
    setForm(r);
    setOpen(true);
  }

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <div>
      <PageHeader title="Sales Orders / Contracts" subtitle="Confirmed client contracts with LPO document upload"
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New Sales Order</Button>} />
      <DataTable rows={data} loading={isLoading}
        columns={[
          { header: "SO No.", cell: (r: any) => <span className="font-mono text-xs">{r.so_number}</span> },
          { header: "Client", cell: (r: any) => clientName(r.client_id) },
          { header: "Project", cell: (r: any) => projName(r.project_id) },
          { header: "Date", cell: (r: any) => fmtDate(r.order_date) },
          { header: "Value", cell: (r: any) => fmtAED(r.contract_value) },
          { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
        ]}
        onEdit={openEdit}
        onDelete={(r) => remove.mutate(r.id)} />

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Sales Order" : "New Sales Order"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-2">
            {/* SO Number */}
            <div className="space-y-1.5">
              <Label>SO Number *</Label>
              <Input value={form.so_number || ""} onChange={(e) => set("so_number", e.target.value)} data-testid="input-so-number" />
            </div>

            {/* Client with quick-add */}
            <div className="space-y-1.5">
              <Label>Client *</Label>
              <QuickAddSelect
                type="client"
                options={(clients || []).map((c: any) => ({ value: c.id, label: c.name }))}
                value={form.client_id || ""}
                onChange={(v) => set("client_id", v)}
                data-testid="select-client"
              />
            </div>

            {/* From Quotation */}
            <div className="space-y-1.5">
              <Label>From Quotation</Label>
              <Select value={form.quot_id || ""} onValueChange={(v) => set("quot_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {(quotations || []).map((q: any) => <SelectItem key={q.id} value={q.id}>{q.quot_number}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Project with quick-add */}
            <div className="space-y-1.5">
              <Label>Project</Label>
              <QuickAddSelect
                type="project"
                options={(projects || []).map((p: any) => ({ value: p.id, label: p.name }))}
                value={form.project_id || ""}
                onChange={(v) => set("project_id", v)}
                data-testid="select-project"
              />
            </div>

            {/* Order Date */}
            <div className="space-y-1.5">
              <Label>Order Date</Label>
              <Input type="date" value={form.order_date || ""} onChange={(e) => set("order_date", e.target.value)} />
            </div>

            {/* Contract Value */}
            <div className="space-y-1.5">
              <Label>Contract Value (AED)</Label>
              <Input type="number" value={form.contract_value || ""} onChange={(e) => set("contract_value", e.target.value)} />
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status || "draft"} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="col-span-2 space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} rows={2} />
            </div>

            {/* Document upload */}
            <div className="col-span-2">
              <DocUploader
                slots={SO_DOC_SLOTS}
                entityType="sales_order"
                entityId={form.id || form.so_number}
                entityLabel={`${form.so_number} — ${clientName(form.client_id)}`}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-so">
              {save.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
