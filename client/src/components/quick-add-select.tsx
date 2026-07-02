/**
 * QuickAddSelect — a dropdown with a "+" button to add a new option inline.
 * Works for Clients, Projects, or any entity with a name field.
 * After saving, the new record is auto-selected and the dropdown closes.
 */
import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2 } from "lucide-react";

// ---- Client quick-add fields -----------------------------------------------
function ClientQuickForm({ onSaved }: { onSaved: (id: string, name: string) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [trn, setTrn] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Client name is required");
      return (await apiRequest("POST", "/api/clients", {
        name: name.trim(),
        contact_person: contact || null,
        phone: phone || null,
        email: email || null,
        trn: trn || null,
      })).json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client added", description: data.name });
      onSaved(data.id, data.name);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-3 py-2">
      <div className="space-y-1.5">
        <Label>Client Name *</Label>
        <Input placeholder="Company name" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-client-name" autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Contact Person</Label>
          <Input placeholder="e.g. Ahmed Al Rashid" value={contact} onChange={(e) => setContact(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input placeholder="+971..." value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" placeholder="client@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>TRN</Label>
          <Input placeholder="Tax Registration No." value={trn} onChange={(e) => setTrn(e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">You can fill in the remaining details later from the Clients page.</p>
      <DialogFooter>
        <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-client">
          {save.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : "Save Client"}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ---- Project quick-add fields -----------------------------------------------
function ProjectQuickForm({ onSaved }: { onSaved: (id: string, name: string) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [location, setLocation] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Project name is required");
      const num = `NXS-PRJ-${Date.now().toString().slice(-5)}`;
      return (await apiRequest("POST", "/api/projects", {
        project_number: num,
        name: name.trim(),
        client_name: clientName || null,
        location: location || null,
        status: "active",
        start_date: new Date().toISOString().slice(0, 10),
      })).json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Project added", description: data.name });
      onSaved(data.id, data.name);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-3 py-2">
      <div className="space-y-1.5">
        <Label>Project Name *</Label>
        <Input placeholder="e.g. Villa Renovation — Al Barsha" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-project-name" autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Client Name (optional)</Label>
          <Input placeholder="Client company" value={clientName} onChange={(e) => setClientName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Location (optional)</Label>
          <Input placeholder="e.g. Dubai Marina" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">You can fill in more details later from the Projects page.</p>
      <DialogFooter>
        <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-project">
          {save.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : "Save Project"}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ---- Main QuickAddSelect component -----------------------------------------
export type QuickAddType = "client" | "project";

interface Option { value: string; label: string; }

interface QuickAddSelectProps {
  type: QuickAddType;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  "data-testid"?: string;
}

export function QuickAddSelect({
  type,
  options,
  value,
  onChange,
  placeholder,
  required,
  "data-testid": testId,
}: QuickAddSelectProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const title = type === "client" ? "Add New Client" : "Add New Project";

  function handleSaved(id: string, _name: string) {
    setDialogOpen(false);
    onChange(id);
  }

  return (
    <>
      <div className="flex gap-1.5 items-center">
        <Select value={value || ""} onValueChange={onChange} required={required}>
          <SelectTrigger className="flex-1" data-testid={testId}>
            <SelectValue placeholder={placeholder || `Select ${type}…`} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
            {options.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">No {type}s yet — click + to add</div>
            )}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 flex-shrink-0"
          onClick={() => setDialogOpen(true)}
          title={`Add new ${type}`}
          data-testid={`button-add-${type}`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" /> {title}
            </DialogTitle>
          </DialogHeader>
          {type === "client" ? (
            <ClientQuickForm onSaved={handleSaved} />
          ) : (
            <ProjectQuickForm onSaved={handleSaved} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
