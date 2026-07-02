import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { Loader, EmptyState } from "./common";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T extends { id: string }>({
  rows, columns, loading, onEdit, onDelete, onRowClick, emptyMessage = "No records found.",
}: {
  rows: T[] | undefined;
  columns: Column<T>[];
  loading?: boolean;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}) {
  if (loading) return <Loader />;
  const data = rows || [];
  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground text-xs">
              {columns.map((c, i) => <th key={i} className={`p-3 ${c.className || ""}`}>{c.header}</th>)}
              {(onEdit || onDelete) && <th className="p-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id}
                className={`border-b border-border/50 last:border-0 ${onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}>
                {columns.map((c, i) => <td key={i} className={`p-3 ${c.className || ""}`}>{c.cell(row)}</td>)}
                {(onEdit || onDelete) && (
                  <td className="p-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {onEdit && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(row)}><Pencil className="h-4 w-4" /></Button>}
                    {onDelete && <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("Delete this record?")) onDelete(row); }}><Trash2 className="h-4 w-4" /></Button>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && <EmptyState message={emptyMessage} />}
      </CardContent>
    </Card>
  );
}
