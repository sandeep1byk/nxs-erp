import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { COMPANY } from "@/lib/nxs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common";
import { Loader2 } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@nxs-uae.com");
  const [password, setPassword] = useState("NXS@2026");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src={COMPANY.logo} alt="NXS" className="h-16 mb-4 object-contain"
            onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
          <h1 className="text-2xl font-bold text-primary">NXS ERP</h1>
          <p className="text-sm text-sidebar-foreground/60 text-center mt-1">
            Contracting & Building Maintenance
          </p>
        </div>

        <div className="bg-card rounded-xl border border-card-border shadow-lg p-6 md:p-8">
          <h2 className="text-lg font-semibold text-foreground mb-1">Sign in</h2>
          <p className="text-sm text-muted-foreground mb-6">Enter your credentials to continue.</p>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@nxs-uae.com" />
            </Field>
            <Field label="Password">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Sign in
            </Button>
          </form>
          <div className="mt-6 rounded-md bg-muted p-3 text-xs text-muted-foreground">
            <div className="font-medium mb-1">Demo accounts (password: NXS@2026)</div>
            admin@nxs-uae.com · engineer@nxs-uae.com · accountant@nxs-uae.com · store@nxs-uae.com
          </div>
        </div>
        <p className="text-center text-xs text-sidebar-foreground/40 mt-6">
          {COMPANY.address}
        </p>
      </div>
    </div>
  );
}
