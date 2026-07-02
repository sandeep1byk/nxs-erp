import { ReactNode, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Field } from "./common";
import { Loader2 } from "lucide-react";

export type FieldType = "text" | "number" | "date" | "textarea" | "select" | "email";
export interface FormFieldDef {
  name: string;
  label: string;
  type?: FieldType;
  options?: { value: string; label: string }[];
  required?: boolean;
  col?: 1 | 2; // grid span
  placeholder?: string;
}

export function FormDialog({
  open, onClose, title, fields, initial, onSave, saving, extra,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  fields: FormFieldDef[];
  initial?: Record<string, any>;
  onSave: (values: Record<string, any>) => void;
  saving?: boolean;
  extra?: (values: Record<string, any>, set: (v: Record<string, any>) => void) => ReactNode;
}) {
  const [values, setValues] = useState<Record<string, any>>(initial || {});
  useEffect(() => { setValues(initial || {}); }, [initial, open]);

  const set = (name: string, val: any) => setValues((v) => ({ ...v, [name]: val }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(values);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map((f) => (
              <Field key={f.name} label={f.label + (f.required ? " *" : "")}
                className={f.col === 2 || f.type === "textarea" ? "sm:col-span-2" : ""}>
                {f.type === "textarea" ? (
                  <Textarea value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)}
                    required={f.required} placeholder={f.placeholder} rows={3} />
                ) : f.type === "select" ? (
                  <Select value={values[f.name] ?? ""} onValueChange={(v) => set(f.name, v)}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {(f.options || []).map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "email" ? "email" : "text"}
                    step={f.type === "number" ? "any" : undefined}
                    value={values[f.name] ?? ""} required={f.required} placeholder={f.placeholder}
                    onChange={(e) => set(f.name, f.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)} />
                )}
              </Field>
            ))}
          </div>
          {extra && extra(values, setValues)}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Simple line-items editor for quotations/POs/invoices/PRs
export function LineItemsEditor({
  items, onChange, showUnit = true,
}: {
  items: any[];
  onChange: (items: any[]) => void;
  showUnit?: boolean;
}) {
  const rows = items && items.length ? items : [];
  const update = (i: number, key: string, val: any) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r));
    if (key === "quantity" || key === "unit_price") {
      const r = next[i];
      r.amount = Math.round(Number(r.quantity || 0) * Number(r.unit_price || 0) * 100) / 100;
    }
    onChange(next);
  };
  const add = () => onChange([...rows, { description: "", quantity: 1, unit: "", unit_price: 0, amount: 0 }]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Line Items</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground text-xs">
              <th className="pb-1">Description</th>
              <th className="pb-1 w-20">Qty</th>
              {showUnit && <th className="pb-1 w-20">Unit</th>}
              <th className="pb-1 w-28">Unit Price</th>
              <th className="pb-1 w-28">Amount</th>
              <th className="pb-1 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="pr-1 py-1"><Input value={r.description ?? ""} onChange={(e) => update(i, "description", e.target.value)} /></td>
                <td className="pr-1"><Input type="number" step="any" value={r.quantity ?? ""} onChange={(e) => update(i, "quantity", Number(e.target.value))} /></td>
                {showUnit && <td className="pr-1"><Input value={r.unit ?? ""} onChange={(e) => update(i, "unit", e.target.value)} /></td>}
                <td className="pr-1"><Input type="number" step="any" value={r.unit_price ?? ""} onChange={(e) => update(i, "unit_price", Number(e.target.value))} /></td>
                <td className="pr-1"><Input readOnly value={(r.amount ?? 0).toFixed(2)} /></td>
                <td><button type="button" onClick={() => remove(i)} className="text-destructive text-xs px-1">✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={add}>+ Add item</Button>
    </div>
  );
}
