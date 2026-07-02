import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { STATUS_COLORS } from "@/lib/nxs";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const cls = STATUS_COLORS[status] || "bg-slate-100 text-slate-700";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", cls)}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="text-center py-12 text-muted-foreground text-sm">{message}</div>;
}

export function Loader() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

// Generic list query hook
export function useList<T = any>(path: string, params?: Record<string, string>) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return useQuery<T[]>({ queryKey: [`/api/${path}${qs}`] });
}

export function useOne<T = any>(path: string, id?: string) {
  return useQuery<T>({ queryKey: [`/api/${path}/${id}`], enabled: !!id });
}

// Generic mutation for create/update/delete
export function useSave(path: string, invalidate: string[] = []) {
  return useMutation({
    mutationFn: async (body: any) => {
      const method = body.id ? "PUT" : "POST";
      const url = body.id ? `/api/${path}/${body.id}` : `/api/${path}`;
      const res = await apiRequest(method, url, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/${path}`] });
      invalidate.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      queryClient.invalidateQueries();
    },
  });
}

export function useRemove(path: string) {
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/${path}/${id}`);
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

export function KV({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground text-right">{value ?? "—"}</span>
    </div>
  );
}
