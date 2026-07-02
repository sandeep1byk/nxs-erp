import { useState } from "react";
import { PageHeader, useList, useSave, StatusBadge } from "@/components/common";
import { DataTable } from "@/components/data-table";
import { FormDialog, FormFieldDef } from "@/components/crud-kit";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, CheckCircle } from "lucide-react";
import { fmtDate, fmtAED } from "@/lib/nxs";
import { queryClient } from "@/lib/queryClient";

export default function Bank() {
  const stmts = useList("bank_statements");
  const txns = useList("bank_transactions");
  const projects = useList("projects");
  const accounts = useList("accounts");
  const saveStmt = useSave("bank_statements");
  const saveTxn = useSave("bank_transactions");
  const [stmtOpen, setStmtOpen] = useState(false);
  const [txnOpen, setTxnOpen] = useState(false);
  const [reconcile, setReconcile] = useState<any>(null);

  const projName = (id: string) => (projects.data || []).find((p: any) => p.id === id)?.name || "—";

  const stmtFields: FormFieldDef[] = [
    { name: "bank_name", label: "Bank Name", required: true },
    { name: "account_number", label: "Account Number" },
    { name: "statement_date", label: "Statement Date", type: "date" },
    { name: "status", label: "Status", type: "select", options: ["pending", "in_progress", "reconciled"].map((s) => ({ value: s, label: s })) },
    { name: "file_url", label: "File URL", col: 2 },
  ];
  const txnFields: FormFieldDef[] = [
    { name: "statement_id", label: "Statement", type: "select", options: (stmts.data || []).map((s: any) => ({ value: s.id, label: `${s.bank_name} — ${s.statement_date || ""}` })) },
    { name: "txn_date", label: "Date", type: "date" },
    { name: "description", label: "Description", col: 2 },
    { name: "reference", label: "Reference" },
    { name: "counterparty", label: "Counterparty" },
    { name: "debit", label: "Debit", type: "number" },
    { name: "credit", label: "Credit", type: "number" },
    { name: "balance", label: "Balance", type: "number" },
  ];
  const reconcileFields: FormFieldDef[] = [
    { name: "counterparty", label: "Counterparty", col: 2 },
    { name: "project_id", label: "Project", type: "select", options: (projects.data || []).map((p: any) => ({ value: p.id, label: p.name })) },
    { name: "account_id", label: "GL Account", type: "select", options: (accounts.data || []).map((a: any) => ({ value: a.id, label: `${a.account_code} — ${a.name}` })) },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  return (
    <div>
      <PageHeader title="Bank Reconciliation" subtitle="Import statements and reconcile transactions" />
      <Tabs defaultValue="txns">
        <TabsList>
          <TabsTrigger value="txns">Transactions</TabsTrigger>
          <TabsTrigger value="statements">Statements</TabsTrigger>
        </TabsList>

        <TabsContent value="txns">
          <div className="flex justify-end mb-3"><Button size="sm" onClick={() => setTxnOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Transaction</Button></div>
          <DataTable rows={txns.data} loading={txns.isLoading}
            columns={[
              { header: "Date", cell: (r: any) => fmtDate(r.txn_date) },
              { header: "Description", cell: (r: any) => r.description || "—" },
              { header: "Counterparty", cell: (r: any) => r.counterparty || "—" },
              { header: "Debit", cell: (r: any) => r.debit ? fmtAED(r.debit) : "—" },
              { header: "Credit", cell: (r: any) => r.credit ? fmtAED(r.credit) : "—" },
              { header: "Project", cell: (r: any) => r.project_id ? projName(r.project_id) : "—" },
              { header: "Reconciled", cell: (r: any) => r.is_reconciled ? <span className="inline-flex items-center gap-1 text-green-600 text-xs"><CheckCircle className="h-4 w-4" /> Yes</span> : <Button size="sm" variant="outline" onClick={() => setReconcile(r)}>Reconcile</Button> },
            ]} />
        </TabsContent>

        <TabsContent value="statements">
          <div className="flex justify-end mb-3"><Button size="sm" onClick={() => setStmtOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Statement</Button></div>
          <DataTable rows={stmts.data} loading={stmts.isLoading}
            columns={[
              { header: "Bank", cell: (r: any) => <span className="font-medium">{r.bank_name}</span> },
              { header: "Account", cell: (r: any) => r.account_number || "—" },
              { header: "Date", cell: (r: any) => fmtDate(r.statement_date) },
              { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
            ]} />
        </TabsContent>
      </Tabs>

      <FormDialog open={stmtOpen} onClose={() => setStmtOpen(false)} title="Add Bank Statement"
        fields={stmtFields} initial={{ status: "pending" }} saving={saveStmt.isPending}
        onSave={(v) => saveStmt.mutate(v, { onSuccess: () => setStmtOpen(false) })} />
      <FormDialog open={txnOpen} onClose={() => setTxnOpen(false)} title="Add Transaction"
        fields={txnFields} initial={{ txn_date: new Date().toISOString().slice(0, 10) }} saving={saveTxn.isPending}
        onSave={(v) => saveTxn.mutate(v, { onSuccess: () => setTxnOpen(false) })} />
      {reconcile && (
        <FormDialog open={!!reconcile} onClose={() => setReconcile(null)} title="Reconcile Transaction"
          fields={reconcileFields} initial={reconcile} saving={saveTxn.isPending}
          onSave={(v) => saveTxn.mutate({ ...v, is_reconciled: true }, { onSuccess: () => { setReconcile(null); queryClient.invalidateQueries({ queryKey: ["/api/bank_transactions"] }); } })} />
      )}
    </div>
  );
}
