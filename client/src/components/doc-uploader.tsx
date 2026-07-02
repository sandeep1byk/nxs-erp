/**
 * DocUploader — reusable file upload component
 * Uploads a file to /api/upload (server → Supabase Storage)
 * Automatically saves to Document Vault with the correct category.
 * Returns the file URL + any extracted metadata via onUploaded().
 */
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getAuthToken } from "@/lib/queryClient";
import { Upload, FileText, X, CheckCircle2, Loader2, ExternalLink } from "lucide-react";

export interface UploadedDoc {
  url: string;
  file_name: string;
  vault_id?: string;
}

export interface DocSlot {
  key: string;               // unique key e.g. "passport"
  label: string;             // display name e.g. "Passport Copy"
  doc_category: string;      // maps to document_vault.doc_category
  expiryField?: string;      // which form field to auto-fill with expiry date
  accept?: string;           // file accept string, default "image/*,application/pdf"
}

interface DocUploaderProps {
  slots: DocSlot[];
  entityType: string;        // "employee" | "vehicle" | "sales_order"
  entityId?: string;         // UUID of the record — pass after save if editing
  entityLabel?: string;      // Human name for vault title e.g. "John Smith"
  onUploaded?: (slot: DocSlot, doc: UploadedDoc, expiryDate?: string) => void;
  existingUrls?: Record<string, string>; // slotKey → already-uploaded URL
}

export function DocUploader({
  slots,
  entityType,
  entityId,
  entityLabel,
  onUploaded,
  existingUrls = {},
}: DocUploaderProps) {
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [uploaded, setUploaded] = useState<Record<string, UploadedDoc>>({});
  const [expiryInputs, setExpiryInputs] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function handleFile(slot: DocSlot, file: File) {
    if (!file) return;
    setErrors((e) => ({ ...e, [slot.key]: "" }));
    setUploading((u) => ({ ...u, [slot.key]: true }));

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("entity_type", entityType);
      if (entityId) fd.append("entity_id", entityId);
      fd.append("doc_category", slot.doc_category);
      fd.append("title", `${entityLabel || entityType} — ${slot.label}`);
      const exp = expiryInputs[slot.key];
      if (exp) fd.append("expiry_date", exp);

      const token = getAuthToken();
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(err.message);
      }

      const data: UploadedDoc = await res.json();
      setUploaded((u) => ({ ...u, [slot.key]: data }));
      onUploaded?.(slot, data, expiryInputs[slot.key]);
    } catch (e: any) {
      setErrors((er) => ({ ...er, [slot.key]: e.message }));
    } finally {
      setUploading((u) => ({ ...u, [slot.key]: false }));
    }
  }

  function clearSlot(key: string) {
    setUploaded((u) => { const n = { ...u }; delete n[key]; return n; });
    if (fileRefs.current[key]) fileRefs.current[key]!.value = "";
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center gap-2 mb-1">
        <Upload className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Document Uploads
        </span>
        <Badge variant="secondary" className="text-[10px]">auto-saved to Document Vault</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {slots.map((slot) => {
          const isUploading = uploading[slot.key];
          const done = uploaded[slot.key] || (existingUrls[slot.key] ? { url: existingUrls[slot.key], file_name: slot.label } : null);
          const err = errors[slot.key];

          return (
            <div
              key={slot.key}
              className={`rounded-xl border p-3 space-y-2 transition-colors ${done ? "border-green-500/40 bg-green-50/40 dark:bg-green-950/10" : "border-border bg-muted/30"}`}
            >
              <div className="flex items-center gap-2">
                <FileText className={`h-4 w-4 flex-shrink-0 ${done ? "text-green-600" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">{slot.label}</span>
                {done && <CheckCircle2 className="h-4 w-4 text-green-600 ml-auto" />}
              </div>

              {/* Expiry date input (before upload) */}
              {slot.expiryField && !done && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Expiry Date (optional)</Label>
                  <Input
                    type="date"
                    className="h-7 text-xs"
                    value={expiryInputs[slot.key] || ""}
                    onChange={(e) => setExpiryInputs((x) => ({ ...x, [slot.key]: e.target.value }))}
                    data-testid={`input-expiry-${slot.key}`}
                  />
                </div>
              )}

              {/* Uploaded state */}
              {done ? (
                <div className="flex items-center gap-2">
                  <a
                    href={done.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary flex items-center gap-1 truncate flex-1"
                    data-testid={`link-doc-${slot.key}`}
                  >
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{done.file_name}</span>
                  </a>
                  {uploaded[slot.key] && (
                    <button
                      type="button"
                      onClick={() => clearSlot(slot.key)}
                      className="text-muted-foreground hover:text-destructive"
                      data-testid={`button-clear-${slot.key}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    ref={(el) => { fileRefs.current[slot.key] = el; }}
                    type="file"
                    accept={slot.accept || "image/*,application/pdf"}
                    className="hidden"
                    data-testid={`file-input-${slot.key}`}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(slot, f);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    disabled={isUploading}
                    onClick={() => fileRefs.current[slot.key]?.click()}
                    data-testid={`button-upload-${slot.key}`}
                  >
                    {isUploading ? (
                      <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Uploading…</>
                    ) : (
                      <><Upload className="h-3.5 w-3.5 mr-1.5" /> Choose File</>
                    )}
                  </Button>
                </div>
              )}

              {err && <p className="text-xs text-destructive">{err}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
