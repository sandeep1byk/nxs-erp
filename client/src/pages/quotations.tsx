import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getAuthToken } from "@/lib/queryClient";
import { fmtDate, fmtAED, nextNumber, computeTotals, COMPANY, todayLocal } from "@/lib/nxs";
import {
  Plus, Printer, Trash2, Edit, Upload, X, ChevronDown, ChevronUp,
  Search, Package, FileText, CheckSquare, Building2, Loader2, BookOpen
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Product {
  id: string;
  work_type: string;
  brand: string;
  product_name: string;
  full_name: string;
  category: string;
  description: string;
  application_areas: string[];
  sow_steps: string[];
  logo_url: string;
  system_design_url: string;
  brand_website: string;
  is_custom?: boolean;
}

interface LineItem {
  sl: number;
  description: string;
  product_full_name?: string;
  brand?: string;
  logo_url?: string;
  system_design_url?: string;
  product_description?: string;
  uom: string;
  quantity: number;
  unit_price: number;
  amount: number;
  is_optional?: boolean;
}

interface Responsibility {
  item: string;
  nxs: boolean;
  client: boolean;
  shared: boolean;
}

interface PaymentSchedule {
  milestone: string;
  percentage: number;
  notes: string;
}

interface Quotation {
  id?: string;
  quot_number: string;
  quot_date: string;
  valid_until: string;
  status: string;
  client_id: string;
  project_id?: string;
  subject: string;
  work_type: string;
  cover_photo_url?: string;
  site_photos: string[];
  product_photos: string[];
  scope_of_work?: string;
  scope_items: LineItem[];
  items: LineItem[];
  optional_items: LineItem[];
  warranty_terms?: string;
  payment_terms?: string;
  payment_schedule: PaymentSchedule[];
  responsibilities: Responsibility[];
  working_conditions?: string;
  terms_conditions?: string;
  mobilisation_days: number;
  execution_days: number;
  validity_days: number;
  closing_note?: string;
  prepared_by: string;
  designation: string;
  subtotal?: number;
  vat_amount?: number;
  total_amount?: number;
  notes?: string;
}

// ─── Default T&C Data ─────────────────────────────────────────────────────────
const DEFAULT_TC: Record<string, Record<string, string>> = {
  floor_coating: {
    warranty: `1. NXS Contracting provides a warranty of three (3) years on all floor coating works against material failure and application defects under normal use conditions.
2. The warranty is limited to 50% of the contract value and covers repair or replacement of defective areas at our discretion.
3. The warranty is void in the event of: structural movement or cracking of the substrate; physical damage, abuse, or improper maintenance; modification or repair by unauthorized parties; exposure to chemicals or loads beyond the specified design limits; and non-payment of any outstanding invoices.
4. Normal wear, tyre marks, surface scratches from vehicular traffic, and color variation due to UV exposure are not covered under warranty.
5. The client must report defects in writing within the warranty period; NXS will inspect and determine the cause within 14 working days.`,
    requirements: `1. The client shall ensure the concrete substrate is structurally sound, properly cured (minimum 28 days), and has a surface tensile strength of not less than 1.5 N/mm².
2. The surface moisture content must not exceed 75% RH (BS8204) prior to coating application. NXS reserves the right to delay works if moisture levels are unacceptable.
3. The client shall ensure adequate ventilation, lighting, and access to water and electrical supply (3-phase power if required) throughout the execution period.
4. All grinding, shot blasting, or surface preparation will generate dust; the client must remove sensitive equipment and provide protection to adjacent areas. NXS will not be liable for dust migration.
5. Ambient temperature during application must be between 5°C and 35°C, with relative humidity below 85% and substrate temperature at least 3°C above dew point.
6. The client is responsible for curing restrictions after application — areas must not be trafficked before the specified curing period elapses.
7. Any delays caused by the client (lack of access, utility unavailability, third-party interference) will be subject to a back-charge of AED 5,000 per day for idle crew.`,
    working_conditions: `• This quotation covers only the scope of work described herein. Any additional areas, changes to specification, or extra coats are subject to a separate variation order.
• All quantities are provisional and subject to final site measurement. The contract value will be adjusted accordingly upon completion.
• NXS reserves the right to stop works if site conditions are deemed unsafe or unsuitable for application.
• Any authorized variation or additional work must be confirmed in writing by an authorized signatory of the client before execution.
• Professional indemnity for design-related failures is excluded unless NXS has been engaged specifically as design consultant.
• Waste disposal of surface preparation debris and empty product containers is the client's responsibility unless otherwise agreed.
• Force majeure events (extreme weather, government restrictions, material unavailability) shall extend the execution period without penalty.
• This quotation does not include provision for buried services, underground utilities, or any unknown substrate conditions discovered during works.
• NXS is not responsible for pre-existing structural defects, cracks, or honeycombing discovered during surface preparation.`
  },
  waterproofing: {
    warranty: `1. NXS Contracting provides a warranty of five (5) years on waterproofing works against water infiltration due to material failure or application defects.
2. The warranty covers repair of the waterproofed area; it does not cover consequential damage to finishes, fittings, or contents below.
3. Warranty is limited to 50% of the contract value and is void in the event of: structural movement or settlement cracking; physical damage from subsequent construction activities; improper drainage design; and unauthorized modification of the waterproofed area.
4. The warranty does not cover areas where finishing screed, tiles, or other topping materials have been applied by others without NXS's approval.
5. Any penetrations, fixings, or pipe work installed after completion of waterproofing works by others will void the warranty at those locations.`,
    requirements: `1. The substrate must be structurally sound, free from cracks wider than 0.3mm, and all blow holes/honeycombing must be repaired prior to waterproofing application.
2. The surface must be clean, dry (unless applying a wet-on-wet cementitious system), and free from oil, grease, dust, and release agents.
3. The client must ensure all drainage outlets, pipes, and penetrations are in their final position before waterproofing commences. Relocation of services after application voids the warranty at those points.
4. Curing time of 24–48 hours must be maintained after application before any topping, screed, or backfill is placed. The client must coordinate other trades accordingly.
5. The client must provide unobstructed access to all areas during application and testing (flood testing). NXS will carry out a flood test for a minimum of 24 hours; the client must be present.
6. The client is responsible for protecting completed waterproofing from construction traffic and damage until the protective screed or covering is installed.
7. Any delays caused by the client will be subject to a back-charge of AED 5,000 per day for idle crew.`,
    working_conditions: `• All waterproofing quantities are based on the areas shown in the drawings or measured during site survey. Final quantities are subject to site measurement upon completion.
• NXS will carry out a water flood test on completion. The client must attend and sign-off the test before we demobilize.
• Drainage falls and gradients are the structural engineer's/architect's responsibility; NXS will not be held liable for ponding due to inadequate falls in the substrate.
• This quotation excludes protection screed, tiles, and finishing works unless explicitly stated.
• Force majeure events, extreme weather, or government-mandated stoppages will extend the execution period without penalty.
• Buried services, existing waterproofing membranes in poor condition not disclosed at tender stage, and unknown substrate conditions may result in variation orders.`
  },
  concrete_repair: {
    warranty: `1. NXS Contracting provides a warranty of two (2) years on concrete repair and structural strengthening works against defective materials and workmanship.
2. Warranty covers failure of the repaired section; it does not extend to adjacent concrete not included in the scope of works.
3. The warranty is void in the event of: continued exposure to aggressive chemicals or chloride attack beyond design levels; structural overloading; unauthorized modification or drilling into repaired areas; and non-payment of outstanding invoices.
4. Structural assessment and engineering design (if required) are excluded from warranty unless NXS was specifically appointed as the structural engineer.
5. Any structural defects, rebar corrosion, or carbonation beyond the repaired zone are excluded; NXS will not be held liable for progressive deterioration in areas outside the scope.`,
    requirements: `1. A structural condition assessment report must be available prior to commencement. If not available, NXS may carry out a preliminary assessment at an additional cost.
2. The client must ensure safe access to all areas to be repaired, including scaffolding, elevated work platforms, or rope access where required. Access equipment cost is not included unless specified.
3. All electrical, mechanical, and plumbing services near the repair zone must be isolated and protected before commencement.
4. Dust, noise, and vibration from mechanical chasing, breaking, and shot blasting are inherent to the works. The client must manage building occupation accordingly.
5. The client must allow minimum curing periods before re-loading repaired elements — NXS will advise specific requirements per repair type.
6. The client is responsible for providing waste disposal facilities for concrete debris, broken material, and empty containers.
7. Any delays caused by the client will be subject to a back-charge of AED 5,000 per day for idle crew.`,
    working_conditions: `• All repair quantities are provisional and based on initial visual assessment. Actual quantities may vary after breaking out deteriorated concrete; a variation order will be issued for quantities exceeding ±10% of the tender estimate.
• NXS is not responsible for any existing structural deficiencies not identified in the initial condition survey.
• Load testing or structural certification after repair works is the structural engineer's responsibility unless NXS is specifically appointed.
• Carbon fibre reinforcement (CFRP) systems require controlled temperature and humidity during installation; the client must provide conditioned space if required.
• Force majeure, government restrictions, or material import delays will extend the execution period without penalty.
• This quotation excludes paint, rendering, or decorative finishing to repaired areas unless explicitly included.`
  }
};

const DEFAULT_RESPONSIBILITIES: Responsibility[] = [
  { item: "Site safety & HSE compliance", nxs: true, client: false, shared: false },
  { item: "Surface moisture content check", nxs: true, client: false, shared: false },
  { item: "Surface temperature check", nxs: true, client: false, shared: false },
  { item: "Grinding / shot blasting / surface preparation", nxs: true, client: false, shared: false },
  { item: "Water & electricity supply on-site", nxs: false, client: true, shared: false },
  { item: "Site access during working hours", nxs: false, client: true, shared: false },
  { item: "Protection of adjacent areas & finishes", nxs: false, client: false, shared: true },
  { item: "Permits & NOC from authorities", nxs: false, client: true, shared: false },
  { item: "Barricading & safety signage", nxs: false, client: false, shared: true },
  { item: "Equipment & material storage area", nxs: false, client: true, shared: false },
  { item: "Forklift / crane for material offloading", nxs: false, client: true, shared: false },
  { item: "Mock-up / sample approval", nxs: false, client: false, shared: true },
  { item: "NXS site supervision", nxs: true, client: false, shared: false },
  { item: "Security passes & site induction", nxs: false, client: true, shared: false },
  { item: "Structural defects identification", nxs: true, client: false, shared: false },
];

const DEFAULT_PAYMENT: PaymentSchedule[] = [
  { milestone: "Advance upon LOI/Contract signing", percentage: 25, notes: "" },
  { milestone: "Upon material delivery to site", percentage: 50, notes: "" },
  { milestone: "Upon completion & handover", percentage: 25, notes: "" },
];

const WORK_TYPES = [
  { value: "floor_coating", label: "Floor Coating Works" },
  { value: "waterproofing", label: "Waterproofing Works" },
  { value: "concrete_repair", label: "Concrete Repair & Strengthening" },
];

const CATEGORY_LABELS: Record<string, string> = {
  epoxy_coating: "Epoxy Coating",
  pu_coating: "PU Coating",
  pu_coating_membrane: "PU Coating with Membrane",
  pu_screed: "PU Screed",
  cementitious: "Cementitious Waterproofing",
  crystalline: "Crystalline Waterproofing",
  polyurethane_membrane: "PU Membrane",
  bituminous_membrane: "Bituminous Membrane",
  acrylic_elastomeric: "Acrylic / Elastomeric",
  liquid_applied_membrane: "Liquid Applied Membrane",
  injection_grouting: "Injection Grouting",
  repair_mortar: "Repair Mortar",
  epoxy_injection: "Epoxy Injection",
  frp_strengthening: "FRP / CFRP Strengthening",
  shotcrete_gunite: "Shotcrete / Gunite",
  corrosion_inhibitor: "Corrosion Inhibitor",
  grouting: "Grouting",
  protective_coating: "Protective Coating",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function useList(table: string) {
  return useQuery<any[]>({
    queryKey: [`/api/${table}`],
    queryFn: () => apiRequest("GET", `/api/${table}`).then(r => r.json()),
  });
}

function calcTotals(items: LineItem[], optional: LineItem[]) {
  const mainTotal = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const optTotal = optional.filter(i => !i.is_optional).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const subtotal = mainTotal + optTotal;
  const vat = Math.round(subtotal * 0.05 * 100) / 100;
  return { subtotal, vat, total: subtotal + vat };
}

// ─── Product Picker Dialog ─────────────────────────────────────────────────────
function ProductPicker({ workType, onSelect, onClose }: {
  workType: string;
  onSelect: (p: Product) => void;
  onClose: () => void;
}) {
  const { data: products = [], isLoading } = useList("product_library");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");

  const filtered = products.filter((p: Product) =>
    p.work_type === workType &&
    (catFilter === "all" || p.category === catFilter) &&
    (search === "" || p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      p.brand.toLowerCase().includes(search.toLowerCase()))
  );

  const cats = [...new Set(products.filter((p: Product) => p.work_type === workType).map((p: Product) => p.category))];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-amber-600" />
            Select Product
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search brand or product..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {cats.map(c => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] || c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="flex-1 pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((p: Product) => (
                <div key={p.id}
                  className="border rounded-lg p-3 cursor-pointer hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors"
                  onClick={() => onSelect(p)}
                  data-testid={`product-item-${p.id}`}
                >
                  <div className="flex items-start gap-3">
                    {p.logo_url && (
                      <img src={p.logo_url} alt={p.brand} className="h-8 w-16 object-contain mt-0.5 shrink-0" onError={e => (e.currentTarget.style.display = 'none')} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{p.full_name}</span>
                        <Badge variant="outline" className="text-xs">{CATEGORY_LABELS[p.category] || p.category}</Badge>
                        {p.is_custom && <Badge className="text-xs bg-amber-100 text-amber-800">Custom</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {(p.application_areas || []).slice(0, 3).map((a, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{a}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && !isLoading && (
                <p className="text-center text-muted-foreground py-8">No products found. Try adjusting your search.</p>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─── TDS Upload Dialog ─────────────────────────────────────────────────────────
function TDSUploadDialog({ workType, onSave, onClose }: {
  workType: string;
  onSave: (p: Partial<Product>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<Product>>({ work_type: workType, is_custom: true, sow_steps: [], application_areas: [] });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  async function handleTDSUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = getAuthToken();
      const res = await fetch("/api/parse-tds", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const data = await res.json();
      setForm(f => ({ ...f, product_name: data.product_name, description: data.description }));
      toast({ title: "TDS parsed", description: "Review and complete the product details below." });
    } catch {
      toast({ title: "Parse failed", description: "Fill in details manually.", variant: "destructive" });
    } finally { setUploading(false); }
  }

  async function handleSave() {
    if (!form.brand || !form.product_name) {
      toast({ title: "Required", description: "Brand and product name are required.", variant: "destructive" });
      return;
    }
    const payload = {
      ...form,
      full_name: `${form.brand} ${form.product_name}`,
      category: form.category || "other",
      is_custom: true,
      application_areas: form.application_areas || [],
      sow_steps: form.sow_steps || [],
    };
    await apiRequest("POST", "/api/product_library", payload);
    qc.invalidateQueries({ queryKey: ["/api/product_library"] });
    toast({ title: "Product saved to library" });
    onSave(payload as Product);
    onClose();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-amber-600" />
            Add Custom Product
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="border-2 border-dashed border-amber-300 rounded-lg p-4 text-center cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-950/20"
            onClick={() => fileRef.current?.click()}>
            <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleTDSUpload} />
            {uploading ? <Loader2 className="h-6 w-6 animate-spin mx-auto text-amber-600" /> :
              <><Upload className="h-6 w-6 mx-auto text-amber-600 mb-1" />
                <p className="text-sm font-medium">Upload TDS (PDF) — Optional</p>
                <p className="text-xs text-muted-foreground">AI will extract product name and description</p></>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Brand *</Label>
              <Input placeholder="e.g. Sika" value={form.brand || ""} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Product Name *</Label>
              <Input placeholder="e.g. Sikafloor-264" value={form.product_name || ""} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Category</Label>
            <Select value={form.category || ""} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea rows={3} placeholder="Brief product description..." value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Brand Logo URL (optional)</Label>
            <Input placeholder="https://..." value={form.logo_url || ""} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleSave}>Save to Library</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Photo upload helper ───────────────────────────────────────────────────────
function PhotoUpload({ label, urls, onChange, max = 6 }: {
  label: string; urls: string[]; onChange: (u: string[]) => void; max?: number;
}) {
  const [url, setUrl] = useState("");
  function add() {
    if (!url.trim()) return;
    onChange([...urls, url.trim()]);
    setUrl("");
  }
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input placeholder="Paste image URL..." value={url} onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()} />
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={urls.length >= max}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {urls.map((u, i) => (
            <div key={i} className="relative group">
              <img src={u} alt={`photo-${i}`} className="h-20 w-28 object-cover rounded border"
                onError={e => (e.currentTarget.src = "https://placehold.co/112x80?text=IMG")} />
              <button type="button" onClick={() => onChange(urls.filter((_, j) => j !== i))}
                className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Line Items Editor ─────────────────────────────────────────────────────────
function LineEditor({ items, onChange, workType, optional = false }: {
  items: LineItem[]; onChange: (items: LineItem[]) => void; workType: string; optional?: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [showTDS, setShowTDS] = useState(false);

  function addFromProduct(p: Product) {
    const item: LineItem = {
      sl: items.length + 1,
      description: p.description?.slice(0, 200) || "",
      product_full_name: p.full_name,
      brand: p.brand,
      logo_url: p.logo_url,
      system_design_url: p.system_design_url,
      product_description: p.description,
      uom: "m²",
      quantity: 0,
      unit_price: 0,
      amount: 0,
      is_optional: optional,
    };
    onChange([...items, item]);
    setShowPicker(false);
  }

  function addBlank() {
    onChange([...items, { sl: items.length + 1, description: "", uom: "m²", quantity: 0, unit_price: 0, amount: 0, is_optional: optional }]);
  }

  function update(i: number, field: string, val: any) {
    const next = items.map((item, j) => {
      if (j !== i) return item;
      const updated = { ...item, [field]: val };
      if (field === "quantity" || field === "unit_price") {
        updated.amount = Number(updated.quantity || 0) * Number(updated.unit_price || 0);
      }
      return updated;
    });
    onChange(next);
  }

  function remove(i: number) { onChange(items.filter((_, j) => j !== i).map((it, j) => ({ ...it, sl: j + 1 }))); }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <Button type="button" size="sm" variant="outline" onClick={() => setShowPicker(true)}
          className="border-amber-300 text-amber-700 hover:bg-amber-50">
          <Package className="h-3.5 w-3.5 mr-1" /> Pick from Library
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setShowTDS(true)}
          className="border-amber-300 text-amber-700 hover:bg-amber-50">
          <Upload className="h-3.5 w-3.5 mr-1" /> Add New Product (TDS)
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={addBlank}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Blank Line
        </Button>
      </div>

      {items.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className="text-left p-2 w-6">#</th>
                <th className="text-left p-2">Job Description / Product</th>
                <th className="text-left p-2 w-16">UOM</th>
                <th className="text-left p-2 w-20">Qty</th>
                <th className="text-left p-2 w-24">Unit Price</th>
                <th className="text-left p-2 w-24">Amount</th>
                <th className="p-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2 text-muted-foreground">{item.sl}</td>
                  <td className="p-2">
                    {item.product_full_name && (
                      <div className="flex items-center gap-1.5 mb-1">
                        {item.logo_url && <img src={item.logo_url} alt="" className="h-4 object-contain" onError={e => (e.currentTarget.style.display = 'none')} />}
                        <span className="font-medium text-amber-700">{item.product_full_name}</span>
                      </div>
                    )}
                    <Textarea rows={2} placeholder="Description..." className="text-xs resize-none"
                      value={item.description} onChange={e => update(i, "description", e.target.value)} />
                  </td>
                  <td className="p-2">
                    <Input className="h-7 text-xs" value={item.uom} onChange={e => update(i, "uom", e.target.value)} />
                  </td>
                  <td className="p-2">
                    <Input type="number" className="h-7 text-xs" value={item.quantity || ""}
                      onChange={e => update(i, "quantity", parseFloat(e.target.value) || 0)} />
                  </td>
                  <td className="p-2">
                    <Input type="number" className="h-7 text-xs" value={item.unit_price || ""}
                      onChange={e => update(i, "unit_price", parseFloat(e.target.value) || 0)} />
                  </td>
                  <td className="p-2 font-mono text-right text-xs">
                    {(item.amount || 0).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-2">
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:bg-red-50" onClick={() => remove(i)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showPicker && <ProductPicker workType={workType} onSelect={addFromProduct} onClose={() => setShowPicker(false)} />}
      {showTDS && <TDSUploadDialog workType={workType} onSave={p => addFromProduct(p as Product)} onClose={() => setShowTDS(false)} />}
    </div>
  );
}

// ─── Responsibilities Editor ───────────────────────────────────────────────────
function ResponsibilitiesEditor({ rows, onChange }: { rows: Responsibility[]; onChange: (r: Responsibility[]) => void }) {
  function toggle(i: number, col: "nxs" | "client" | "shared") {
    onChange(rows.map((r, j) => j !== i ? r : {
      ...r,
      nxs: col === "nxs",
      client: col === "client",
      shared: col === "shared",
    }));
  }
  function remove(i: number) { onChange(rows.filter((_, j) => j !== i)); }
  function addRow() { onChange([...rows, { item: "", nxs: false, client: true, shared: false }]); }

  return (
    <div className="space-y-2">
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>
              <th className="text-left p-2">Responsibility Item</th>
              <th className="text-center p-2 w-16">NXS</th>
              <th className="text-center p-2 w-16">Client</th>
              <th className="text-center p-2 w-20">Shared</th>
              <th className="p-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="p-2">
                  <Input className="h-7 text-xs" value={r.item} onChange={e => onChange(rows.map((rr, j) => j === i ? { ...rr, item: e.target.value } : rr))} />
                </td>
                {(["nxs", "client", "shared"] as const).map(col => (
                  <td key={col} className="p-2 text-center">
                    <button type="button" onClick={() => toggle(i, col)}
                      className={`h-5 w-5 rounded border-2 mx-auto block transition-colors ${r[col] ? "bg-amber-500 border-amber-500" : "border-slate-300 hover:border-amber-400"}`}>
                      {r[col] && <span className="text-white text-xs leading-none">✓</span>}
                    </button>
                  </td>
                ))}
                <td className="p-2">
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => remove(i)}>
                    <X className="h-3 w-3" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addRow}><Plus className="h-3.5 w-3.5 mr-1" /> Add Row</Button>
    </div>
  );
}

// ─── Payment Schedule Editor ───────────────────────────────────────────────────
function PaymentEditor({ schedule, onChange }: { schedule: PaymentSchedule[]; onChange: (s: PaymentSchedule[]) => void }) {
  const total = schedule.reduce((s, r) => s + Number(r.percentage || 0), 0);
  function update(i: number, f: string, v: any) { onChange(schedule.map((r, j) => j !== i ? r : { ...r, [f]: v })); }
  function remove(i: number) { onChange(schedule.filter((_, j) => j !== i)); }
  return (
    <div className="space-y-2">
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>
              <th className="text-left p-2">Milestone</th>
              <th className="text-center p-2 w-20">%</th>
              <th className="text-left p-2">Notes</th>
              <th className="p-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="p-2"><Input className="h-7 text-xs" value={r.milestone} onChange={e => update(i, "milestone", e.target.value)} /></td>
                <td className="p-2"><Input type="number" className="h-7 text-xs text-center" value={r.percentage} onChange={e => update(i, "percentage", Number(e.target.value))} /></td>
                <td className="p-2"><Input className="h-7 text-xs" value={r.notes} onChange={e => update(i, "notes", e.target.value)} /></td>
                <td className="p-2"><Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => remove(i)}><X className="h-3 w-3" /></Button></td>
              </tr>
            ))}
            <tr className="border-t bg-slate-50 dark:bg-slate-900">
              <td className="p-2 font-semibold text-xs">Total</td>
              <td className={`p-2 text-center font-bold text-xs ${total !== 100 ? "text-red-500" : "text-green-600"}`}>{total}%</td>
              <td colSpan={2} className="p-2 text-xs text-muted-foreground">{total !== 100 ? `⚠ Should total 100%` : "✓ Correct"}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" size="sm"
        onClick={() => onChange([...schedule, { milestone: "", percentage: 0, notes: "" }])}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Add Milestone
      </Button>
    </div>
  );
}

// ─── Quotation Form (full) ─────────────────────────────────────────────────────
function QuotationForm({ initial, onSave, onClose, clients, projects }: {
  initial: Partial<Quotation>;
  onSave: (q: Quotation) => void;
  onClose: () => void;
  clients: any[];
  projects: any[];
}) {
  const [q, setQ] = useState<Quotation>({
    quot_number: initial.quot_number || nextNumber("NXS-QT"),
    quot_date: initial.quot_date || todayLocal(),
    valid_until: initial.valid_until || "",
    status: initial.status || "draft",
    client_id: initial.client_id || "",
    project_id: initial.project_id || "",
    subject: initial.subject || "",
    work_type: initial.work_type || "floor_coating",
    cover_photo_url: initial.cover_photo_url || "",
    site_photos: initial.site_photos || [],
    product_photos: initial.product_photos || [],
    scope_of_work: initial.scope_of_work || "",
    scope_items: initial.scope_items || [],
    items: initial.items || [],
    optional_items: initial.optional_items || [],
    warranty_terms: initial.warranty_terms || "",
    payment_terms: initial.payment_terms || "",
    payment_schedule: initial.payment_schedule?.length ? initial.payment_schedule : [...DEFAULT_PAYMENT],
    responsibilities: initial.responsibilities?.length ? initial.responsibilities : [...DEFAULT_RESPONSIBILITIES],
    working_conditions: initial.working_conditions || "",
    terms_conditions: initial.terms_conditions || "",
    mobilisation_days: initial.mobilisation_days || 7,
    execution_days: initial.execution_days || 14,
    validity_days: initial.validity_days || 30,
    closing_note: initial.closing_note || "",
    prepared_by: initial.prepared_by || "Sandeep",
    designation: initial.designation || "Managing Director",
    ...initial,
  });

  function up(patch: Partial<Quotation>) { setQ(prev => ({ ...prev, ...patch })); }

  function applyDefaults(wt: string) {
    const tc = DEFAULT_TC[wt] || {};
    up({
      work_type: wt,
      warranty_terms: tc.warranty || "",
      terms_conditions: tc.requirements || "",
      working_conditions: tc.working_conditions || "",
    });
  }

  const { subtotal, vat, total } = calcTotals(q.items, q.optional_items);
  const clientObj = clients.find(c => c.id === q.client_id);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b bg-gradient-to-r from-[#0c1125] to-[#1a2340] rounded-t-lg">
          <DialogTitle className="text-white text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-400" />
            {initial.id ? `Edit Quotation — ${initial.quot_number}` : "New Professional Quotation"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <Tabs defaultValue="header" className="space-y-4">
            <TabsList className="grid grid-cols-6 gap-1 h-auto p-1">
              <TabsTrigger value="header" className="text-xs py-1.5">Header</TabsTrigger>
              <TabsTrigger value="scope" className="text-xs py-1.5">Scope / Items</TabsTrigger>
              <TabsTrigger value="photos" className="text-xs py-1.5">Photos</TabsTrigger>
              <TabsTrigger value="commercial" className="text-xs py-1.5">Commercial</TabsTrigger>
              <TabsTrigger value="terms" className="text-xs py-1.5">T&amp;C</TabsTrigger>
              <TabsTrigger value="closing" className="text-xs py-1.5">Closing</TabsTrigger>
            </TabsList>

            {/* ── Tab 1: Header ── */}
            <TabsContent value="header" className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label>Quotation No. *</Label>
                  <Input value={q.quot_number} onChange={e => up({ quot_number: e.target.value })} data-testid="input-quot-number" />
                </div>
                <div className="space-y-1">
                  <Label>Date</Label>
                  <Input type="date" value={q.quot_date} onChange={e => up({ quot_date: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Valid Until</Label>
                  <Input type="date" value={q.valid_until} onChange={e => up({ valid_until: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Client *</Label>
                  <Select value={q.client_id} onValueChange={v => up({ client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select client..." /></SelectTrigger>
                    <SelectContent>
                      {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Project (optional)</Label>
                  <Select value={q.project_id || "none"} onValueChange={v => up({ project_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select project..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Subject / Quote Title *</Label>
                <Input placeholder="e.g. Epoxy Floor Coating Works — Al Barsha Villa" value={q.subject}
                  onChange={e => up({ subject: e.target.value })} data-testid="input-subject" />
              </div>
              <div className="space-y-1">
                <Label>Work Type</Label>
                <div className="flex gap-2 flex-wrap">
                  {WORK_TYPES.map(wt => (
                    <button key={wt.value} type="button"
                      onClick={() => applyDefaults(wt.value)}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${q.work_type === wt.value
                        ? "bg-amber-600 border-amber-600 text-white"
                        : "border-slate-300 hover:border-amber-400 hover:text-amber-700"}`}
                      data-testid={`work-type-${wt.value}`}>
                      {wt.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Selecting a work type auto-fills T&C, warranty, and working conditions.</p>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={q.status} onValueChange={v => up({ status: v })}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["draft", "sent", "accepted", "rejected", "expired"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Cover Photo URL (for printed cover page)</Label>
                <Input placeholder="https://... (site or project photo)" value={q.cover_photo_url || ""}
                  onChange={e => up({ cover_photo_url: e.target.value })} />
                {q.cover_photo_url && (
                  <img src={q.cover_photo_url} alt="cover" className="h-32 rounded border object-cover mt-2"
                    onError={e => (e.currentTarget.style.display = 'none')} />
                )}
              </div>
            </TabsContent>

            {/* ── Tab 2: Scope / Items ── */}
            <TabsContent value="scope" className="space-y-5">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Scope of Work Introduction</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea rows={4} placeholder="Brief introduction paragraph about scope of works..."
                    value={q.scope_of_work || ""} onChange={e => up({ scope_of_work: e.target.value })} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package className="h-4 w-4 text-amber-600" />
                    Main Line Items
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <LineEditor items={q.items} onChange={items => up({ items })} workType={q.work_type} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                    Optional Items <Badge variant="outline" className="text-xs">Toggle per quote</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-3">Add optional/provisional items here. They will be clearly marked "Optional" in the printed quote and excluded from the main total.</p>
                  <LineEditor items={q.optional_items} onChange={optional_items => up({ optional_items })} workType={q.work_type} optional />
                </CardContent>
              </Card>

              <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-900 space-y-1">
                <div className="flex justify-between text-sm"><span>Subtotal</span><span className="font-mono">{fmtAED(subtotal)}</span></div>
                <div className="flex justify-between text-sm"><span>VAT (5%)</span><span className="font-mono">{fmtAED(vat)}</span></div>
                <Separator className="my-1" />
                <div className="flex justify-between font-bold"><span>Total</span><span className="font-mono text-amber-700">{fmtAED(total)}</span></div>
              </div>
            </TabsContent>

            {/* ── Tab 3: Photos ── */}
            <TabsContent value="photos" className="space-y-5">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Site Visit / Reference Photos</CardTitle></CardHeader>
                <CardContent>
                  <PhotoUpload label="Site Photos (up to 6)" urls={q.site_photos} onChange={site_photos => up({ site_photos })} max={6} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Product / System Design Photos</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-2">Product images and system design diagrams from TDS/brochures (auto-filled when you pick a product from library).</p>
                  <PhotoUpload label="Product & System Design Images" urls={q.product_photos} onChange={product_photos => up({ product_photos })} max={8} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Tab 4: Commercial ── */}
            <TabsContent value="commercial" className="space-y-5">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Payment Schedule</CardTitle></CardHeader>
                <CardContent>
                  <PaymentEditor schedule={q.payment_schedule} onChange={payment_schedule => up({ payment_schedule })} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Responsibilities Matrix</CardTitle></CardHeader>
                <CardContent>
                  <ResponsibilitiesEditor rows={q.responsibilities} onChange={responsibilities => up({ responsibilities })} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Project Timeline</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <Label>Mobilisation (days)</Label>
                      <Input type="number" value={q.mobilisation_days} onChange={e => up({ mobilisation_days: Number(e.target.value) })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Execution (days)</Label>
                      <Input type="number" value={q.execution_days} onChange={e => up({ execution_days: Number(e.target.value) })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Validity (days)</Label>
                      <Input type="number" value={q.validity_days} onChange={e => up({ validity_days: Number(e.target.value) })} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Tab 5: T&C ── */}
            <TabsContent value="terms" className="space-y-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-lg text-xs text-amber-800 dark:text-amber-200">
                T&C are auto-filled when you select a work type in the Header tab. Edit freely below.
              </div>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Client Requirements / Obligations</CardTitle></CardHeader>
                <CardContent>
                  <Textarea rows={8} value={q.terms_conditions || ""} onChange={e => up({ terms_conditions: e.target.value })} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Warranty Terms</CardTitle></CardHeader>
                <CardContent>
                  <Textarea rows={6} value={q.warranty_terms || ""} onChange={e => up({ warranty_terms: e.target.value })} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Working Conditions &amp; Exclusions</CardTitle></CardHeader>
                <CardContent>
                  <Textarea rows={8} value={q.working_conditions || ""} onChange={e => up({ working_conditions: e.target.value })} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Additional Notes</CardTitle></CardHeader>
                <CardContent>
                  <Textarea rows={3} placeholder="Any additional notes..." value={q.notes || ""} onChange={e => up({ notes: e.target.value } as any)} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Tab 6: Closing ── */}
            <TabsContent value="closing" className="space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Closing Note</CardTitle></CardHeader>
                <CardContent>
                  <Textarea rows={4}
                    placeholder="e.g. We trust the above quotation meets your requirements. Please feel free to contact us for any clarifications..."
                    value={q.closing_note || ""} onChange={e => up({ closing_note: e.target.value })} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Signatory Details</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Prepared By</Label>
                      <Input value={q.prepared_by} onChange={e => up({ prepared_by: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Designation</Label>
                      <Input value={q.designation} onChange={e => up({ designation: e.target.value })} />
                    </div>
                  </div>
                </CardContent>
              </Card>
              {/* Preview of dual signature block */}
              <Card className="bg-slate-50 dark:bg-slate-900">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Signature Block Preview</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-8 pt-2 text-sm">
                    <div>
                      <p className="font-semibold text-[#0c1125] dark:text-slate-200">For & on behalf of:</p>
                      <p className="font-bold text-amber-700">NXS Contracting & Building Maintenance LLC</p>
                      <div className="mt-4 border-t border-slate-400 pt-1">
                        <p className="font-medium">{q.prepared_by}</p>
                        <p className="text-muted-foreground text-xs">{q.designation}</p>
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-[#0c1125] dark:text-slate-200">Accepted by:</p>
                      <p className="font-bold">{clientObj?.name || "Client Name"}</p>
                      <div className="mt-4 border-t border-slate-400 pt-1">
                        <p className="text-muted-foreground text-xs">Authorised Signatory</p>
                        <p className="text-muted-foreground text-xs">Date: ________________________</p>
                        <p className="text-muted-foreground text-xs">Stamp: ________________________</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t flex justify-between">
          <div className="text-sm text-muted-foreground">
            Total: <span className="font-bold text-amber-700 text-base">{fmtAED(total)}</span>
            <span className="ml-2 text-xs">incl. 5% VAT</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button className="bg-[#0c1125] hover:bg-[#1a2340] text-white" onClick={() => {
              const { subtotal: s, vat: v, total: t } = calcTotals(q.items, q.optional_items);
              onSave({ ...q, subtotal: s, vat_amount: v, total_amount: t });
            }}>
              Save Quotation
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Print View ───────────────────────────────────────────────────────────────
function PrintView({ q, clients, onClose }: { q: Quotation; clients: any[]; onClose: () => void }) {
  const client = clients.find(c => c.id === q.client_id);
  const { subtotal, vat, total } = calcTotals(q.items, q.optional_items);
  const mainItems = (q.items || []).filter(i => !i.is_optional);
  const optItems = (q.optional_items || []);

  function print() { window.print(); }

  const style = `
    @media print {
      body * { visibility: hidden; }
      #print-area, #print-area * { visibility: visible; }
      #print-area { position: fixed; top: 0; left: 0; width: 100%; }
      .no-print { display: none !important; }
    }
    @page { margin: 15mm; size: A4; }
  `;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0">
        <style>{style}</style>
        <div className="flex items-center justify-between px-5 py-3 border-b no-print">
          <span className="font-semibold text-sm">Print Preview — {q.quot_number}</span>
          <div className="flex gap-2">
            <Button size="sm" onClick={print} className="bg-amber-600 hover:bg-amber-700 text-white">
              <Printer className="h-4 w-4 mr-1" /> Print / Save PDF
            </Button>
            <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div id="print-area" className="bg-white text-[#1a1a1a] font-sans" style={{ fontFamily: "Arial, sans-serif", fontSize: 11 }}>

            {/* PAGE 1 — COVER */}
            <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "0 0 20px" }}>
              {/* Header bar */}
              <div style={{ backgroundColor: "#0c1125", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <img src={COMPANY.logo} alt="NXS" style={{ height: 40, objectFit: "contain" }}
                    onError={e => { e.currentTarget.style.display = 'none'; }} />
                </div>
                <div style={{ textAlign: "right", color: "#fff", fontSize: 10 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#bd7214", letterSpacing: 2 }}>QUOTATION</div>
                  <div>Ref: {q.quot_number}</div>
                  <div>Date: {fmtDate(q.quot_date)}</div>
                </div>
              </div>

              {/* Cover photo */}
              {q.cover_photo_url && (
                <div style={{ flex: 1, maxHeight: 340, overflow: "hidden" }}>
                  <img src={q.cover_photo_url} alt="cover" style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={e => (e.currentTarget.style.display = 'none')} />
                </div>
              )}

              {/* Cover info block */}
              <div style={{ padding: "16px 24px", borderTop: "3px solid #bd7214" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: "#bd7214", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Submitted To</div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{client?.name || "—"}</div>
                    {client?.address && <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>{client.address}</div>}
                    {client?.contact_person && <div style={{ fontSize: 10 }}>Attn: {client.contact_person}</div>}
                    {client?.trn && <div style={{ fontSize: 10 }}>TRN: {client.trn}</div>}
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: "#bd7214", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Submitted By</div>
                    <div style={{ fontWeight: 700, fontSize: 12 }}>{COMPANY.name}</div>
                    <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>{COMPANY.address}</div>
                    <div style={{ fontSize: 10 }}>T: {COMPANY.phone} | E: {COMPANY.email}</div>
                    <div style={{ fontSize: 10 }}>TRN: 100XXXXXXXX00003</div>
                  </div>
                </div>
                <div style={{ marginTop: 12, padding: "8px 12px", backgroundColor: "#f9f6ef", borderLeft: "3px solid #bd7214" }}>
                  <div style={{ fontSize: 10, fontWeight: 600 }}>Subject: {q.subject}</div>
                  <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>
                    Valid Until: {fmtDate(q.valid_until)} &nbsp;|&nbsp;
                    Work Type: {WORK_TYPES.find(w => w.value === q.work_type)?.label}
                  </div>
                </div>
              </div>
            </div>

            {/* PAGE BREAK */}
            <div style={{ pageBreakBefore: "always" }} />

            {/* PAGE 2 — SCOPE OF WORK */}
            <div style={{ padding: "24px" }}>
              <SectionTitle>SCOPE OF WORK</SectionTitle>

              {q.scope_of_work && (
                <p style={{ fontSize: 11, lineHeight: 1.7, marginBottom: 16, color: "#333" }}>{q.scope_of_work}</p>
              )}

              {/* Site photos */}
              {(q.site_photos || []).length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: "#bd7214", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Site Reference Photos</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {q.site_photos.map((u, i) => (
                      <img key={i} src={u} alt={`site-${i}`} style={{ height: 100, width: 140, objectFit: "cover", borderRadius: 4, border: "1px solid #ddd" }}
                        onError={e => (e.currentTarget.style.display = 'none')} />
                    ))}
                  </div>
                </div>
              )}

              {/* Line items */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, marginBottom: 8 }}>
                <thead>
                  <tr style={{ backgroundColor: "#0c1125", color: "#fff" }}>
                    <th style={{ padding: "6px 8px", textAlign: "left", width: 28 }}>Sl.</th>
                    <th style={{ padding: "6px 8px", textAlign: "left" }}>Job Description</th>
                    <th style={{ padding: "6px 8px", textAlign: "center", width: 44 }}>UOM</th>
                    <th style={{ padding: "6px 8px", textAlign: "center", width: 50 }}>Qty</th>
                    <th style={{ padding: "6px 8px", textAlign: "right", width: 70 }}>Unit Price</th>
                    <th style={{ padding: "6px 8px", textAlign: "right", width: 80 }}>Amount (AED)</th>
                  </tr>
                </thead>
                <tbody>
                  {mainItems.map((item, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #e5e7eb", backgroundColor: i % 2 ? "#fafafa" : "#fff" }}>
                      <td style={{ padding: "6px 8px", verticalAlign: "top", color: "#888" }}>{item.sl}</td>
                      <td style={{ padding: "6px 8px", verticalAlign: "top" }}>
                        {item.product_full_name && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            {item.logo_url && <img src={item.logo_url} alt="" style={{ height: 14, objectFit: "contain" }} onError={e => (e.currentTarget.style.display = 'none')} />}
                            <span style={{ fontWeight: 700, color: "#bd7214" }}>{item.product_full_name}</span>
                          </div>
                        )}
                        <div style={{ color: "#333", lineHeight: 1.5 }}>{item.description}</div>
                        {item.system_design_url && (
                          <img src={item.system_design_url} alt="system" style={{ height: 50, marginTop: 4, objectFit: "contain" }}
                            onError={e => (e.currentTarget.style.display = 'none')} />
                        )}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "center", verticalAlign: "top" }}>{item.uom}</td>
                      <td style={{ padding: "6px 8px", textAlign: "center", verticalAlign: "top" }}>{item.quantity}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", verticalAlign: "top" }}>{Number(item.unit_price).toLocaleString("en-AE", { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", verticalAlign: "top", fontWeight: 600 }}>{Number(item.amount).toLocaleString("en-AE", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Optional items */}
              {optItems.length > 0 && (
                <>
                  <div style={{ fontSize: 9, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: 1, margin: "12px 0 4px" }}>Optional / Provisional Items (Excluded from Total)</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, marginBottom: 8 }}>
                    <tbody>
                      {optItems.map((item, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #e5e7eb", backgroundColor: "#fffbf0" }}>
                          <td style={{ padding: "5px 8px", width: 28, color: "#888" }}>{item.sl}</td>
                          <td style={{ padding: "5px 8px" }}>
                            {item.product_full_name && <div style={{ fontWeight: 600, color: "#888" }}>{item.product_full_name}</div>}
                            <div style={{ color: "#555" }}>{item.description}</div>
                          </td>
                          <td style={{ padding: "5px 8px", textAlign: "center", width: 44 }}>{item.uom}</td>
                          <td style={{ padding: "5px 8px", textAlign: "center", width: 50 }}>{item.quantity}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", width: 70 }}>{Number(item.unit_price).toLocaleString("en-AE", { minimumFractionDigits: 2 })}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", width: 80, color: "#888" }}>{Number(item.amount).toLocaleString("en-AE", { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {/* Totals */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <table style={{ fontSize: 11, minWidth: 260 }}>
                  <tbody>
                    <tr><td style={{ padding: "3px 12px 3px 0", color: "#555" }}>Subtotal</td><td style={{ textAlign: "right", fontFamily: "monospace" }}>AED {subtotal.toLocaleString("en-AE", { minimumFractionDigits: 2 })}</td></tr>
                    <tr><td style={{ padding: "3px 12px 3px 0", color: "#555" }}>VAT (5%)</td><td style={{ textAlign: "right", fontFamily: "monospace" }}>AED {vat.toLocaleString("en-AE", { minimumFractionDigits: 2 })}</td></tr>
                    <tr style={{ borderTop: "2px solid #0c1125" }}>
                      <td style={{ padding: "5px 12px 5px 0", fontWeight: 700, fontSize: 13 }}>TOTAL</td>
                      <td style={{ textAlign: "right", fontWeight: 800, fontSize: 13, color: "#bd7214", fontFamily: "monospace" }}>AED {total.toLocaleString("en-AE", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* PAGE BREAK */}
            <div style={{ pageBreakBefore: "always" }} />

            {/* PAGE 3 — COMMERCIAL TERMS */}
            <div style={{ padding: "24px" }}>
              <SectionTitle>COMMERCIAL TERMS</SectionTitle>

              {/* Payment schedule */}
              {q.payment_schedule?.length > 0 && (
                <>
                  <SubTitle>Payment Schedule</SubTitle>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, marginBottom: 16 }}>
                    <thead>
                      <tr style={{ backgroundColor: "#0c1125", color: "#fff" }}>
                        <th style={{ padding: "5px 8px", textAlign: "left" }}>Milestone</th>
                        <th style={{ padding: "5px 8px", textAlign: "center", width: 50 }}>%</th>
                        <th style={{ padding: "5px 8px", textAlign: "right", width: 120 }}>Amount (AED)</th>
                        <th style={{ padding: "5px 8px", textAlign: "left" }}>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {q.payment_schedule.map((p, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #e5e7eb", backgroundColor: i % 2 ? "#fafafa" : "#fff" }}>
                          <td style={{ padding: "5px 8px" }}>{p.milestone}</td>
                          <td style={{ padding: "5px 8px", textAlign: "center" }}>{p.percentage}%</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "monospace" }}>
                            {(total * p.percentage / 100).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: "5px 8px", color: "#666" }}>{p.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {/* Timeline */}
              <SubTitle>Project Timeline</SubTitle>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, marginBottom: 16 }}>
                <tbody>
                  {[
                    ["Material Delivery", `Within ${q.mobilisation_days} working days from advance payment`],
                    ["Mobilisation", `Within ${q.mobilisation_days} working days from advance payment & site readiness`],
                    ["Execution Duration", `Approximately ${q.execution_days} working days from mobilisation`],
                    ["Quotation Validity", `${q.validity_days} days from date of quotation`],
                    ["VAT", "5% VAT applicable as per UAE Federal Tax Authority regulations"],
                  ].map(([k, v], i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "4px 8px", fontWeight: 600, width: "30%", color: "#0c1125" }}>{k}</td>
                      <td style={{ padding: "4px 8px", color: "#444" }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Responsibilities Matrix */}
              {q.responsibilities?.length > 0 && (
                <>
                  <SubTitle>Responsibilities Matrix</SubTitle>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, marginBottom: 16 }}>
                    <thead>
                      <tr style={{ backgroundColor: "#0c1125", color: "#fff" }}>
                        <th style={{ padding: "5px 8px", textAlign: "left" }}>Item</th>
                        <th style={{ padding: "5px 8px", textAlign: "center", width: 50 }}>NXS</th>
                        <th style={{ padding: "5px 8px", textAlign: "center", width: 60 }}>Client</th>
                        <th style={{ padding: "5px 8px", textAlign: "center", width: 60 }}>Shared</th>
                      </tr>
                    </thead>
                    <tbody>
                      {q.responsibilities.map((r, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #e5e7eb", backgroundColor: i % 2 ? "#fafafa" : "#fff" }}>
                          <td style={{ padding: "4px 8px" }}>{r.item}</td>
                          <td style={{ padding: "4px 8px", textAlign: "center" }}>{r.nxs ? "✓" : ""}</td>
                          <td style={{ padding: "4px 8px", textAlign: "center" }}>{r.client ? "✓" : ""}</td>
                          <td style={{ padding: "4px 8px", textAlign: "center" }}>{r.shared ? "✓" : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>

            {/* PAGE BREAK */}
            <div style={{ pageBreakBefore: "always" }} />

            {/* PAGE 4 — T&C */}
            <div style={{ padding: "24px" }}>
              <SectionTitle>TERMS &amp; CONDITIONS</SectionTitle>

              {q.terms_conditions && (
                <>
                  <SubTitle>Client Requirements &amp; Obligations</SubTitle>
                  <pre style={{ fontFamily: "Arial, sans-serif", fontSize: 10, lineHeight: 1.7, whiteSpace: "pre-wrap", color: "#333", marginBottom: 14 }}>{q.terms_conditions}</pre>
                </>
              )}

              {q.warranty_terms && (
                <>
                  <SubTitle>Warranty Terms</SubTitle>
                  <pre style={{ fontFamily: "Arial, sans-serif", fontSize: 10, lineHeight: 1.7, whiteSpace: "pre-wrap", color: "#333", marginBottom: 14 }}>{q.warranty_terms}</pre>
                </>
              )}

              {q.working_conditions && (
                <>
                  <SubTitle>Working Conditions &amp; Exclusions</SubTitle>
                  <pre style={{ fontFamily: "Arial, sans-serif", fontSize: 10, lineHeight: 1.7, whiteSpace: "pre-wrap", color: "#333", marginBottom: 14 }}>{q.working_conditions}</pre>
                </>
              )}

              {/* Product photos / system design */}
              {(q.product_photos || []).length > 0 && (
                <>
                  <SubTitle>Product Reference / System Design</SubTitle>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
                    {q.product_photos.map((u, i) => (
                      <img key={i} src={u} alt={`prod-${i}`} style={{ height: 100, maxWidth: 180, objectFit: "contain", border: "1px solid #ddd", borderRadius: 4 }}
                        onError={e => (e.currentTarget.style.display = 'none')} />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* PAGE BREAK */}
            <div style={{ pageBreakBefore: "always" }} />

            {/* PAGE 5 — CLOSING */}
            <div style={{ padding: "24px" }}>
              <SectionTitle>ACCEPTANCE</SectionTitle>

              {q.closing_note ? (
                <p style={{ fontSize: 11, lineHeight: 1.8, color: "#333", marginBottom: 20 }}>{q.closing_note}</p>
              ) : (
                <p style={{ fontSize: 11, lineHeight: 1.8, color: "#333", marginBottom: 20 }}>
                  We trust the above quotation meets your requirements and look forward to your valued confirmation.
                  Should you require any clarifications or wish to discuss the scope of work further, please do not
                  hesitate to contact us. We remain committed to delivering quality workmanship within the agreed timeline.
                </p>
              )}

              <p style={{ fontSize: 10, color: "#666", fontStyle: "italic", marginBottom: 24 }}>
                Above information is not an invoice. This constitutes a commercial quotation only. Prices are exclusive of any items not
                specifically mentioned herein. By signing below, the client confirms acceptance of all terms, conditions, scope of work,
                and commercial terms as stated in this document.
              </p>

              {/* Dual signature block */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginTop: 24 }}>
                <div style={{ borderTop: "1px solid #ccc", paddingTop: 10 }}>
                  <div style={{ fontSize: 9, color: "#888", marginBottom: 4 }}>For &amp; on behalf of:</div>
                  <div style={{ fontWeight: 700, color: "#bd7214", fontSize: 12 }}>NXS Contracting &amp; Building Maintenance LLC</div>
                  <div style={{ marginTop: 36, borderTop: "1px solid #333", paddingTop: 4 }}>
                    <div style={{ fontWeight: 600 }}>{q.prepared_by}</div>
                    <div style={{ fontSize: 9, color: "#666" }}>{q.designation}</div>
                    <div style={{ marginTop: 6, height: 50, border: "1px dashed #ccc", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 9, color: "#aaa" }}>Signature &amp; Stamp</span>
                    </div>
                  </div>
                </div>
                <div style={{ borderTop: "1px solid #ccc", paddingTop: 10 }}>
                  <div style={{ fontSize: 9, color: "#888", marginBottom: 4 }}>Accepted by:</div>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>{client?.name || "Client"}</div>
                  <div style={{ marginTop: 36, borderTop: "1px solid #333", paddingTop: 4 }}>
                    <div style={{ fontSize: 10, color: "#555" }}>Authorised Signatory</div>
                    <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>Name: _________________________________</div>
                    <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>Date: __________________________________</div>
                    <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>Stamp: _________________________________</div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ marginTop: 40, paddingTop: 12, borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", fontSize: 9, color: "#aaa" }}>
                <span>{COMPANY.name} | {COMPANY.address}</span>
                <span>T: {COMPANY.phone} | E: {COMPANY.email} | W: {COMPANY.website}</span>
              </div>
            </div>

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 800, color: "#0c1125", borderBottom: "2px solid #bd7214", paddingBottom: 4, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
      {children}
    </div>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: "#bd7214", textTransform: "uppercase", letterSpacing: 0.8, margin: "10px 0 5px" }}>
      {children}
    </div>
  );
}

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  expired: "bg-orange-100 text-orange-800",
};

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function Quotations() {
  const { data: quotations = [], isLoading } = useList("quotations");
  const { data: clients = [] } = useList("clients");
  const { data: projects = [] } = useList("projects");
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Quotation> | null>(null);
  const [printing, setPrinting] = useState<Quotation | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [search, setSearch] = useState("");

  const save = useMutation({
    mutationFn: (q: Quotation) => q.id
      ? apiRequest("PUT", `/api/quotations/${q.id}`, q).then(r => r.json())
      : apiRequest("POST", "/api/quotations", q).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/quotations"] });
      toast({ title: "Quotation saved" });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/quotations/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/quotations"] });
      toast({ title: "Quotation deleted" });
    },
  });

  async function seedProducts() {
    setSeeding(true);
    try {
      const res = await apiRequest("POST", "/api/seed-products", {});
      const data = await res.json();
      toast({ title: "Product library ready", description: data.message });
      qc.invalidateQueries({ queryKey: ["/api/product_library"] });
    } catch (e: any) {
      toast({ title: "Seed failed", description: e.message, variant: "destructive" });
    } finally { setSeeding(false); }
  }

  const filtered = (quotations as Quotation[]).filter(q =>
    search === "" ||
    q.quot_number?.toLowerCase().includes(search.toLowerCase()) ||
    q.subject?.toLowerCase().includes(search.toLowerCase()) ||
    clients.find((c: any) => c.id === q.client_id)?.name?.toLowerCase().includes(search.toLowerCase())
  );

  function newQuotation() {
    setEditing({
      quot_number: nextNumber("NXS-QT"),
      quot_date: todayLocal(),
      status: "draft",
      work_type: "floor_coating",
      items: [],
      optional_items: [],
      site_photos: [],
      product_photos: [],
      scope_items: [],
      payment_schedule: [...DEFAULT_PAYMENT],
      responsibilities: [...DEFAULT_RESPONSIBILITIES],
      mobilisation_days: 7,
      execution_days: 14,
      validity_days: 30,
      prepared_by: "Sandeep",
      designation: "Managing Director",
      ...DEFAULT_TC.floor_coating && {
        warranty_terms: DEFAULT_TC.floor_coating.warranty,
        terms_conditions: DEFAULT_TC.floor_coating.requirements,
        working_conditions: DEFAULT_TC.floor_coating.working_conditions,
      }
    });
    setOpen(true);
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0c1125] dark:text-white">Quotations</h1>
          <p className="text-sm text-muted-foreground">Professional quotations with product library, SOW templates & T&C</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={seedProducts} disabled={seeding} data-testid="button-seed-products"
            className="border-amber-300 text-amber-700 hover:bg-amber-50">
            {seeding ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <BookOpen className="h-4 w-4 mr-1" />}
            Load Product Library
          </Button>
          <Button onClick={newQuotation} className="bg-[#0c1125] hover:bg-[#1a2340] text-white" data-testid="button-new-quotation">
            <Plus className="h-4 w-4 mr-1" /> New Quotation
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search quotations..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#0c1125] text-white">
            <tr>
              <th className="text-left p-3">Quot No.</th>
              <th className="text-left p-3">Client</th>
              <th className="text-left p-3">Subject</th>
              <th className="text-left p-3">Work Type</th>
              <th className="text-left p-3">Date</th>
              <th className="text-right p-3">Total</th>
              <th className="text-left p-3">Status</th>
              <th className="p-3 w-28"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="text-center p-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center p-8 text-muted-foreground">No quotations yet. Click "New Quotation" to create one.</td></tr>
            ) : (
              filtered.map((q: Quotation) => (
                <tr key={q.id} className="border-t hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors" data-testid={`row-quotation-${q.id}`}>
                  <td className="p-3 font-mono text-xs font-semibold text-amber-700">{q.quot_number}</td>
                  <td className="p-3">{clients.find((c: any) => c.id === q.client_id)?.name || "—"}</td>
                  <td className="p-3 max-w-[200px] truncate text-muted-foreground">{q.subject || "—"}</td>
                  <td className="p-3">
                    <Badge variant="outline" className="text-xs">{WORK_TYPES.find(w => w.value === q.work_type)?.label?.replace(" Works", "") || "—"}</Badge>
                  </td>
                  <td className="p-3 text-xs">{fmtDate(q.quot_date)}</td>
                  <td className="p-3 text-right font-mono font-semibold">{fmtAED(q.total_amount)}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[q.status] || "bg-slate-100 text-slate-700"}`}>
                      {q.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setPrinting(q)} data-testid={`button-print-${q.id}`}>
                        <Printer className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => { setEditing(q); setOpen(true); }} data-testid={`button-edit-${q.id}`}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500 hover:bg-red-50"
                        onClick={() => { if (confirm("Delete this quotation?")) remove.mutate(q.id!); }}
                        data-testid={`button-delete-${q.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Form dialog */}
      {open && editing && (
        <QuotationForm
          initial={editing}
          clients={clients}
          projects={projects}
          onSave={q => save.mutate(q)}
          onClose={() => { setOpen(false); setEditing(null); }}
        />
      )}

      {/* Print dialog */}
      {printing && (
        <PrintView
          q={printing}
          clients={clients}
          onClose={() => setPrinting(null)}
        />
      )}
    </div>
  );
}
