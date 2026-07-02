import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "node:http";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import supabase from "./supabase";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

// ---- file upload (Supabase Storage) ----------------------------------------
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const JWT_SECRET = process.env.JWT_SECRET || "";


interface AuthedRequest extends Request {
  user?: { id: string; email: string; full_name: string; role: string };
}

// ---- helpers ----------------------------------------------------------------
function sign(user: { id: string; email: string; full_name: string; role: string }) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
}

function auth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "No token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET) as any;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

function requireRole(...roles: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: "Unauthenticated" });
    if (req.user.role === "admin" || roles.includes(req.user.role)) return next();
    return res.status(403).json({ message: "Forbidden" });
  };
}

// JSON columns stored as text; parse on read, stringify on write
function parseJson(val: any, fallback: any = []) {
  if (val == null) return fallback;
  if (typeof val === "object") return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

// A generic CRUD factory for a table with a set of JSON columns.
function registerCrud(
  app: Express,
  path: string,
  table: string,
  opts: { jsonCols?: string[]; orderBy?: string; ascending?: boolean } = {}
) {
  const jsonCols = opts.jsonCols || [];
  const orderBy = opts.orderBy || "created_at";
  const ascending = opts.ascending ?? false;

  const hydrate = (row: any) => {
    if (!row) return row;
    for (const c of jsonCols) row[c] = parseJson(row[c]);
    return row;
  };
  const dehydrate = (body: any) => {
    const out = { ...body };
    delete out.id;
    for (const c of jsonCols) {
      if (out[c] !== undefined && typeof out[c] !== "string") out[c] = JSON.stringify(out[c]);
    }
    return out;
  };

  app.get(`/api/${path}`, auth, async (req: AuthedRequest, res) => {
    let q = supabase.from(table).select("*");
    // simple query filters
    for (const [k, v] of Object.entries(req.query)) {
      if (["order", "limit"].includes(k)) continue;
      q = q.eq(k, v as string);
    }
    let query = q.order(orderBy, { ascending });
    let { data, error } = await query;
    if (error) {
      // retry without ordering (column may not exist)
      const r2 = await supabase.from(table).select("*");
      if (r2.error) return res.status(500).json({ message: r2.error.message });
      data = r2.data;
    }
    res.json((data || []).map(hydrate));
  });

  app.get(`/api/${path}/:id`, auth, async (req, res) => {
    const { data, error } = await supabase.from(table).select("*").eq("id", req.params.id).single();
    if (error) return res.status(404).json({ message: error.message });
    res.json(hydrate(data));
  });

  app.post(`/api/${path}`, auth, async (req, res) => {
    const { data, error } = await supabase.from(table).insert(dehydrate(req.body)).select().single();
    if (error) return res.status(400).json({ message: error.message });
    res.json(hydrate(data));
  });

  app.put(`/api/${path}/:id`, auth, async (req, res) => {
    const { data, error } = await supabase.from(table).update(dehydrate(req.body)).eq("id", req.params.id).select().single();
    if (error) return res.status(400).json({ message: error.message });
    res.json(hydrate(data));
  });

  app.delete(`/api/${path}/:id`, auth, async (req, res) => {
    const { error } = await supabase.from(table).delete().eq("id", req.params.id);
    if (error) return res.status(400).json({ message: error.message });
    res.json({ ok: true });
  });
}

// ---- seed -------------------------------------------------------------------
// Only creates system login accounts + chart of accounts if DB is empty.
// NO demo data — database starts clean for real use.
async function seedIfEmpty() {
  try {
    const { data: existing, error } = await supabase.from("users").select("id").limit(1);
    if (error) { console.error("Seed check error:", error.message); return; }
    if (existing && existing.length > 0) return; // already initialised

    console.log("Initialising NXS ERP — creating system accounts...");
    const users = [
      { email: "admin@nxs-uae.com",      password_hash: await bcrypt.hash("NXS@2026", 10), full_name: "Admin User",   role: "admin",       is_active: true },
      { email: "engineer@nxs-uae.com",   password_hash: await bcrypt.hash("NXS@2026", 10), full_name: "Engineer",     role: "engineer",    is_active: true },
      { email: "accountant@nxs-uae.com", password_hash: await bcrypt.hash("NXS@2026", 10), full_name: "Accountant",   role: "accountant",  is_active: true },
      { email: "store@nxs-uae.com",      password_hash: await bcrypt.hash("NXS@2026", 10), full_name: "Store Keeper", role: "storekeeper", is_active: true },
    ];
    await supabase.from("users").insert(users);

    // Chart of accounts — UAE construction standard
    const accounts = [
      { account_code: "1000", name: "Cash & Bank",                       type: "asset",     is_active: true },
      { account_code: "1100", name: "Accounts Receivable",               type: "asset",     is_active: true },
      { account_code: "1150", name: "Retention Receivable",              type: "asset",     is_active: true },
      { account_code: "1200", name: "Work in Progress",                  type: "asset",     is_active: true },
      { account_code: "1300", name: "Inventory - Materials",             type: "asset",     is_active: true },
      { account_code: "1400", name: "Fixed Assets - Vehicles & Equip",  type: "asset",     is_active: true },
      { account_code: "1500", name: "VAT Input (Recoverable)",           type: "asset",     is_active: true },
      { account_code: "2000", name: "Accounts Payable",                  type: "liability", is_active: true },
      { account_code: "2100", name: "Accrued Expenses",                  type: "liability", is_active: true },
      { account_code: "2200", name: "VAT Output (Payable)",              type: "liability", is_active: true },
      { account_code: "2300", name: "Advances from Customers",           type: "liability", is_active: true },
      { account_code: "3000", name: "Share Capital",                     type: "equity",    is_active: true },
      { account_code: "3100", name: "Retained Earnings",                 type: "equity",    is_active: true },
      { account_code: "4000", name: "Contract Revenue",                  type: "revenue",   is_active: true },
      { account_code: "4100", name: "Maintenance Revenue",               type: "revenue",   is_active: true },
      { account_code: "5000", name: "Direct Material Cost",              type: "expense",   is_active: true },
      { account_code: "5100", name: "Direct Labour Cost",                type: "expense",   is_active: true },
      { account_code: "5200", name: "Subcontractor Cost",                type: "expense",   is_active: true },
      { account_code: "5300", name: "Equipment & Vehicle Cost",          type: "expense",   is_active: true },
      { account_code: "6000", name: "Salaries & Wages",                  type: "expense",   is_active: true },
      { account_code: "6100", name: "Rent Expense",                      type: "expense",   is_active: true },
      { account_code: "6200", name: "Utilities",                         type: "expense",   is_active: true },
      { account_code: "6300", name: "Office & Admin Expenses",           type: "expense",   is_active: true },
      { account_code: "6400", name: "Depreciation",                      type: "expense",   is_active: true },
    ];
    await supabase.from("accounts").insert(accounts);

    // Default expense categories
    await supabase.from("expense_categories").insert([
      { name: "Office Supplies" },
      { name: "Travel & Transport" },
      { name: "Utilities" },
      { name: "Maintenance & Repairs" },
      { name: "Subcontractor Payments" },
      { name: "Staff Welfare" },
      { name: "Professional Fees" },
      { name: "Marketing & Advertising" },
    ]);

    console.log("Initialisation complete.");
  } catch (e: any) {
    console.error("Seed error:", e?.message || e);
  }
}

// ---- routes -----------------------------------------------------------------
export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  seedIfEmpty().catch(err => console.error('Seed failed (non-fatal):', err?.message || err));

  // AUTH
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: "Email and password required" });
    const { data: user, error } = await supabase.from("users").select("*").eq("email", email).single();
    if (error || !user) return res.status(401).json({ message: "Invalid credentials" });
    if (!user.is_active) return res.status(403).json({ message: "Account disabled" });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });
    const payload = { id: user.id, email: user.email, full_name: user.full_name, role: user.role };
    res.json({ token: sign(payload), user: payload });
  });

  app.get("/api/auth/me", auth, (req: AuthedRequest, res) => res.json(req.user));

  // DASHBOARD
  app.get("/api/dashboard", auth, async (_req, res) => {
    const [projects, employees, alerts] = await Promise.all([
      supabase.from("projects").select("*"),
      supabase.from("employees").select("*"),
      supabase.from("expiry_alerts").select("*"),
    ]);
    const projs = projects.data || [];
    const emps = employees.data || [];
    const activeProjects = projs.filter((p: any) => p.status === "active").length;
    const totalContract = projs.reduce((s: number, p: any) => s + (Number(p.contract_value) || 0), 0);
    const totalBudget = projs.reduce((s: number, p: any) => s + (Number(p.budgeted_cost) || 0), 0);
    const budgetPct = totalContract ? Math.round((totalBudget / totalContract) * 100) : 0;
    const activeEmployees = emps.filter((e: any) => (e.status || "active") === "active").length;
    res.json({
      activeProjects,
      totalContractValue: totalContract,
      totalBudget,
      budgetPct,
      activeEmployees,
      projects: projs,
      alerts: alerts.data || [],
    });
  });

  // EXPIRY ALERTS — computed live from employees & vehicles
  app.get("/api/expiry", auth, async (_req, res) => {
    const [emps, vehicles, acks] = await Promise.all([
      supabase.from("employees").select("*"),
      supabase.from("vehicles").select("*"),
      supabase.from("expiry_alerts").select("*"),
    ]);
    const ackMap = new Map<string, any>();
    (acks.data || []).forEach((a: any) => ackMap.set(`${a.entity_type}:${a.entity_id}:${a.expiry_date}`, a));
    const today = new Date();
    const items: any[] = [];
    const push = (entity_type: string, entity_id: string, entity_name: string, label: string, date?: string) => {
      if (!date) return;
      const exp = new Date(date);
      const days = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
      if (days > 60 || days < -30) return;
      const key = `${entity_type}:${entity_id}:${date}`;
      items.push({ entity_type, entity_id, entity_name: `${entity_name} — ${label}`, expiry_date: date, days_remaining: days, is_acknowledged: ackMap.get(key)?.is_acknowledged || false });
    };
    (emps.data || []).forEach((e: any) => {
      push("employee", e.id, e.full_name, "Passport", e.passport_expiry);
      push("employee", e.id, e.full_name, "Visa", e.visa_expiry);
      push("employee", e.id, e.full_name, "Emirates ID", e.emirates_id_expiry);
      push("employee", e.id, e.full_name, "Labour Card", e.labour_card_expiry);
    });
    (vehicles.data || []).forEach((v: any) => {
      push("vehicle", v.id, v.plate_number, "Registration", v.registration_expiry);
      push("vehicle", v.id, v.plate_number, "Insurance", v.insurance_expiry);
    });
    items.sort((a, b) => a.days_remaining - b.days_remaining);
    res.json(items);
  });

  app.post("/api/expiry/acknowledge", auth, async (req, res) => {
    const { entity_type, entity_id, entity_name, expiry_date } = req.body || {};
    const { data, error } = await supabase.from("expiry_alerts")
      .insert({ entity_type, entity_id, entity_name, expiry_date, is_acknowledged: true }).select().single();
    if (error) return res.status(400).json({ message: error.message });
    res.json(data);
  });

  // PAYROLL generation
  // OT formula: monthly mandatory hrs = 9 × 26 = 234
  // OT rate = basic_salary / 234 * 1.5
  // Only sum OT hours from current month timesheets
  const MONTHLY_MANDATORY_HRS = 234;
  app.post("/api/payroll/generate", auth, requireRole("accountant"), async (req, res) => {
    const { month, year } = req.body || {};
    if (!month || !year) return res.status(400).json({ message: "month and year required" });
    const { data: emps } = await supabase.from("employees").select("*").eq("status", "active");
    // Filter timesheets for this month only
    const monthStart = `${year}-${String(month).padStart(2,'0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? Number(year) + 1 : Number(year);
    const monthEnd = `${nextYear}-${String(nextMonth).padStart(2,'0')}-01`;
    const { data: ts } = await supabase.from("timesheets").select("*")
      .gte("work_date", monthStart).lt("work_date", monthEnd);
    const rows: any[] = [];
    for (const e of emps || []) {
      // Sum overtime hours for this employee this month
      const otHours = (ts || []).filter((t: any) => t.employee_id === e.id)
        .reduce((s: number, t: any) => s + (Number(t.hours_overtime) || 0), 0);
      const basic = Number(e.basic_salary) || 0;
      // OT rate = basic / 234 mandatory hrs × 1.5
      const otRate = basic / MONTHLY_MANDATORY_HRS * 1.5;
      const overtimePay = Math.round(otHours * otRate * 100) / 100;
      const housing = Number(e.housing_allowance) || 0;
      const transport = Number(e.transport_allowance) || 0;
      const other = Number(e.other_allowance) || 0;
      const net = basic + housing + transport + other + overtimePay;
      rows.push({
        employee_id: e.id, month, year, basic_salary: basic, housing_allowance: housing,
        transport_allowance: transport, other_allowance: other,
        overtime_hours: Math.round(otHours * 100) / 100,
        overtime_pay: overtimePay,
        special_bonus: 0, medical_leave_days: 0, annual_leave_days: 0, leave_deduction: 0,
        deductions: 0, net_salary: Math.round(net * 100) / 100, status: "draft",
      });
    }
    // remove existing drafts for the period
    await supabase.from("payroll").delete().eq("month", month).eq("year", year).eq("status", "draft");
    const { data, error } = await supabase.from("payroll").insert(rows).select();
    if (error) return res.status(400).json({ message: error.message });
    res.json(data);
  });

  // STOCK balances view
  app.get("/api/stock/balances", auth, async (_req, res) => {
    const [ledger, items, locs] = await Promise.all([
      supabase.from("stock_ledger").select("*"),
      supabase.from("inventory_items").select("*"),
      supabase.from("stock_locations").select("*"),
    ]);
    const itemMap = new Map((items.data || []).map((i: any) => [i.id, i]));
    const locMap = new Map((locs.data || []).map((l: any) => [l.id, l]));
    const bal = new Map<string, number>();
    for (const m of ledger.data || []) {
      const qty = Number(m.quantity) || 0;
      if (m.to_location_id) bal.set(`${m.item_id}:${m.to_location_id}`, (bal.get(`${m.item_id}:${m.to_location_id}`) || 0) + qty);
      if (m.from_location_id) bal.set(`${m.item_id}:${m.from_location_id}`, (bal.get(`${m.item_id}:${m.from_location_id}`) || 0) - qty);
    }
    const out: any[] = [];
    for (const [key, quantity] of Array.from(bal.entries())) {
      const [itemId, locId] = key.split(":");
      const item: any = itemMap.get(itemId);
      const loc: any = locMap.get(locId);
      out.push({
        item_id: itemId, item_code: item?.item_code, item_name: item?.name, unit: item?.unit,
        location_id: locId, location_name: loc?.name, location_type: loc?.type, quantity,
      });
    }
    res.json(out.filter((r) => Math.abs(r.quantity) > 0.0001));
  });

  // PR -> PO conversion
  app.post("/api/purchase_requests/:id/convert", auth, async (req, res) => {
    const { data: pr, error } = await supabase.from("purchase_requests").select("*").eq("id", req.params.id).single();
    if (error || !pr) return res.status(404).json({ message: "PR not found" });
    const items = parseJson(pr.items);
    const subtotal = items.reduce((s: number, it: any) => s + (Number(it.amount) || 0), 0);
    const vat = Math.round(subtotal * 0.05 * 100) / 100;
    const poNumber = `NXS-PO-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
    const { data: po, error: e2 } = await supabase.from("purchase_orders").insert({
      po_number: poNumber, pr_id: pr.id, project_id: pr.project_id, order_date: new Date().toISOString().slice(0, 10),
      status: "draft", subtotal, vat_amount: vat, total_amount: subtotal + vat, items: JSON.stringify(items),
    }).select().single();
    if (e2) return res.status(400).json({ message: e2.message });
    await supabase.from("purchase_requests").update({ status: "converted" }).eq("id", pr.id);
    res.json(po);
  });

  // Generic CRUD registrations
  const jsonItems = ["items"];
  registerCrud(app, "users", "users");
  registerCrud(app, "clients", "clients");
  registerCrud(app, "projects", "projects");
  registerCrud(app, "project_tasks", "project_tasks");
  registerCrud(app, "project_daily_updates", "project_daily_updates", { jsonCols: ["photos"] });
  registerCrud(app, "employees", "employees");
  registerCrud(app, "employee_documents", "employee_documents");
  registerCrud(app, "timesheets", "timesheets");
  registerCrud(app, "payroll", "payroll");
  registerCrud(app, "vehicles", "vehicles");
  registerCrud(app, "vendors", "vendors");
  registerCrud(app, "purchase_requests", "purchase_requests", { jsonCols: jsonItems });
  registerCrud(app, "purchase_orders", "purchase_orders", { jsonCols: jsonItems });
  registerCrud(app, "inventory_items", "inventory_items");
  registerCrud(app, "stock_locations", "stock_locations");
  registerCrud(app, "stock_ledger", "stock_ledger");
  registerCrud(app, "quotations", "quotations", { jsonCols: jsonItems });
  registerCrud(app, "sales_orders", "sales_orders");
  registerCrud(app, "accounts", "accounts", { orderBy: "account_code", ascending: true });
  registerCrud(app, "journal_entries", "journal_entries", { jsonCols: ["lines"] });
  registerCrud(app, "invoices", "invoices", { jsonCols: jsonItems });
  registerCrud(app, "site_progress_reports", "site_progress_reports", { jsonCols: ["photos"] });
  registerCrud(app, "document_vault", "document_vault");
  registerCrud(app, "bank_statements", "bank_statements");
  registerCrud(app, "bank_transactions", "bank_transactions");
  registerCrud(app, "expense_categories", "expense_categories", { orderBy: "name", ascending: true });

  // ---- File upload to Supabase Storage → auto-save to document_vault --------
  app.post("/api/upload", auth, upload.single("file"), async (req: AuthedRequest, res) => {
    try {
      const file = (req as any).file;
      if (!file) return res.status(400).json({ message: "No file provided" });

      const { entity_type, entity_id, doc_category, title, expiry_date, notes } = req.body;
      const folder = entity_type ? `${entity_type}/${entity_id || "misc"}` : "misc";
      const uniqueName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const storagePath = `${folder}/${uniqueName}`;

      // Upload to Supabase storage
      const { error: uploadErr } = await supabase.storage
        .from("nxs-documents")
        .upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: false });

      if (uploadErr) return res.status(500).json({ message: uploadErr.message });

      // Build public URL
      const { data: urlData } = supabase.storage.from("nxs-documents").getPublicUrl(storagePath);
      const fileUrl = urlData.publicUrl;

      // Auto-save to document_vault
      const vaultPayload: any = {
        title: title || file.originalname,
        doc_category: doc_category || "other",
        file_name: file.originalname,
        file_url: fileUrl,
        doc_date: new Date().toISOString().slice(0, 10),
        uploaded_by: req.user?.id,
        notes: notes || null,
      };
      if (expiry_date) vaultPayload.expiry_date = expiry_date;
      if (entity_type === "employee" && entity_id) vaultPayload.employee_id = entity_id;
      if (entity_type === "vehicle" && entity_id) vaultPayload.vehicle_id = entity_id;
      if (entity_type === "sales_order" && entity_id) vaultPayload.reference_number = entity_id;

      const { data: vaultDoc, error: vaultErr } = await supabase
        .from("document_vault")
        .insert(vaultPayload)
        .select()
        .single();

      if (vaultErr) {
        // Vault save failed — still return the URL so the record can be saved
        console.error("Vault save failed:", vaultErr.message);
      }

      res.json({ url: fileUrl, vault_id: vaultDoc?.id, file_name: file.originalname });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });


  // ---- Tally Import: parse PDF -------------------------------------------
  const uploadPdf = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

  app.post("/api/tally/parse-pdf", auth, uploadPdf.single("pdf"), async (req: AuthedRequest, res) => {
    try {
      const file = (req as any).file;
      if (!file) return res.status(400).json({ message: "No PDF provided" });

      let text = "";
      try {
        const pdfData = await pdfParse(file.buffer);
        text = pdfData.text || "";
      } catch (e: any) {
        return res.status(400).json({ message: `Could not read PDF: ${e.message}` });
      }

      const extract = (patterns: RegExp[]): string => {
        for (const p of patterns) {
          const m = text.match(p);
          if (m?.[1]) return m[1].trim();
        }
        return "";
      };

      const invoice_number = extract([
        /(?:Invoice\s*No\.?|Tax\s*Invoice\s*No\.?|Inv\.?\s*No\.?|Voucher\s*No\.?)\s*[:#]?\s*([A-Z0-9\/\-]+)/i,
        /(?:Invoice\s*Number|Bill\s*No\.?)\s*[:#]?\s*([A-Z0-9\/\-]+)/i,
      ]);

      const rawDate = extract([
        /(?:Invoice\s*Date|Dated|Date)\s*[:#]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
        /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/,
        /(\d{4}[\/\-]\d{2}[\/\-]\d{2})/,
      ]);
      let invoice_date = rawDate;
      if (rawDate) {
        const dmy = rawDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (dmy) {
          const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
          invoice_date = `${year}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
        }
      }

      const client_name = extract([
        /(?:Bill\s*To|Buyer|Party\s*Name|To)[:\s]+([A-Za-z][A-Za-z0-9 &.,'\-]{2,60})/i,
      ]);

      const totalStr = extract([
        /(?:Grand\s*Total|Total\s*Amount|Invoice\s*Total|Net\s*Total)[:\s]+(?:AED\s*)?([\d,]+\.?\d*)/i,
        /(?:Total)[:\s]+(?:AED\s*)?([\d,]+\.?\d*)/i,
      ]);
      const vatStr = extract([
        /(?:VAT|Tax\s*Amount|IGST|GST|Output\s*VAT)[:\s]+(?:AED\s*)?([\d,]+\.?\d*)/i,
      ]);
      const subStr = extract([
        /(?:Sub\s*Total|Taxable\s*Amount|Net\s*Amount)[:\s]+(?:AED\s*)?([\d,]+\.?\d*)/i,
      ]);

      const total_amount = parseFloat(totalStr.replace(/,/g, "")) || 0;
      const vat_amount = parseFloat(vatStr.replace(/,/g, "")) || Math.round(total_amount / 1.05 * 0.05 * 100) / 100;
      const amount = parseFloat(subStr.replace(/,/g, "")) || Math.round((total_amount - vat_amount) * 100) / 100;

      res.json({
        invoice_number: invoice_number || `TALLY-${Date.now()}`,
        invoice_date: invoice_date || new Date().toISOString().slice(0, 10),
        client_name,
        amount,
        vat_amount,
        total_amount,
        status: "draft",
        notes: `Imported from Tally PDF: ${file.originalname}`,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ---- Tally Import: bulk create invoices + clients -----------------------
  app.post("/api/tally/import", auth, async (req: AuthedRequest, res) => {
    try {
      const { invoices } = req.body || {};
      if (!Array.isArray(invoices) || !invoices.length) {
        return res.status(400).json({ message: "No invoices provided" });
      }

      let created = 0;
      let skipped = 0;
      const clientCache = new Map<string, string>();

      for (const inv of invoices) {
        try {
          let client_id: string | null = null;
          if (inv.client_name) {
            const nameKey = inv.client_name.toLowerCase().trim();
            if (clientCache.has(nameKey)) {
              client_id = clientCache.get(nameKey)!;
            } else {
              const { data: existing } = await supabase
                .from("clients")
                .select("id, name")
                .ilike("name", inv.client_name.trim())
                .limit(1);
              if (existing && existing.length > 0) {
                client_id = existing[0].id;
              } else {
                const { data: newClient, error: clientErr } = await supabase
                  .from("clients")
                  .insert({ name: inv.client_name.trim() })
                  .select()
                  .single();
                if (!clientErr && newClient) client_id = newClient.id;
              }
              if (client_id) clientCache.set(nameKey, client_id);
            }
          }

          if (inv.invoice_number) {
            const { data: dup } = await supabase
              .from("invoices")
              .select("id")
              .eq("invoice_number", inv.invoice_number)
              .limit(1);
            if (dup && dup.length > 0) { skipped++; continue; }
          }

          const payload: any = {
            invoice_number: inv.invoice_number || `IMP-${Date.now()}`,
            invoice_date: inv.invoice_date || new Date().toISOString().slice(0, 10),
            due_date: inv.invoice_date || new Date().toISOString().slice(0, 10),
            client_id,
            client_name: inv.client_name || null,
            subtotal: inv.amount || 0,
            vat_amount: inv.vat_amount || 0,
            total_amount: inv.total_amount || 0,
            status: "draft",
            notes: inv.notes || "Imported from Tally",
            items: JSON.stringify([]),
          };

          const { error: invErr } = await supabase.from("invoices").insert(payload);
          if (invErr) { console.error("Invoice insert error:", invErr.message); skipped++; continue; }
          created++;
        } catch (rowErr: any) {
          console.error("Row import error:", rowErr.message);
          skipped++;
        }
      }

      res.json({ created, skipped, total: invoices.length });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  return httpServer;
}