import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "node:http";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import supabase from "./supabase";

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
async function seedIfEmpty() {
  try {
    const { data: existing, error } = await supabase.from("users").select("id").limit(1);
    if (error) { console.error("Seed check error:", error.message); return; }
    if (existing && existing.length > 0) return;

    console.log("Seeding NXS ERP database...");
    const hash = await bcrypt.hash("NXS@2026", 10);
    const users = [
      { email: "admin@nxs-uae.com", password_hash: hash, full_name: "Admin User", role: "admin", is_active: true },
      { email: "engineer@nxs-uae.com", password_hash: await bcrypt.hash("NXS@2026", 10), full_name: "Ahmed Engineer", role: "engineer", is_active: true },
      { email: "accountant@nxs-uae.com", password_hash: await bcrypt.hash("NXS@2026", 10), full_name: "Fatima Accountant", role: "accountant", is_active: true },
      { email: "store@nxs-uae.com", password_hash: await bcrypt.hash("NXS@2026", 10), full_name: "Store Keeper", role: "storekeeper", is_active: true },
    ];
    const { data: userRows } = await supabase.from("users").insert(users).select();
    const adminId = userRows?.find((u: any) => u.role === "admin")?.id;
    const engId = userRows?.find((u: any) => u.role === "engineer")?.id;

    const clients = [
      { name: "Emaar Properties PJSC", contact_person: "Khalid Al Mansoori", email: "procurement@emaar.ae", phone: "+971 4 367 3333", address: "Downtown Dubai, UAE", trn: "100234567800003" },
      { name: "Dubai Municipality", contact_person: "Sara Ahmed", email: "contracts@dm.gov.ae", phone: "+971 4 221 5555", address: "Deira, Dubai, UAE", trn: "100987654300003" },
      { name: "Al Futtaim Group", contact_person: "Omar Sheikh", email: "facilities@alfuttaim.ae", phone: "+971 4 206 6666", address: "Festival City, Dubai, UAE", trn: "100456789100003" },
    ];
    const { data: clientRows } = await supabase.from("clients").insert(clients).select();
    const c0 = clientRows?.[0]?.id, c1 = clientRows?.[1]?.id, c2 = clientRows?.[2]?.id;

    const projects = [
      { project_number: "NXS-P-2026-001", name: "Downtown Tower Fit-Out", client_id: c0, location: "Downtown Dubai", description: "Interior fit-out and MEP works", start_date: "2026-01-15", end_date: "2026-09-30", contract_value: 4500000, budgeted_cost: 3600000, status: "active", assigned_engineer_id: engId },
      { project_number: "NXS-P-2026-002", name: "Al Qusais Warehouse Maintenance", client_id: c1, location: "Al Qusais, Dubai", description: "Annual building maintenance contract", start_date: "2026-03-01", end_date: "2026-12-31", contract_value: 1200000, budgeted_cost: 950000, status: "active", assigned_engineer_id: engId },
      { project_number: "NXS-P-2026-003", name: "Festival City Mall Renovation", client_id: c2, location: "Festival City", description: "Retail unit renovation package", start_date: "2026-05-01", end_date: "2026-11-30", contract_value: 2800000, budgeted_cost: 2300000, status: "planning", assigned_engineer_id: engId },
    ];
    await supabase.from("projects").insert(projects);

    const vendors = [
      { name: "Danube Building Materials", contact_person: "Rajesh Kumar", email: "sales@danube.ae", phone: "+971 4 880 9000", address: "Jebel Ali, Dubai", trn: "100111222300003", payment_terms: "30 days" },
      { name: "Emirates Electrical Supplies", contact_person: "Mohammed Ali", email: "info@ees.ae", phone: "+971 4 333 4444", address: "Al Quoz, Dubai", trn: "100222333400003", payment_terms: "45 days" },
      { name: "Gulf Steel Industries", contact_person: "Peter John", email: "orders@gulfsteel.ae", phone: "+971 4 555 6666", address: "Industrial Area, Sharjah", trn: "100333444500003", payment_terms: "60 days" },
    ];
    await supabase.from("vendors").insert(vendors);

    const soon = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
    const employees = [
      { employee_number: "NXS-E-001", full_name: "Rakesh Sharma", nationality: "Indian", designation: "Site Engineer", department: "Engineering", basic_salary: 8000, housing_allowance: 3000, transport_allowance: 1000, other_allowance: 500, join_date: "2023-02-01", status: "active", email: "rakesh@nxs-uae.com", phone: "+971 50 111 2222", passport_number: "N1234567", passport_expiry: soon(45), visa_number: "784-2023-111", visa_expiry: soon(25), emirates_id: "784-1990-1234567-1", emirates_id_expiry: soon(120), labour_card: "LC-1001", labour_card_expiry: soon(200) },
      { employee_number: "NXS-E-002", full_name: "Abdul Rahman", nationality: "Pakistani", designation: "Foreman", department: "Operations", basic_salary: 5000, housing_allowance: 2000, transport_allowance: 800, other_allowance: 300, join_date: "2022-06-15", status: "active", email: "abdul@nxs-uae.com", phone: "+971 50 222 3333", passport_number: "P7654321", passport_expiry: soon(300), visa_number: "784-2022-222", visa_expiry: soon(55), emirates_id: "784-1985-7654321-2", emirates_id_expiry: soon(80), labour_card: "LC-1002", labour_card_expiry: soon(90) },
      { employee_number: "NXS-E-003", full_name: "John Cruz", nationality: "Filipino", designation: "Electrician", department: "MEP", basic_salary: 3500, housing_allowance: 1500, transport_allowance: 600, other_allowance: 200, join_date: "2024-01-10", status: "active", email: "john@nxs-uae.com", phone: "+971 50 333 4444", passport_number: "PH998877", passport_expiry: soon(400), visa_number: "784-2024-333", visa_expiry: soon(500), emirates_id: "784-1992-9988776-3", emirates_id_expiry: soon(15), labour_card: "LC-1003", labour_card_expiry: soon(220) },
      { employee_number: "NXS-E-004", full_name: "Mahesh Patel", nationality: "Indian", designation: "Plumber", department: "MEP", basic_salary: 3200, housing_allowance: 1400, transport_allowance: 600, other_allowance: 200, join_date: "2023-09-01", status: "active", email: "mahesh@nxs-uae.com", phone: "+971 50 444 5555", passport_number: "N5544332", passport_expiry: soon(250), visa_number: "784-2023-444", visa_expiry: soon(150), emirates_id: "784-1988-5544332-4", emirates_id_expiry: soon(180), labour_card: "LC-1004", labour_card_expiry: soon(35) },
      { employee_number: "NXS-E-005", full_name: "Suresh Nair", nationality: "Indian", designation: "Quantity Surveyor", department: "Commercial", basic_salary: 7000, housing_allowance: 2500, transport_allowance: 900, other_allowance: 400, join_date: "2022-11-20", status: "active", email: "suresh@nxs-uae.com", phone: "+971 50 555 6666", passport_number: "N1122334", passport_expiry: soon(600), visa_number: "784-2022-555", visa_expiry: soon(320), emirates_id: "784-1987-1122334-5", emirates_id_expiry: soon(280), labour_card: "LC-1005", labour_card_expiry: soon(310) },
    ];
    await supabase.from("employees").insert(employees);

    const vehicles = [
      { plate_number: "Dubai A 12345", make: "Toyota", model: "Hilux", year: 2022, type: "Pickup", registration_expiry: soon(40), insurance_expiry: soon(70), status: "active" },
      { plate_number: "Dubai B 67890", make: "Nissan", model: "Urvan", year: 2021, type: "Van", registration_expiry: soon(20), insurance_expiry: soon(120), status: "active" },
      { plate_number: "Dubai C 11223", make: "Mitsubishi", model: "Canter", year: 2023, type: "Truck", registration_expiry: soon(200), insurance_expiry: soon(50), status: "active" },
    ];
    await supabase.from("vehicles").insert(vehicles);

    // Chart of accounts (UAE construction)
    const accounts = [
      { account_code: "1000", name: "Cash & Bank", type: "asset", is_active: true },
      { account_code: "1100", name: "Accounts Receivable", type: "asset", is_active: true },
      { account_code: "1150", name: "Retention Receivable", type: "asset", is_active: true },
      { account_code: "1200", name: "Work in Progress", type: "asset", is_active: true },
      { account_code: "1300", name: "Inventory - Materials", type: "asset", is_active: true },
      { account_code: "1400", name: "Fixed Assets - Vehicles & Equipment", type: "asset", is_active: true },
      { account_code: "1500", name: "VAT Input (Recoverable)", type: "asset", is_active: true },
      { account_code: "2000", name: "Accounts Payable", type: "liability", is_active: true },
      { account_code: "2100", name: "Accrued Expenses", type: "liability", is_active: true },
      { account_code: "2200", name: "VAT Output (Payable)", type: "liability", is_active: true },
      { account_code: "2300", name: "Advances from Customers", type: "liability", is_active: true },
      { account_code: "3000", name: "Share Capital", type: "equity", is_active: true },
      { account_code: "3100", name: "Retained Earnings", type: "equity", is_active: true },
      { account_code: "4000", name: "Contract Revenue", type: "revenue", is_active: true },
      { account_code: "4100", name: "Maintenance Revenue", type: "revenue", is_active: true },
      { account_code: "5000", name: "Direct Material Cost", type: "expense", is_active: true },
      { account_code: "5100", name: "Direct Labour Cost", type: "expense", is_active: true },
      { account_code: "5200", name: "Subcontractor Cost", type: "expense", is_active: true },
      { account_code: "5300", name: "Equipment & Vehicle Cost", type: "expense", is_active: true },
      { account_code: "6000", name: "Salaries & Wages", type: "expense", is_active: true },
      { account_code: "6100", name: "Rent Expense", type: "expense", is_active: true },
      { account_code: "6200", name: "Utilities", type: "expense", is_active: true },
      { account_code: "6300", name: "Office & Admin Expenses", type: "expense", is_active: true },
      { account_code: "6400", name: "Depreciation", type: "expense", is_active: true },
    ];
    await supabase.from("accounts").insert(accounts);

    // Stock locations
    await supabase.from("stock_locations").insert([
      { name: "Main Warehouse - Al Qusais", type: "warehouse" },
      { name: "Site Store - Downtown Tower", type: "site" },
    ]);

    // Inventory items
    await supabase.from("inventory_items").insert([
      { item_code: "CEM-001", name: "Portland Cement 50kg", unit: "bag", category: "Cement", unit_cost: 14, reorder_level: 100 },
      { item_code: "STL-001", name: "Steel Rebar 12mm", unit: "ton", category: "Steel", unit_cost: 2400, reorder_level: 5 },
      { item_code: "ELC-001", name: "Electrical Cable 2.5mm", unit: "roll", category: "Electrical", unit_cost: 180, reorder_level: 20 },
      { item_code: "PNT-001", name: "Emulsion Paint 20L", unit: "drum", category: "Finishes", unit_cost: 220, reorder_level: 15 },
    ]);

    console.log("Seed complete.");
  } catch (e: any) {
    console.error("Seed error:", e?.message || e);
  }
}

// ---- routes -----------------------------------------------------------------
export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  await seedIfEmpty();

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
  app.post("/api/payroll/generate", auth, requireRole("accountant"), async (req, res) => {
    const { month, year } = req.body || {};
    if (!month || !year) return res.status(400).json({ message: "month and year required" });
    const { data: emps } = await supabase.from("employees").select("*").eq("status", "active");
    const { data: ts } = await supabase.from("timesheets").select("*");
    const rows: any[] = [];
    for (const e of emps || []) {
      const ot = (ts || []).filter((t: any) => t.employee_id === e.id).reduce((s: number, t: any) => s + (Number(t.hours_overtime) || 0), 0);
      const basic = Number(e.basic_salary) || 0;
      const hourly = basic / 30 / 8;
      const overtimePay = Math.round(ot * hourly * 1.25);
      const housing = Number(e.housing_allowance) || 0;
      const transport = Number(e.transport_allowance) || 0;
      const other = Number(e.other_allowance) || 0;
      const net = basic + housing + transport + other + overtimePay;
      rows.push({
        employee_id: e.id, month, year, basic_salary: basic, housing_allowance: housing,
        transport_allowance: transport, other_allowance: other, overtime_pay: overtimePay,
        deductions: 0, net_salary: net, status: "draft",
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

  return httpServer;
}
