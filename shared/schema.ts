// Plain TypeScript types for NXS ERP (Supabase-backed, no drizzle).

export type Role = "admin" | "engineer" | "accountant" | "storekeeper";

export interface User {
  id: string;
  email: string;
  password_hash?: string;
  full_name: string;
  role: Role;
  is_active: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
}

export interface Client {
  id: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  trn?: string;
}

export interface Project {
  id: string;
  project_number: string;
  name: string;
  client_id?: string;
  location?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  contract_value?: number;
  budgeted_cost?: number;
  status: "planning" | "active" | "on_hold" | "completed" | "cancelled";
  assigned_engineer_id?: string;
}

export interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status?: string;
  due_date?: string;
}

export interface ProjectDailyUpdate {
  id: string;
  project_id: string;
  reported_by?: string;
  update_date?: string;
  weather?: string;
  work_done?: string;
  issues?: string;
  next_day_plan?: string;
  photos?: string[];
}

export interface Employee {
  id: string;
  employee_number: string;
  full_name: string;
  nationality?: string;
  designation?: string;
  department?: string;
  basic_salary?: number;
  housing_allowance?: number;
  transport_allowance?: number;
  other_allowance?: number;
  join_date?: string;
  status?: string;
  email?: string;
  phone?: string;
  emergency_contact?: string;
  bank_account?: string;
  bank_name?: string;
  visa_number?: string;
  visa_expiry?: string;
  passport_number?: string;
  passport_expiry?: string;
  emirates_id?: string;
  emirates_id_expiry?: string;
  labour_card?: string;
  labour_card_expiry?: string;
}

export interface LineItem {
  description: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  amount: number;
}

export interface JournalLine {
  account_id?: string;
  account_name?: string;
  description?: string;
  debit: number;
  credit: number;
}

export interface Account {
  id: string;
  account_code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  parent_id?: string;
  is_active: boolean;
}

// Generic record fallback used broadly on the client
export type AnyRecord = Record<string, any>;
