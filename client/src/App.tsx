import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/layout";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import ExpiryAlerts from "@/pages/expiry";
import Projects from "@/pages/projects";
import ProjectDetail from "@/pages/project-detail";
import SiteReports from "@/pages/site-reports";
import Employees from "@/pages/employees";
import Timesheets from "@/pages/timesheets";
import Payroll from "@/pages/payroll";
import Vehicles from "@/pages/vehicles";
import PurchaseRequests from "@/pages/purchase-requests";
import PurchaseOrders from "@/pages/purchase-orders";
import Vendors from "@/pages/vendors";
import Inventory from "@/pages/inventory";
import Quotations from "@/pages/quotations";
import SalesOrders from "@/pages/sales-orders";
import Clients from "@/pages/clients";
import Invoices from "@/pages/invoices";
import Accounts from "@/pages/accounts";
import Journal from "@/pages/journal";
import Bank from "@/pages/bank";
import Documents from "@/pages/documents";
import FinanceQuickEntry from "@/pages/finance-quick-entry";

function AppRouter() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/expiry" component={ExpiryAlerts} />
        <Route path="/projects" component={Projects} />
        <Route path="/projects/:id" component={ProjectDetail} />
        <Route path="/site-reports" component={SiteReports} />
        <Route path="/employees" component={Employees} />
        <Route path="/timesheets" component={Timesheets} />
        <Route path="/payroll" component={Payroll} />
        <Route path="/vehicles" component={Vehicles} />
        <Route path="/purchase-requests" component={PurchaseRequests} />
        <Route path="/purchase-orders" component={PurchaseOrders} />
        <Route path="/vendors" component={Vendors} />
        <Route path="/inventory" component={Inventory} />
        <Route path="/quotations" component={Quotations} />
        <Route path="/sales-orders" component={SalesOrders} />
        <Route path="/clients" component={Clients} />
        <Route path="/invoices" component={Invoices} />
        <Route path="/accounts" component={Accounts} />
        <Route path="/journal" component={Journal} />
        <Route path="/bank" component={Bank} />
        <Route path="/documents" component={Documents} />
        <Route path="/finance-quick-entry" component={FinanceQuickEntry} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function Gate() {
  const { user } = useAuth();
  if (!user) return <Login />;
  return <AppRouter />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthProvider>
          <Router hook={useHashLocation}>
            <Gate />
          </Router>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
