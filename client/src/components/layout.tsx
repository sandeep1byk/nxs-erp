import { ReactNode, useState } from "react";
import { AppSidebar } from "./app-sidebar";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { COMPANY } from "@/lib/nxs";

export function AppLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:block shrink-0">
        <AppSidebar />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 border-b border-border bg-sidebar text-sidebar-foreground px-4 py-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button className="p-1"><Menu className="h-6 w-6" /></button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 border-0">
              <AppSidebar onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <img src={COMPANY.logo} alt="NXS" className="h-7 w-auto" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
          <span className="font-bold text-primary">NXS ERP</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
