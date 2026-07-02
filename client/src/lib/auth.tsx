import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { apiRequest, setAuthToken } from "./queryClient";
import { queryClient } from "./queryClient";

export type Role = "admin" | "engineer" | "accountant" | "storekeeper";
export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/login", { email, password });
    const data = await res.json();
    setAuthToken(data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    setToken(null);
    setUser(null);
    queryClient.clear();
    window.location.hash = "#/";
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// Role-based nav visibility helper
export const MODULE_ROLES: Record<string, Role[]> = {
  dashboard: ["admin", "engineer", "accountant", "storekeeper"],
  projects: ["admin", "engineer"],
  daily: ["admin", "engineer"],
  siteReports: ["admin", "engineer"],
  hr: ["admin", "accountant"],
  timesheets: ["admin", "engineer", "accountant"],
  payroll: ["admin", "accountant"],
  vehicles: ["admin", "accountant"],
  procurement: ["admin", "engineer"],
  vendors: ["admin", "accountant"],
  inventory: ["admin", "storekeeper"],
  sales: ["admin", "accountant"],
  clients: ["admin", "accountant"],
  finance: ["admin", "accountant"],
  invoices: ["admin", "accountant"],
  documents: ["admin", "engineer", "accountant", "storekeeper"],
  expiry: ["admin", "accountant"],
};

export function canAccess(role: Role | undefined, moduleKey: string) {
  if (!role) return false;
  if (role === "admin") return true;
  return (MODULE_ROLES[moduleKey] || []).includes(role);
}
