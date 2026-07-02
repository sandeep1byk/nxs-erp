import { Link, useLocation } from "wouter";
import { useAuth, canAccess } from "@/lib/auth";
import { COMPANY } from "@/lib/nxs";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Building2, ClipboardList, Users, Truck, Clock, Wallet,
  ShoppingCart, Package, FileText, Receipt, BookOpen, Landmark, HardHat,
  FolderArchive, BellRing, LogOut, FileSignature, Handshake, Store,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NavItem { key: string; label: string; href: string; icon: any; }
interface NavGroup { title: string; items: NavItem[]; }

const GROUPS: NavGroup[] = [
  { title: "Overview", items: [
    { key: "dashboard", label: "Dashboard", href: "/", icon: LayoutDashboard },
    { key: "expiry", label: "Expiry Alerts", href: "/expiry", icon: BellRing },
  ]},
  { title: "Operations", items: [
    { key: "projects", label: "Projects", href: "/projects", icon: Building2 },
    { key: "siteReports", label: "Site Reports", href: "/site-reports", icon: HardHat },
  ]},
  { title: "Human Resources", items: [
    { key: "hr", label: "Employees", href: "/employees", icon: Users },
    { key: "timesheets", label: "Timesheets", href: "/timesheets", icon: Clock },
    { key: "payroll", label: "Payroll", href: "/payroll", icon: Wallet },
    { key: "vehicles", label: "Vehicles", href: "/vehicles", icon: Truck },
  ]},
  { title: "Procurement & Stock", items: [
    { key: "procurement", label: "Purchase Requests", href: "/purchase-requests", icon: ClipboardList },
    { key: "procurement", label: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart },
    { key: "vendors", label: "Vendors", href: "/vendors", icon: Store },
    { key: "inventory", label: "Inventory & Stock", href: "/inventory", icon: Package },
  ]},
  { title: "Sales", items: [
    { key: "sales", label: "Quotations", href: "/quotations", icon: FileText },
    { key: "sales", label: "Sales Orders", href: "/sales-orders", icon: Handshake },
    { key: "clients", label: "Clients", href: "/clients", icon: Users },
  ]},
  { title: "Finance", items: [
    { key: "invoices", label: "Invoices", href: "/invoices", icon: Receipt },
    { key: "finance", label: "Chart of Accounts", href: "/accounts", icon: BookOpen },
    { key: "finance", label: "Journal Entries", href: "/journal", icon: FileSignature },
    { key: "finance", label: "Bank Reconciliation", href: "/bank", icon: Landmark },
  ]},
  { title: "Documents", items: [
    { key: "documents", label: "Document Vault", href: "/documents", icon: FolderArchive },
  ]},
];

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-sidebar-border">
        <img src={COMPANY.logo} alt="NXS" className="h-9 w-auto object-contain" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
        <div className="leading-tight">
          <div className="font-bold text-primary text-lg">NXS ERP</div>
          <div className="text-[10px] text-sidebar-foreground/60">Contracting & Maintenance</div>
        </div>
      </div>

      <ScrollArea className="flex-1 px-2 py-3">
        {GROUPS.map((group) => {
          const items = group.items.filter((it) => canAccess(user?.role, it.key));
          if (!items.length) return null;
          return (
            <div key={group.title} className="mb-4">
              <div className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">{group.title}</div>
              <nav className="space-y-0.5">
                {items.map((it) => {
                  const active = location === it.href || (it.href !== "/" && location.startsWith(it.href));
                  const Icon = it.icon;
                  return (
                    <Link key={it.href} href={it.href} onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}>
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{it.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          );
        })}
      </ScrollArea>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 mb-2 px-1">
          <div className="h-9 w-9 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-semibold text-sm">
            {user?.full_name?.charAt(0) || "U"}
          </div>
          <div className="leading-tight min-w-0">
            <div className="text-sm font-medium truncate">{user?.full_name}</div>
            <div className="text-[11px] capitalize text-sidebar-foreground/50">{user?.role}</div>
          </div>
        </div>
        <button onClick={logout}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </aside>
  );
}
