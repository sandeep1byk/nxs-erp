import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader, Loader } from "@/components/common";
import { fmtDate } from "@/lib/nxs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle } from "lucide-react";

export default function ExpiryAlerts() {
  const { data, isLoading } = useQuery<any[]>({ queryKey: ["/api/expiry"] });
  const ack = useMutation({
    mutationFn: async (a: any) => (await apiRequest("POST", "/api/expiry/acknowledge", a)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/expiry"] }); queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] }); },
  });

  if (isLoading) return <Loader />;
  const items = data || [];

  return (
    <div>
      <PageHeader title="Expiry Alerts" subtitle="Documents expiring within 60 days — passports, visas, Emirates IDs, vehicle registration & insurance" />
      <div className="flex gap-4 mb-4 text-xs">
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-red-500" /> &lt; 30 days</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-amber-500" /> &lt; 60 days</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-green-500" /> &gt; 60 days</span>
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground text-xs">
                <th className="p-3">Entity</th>
                <th className="p-3">Type</th>
                <th className="p-3">Expiry Date</th>
                <th className="p-3">Days Remaining</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a, i) => {
                const color = a.days_remaining < 30 ? "bg-red-500" : a.days_remaining < 60 ? "bg-amber-500" : "bg-green-500";
                return (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="p-3 font-medium">{a.entity_name}</td>
                    <td className="p-3 capitalize text-muted-foreground">{a.entity_type}</td>
                    <td className="p-3">{fmtDate(a.expiry_date)}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-2">
                        <span className={cn("h-2.5 w-2.5 rounded-full", color)} />
                        {a.days_remaining < 0 ? `${Math.abs(a.days_remaining)}d overdue` : `${a.days_remaining} days`}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {a.is_acknowledged ? (
                        <span className="inline-flex items-center gap-1 text-green-600 text-xs"><CheckCircle className="h-4 w-4" /> Acknowledged</span>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => ack.mutate(a)}>Acknowledge</Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">
                  <AlertTriangle className="h-6 w-6 mx-auto mb-2 opacity-50" />No upcoming expiries.
                </td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
