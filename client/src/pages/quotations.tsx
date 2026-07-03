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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getAuthToken } from "@/lib/queryClient";
import { fmtDate, fmtAED, nextNumber, COMPANY, todayLocal } from "@/lib/nxs";
import { openPrintTab } from "@/components/print-doc";
import {
  Plus, Printer, Trash2, Edit, Upload, X, Search, Package,
  FileText, Loader2, BookOpen, ImagePlus, ChevronDown, ChevronUp, ExternalLink
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Product {
  id: string; work_type: string; brand: string; product_name: string;
  full_name: string; category: string; description: string;
  application_areas: string[]; sow_steps: string[];
  logo_url: string; system_design_url: string; brand_website: string; is_custom?: boolean;
}

interface LineItem {
  sl: number; description: string; product_full_name?: string; brand?: string;
  logo_url?: string; system_design_url?: string; product_description?: string;
  uom: string; quantity: number; unit_price: number; amount: number; is_optional?: boolean;
}

interface Responsibility {
  item: string; nxs: boolean; client: boolean; shared: boolean;
}

interface PaymentSchedule {
  milestone: string; percentage: number; notes: string;
}

interface Quotation {
  id?: string; quot_number: string; quot_date: string; valid_until: string;
  status: string; client_id: string; project_id?: string; subject: string;
  work_type: string; cover_photo_url?: string; site_photos: string[];
  product_photos: string[]; scope_of_work?: string; scope_items: LineItem[];
  items: LineItem[]; optional_items: LineItem[]; warranty_terms?: string;
  payment_terms?: string; payment_schedule: PaymentSchedule[];
  responsibilities: Responsibility[]; working_conditions?: string;
  terms_conditions?: string; mobilisation_days: number; execution_days: number;
  validity_days: number; closing_note?: string; prepared_by: string;
  designation: string; subtotal?: number; vat_amount?: number; total_amount?: number; notes?: string;
}

// ─── Default Data ─────────────────────────────────────────────────────────────
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
4. All grinding, shot blasting, or surface preparation will generate dust; the client must remove sensitive equipment and provide protection to adjacent areas.
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
• NXS is not responsible for pre-existing structural defects, cracks, or honeycombing discovered during surface preparation.`
  },
  waterproofing: {
    warranty: `1. NXS Contracting provides a warranty of five (5) years on waterproofing works against water infiltration due to material failure or application defects.
2. The warranty covers repair of the waterproofed area; it does not cover consequential damage to finishes, fittings, or contents below.
3. Warranty is limited to 50% of the contract value and is void in the event of: structural movement or settlement cracking; physical damage from subsequent construction activities; improper drainage design; and unauthorized modification of the waterproofed area.
4. The warranty does not cover areas where finishing screed, tiles, or other topping materials have been applied by others without NXS's approval.
5. Any penetrations, fixings, or pipe work installed after completion by others will void the warranty at those locations.`,
    requirements: `1. The substrate must be structurally sound, free from cracks wider than 0.3mm, and all blow holes/honeycombing must be repaired prior to waterproofing application.
2. The surface must be clean, dry (unless applying a wet-on-wet cementitious system), and free from oil, grease, dust, and release agents.
3. The client must ensure all drainage outlets, pipes, and penetrations are in their final position before waterproofing commences.
4. Curing time of 24–48 hours must be maintained after application before any topping, screed, or backfill is placed.
5. The client must provide unobstructed access to all areas during application and testing (flood testing for a minimum of 24 hours).
6. The client is responsible for protecting completed waterproofing from construction traffic and damage until the protective screed is installed.
7. Any delays caused by the client will be subject to a back-charge of AED 5,000 per day for idle crew.`,
    working_conditions: `• All waterproofing quantities are based on the areas shown in the drawings or measured during site survey. Final quantities are subject to site measurement upon completion.
• NXS will carry out a water flood test on completion. The client must attend and sign-off the test before we demobilize.
• Drainage falls and gradients are the structural engineer's/architect's responsibility; NXS will not be held liable for ponding due to inadequate falls.
• This quotation excludes protection screed, tiles, and finishing works unless explicitly stated.
• Force majeure events, extreme weather, or government-mandated stoppages will extend the execution period without penalty.`
  },
  concrete_repair: {
    warranty: `1. NXS Contracting provides a warranty of two (2) years on concrete repair and structural strengthening works against defective materials and workmanship.
2. Warranty covers failure of the repaired section; it does not extend to adjacent concrete not included in the scope of works.
3. The warranty is void in the event of: continued exposure to aggressive chemicals beyond design levels; structural overloading; unauthorized modification or drilling into repaired areas; and non-payment of outstanding invoices.
4. Structural assessment and engineering design (if required) are excluded from warranty unless NXS was specifically appointed as the structural engineer.`,
    requirements: `1. A structural condition assessment report must be available prior to commencement. If not available, NXS may carry out a preliminary assessment at an additional cost.
2. The client must ensure safe access to all areas to be repaired, including scaffolding, elevated work platforms, or rope access where required.
3. All electrical, mechanical, and plumbing services near the repair zone must be isolated and protected before commencement.
4. Dust, noise, and vibration from mechanical chasing, breaking, and shot blasting are inherent to the works. The client must manage building occupation accordingly.
5. The client must allow minimum curing periods before re-loading repaired elements — NXS will advise specific requirements per repair type.
6. Any delays caused by the client will be subject to a back-charge of AED 5,000 per day for idle crew.`,
    working_conditions: `• All repair quantities are provisional and based on initial visual assessment. Actual quantities may vary after breaking out deteriorated concrete; a variation order will be issued for quantities exceeding ±10% of the tender estimate.
• NXS is not responsible for any existing structural deficiencies not identified in the initial condition survey.
• Load testing or structural certification after repair works is the structural engineer's responsibility unless NXS is specifically appointed.
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
  epoxy_coating: "Epoxy Coating", pu_coating: "PU Coating",
  pu_coating_membrane: "PU Coating with Membrane", pu_screed: "PU Screed",
  cementitious: "Cementitious Waterproofing", crystalline: "Crystalline Waterproofing",
  polyurethane_membrane: "PU Membrane", bituminous_membrane: "Bituminous Membrane",
  acrylic_elastomeric: "Acrylic / Elastomeric", liquid_applied_membrane: "Liquid Applied Membrane",
  injection_grouting: "Injection Grouting", repair_mortar: "Repair Mortar",
  epoxy_injection: "Epoxy Injection", frp_strengthening: "FRP / CFRP Strengthening",
  shotcrete_gunite: "Shotcrete / Gunite", corrosion_inhibitor: "Corrosion Inhibitor",
  grouting: "Grouting", protective_coating: "Protective Coating",
};

const UOM_OPTIONS = ["m²", "lm", "sm", "nos", "ls", "kg", "m³"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function useList(table: string) {
  return useQuery<any[]>({
    queryKey: [`/api/${table}`],
    queryFn: () => apiRequest("GET", `/api/${table}`).then(r => r.json()),
  });
}

function calcTotals(items: LineItem[], optional: LineItem[]) {
  const all = [...(items || []), ...(optional || [])];
  const subtotal = all.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const vat = Math.round(subtotal * 0.05 * 100) / 100;
  return { subtotal, vat, total: subtotal + vat };
}

// ─── Photo Uploader (real file upload) ─────────────────────────────────────────
function PhotoUploader({ label, urls, onChange, max = 6, folder = "quotations" }: {
  label: string; urls: string[]; onChange: (u: string[]) => void; max?: number; folder?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (urls.length + files.length > max) {
      toast({ title: `Maximum ${max} photos allowed`, variant: "destructive" }); return;
    }
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("entity_type", "quotation");
        fd.append("doc_category", folder);
        fd.append("title", file.name);
        const token = getAuthToken();
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        uploaded.push(data.url);
      }
      onChange([...urls, ...uploaded]);
      toast({ title: `${uploaded.length} photo(s) uploaded` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <Label>{label} ({urls.length}/{max})</Label>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
      <button type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading || urls.length >= max}
        className="w-full border-2 border-dashed border-amber-300 rounded-lg p-4 flex flex-col items-center gap-1.5 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
        {uploading
          ? <><Loader2 className="h-5 w-5 animate-spin text-amber-600" /><span className="text-sm text-amber-700">Uploading...</span></>
          : <><ImagePlus className="h-5 w-5 text-amber-600" /><span className="text-sm font-medium text-amber-700">Click to upload photos</span><span className="text-xs text-muted-foreground">JPG, PNG — up to {max} photos</span></>
        }
      </button>
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urls.map((u, i) => (
            <div key={i} className="relative group">
              <img src={u} alt={`photo-${i}`} className="h-24 w-32 object-cover rounded-lg border-2 border-slate-200"
                onError={e => (e.currentTarget.src = "https://placehold.co/128x96?text=Photo")} />
              <button type="button" onClick={() => onChange(urls.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Single Cover Photo Uploader ──────────────────────────────────────────────
function CoverPhotoUpload({ url, onChange }: { url: string; onChange: (u: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("entity_type", "quotation");
      fd.append("doc_category", "cover_photos");
      fd.append("title", file.name);
      const token = getAuthToken();
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      onChange(data.url);
      toast({ title: "Cover photo uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Label>Cover Photo (for printed cover page)</Label>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {url ? (
        <div className="relative group w-full">
          <img src={url} alt="cover" className="w-full h-40 object-cover rounded-lg border-2 border-amber-200"
            onError={e => (e.currentTarget.src = "https://placehold.co/600x160?text=Cover+Photo")} />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
            <button type="button" onClick={() => fileRef.current?.click()}
              className="bg-white text-slate-800 text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-amber-50">
              Replace Photo
            </button>
            <button type="button" onClick={() => onChange("")}
              className="bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium">
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="w-full border-2 border-dashed border-amber-300 rounded-lg p-6 flex flex-col items-center gap-2 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors">
          {uploading
            ? <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
            : <><ImagePlus className="h-6 w-6 text-amber-600" /><span className="text-sm font-medium text-amber-700">Upload Cover Photo</span><span className="text-xs text-muted-foreground">Best: landscape photo of a project site</span></>
          }
        </button>
      )}
    </div>
  );
}

// ─── Product Picker Dialog ─────────────────────────────────────────────────────
function ProductPicker({ workType, onSelect, onClose }: {
  workType: string; onSelect: (p: Product) => void; onClose: () => void;
}) {
  const { data: products = [], isLoading } = useList("product_library");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");

  const filtered = (products as Product[]).filter(p =>
    p.work_type === workType &&
    (catFilter === "all" || p.category === catFilter) &&
    (search === "" || p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      p.brand.toLowerCase().includes(search.toLowerCase()))
  );
  const cats = [...new Set((products as Product[]).filter(p => p.work_type === workType).map(p => p.category))];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" style={{ maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-amber-600" /> Select Product from Library
          </DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 mb-3 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search brand or product..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
          </div>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {cats.map(c => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] || c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 overflow-y-auto pr-1 space-y-2">
          {isLoading
            ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-amber-600" /></div>
            : filtered.length === 0
              ? <p className="text-center text-muted-foreground py-8 text-sm">No products found for this work type yet.<br />Click "Load Product Library" on the main page first.</p>
              : filtered.map(p => (
                <div key={p.id}
                  className="border rounded-lg p-3 cursor-pointer hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors"
                  onClick={() => onSelect(p)}>
                  <div className="flex items-start gap-3">
                    {p.logo_url && <img src={p.logo_url} alt={p.brand} className="h-7 w-14 object-contain shrink-0 mt-0.5" onError={e => (e.currentTarget.style.display = 'none')} />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{p.full_name}</span>
                        <Badge variant="outline" className="text-xs">{CATEGORY_LABELS[p.category] || p.category}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>
                    </div>
                  </div>
                </div>
              ))
          }
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Line Items Editor ─────────────────────────────────────────────────────────
function LineEditor({ items, onChange, workType, label, optional = false }: {
  items: LineItem[]; onChange: (i: LineItem[]) => void;
  workType: string; label: string; optional?: boolean;
}) {
  const [pickerFor, setPickerFor] = useState<number | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  function addBlank() {
    const newIdx = items.length;
    onChange([...items, {
      sl: items.length + 1, description: "", uom: "m²",
      quantity: 0, unit_price: 0, amount: 0, is_optional: optional
    }]);
    setExpandedIdx(newIdx);
  }

  function applyProduct(lineIdx: number, p: Product) {
    update(lineIdx, {
      product_full_name: p.full_name, brand: p.brand,
      logo_url: p.logo_url, system_design_url: p.system_design_url,
      description: p.description?.slice(0, 300) || "",
    });
    setPickerFor(null);
  }

  function update(i: number, patch: Partial<LineItem>) {
    onChange(items.map((item, j) => {
      if (j !== i) return item;
      const updated = { ...item, ...patch };
      if ("quantity" in patch || "unit_price" in patch) {
        updated.amount = Number(updated.quantity || 0) * Number(updated.unit_price || 0);
      }
      return updated;
    }));
  }

  function remove(i: number) {
    onChange(items.filter((_, j) => j !== i).map((it, j) => ({ ...it, sl: j + 1 })));
    setExpandedIdx(null);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">{label}</Label>
        <Button type="button" size="sm" onClick={addBlank}
          className="bg-amber-600 hover:bg-amber-700 text-white h-7 px-3 text-xs">
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Line
        </Button>
      </div>

      {items.length === 0 && (
        <div className="border-2 border-dashed rounded-lg p-5 text-center text-sm text-muted-foreground">
          No items yet. Click "Add Line" to start.
        </div>
      )}

      <div className="space-y-2">
        {items.map((item, i) => {
          const isExpanded = expandedIdx === i;
          return (
            <div key={i} className={`border rounded-lg overflow-hidden transition-all ${optional ? "border-amber-200 bg-amber-50/30 dark:bg-amber-950/10" : "border-slate-200"}`}>
              {/* Collapsed summary row */}
              <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                onClick={() => setExpandedIdx(isExpanded ? null : i)}>
                <span className="text-xs text-muted-foreground w-5 shrink-0">{item.sl}.</span>
                <div className="flex-1 min-w-0">
                  {item.product_full_name
                    ? <span className="text-xs font-semibold text-amber-700">{item.product_full_name}</span>
                    : <span className="text-xs text-muted-foreground italic">{item.description ? item.description.slice(0, 60) + (item.description.length > 60 ? "…" : "") : "Click to edit..."}</span>
                  }
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{item.uom}</span>
                <span className="text-xs shrink-0 w-16 text-right font-mono">
                  {item.quantity > 0 ? `${item.quantity} × ${item.unit_price}` : "—"}
                </span>
                <span className="text-xs font-semibold shrink-0 w-20 text-right font-mono text-amber-700">
                  {item.amount > 0 ? item.amount.toLocaleString("en-AE", { minimumFractionDigits: 2 }) : "—"}
                </span>
                <button type="button" onClick={e => { e.stopPropagation(); remove(i); }}
                  className="text-red-400 hover:text-red-600 shrink-0 ml-1">
                  <X className="h-3.5 w-3.5" />
                </button>
                {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
              </div>

              {/* Expanded edit panel */}
              {isExpanded && (
                <div className="border-t px-3 py-3 space-y-3 bg-white dark:bg-slate-900">
                  {/* Product selection */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button type="button" size="sm" variant="outline"
                      className="border-amber-300 text-amber-700 hover:bg-amber-50 text-xs h-7"
                      onClick={() => setPickerFor(i)}>
                      <Package className="h-3 w-3 mr-1" />
                      {item.product_full_name ? "Change Product" : "Pick from Library"}
                    </Button>
                    {item.product_full_name && (
                      <button type="button" onClick={() => update(i, { product_full_name: "", brand: "", logo_url: "", system_design_url: "" })}
                        className="text-xs text-muted-foreground hover:text-red-500 flex items-center gap-1">
                        <X className="h-3 w-3" /> Clear product
                      </button>
                    )}
                    {item.product_full_name && (
                      <div className="flex items-center gap-1.5 ml-2">
                        {item.logo_url && <img src={item.logo_url} alt="" className="h-5 object-contain" onError={e => (e.currentTarget.style.display = 'none')} />}
                        <span className="text-xs font-semibold text-amber-700">{item.product_full_name}</span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <Label className="text-xs">Job Description</Label>
                    <Textarea rows={3} placeholder="Enter job description or edit the auto-filled product description..."
                      className="text-xs resize-none"
                      value={item.description}
                      onChange={e => update(i, { description: e.target.value })} />
                  </div>

                  {/* UOM + Qty + Price */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Unit (UOM)</Label>
                      <Select value={item.uom} onValueChange={v => update(i, { uom: v })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {UOM_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Quantity</Label>
                      <Input type="number" className="h-8 text-xs" placeholder="0"
                        value={item.quantity || ""}
                        onChange={e => update(i, { quantity: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Unit Price (AED)</Label>
                      <Input type="number" className="h-8 text-xs" placeholder="0.00"
                        value={item.unit_price || ""}
                        onChange={e => update(i, { unit_price: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>

                  {/* Amount display */}
                  <div className="flex justify-end">
                    <div className="text-sm font-semibold text-amber-700">
                      Amount: AED {(item.amount || 0).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {pickerFor !== null && (
        <ProductPicker workType={workType} onSelect={p => applyProduct(pickerFor, p)} onClose={() => setPickerFor(null)} />
      )}
    </div>
  );
}

// ─── Responsibilities Editor ───────────────────────────────────────────────────
function ResponsibilitiesEditor({ rows, onChange }: { rows: Responsibility[]; onChange: (r: Responsibility[]) => void }) {
  function toggle(i: number, col: "nxs" | "client" | "shared") {
    onChange(rows.map((r, j) => j !== i ? r : { ...r, nxs: col === "nxs", client: col === "client", shared: col === "shared" }));
  }
  return (
    <div className="space-y-2">
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>
              <th className="text-left p-2 text-xs">Responsibility Item</th>
              <th className="text-center p-2 w-14 text-xs">NXS</th>
              <th className="text-center p-2 w-14 text-xs">Client</th>
              <th className="text-center p-2 w-16 text-xs">Shared</th>
              <th className="p-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="p-2">
                  <Input className="h-7 text-xs" value={r.item}
                    onChange={e => onChange(rows.map((rr, j) => j === i ? { ...rr, item: e.target.value } : rr))} />
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
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-400"
                    onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                    <X className="h-3 w-3" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" size="sm"
        onClick={() => onChange([...rows, { item: "", nxs: false, client: true, shared: false }])}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Add Row
      </Button>
    </div>
  );
}

// ─── Payment Editor ────────────────────────────────────────────────────────────
function PaymentEditor({ schedule, onChange }: { schedule: PaymentSchedule[]; onChange: (s: PaymentSchedule[]) => void }) {
  const total = schedule.reduce((s, r) => s + Number(r.percentage || 0), 0);
  function update(i: number, f: string, v: any) { onChange(schedule.map((r, j) => j !== i ? r : { ...r, [f]: v })); }
  return (
    <div className="space-y-2">
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>
              <th className="text-left p-2 text-xs">Milestone</th>
              <th className="text-center p-2 w-16 text-xs">%</th>
              <th className="text-left p-2 text-xs">Notes</th>
              <th className="p-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="p-2"><Input className="h-7 text-xs" value={r.milestone} onChange={e => update(i, "milestone", e.target.value)} /></td>
                <td className="p-2"><Input type="number" className="h-7 text-xs text-center" value={r.percentage} onChange={e => update(i, "percentage", Number(e.target.value))} /></td>
                <td className="p-2"><Input className="h-7 text-xs" value={r.notes} onChange={e => update(i, "notes", e.target.value)} /></td>
                <td className="p-2">
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-400"
                    onClick={() => onChange(schedule.filter((_, j) => j !== i))}>
                    <X className="h-3 w-3" />
                  </Button>
                </td>
              </tr>
            ))}
            <tr className="border-t bg-slate-50 dark:bg-slate-900">
              <td className="p-2 font-semibold text-xs">Total</td>
              <td className={`p-2 text-center font-bold text-xs ${total !== 100 ? "text-red-500" : "text-green-600"}`}>{total}%</td>
              <td colSpan={2} className="p-2 text-xs text-muted-foreground">{total !== 100 ? "⚠ Should total 100%" : "✓ Correct"}</td>
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

// ─── Quotation Form ────────────────────────────────────────────────────────────
function QuotationForm({ initial, onSave, onClose, clients, projects, saving }: {
  initial: Partial<Quotation>; onSave: (q: Quotation) => void; onClose: () => void;
  clients: any[]; projects: any[]; saving: boolean;
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
    warranty_terms: initial.warranty_terms ?? DEFAULT_TC.floor_coating.warranty,
    payment_terms: initial.payment_terms || "",
    payment_schedule: initial.payment_schedule?.length ? initial.payment_schedule : [...DEFAULT_PAYMENT],
    responsibilities: initial.responsibilities?.length ? initial.responsibilities : [...DEFAULT_RESPONSIBILITIES],
    working_conditions: initial.working_conditions ?? DEFAULT_TC.floor_coating.working_conditions,
    terms_conditions: initial.terms_conditions ?? DEFAULT_TC.floor_coating.requirements,
    mobilisation_days: initial.mobilisation_days ?? 7,
    execution_days: initial.execution_days ?? 14,
    validity_days: initial.validity_days ?? 30,
    closing_note: initial.closing_note || "",
    prepared_by: initial.prepared_by || "Sandeep",
    designation: initial.designation || "Managing Director",
    notes: initial.notes || "",
  });

  function up(patch: Partial<Quotation>) { setQ(prev => ({ ...prev, ...patch })); }

  function applyWorkType(wt: string) {
    const tc = DEFAULT_TC[wt] || {};
    up({ work_type: wt, warranty_terms: tc.warranty || "", terms_conditions: tc.requirements || "", working_conditions: tc.working_conditions || "" });
  }

  const { subtotal, vat, total } = calcTotals(q.items, q.optional_items);
  const clientObj = clients.find(c => c.id === q.client_id);

  return (
    <Dialog open onOpenChange={onClose}>
      {/* Full-height dialog with internal scroll per tab */}
      <DialogContent className="max-w-4xl p-0 flex flex-col" style={{ height: "92vh", maxHeight: "92vh" }}>
        {/* Fixed header */}
        <DialogHeader className="px-5 pt-4 pb-3 border-b bg-gradient-to-r from-[#0c1125] to-[#1a2340] rounded-t-lg shrink-0">
          <DialogTitle className="text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-400" />
            {initial.id ? `Edit — ${initial.quot_number}` : "New Professional Quotation"}
          </DialogTitle>
        </DialogHeader>

        {/* Tab bar — fixed */}
        <Tabs defaultValue="header" className="flex flex-col flex-1 min-h-0">
          <TabsList className="shrink-0 grid grid-cols-6 gap-0.5 mx-5 mt-3 h-auto p-1">
            <TabsTrigger value="header" className="text-xs py-1.5">Header</TabsTrigger>
            <TabsTrigger value="scope" className="text-xs py-1.5">Scope / Items</TabsTrigger>
            <TabsTrigger value="photos" className="text-xs py-1.5">Photos</TabsTrigger>
            <TabsTrigger value="commercial" className="text-xs py-1.5">Commercial</TabsTrigger>
            <TabsTrigger value="terms" className="text-xs py-1.5">T&amp;C</TabsTrigger>
            <TabsTrigger value="closing" className="text-xs py-1.5">Closing</TabsTrigger>
          </TabsList>

          {/* Scrollable tab contents */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">

            {/* ── Header ── */}
            <TabsContent value="header" className="mt-0 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Quotation No. *</Label>
                  <Input value={q.quot_number} onChange={e => up({ quot_number: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input type="date" value={q.quot_date} onChange={e => up({ quot_date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Valid Until</Label>
                  <Input type="date" value={q.valid_until} onChange={e => up({ valid_until: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Client *</Label>
                  <Select value={q.client_id} onValueChange={v => up({ client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select client..." /></SelectTrigger>
                    <SelectContent>
                      {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
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
              <div className="space-y-1.5">
                <Label>Subject / Quote Title *</Label>
                <Input placeholder="e.g. Epoxy Floor Coating Works — Al Barsha Car Park" value={q.subject} onChange={e => up({ subject: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Work Type</Label>
                <div className="flex gap-2 flex-wrap">
                  {WORK_TYPES.map(wt => (
                    <button key={wt.value} type="button" onClick={() => applyWorkType(wt.value)}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${q.work_type === wt.value ? "bg-amber-600 border-amber-600 text-white" : "border-slate-300 hover:border-amber-400 hover:text-amber-700"}`}>
                      {wt.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Selecting a work type auto-fills T&C, warranty, and working conditions.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={q.status} onValueChange={v => up({ status: v })}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["draft", "sent", "accepted", "rejected", "expired"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <CoverPhotoUpload url={q.cover_photo_url || ""} onChange={v => up({ cover_photo_url: v })} />
            </TabsContent>

            {/* ── Scope / Items ── */}
            <TabsContent value="scope" className="mt-0 space-y-5">
              <div className="space-y-1.5">
                <Label>Scope of Work Introduction</Label>
                <Textarea rows={3} placeholder="Brief introduction paragraph about the scope of works..."
                  value={q.scope_of_work || ""} onChange={e => up({ scope_of_work: e.target.value })} />
              </div>
              <Separator />
              <LineEditor items={q.items} onChange={items => up({ items })} workType={q.work_type} label="Main Line Items" />
              <Separator />
              <LineEditor items={q.optional_items} onChange={optional_items => up({ optional_items })} workType={q.work_type} label="Optional / Provisional Items" optional />
              <div className="rounded-lg border bg-slate-50 dark:bg-slate-900 p-4 space-y-1">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{fmtAED(subtotal)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">VAT (5%)</span><span className="font-mono">{fmtAED(vat)}</span></div>
                <Separator className="my-1" />
                <div className="flex justify-between font-bold text-base"><span>Total</span><span className="font-mono text-amber-700">{fmtAED(total)}</span></div>
              </div>
            </TabsContent>

            {/* ── Photos ── */}
            <TabsContent value="photos" className="mt-0 space-y-5">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Site Visit / Reference Photos</CardTitle></CardHeader>
                <CardContent>
                  <PhotoUploader label="Site Photos" urls={q.site_photos} onChange={site_photos => up({ site_photos })} max={6} folder="site-photos" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Product / System Design Photos</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-3">Upload product brochure images, brand photos, or system design diagrams.</p>
                  <PhotoUploader label="Product & System Design Images" urls={q.product_photos} onChange={product_photos => up({ product_photos })} max={8} folder="product-photos" />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Commercial ── */}
            <TabsContent value="commercial" className="mt-0 space-y-5">
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
                    <div className="space-y-1.5">
                      <Label>Mobilisation (days)</Label>
                      <Input type="number" value={q.mobilisation_days} onChange={e => up({ mobilisation_days: Number(e.target.value) })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Execution (days)</Label>
                      <Input type="number" value={q.execution_days} onChange={e => up({ execution_days: Number(e.target.value) })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Validity (days)</Label>
                      <Input type="number" value={q.validity_days} onChange={e => up({ validity_days: Number(e.target.value) })} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── T&C ── */}
            <TabsContent value="terms" className="mt-0 space-y-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-lg text-xs text-amber-800 dark:text-amber-200">
                Auto-filled based on work type selected in Header. Edit freely.
              </div>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Client Requirements &amp; Obligations</CardTitle></CardHeader>
                <CardContent><Textarea rows={9} value={q.terms_conditions || ""} onChange={e => up({ terms_conditions: e.target.value })} /></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Warranty Terms</CardTitle></CardHeader>
                <CardContent><Textarea rows={7} value={q.warranty_terms || ""} onChange={e => up({ warranty_terms: e.target.value })} /></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Working Conditions &amp; Exclusions</CardTitle></CardHeader>
                <CardContent><Textarea rows={9} value={q.working_conditions || ""} onChange={e => up({ working_conditions: e.target.value })} /></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Additional Notes</CardTitle></CardHeader>
                <CardContent><Textarea rows={3} placeholder="Any additional notes..." value={q.notes || ""} onChange={e => up({ notes: e.target.value } as any)} /></CardContent>
              </Card>
            </TabsContent>

            {/* ── Closing ── */}
            <TabsContent value="closing" className="mt-0 space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Closing Paragraph</CardTitle></CardHeader>
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
                    <div className="space-y-1.5"><Label>Prepared By</Label><Input value={q.prepared_by} onChange={e => up({ prepared_by: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label>Designation</Label><Input value={q.designation} onChange={e => up({ designation: e.target.value })} /></div>
                  </div>
                </CardContent>
              </Card>
              {/* Signature preview */}
              <Card className="bg-slate-50 dark:bg-slate-900">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Signature Block Preview</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-8 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">For &amp; on behalf of:</p>
                      <p className="font-bold text-amber-700 mt-0.5">NXS Contracting &amp; Building Maintenance LLC</p>
                      <div className="mt-6 border-t pt-2">
                        <p className="font-medium">{q.prepared_by}</p>
                        <p className="text-xs text-muted-foreground">{q.designation}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Accepted by:</p>
                      <p className="font-bold mt-0.5">{clientObj?.name || "Client Name"}</p>
                      <div className="mt-6 border-t pt-2 space-y-1">
                        <p className="text-xs text-muted-foreground">Authorised Signatory</p>
                        <p className="text-xs text-muted-foreground">Date: ________________________</p>
                        <p className="text-xs text-muted-foreground">Stamp: ______________________</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

          </div>{/* end scrollable area */}

          {/* Fixed footer */}
          <div className="shrink-0 px-5 py-3 border-t flex items-center justify-between bg-white dark:bg-slate-950">
            <div className="text-sm text-muted-foreground">
              Total: <span className="font-bold text-amber-700 text-base ml-1">{fmtAED(total)}</span>
              <span className="ml-1.5 text-xs">incl. 5% VAT</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button className="bg-[#0c1125] hover:bg-[#1a2340] text-white" disabled={saving}
                onClick={() => { const t = calcTotals(q.items, q.optional_items); onSave({ ...q, subtotal: t.subtotal, vat_amount: t.vat, total_amount: t.total }); }}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Save Quotation
              </Button>
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─── Print View ───────────────────────────────────────────────────────────────
function PrintView({ q, clients, onClose }: { q: Quotation; clients: any[]; onClose: () => void }) {
  const client = clients.find(c => c.id === q.client_id);
  const { subtotal, vat, total } = calcTotals(q.items, q.optional_items);
  const mainItems = q.items || [];
  const optItems = q.optional_items || [];

  const ST = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 12, fontWeight: 800, color: "#0c1125", borderBottom: "2px solid #bd7214", paddingBottom: 4, marginBottom: 10, textTransform: "uppercase" as const, letterSpacing: 1 }}>{children}</div>
  );
  const Sub = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 10, fontWeight: 700, color: "#bd7214", textTransform: "uppercase" as const, margin: "8px 0 4px" }}>{children}</div>
  );

  function handleOpenPrintTab() {
    // Grab the fully-rendered quote HTML from #pv and open in a brand-new tab.
    // This ensures ALL pages print (no truncation) and there is no leading blank
    // page introduced by the browser's own print pipeline running inside a dialog.
    const el = document.getElementById("pv");
    if (!el) return;
    // Wrap each top-level section in <div class="page">…</div> so the print CSS
    // in openPrintTab paginates cleanly (removes the leading blank page too).
    const html = `<div style="font-family:Arial,sans-serif; color:#1a1a1a;">${el.innerHTML}</div>`;
    openPrintTab(html, `Quotation ${q.quot_number}`);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 flex flex-col" style={{ height: "92vh", maxHeight: "92vh" }}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0">
          <span className="font-semibold text-sm">Print Preview — {q.quot_number}</span>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleOpenPrintTab} className="bg-amber-600 hover:bg-amber-700 text-white">
              <ExternalLink className="h-4 w-4 mr-1" /> Open Print View
            </Button>
            <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <style>{`@media print { body * { visibility: hidden; } #pv, #pv * { visibility: visible; } #pv { position:fixed;top:0;left:0;width:100%; } .no-print { display:none!important; } } @page { margin:12mm; size:A4; }`}</style>
          <div id="pv" style={{ fontFamily: "Arial, sans-serif", fontSize: 11, color: "#1a1a1a", background: "#fff" }}>

            {/* COVER */}
            <div style={{ display: "flex", flexDirection: "column", pageBreakAfter: "always" }}>
              <div style={{ background: "#0c1125", padding: "14px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <img src={COMPANY.logo} alt="NXS" style={{ height: 38, objectFit: "contain" }} onError={e => (e.currentTarget.style.display = 'none')} />
                <div style={{ textAlign: "right", color: "#fff" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#bd7214", letterSpacing: 2 }}>QUOTATION</div>
                  <div style={{ fontSize: 10 }}>Ref: {q.quot_number} &nbsp;|&nbsp; Date: {fmtDate(q.quot_date)}</div>
                </div>
              </div>
              {q.cover_photo_url && (
                <div style={{ height: 300, overflow: "hidden" }}>
                  <img src={q.cover_photo_url} alt="cover" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => (e.currentTarget.style.display = 'none')} />
                </div>
              )}
              <div style={{ padding: "14px 22px", borderTop: "3px solid #bd7214", flex: 1 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                  <div>
                    <div style={{ fontSize: 8, fontWeight: 600, color: "#bd7214", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Submitted To</div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{client?.name || "—"}</div>
                    {client?.address && <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>{client.address}</div>}
                    {client?.contact_person && <div style={{ fontSize: 10 }}>Attn: {client.contact_person}</div>}
                    {client?.trn && <div style={{ fontSize: 10 }}>TRN: {client.trn}</div>}
                  </div>
                  <div>
                    <div style={{ fontSize: 8, fontWeight: 600, color: "#bd7214", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Submitted By</div>
                    <div style={{ fontWeight: 700, fontSize: 12 }}>{COMPANY.name}</div>
                    <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>{COMPANY.address}</div>
                    <div style={{ fontSize: 10 }}>T: {COMPANY.phone} | E: {COMPANY.email}</div>
                  </div>
                </div>
                <div style={{ marginTop: 10, padding: "7px 10px", background: "#f9f6ef", borderLeft: "3px solid #bd7214" }}>
                  <div style={{ fontWeight: 600, fontSize: 10 }}>Subject: {q.subject}</div>
                  <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>
                    Valid Until: {fmtDate(q.valid_until)} &nbsp;|&nbsp;
                    Work Type: {WORK_TYPES.find(w => w.value === q.work_type)?.label}
                  </div>
                </div>
              </div>
            </div>

            {/* SCOPE */}
            <div style={{ pageBreakBefore: "always", padding: "22px" }}>
              <ST>Scope of Work</ST>
              {q.scope_of_work && <p style={{ fontSize: 11, lineHeight: 1.7, marginBottom: 14, color: "#333" }}>{q.scope_of_work}</p>}

              {(q.site_photos || []).length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <Sub>Site Reference Photos</Sub>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {q.site_photos.map((u, i) => <img key={i} src={u} alt="" style={{ height: 90, width: 130, objectFit: "cover", borderRadius: 3, border: "1px solid #ddd" }} onError={e => (e.currentTarget.style.display = 'none')} />)}
                  </div>
                </div>
              )}

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                <thead>
                  <tr style={{ background: "#0c1125", color: "#fff" }}>
                    <th style={{ padding: "5px 7px", textAlign: "left", width: 24 }}>Sl.</th>
                    <th style={{ padding: "5px 7px", textAlign: "left" }}>Job Description</th>
                    <th style={{ padding: "5px 7px", textAlign: "center", width: 40 }}>UOM</th>
                    <th style={{ padding: "5px 7px", textAlign: "center", width: 44 }}>Qty</th>
                    <th style={{ padding: "5px 7px", textAlign: "right", width: 70 }}>Unit Rate</th>
                    <th style={{ padding: "5px 7px", textAlign: "right", width: 80 }}>Amount (AED)</th>
                  </tr>
                </thead>
                <tbody>
                  {mainItems.map((item, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #e5e7eb", background: i % 2 ? "#fafafa" : "#fff" }}>
                      <td style={{ padding: "5px 7px", color: "#888", verticalAlign: "top" }}>{item.sl}</td>
                      <td style={{ padding: "5px 7px", verticalAlign: "top" }}>
                        {item.product_full_name && (
                          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                            {item.logo_url && <img src={item.logo_url} alt="" style={{ height: 13, objectFit: "contain" }} onError={e => (e.currentTarget.style.display = 'none')} />}
                            <span style={{ fontWeight: 700, color: "#bd7214" }}>{item.product_full_name}</span>
                          </div>
                        )}
                        <div style={{ color: "#333", lineHeight: 1.5 }}>{item.description}</div>
                        {item.system_design_url && <img src={item.system_design_url} alt="system" style={{ height: 44, marginTop: 3, objectFit: "contain" }} onError={e => (e.currentTarget.style.display = 'none')} />}
                      </td>
                      <td style={{ padding: "5px 7px", textAlign: "center", verticalAlign: "top" }}>{item.uom}</td>
                      <td style={{ padding: "5px 7px", textAlign: "center", verticalAlign: "top" }}>{item.quantity}</td>
                      <td style={{ padding: "5px 7px", textAlign: "right", verticalAlign: "top" }}>{Number(item.unit_price).toLocaleString("en-AE", { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: "5px 7px", textAlign: "right", verticalAlign: "top", fontWeight: 600 }}>{Number(item.amount).toLocaleString("en-AE", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {optItems.length > 0 && (
                <>
                  <Sub>Optional / Provisional Items (Excluded from Total)</Sub>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                    <tbody>
                      {optItems.map((item, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #e5e7eb", background: "#fffbf0" }}>
                          <td style={{ padding: "4px 7px", width: 24, color: "#888" }}>{item.sl}</td>
                          <td style={{ padding: "4px 7px" }}>
                            {item.product_full_name && <div style={{ fontWeight: 600, color: "#888" }}>{item.product_full_name}</div>}
                            <div style={{ color: "#555" }}>{item.description}</div>
                          </td>
                          <td style={{ padding: "4px 7px", textAlign: "center", width: 40 }}>{item.uom}</td>
                          <td style={{ padding: "4px 7px", textAlign: "center", width: 44 }}>{item.quantity}</td>
                          <td style={{ padding: "4px 7px", textAlign: "right", width: 70 }}>{Number(item.unit_price).toLocaleString("en-AE", { minimumFractionDigits: 2 })}</td>
                          <td style={{ padding: "4px 7px", textAlign: "right", width: 80, color: "#888" }}>{Number(item.amount).toLocaleString("en-AE", { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                <table style={{ fontSize: 11, minWidth: 250 }}>
                  <tbody>
                    <tr><td style={{ padding: "2px 10px 2px 0", color: "#555" }}>Subtotal</td><td style={{ textAlign: "right", fontFamily: "monospace" }}>AED {subtotal.toLocaleString("en-AE", { minimumFractionDigits: 2 })}</td></tr>
                    <tr><td style={{ padding: "2px 10px 2px 0", color: "#555" }}>VAT (5%)</td><td style={{ textAlign: "right", fontFamily: "monospace" }}>AED {vat.toLocaleString("en-AE", { minimumFractionDigits: 2 })}</td></tr>
                    <tr style={{ borderTop: "2px solid #0c1125" }}>
                      <td style={{ padding: "5px 10px 5px 0", fontWeight: 700, fontSize: 13 }}>TOTAL</td>
                      <td style={{ textAlign: "right", fontWeight: 800, fontSize: 13, color: "#bd7214", fontFamily: "monospace" }}>AED {total.toLocaleString("en-AE", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* COMMERCIAL */}
            <div style={{ pageBreakBefore: "always", padding: "22px" }}>
              <ST>Commercial Terms</ST>
              {q.payment_schedule?.length > 0 && (
                <>
                  <Sub>Payment Schedule</Sub>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, marginBottom: 14 }}>
                    <thead><tr style={{ background: "#0c1125", color: "#fff" }}>
                      <th style={{ padding: "5px 7px", textAlign: "left" }}>Milestone</th>
                      <th style={{ padding: "5px 7px", textAlign: "center", width: 44 }}>%</th>
                      <th style={{ padding: "5px 7px", textAlign: "right", width: 110 }}>Amount (AED)</th>
                      <th style={{ padding: "5px 7px", textAlign: "left" }}>Notes</th>
                    </tr></thead>
                    <tbody>{q.payment_schedule.map((p, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #e5e7eb", background: i % 2 ? "#fafafa" : "#fff" }}>
                        <td style={{ padding: "4px 7px" }}>{p.milestone}</td>
                        <td style={{ padding: "4px 7px", textAlign: "center" }}>{p.percentage}%</td>
                        <td style={{ padding: "4px 7px", textAlign: "right", fontFamily: "monospace" }}>{(total * p.percentage / 100).toLocaleString("en-AE", { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: "4px 7px", color: "#666" }}>{p.notes}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </>
              )}
              <Sub>Project Timeline</Sub>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, marginBottom: 14 }}>
                <tbody>
                  {[["Material Delivery", `Within ${q.mobilisation_days} working days from advance payment`],
                    ["Mobilisation", `Within ${q.mobilisation_days} working days from advance & site readiness`],
                    ["Execution Duration", `Approximately ${q.execution_days} working days from mobilisation`],
                    ["Quotation Validity", `${q.validity_days} days from date of quotation`],
                    ["VAT", "5% VAT applicable as per UAE Federal Tax Authority regulations"],
                  ].map(([k, v], i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "4px 7px", fontWeight: 600, width: "28%", color: "#0c1125" }}>{k}</td>
                      <td style={{ padding: "4px 7px", color: "#444" }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {q.responsibilities?.length > 0 && (
                <>
                  <Sub>Responsibilities Matrix</Sub>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                    <thead><tr style={{ background: "#0c1125", color: "#fff" }}>
                      <th style={{ padding: "5px 7px", textAlign: "left" }}>Item</th>
                      <th style={{ padding: "5px 7px", textAlign: "center", width: 44 }}>NXS</th>
                      <th style={{ padding: "5px 7px", textAlign: "center", width: 54 }}>Client</th>
                      <th style={{ padding: "5px 7px", textAlign: "center", width: 54 }}>Shared</th>
                    </tr></thead>
                    <tbody>{q.responsibilities.map((r, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #e5e7eb", background: i % 2 ? "#fafafa" : "#fff" }}>
                        <td style={{ padding: "4px 7px" }}>{r.item}</td>
                        <td style={{ padding: "4px 7px", textAlign: "center" }}>{r.nxs ? "✓" : ""}</td>
                        <td style={{ padding: "4px 7px", textAlign: "center" }}>{r.client ? "✓" : ""}</td>
                        <td style={{ padding: "4px 7px", textAlign: "center" }}>{r.shared ? "✓" : ""}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </>
              )}
            </div>

            {/* T&C */}
            <div style={{ pageBreakBefore: "always", padding: "22px" }}>
              <ST>Terms &amp; Conditions</ST>
              {q.terms_conditions && (<><Sub>Client Requirements &amp; Obligations</Sub><pre style={{ fontFamily: "Arial,sans-serif", fontSize: 10, lineHeight: 1.7, whiteSpace: "pre-wrap", color: "#333", marginBottom: 12 }}>{q.terms_conditions}</pre></>)}
              {q.warranty_terms && (<><Sub>Warranty Terms</Sub><pre style={{ fontFamily: "Arial,sans-serif", fontSize: 10, lineHeight: 1.7, whiteSpace: "pre-wrap", color: "#333", marginBottom: 12 }}>{q.warranty_terms}</pre></>)}
              {q.working_conditions && (<><Sub>Working Conditions &amp; Exclusions</Sub><pre style={{ fontFamily: "Arial,sans-serif", fontSize: 10, lineHeight: 1.7, whiteSpace: "pre-wrap", color: "#333", marginBottom: 12 }}>{q.working_conditions}</pre></>)}
              {(q.product_photos || []).length > 0 && (
                <><Sub>Product Reference / System Design</Sub>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {q.product_photos.map((u, i) => <img key={i} src={u} alt="" style={{ height: 90, maxWidth: 160, objectFit: "contain", border: "1px solid #ddd", borderRadius: 3 }} onError={e => (e.currentTarget.style.display = 'none')} />)}
                  </div></>
              )}
            </div>

            {/* CLOSING */}
            <div style={{ pageBreakBefore: "always", padding: "22px" }}>
              <ST>Acceptance</ST>
              <p style={{ fontSize: 11, lineHeight: 1.8, color: "#333", marginBottom: 16 }}>
                {q.closing_note || "We trust the above quotation meets your requirements and look forward to your valued confirmation. Should you require any clarifications or wish to discuss the scope of work further, please do not hesitate to contact us. We remain committed to delivering quality workmanship within the agreed timeline."}
              </p>
              <p style={{ fontSize: 9, color: "#777", fontStyle: "italic", marginBottom: 22 }}>
                Above information is not an invoice. This constitutes a commercial quotation only. By signing below, the client confirms acceptance of all terms, conditions, scope of work, and commercial terms as stated in this document.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 36, marginTop: 20 }}>
                <div style={{ borderTop: "1px solid #ccc", paddingTop: 8 }}>
                  <div style={{ fontSize: 9, color: "#888" }}>For &amp; on behalf of:</div>
                  <div style={{ fontWeight: 700, color: "#bd7214", fontSize: 11, marginTop: 2 }}>NXS Contracting &amp; Building Maintenance LLC</div>
                  <div style={{ marginTop: 30, borderTop: "1px solid #333", paddingTop: 4 }}>
                    <div style={{ fontWeight: 600 }}>{q.prepared_by}</div>
                    <div style={{ fontSize: 9, color: "#666" }}>{q.designation}</div>
                    <div style={{ marginTop: 6, height: 44, border: "1px dashed #ccc", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 8, color: "#bbb" }}>Signature &amp; Stamp</span>
                    </div>
                  </div>
                </div>
                <div style={{ borderTop: "1px solid #ccc", paddingTop: 8 }}>
                  <div style={{ fontSize: 9, color: "#888" }}>Accepted by:</div>
                  <div style={{ fontWeight: 700, fontSize: 11, marginTop: 2 }}>{client?.name || "Client"}</div>
                  <div style={{ marginTop: 30, borderTop: "1px solid #333", paddingTop: 4 }}>
                    <div style={{ fontSize: 10, color: "#555" }}>Authorised Signatory</div>
                    <div style={{ fontSize: 10, color: "#555", marginTop: 5 }}>Name: ___________________________</div>
                    <div style={{ fontSize: 10, color: "#555", marginTop: 5 }}>Date: ____________________________</div>
                    <div style={{ fontSize: 10, color: "#555", marginTop: 5 }}>Stamp: __________________________</div>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 36, paddingTop: 10, borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", fontSize: 8, color: "#aaa" }}>
                <span>{COMPANY.name} | {COMPANY.address}</span>
                <span>T: {COMPANY.phone} | E: {COMPANY.email} | W: {COMPANY.website}</span>
              </div>
            </div>

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── STATUS COLORS ─────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700", sent: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800", rejected: "bg-red-100 text-red-800",
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/quotations"] }); toast({ title: "Quotation saved" }); setOpen(false); setEditing(null); },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/quotations/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/quotations"] }); toast({ title: "Deleted" }); },
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

  function newQuotation() {
    setEditing({
      quot_number: nextNumber("NXS-QT"), quot_date: todayLocal(), status: "draft",
      work_type: "floor_coating", items: [], optional_items: [], site_photos: [],
      product_photos: [], scope_items: [], payment_schedule: [...DEFAULT_PAYMENT],
      responsibilities: [...DEFAULT_RESPONSIBILITIES], mobilisation_days: 7,
      execution_days: 14, validity_days: 30, prepared_by: "Sandeep",
      designation: "Managing Director",
    });
    setOpen(true);
  }

  const filtered = (quotations as Quotation[]).filter(q =>
    search === "" ||
    q.quot_number?.toLowerCase().includes(search.toLowerCase()) ||
    q.subject?.toLowerCase().includes(search.toLowerCase()) ||
    (clients as any[]).find(c => c.id === q.client_id)?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0c1125] dark:text-white">Quotations</h1>
          <p className="text-sm text-muted-foreground">Professional quotations with product library, SOW templates &amp; T&C</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={seedProducts} disabled={seeding}
            className="border-amber-300 text-amber-700 hover:bg-amber-50">
            {seeding ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <BookOpen className="h-4 w-4 mr-1" />}
            Load Product Library
          </Button>
          <Button onClick={newQuotation} className="bg-[#0c1125] hover:bg-[#1a2340] text-white">
            <Plus className="h-4 w-4 mr-1" /> New Quotation
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search quotations..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

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
            {isLoading
              ? <tr><td colSpan={8} className="text-center p-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
              : filtered.length === 0
                ? <tr><td colSpan={8} className="text-center p-10 text-muted-foreground text-sm">No quotations yet — click "New Quotation" to create one.</td></tr>
                : filtered.map((q: Quotation) => (
                  <tr key={q.id} className="border-t hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-mono text-xs font-semibold text-amber-700">{q.quot_number}</td>
                    <td className="p-3">{(clients as any[]).find(c => c.id === q.client_id)?.name || "—"}</td>
                    <td className="p-3 max-w-[180px] truncate text-muted-foreground text-xs">{q.subject || "—"}</td>
                    <td className="p-3"><Badge variant="outline" className="text-xs">{WORK_TYPES.find(w => w.value === q.work_type)?.label?.replace(" Works", "") || "—"}</Badge></td>
                    <td className="p-3 text-xs">{fmtDate(q.quot_date)}</td>
                    <td className="p-3 text-right font-mono font-semibold text-sm">{fmtAED(q.total_amount)}</td>
                    <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[q.status] || "bg-slate-100 text-slate-700"}`}>{q.status}</span></td>
                    <td className="p-3">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setPrinting(q)}><Printer className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => { setEditing(q); setOpen(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-red-400 hover:bg-red-50"
                          onClick={() => { if (confirm("Delete this quotation?")) remove.mutate(q.id!); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>

      {open && editing && (
        <QuotationForm initial={editing} clients={clients as any[]} projects={projects as any[]}
          onSave={q => save.mutate(q)} onClose={() => { setOpen(false); setEditing(null); }} saving={save.isPending} />
      )}

      {printing && <PrintView q={printing} clients={clients as any[]} onClose={() => setPrinting(null)} />}
    </div>
  );
}
