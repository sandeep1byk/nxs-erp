import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, useList, useSave, useRemove } from "@/components/common";
import { DataTable } from "@/components/data-table";
import { FormDialog, FormFieldDef } from "@/components/crud-kit";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { fmtAED, fmtDate } from "@/lib/nxs";
import { useAuth } from "@/lib/auth";

export default function Inventory() {
  const { user } = useAuth();
  const items = useList("inventory_items");
  const locations = useList("stock_locations");
  const projects = useList("projects");
  const ledger = useList("stock_ledger");
  const balances = useQuery<any[]>({ queryKey: ["/api/stock/balances"] });

  const saveItem = useSave("inventory_items");
  const removeItem = useRemove("inventory_items");
  const saveLoc = useSave("stock_locations");
  const saveMove = useSave("stock_ledger", ["/api/stock/balances"]);

  const [itemOpen, setItemOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [locOpen, setLocOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);

  const itemName = (id: string) => (items.data || []).find((i: any) => i.id === id)?.name || "—";
  const locName = (id: string) => (locations.data || []).find((l: any) => l.id === id)?.name || "—";

  const itemFields: FormFieldDef[] = [
    { name: "item_code", label: "Item Code", required: true },
    { name: "name", label: "Name", required: true },
    { name: "category", label: "Category" },
    { name: "unit", label: "Unit", placeholder: "bag / ton / roll" },
    { name: "unit_cost", label: "Unit Cost (AED)", type: "number" },
    { name: "reorder_level", label: "Reorder Level", type: "number" },
    { name: "description", label: "Description", type: "textarea" },
  ];
  const locFields: FormFieldDef[] = [
    { name: "name", label: "Location Name", required: true, col: 2 },
    { name: "type", label: "Type", type: "select", required: true, options: [{ value: "warehouse", label: "Warehouse" }, { value: "site", label: "Site" }] },
    { name: "project_id", label: "Linked Project", type: "select", options: (projects.data || []).map((p: any) => ({ value: p.id, label: p.name })) },
  ];
  const moveFields: FormFieldDef[] = [
    { name: "movement_type", label: "Movement Type", type: "select", required: true, options: ["receipt", "transfer", "consumption", "adjustment", "return"].map((s) => ({ value: s, label: s })) },
    { name: "item_id", label: "Item", type: "select", required: true, options: (items.data || []).map((i: any) => ({ value: i.id, label: `${i.item_code} — ${i.name}` })) },
    { name: "from_location_id", label: "From Location", type: "select", options: (locations.data || []).map((l: any) => ({ value: l.id, label: l.name })) },
    { name: "to_location_id", label: "To Location", type: "select", options: (locations.data || []).map((l: any) => ({ value: l.id, label: l.name })) },
    { name: "quantity", label: "Quantity", type: "number", required: true },
    { name: "unit_cost", label: "Unit Cost (AED)", type: "number" },
    { name: "project_id", label: "Allocate to Project", type: "select", options: (projects.data || []).map((p: any) => ({ value: p.id, label: p.name })) },
    { name: "movement_date", label: "Date", type: "date" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  return (
    <div>
      <PageHeader title="Inventory & Stock" subtitle="Item master, locations, movements and balances" />
      <Tabs defaultValue="balances">
        <TabsList>
          <TabsTrigger value="balances">Stock Balances</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
        </TabsList>

        <TabsContent value="balances">
          <DataTable rows={(balances.data || []).map((b: any, i: number) => ({ ...b, id: `${b.item_id}-${b.location_id}-${i}` }))} loading={balances.isLoading}
            columns={[
              { header: "Item", cell: (r: any) => `${r.item_code || ""} — ${r.item_name || ""}` },
              { header: "Location", cell: (r: any) => r.location_name },
              { header: "Type", cell: (r: any) => <span className="capitalize">{r.location_type}</span> },
              { header: "Quantity", cell: (r: any) => `${r.quantity} ${r.unit || ""}` },
            ]}
            emptyMessage="No stock on hand. Record a receipt movement to add stock." />
        </TabsContent>

        <TabsContent value="items">
          <div className="flex justify-end mb-3"><Button size="sm" onClick={() => { setEditItem({}); setItemOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New Item</Button></div>
          <DataTable rows={items.data} loading={items.isLoading}
            columns={[
              { header: "Code", cell: (r: any) => <span className="font-mono text-xs">{r.item_code}</span> },
              { header: "Name", cell: (r: any) => <span className="font-medium">{r.name}</span> },
              { header: "Category", cell: (r: any) => r.category || "—" },
              { header: "Unit", cell: (r: any) => r.unit || "—" },
              { header: "Unit Cost", cell: (r: any) => fmtAED(r.unit_cost) },
              { header: "Reorder", cell: (r: any) => r.reorder_level ?? "—" },
            ]}
            onEdit={(r) => { setEditItem(r); setItemOpen(true); }} onDelete={(r) => removeItem.mutate(r.id)} />
        </TabsContent>

        <TabsContent value="locations">
          <div className="flex justify-end mb-3"><Button size="sm" onClick={() => setLocOpen(true)}><Plus className="h-4 w-4 mr-1" /> New Location</Button></div>
          <DataTable rows={locations.data} loading={locations.isLoading}
            columns={[
              { header: "Name", cell: (r: any) => <span className="font-medium">{r.name}</span> },
              { header: "Type", cell: (r: any) => <span className="capitalize">{r.type}</span> },
            ]} />
        </TabsContent>

        <TabsContent value="movements">
          <div className="flex justify-end mb-3"><Button size="sm" onClick={() => setMoveOpen(true)}><Plus className="h-4 w-4 mr-1" /> Record Movement</Button></div>
          <DataTable rows={ledger.data} loading={ledger.isLoading}
            columns={[
              { header: "Date", cell: (r: any) => fmtDate(r.movement_date) },
              { header: "Type", cell: (r: any) => <span className="capitalize">{r.movement_type}</span> },
              { header: "Item", cell: (r: any) => itemName(r.item_id) },
              { header: "From", cell: (r: any) => r.from_location_id ? locName(r.from_location_id) : "—" },
              { header: "To", cell: (r: any) => r.to_location_id ? locName(r.to_location_id) : "—" },
              { header: "Qty", cell: (r: any) => r.quantity },
              { header: "Cost", cell: (r: any) => fmtAED(r.total_cost) },
            ]} />
        </TabsContent>
      </Tabs>

      <FormDialog open={itemOpen} onClose={() => setItemOpen(false)} title={editItem?.id ? "Edit Item" : "New Item"}
        fields={itemFields} initial={editItem} saving={saveItem.isPending}
        onSave={(v) => saveItem.mutate(v, { onSuccess: () => setItemOpen(false) })} />
      <FormDialog open={locOpen} onClose={() => setLocOpen(false)} title="New Location"
        fields={locFields} initial={{ type: "warehouse" }} saving={saveLoc.isPending}
        onSave={(v) => saveLoc.mutate(v, { onSuccess: () => setLocOpen(false) })} />
      <FormDialog open={moveOpen} onClose={() => setMoveOpen(false)} title="Record Stock Movement"
        fields={moveFields} initial={{ movement_type: "receipt", movement_date: new Date().toISOString().slice(0, 10), recorded_by: user?.id }} saving={saveMove.isPending}
        onSave={(v) => { const total = Math.round((Number(v.quantity || 0) * Number(v.unit_cost || 0)) * 100) / 100; saveMove.mutate({ ...v, total_cost: total }, { onSuccess: () => setMoveOpen(false) }); }} />
    </div>
  );
}
