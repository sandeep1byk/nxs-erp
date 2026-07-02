import { useQuery } from "@tanstack/react-query";
import { PageHeader, Loader, StatusBadge } from "@/components/common";
import { fmtAED, fmtDate } from "@/lib/nxs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Building2, Wallet, Users, TrendingUp, BellRing, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

function Kpi({ icon: Icon, label, value, hint }: any) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1 text-foreground">{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </div>
          <div className="h-11 w-11 rounded-lg bg-accent flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/dashboard"] });
  const { data: expiry } = useQuery<any[]>({ queryKey: ["/api/expiry"] });

  if (isLoading) return <Loader />;
  const d = data || {};
  const alerts = (expiry || []).filter((a) => !a.is_acknowledged);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="NXS Contracting & Building Maintenance — operations overview" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi icon={Building2} label="Active Projects" value={d.activeProjects ?? 0} />
        <Kpi icon={Wallet} label="Total Contract Value" value={fmtAED(d.totalContractValue)} />
        <Kpi icon={TrendingUp} label="Budget vs Contract" value={`${d.budgetPct ?? 0}%`} hint={`Budgeted ${fmtAED(d.totalBudget)}`} />
        <Kpi icon={Users} label="Active Employees" value={d.activeEmployees ?? 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Expiry alerts panel */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <BellRing className="h-4 w-4 text-primary" /> Expiry Alerts
            </CardTitle>
            <Link href="/expiry" className="text-xs text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.length === 0 && <p className="text-sm text-muted-foreground">No upcoming expiries.</p>}
            {alerts.slice(0, 8).map((a, i) => {
              const color = a.days_remaining < 30 ? "text-destructive" : a.days_remaining < 60 ? "text-amber-600" : "text-green-600";
              return (
                <div key={i} className="flex items-center justify-between gap-2 text-sm border-b border-border/50 pb-2 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle className={cn("h-4 w-4 shrink-0", color)} />
                    <span className="truncate">{a.entity_name}</span>
                  </div>
                  <span className={cn("text-xs font-medium whitespace-nowrap", color)}>
                    {a.days_remaining < 0 ? `${Math.abs(a.days_remaining)}d overdue` : `${a.days_remaining}d`}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Project progress overview */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Project Progress Overview</CardTitle>
            <Link href="/projects" className="text-xs text-primary hover:underline">All projects</Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {(d.projects || []).slice(0, 6).map((p: any) => {
              const spent = p.contract_value ? Math.min(100, Math.round(((p.budgeted_cost || 0) / p.contract_value) * 100)) : 0;
              return (
                <div key={p.id}>
                  <div className="flex items-center justify-between mb-1">
                    <Link href={`/projects/${p.id}`} className="text-sm font-medium hover:text-primary truncate">
                      {p.project_number} — {p.name}
                    </Link>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={spent} className="h-2" />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtAED(p.contract_value)}</span>
                  </div>
                </div>
              );
            })}
            {(!d.projects || d.projects.length === 0) && <p className="text-sm text-muted-foreground">No projects yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
