import { ReactNode } from "react";
import { COMPANY, fmtAED, fmtNum, fmtDate } from "@/lib/nxs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";

function Letterhead() {
  return (
    <div className="flex items-start justify-between border-b-2 pb-4 mb-6" style={{ borderColor: "#bd7214" }}>
      <div className="flex items-center gap-3">
        <img src={COMPANY.logo} alt="NXS" style={{ height: 56 }} onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
        <div>
          <div style={{ color: "#0c1125", fontWeight: 800, fontSize: 18 }}>{COMPANY.name}</div>
          <div style={{ color: "#555", fontSize: 11 }}>{COMPANY.address}</div>
        </div>
      </div>
      <div style={{ textAlign: "right", fontSize: 11, color: "#555" }}>
        <div>Tel: {COMPANY.landline} · {COMPANY.phone}</div>
        <div>{COMPANY.email}</div>
        <div>{COMPANY.website}</div>
      </div>
    </div>
  );
}

export function ItemsTable({ items, showUnit = true }: { items: any[]; showUnit?: boolean }) {
  const rows = items || [];
  return (
    <table className="print-doc" style={{ marginTop: 8 }}>
      <thead>
        <tr>
          <th style={{ width: 36 }}>#</th>
          <th>Description</th>
          <th style={{ width: 70 }}>Qty</th>
          {showUnit && <th style={{ width: 70 }}>Unit</th>}
          <th style={{ width: 110 }}>Unit Price</th>
          <th style={{ width: 120 }}>Amount (AED)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((it, i) => (
          <tr key={i}>
            <td>{i + 1}</td>
            <td>{it.description}</td>
            <td>{fmtNum(it.quantity, 0)}</td>
            {showUnit && <td>{it.unit || "—"}</td>}
            <td>{fmtNum(it.unit_price)}</td>
            <td style={{ textAlign: "right" }}>{fmtNum(it.amount ?? Number(it.quantity || 0) * Number(it.unit_price || 0))}</td>
          </tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={showUnit ? 6 : 5} style={{ textAlign: "center", color: "#999" }}>No items</td></tr>}
      </tbody>
    </table>
  );
}

export function TotalsBlock({ subtotal, vat, total, extra }: { subtotal: number; vat: number; total: number; extra?: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
      <table style={{ width: 300 }}>
        <tbody>
          <tr><td style={{ padding: "4px 8px", fontSize: 13 }}>Subtotal</td><td style={{ padding: "4px 8px", textAlign: "right", fontSize: 13 }}>{fmtAED(subtotal)}</td></tr>
          <tr><td style={{ padding: "4px 8px", fontSize: 13 }}>VAT (5%)</td><td style={{ padding: "4px 8px", textAlign: "right", fontSize: 13 }}>{fmtAED(vat)}</td></tr>
          {extra}
          <tr style={{ borderTop: "2px solid #0c1125" }}>
            <td style={{ padding: "6px 8px", fontWeight: 700 }}>TOTAL</td>
            <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: "#bd7214" }}>{fmtAED(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function SignatureLines({ left = "Prepared By", right = "Authorized Signature" }: { left?: string; right?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 48, fontSize: 12 }}>
      <div style={{ width: "40%" }}>
        <div style={{ borderTop: "1px solid #333", paddingTop: 6 }}>{left}</div>
      </div>
      <div style={{ width: "40%", textAlign: "right" }}>
        <div style={{ borderTop: "1px solid #333", paddingTop: 6 }}>{right}</div>
      </div>
    </div>
  );
}

function handlePrint(contentId: string) {
  const content = document.getElementById(contentId);
  if (!content) return;

  // Create a full-page print overlay directly in the current document
  const overlay = document.createElement("div");
  overlay.id = "nxs-print-overlay";
  overlay.innerHTML = content.innerHTML;
  overlay.style.cssText = [
    "position:fixed","top:0","left:0","width:100%","height:100%",
    "background:#fff","color:#000","z-index:99999",
    "font-family:Inter,Arial,sans-serif","font-size:13px",
    "padding:20mm","box-sizing:border-box","overflow:auto",
  ].join(";");

  // Add print-specific style tag
  const style = document.createElement("style");
  style.id = "nxs-print-style";
  style.textContent = `
    @media print {
      body > *:not(#nxs-print-overlay) { display: none !important; }
      #nxs-print-overlay {
        position: fixed !important; top: 0 !important; left: 0 !important;
        width: 100% !important; height: auto !important;
        background: #fff !important; color: #000 !important;
        padding: 14mm !important; box-sizing: border-box !important;
        font-family: Inter, Arial, sans-serif !important; font-size: 12px !important;
        z-index: 99999 !important;
      }
      #nxs-print-overlay table { width: 100%; border-collapse: collapse; }
      #nxs-print-overlay th, #nxs-print-overlay td { border: 1px solid #ccc; padding: 5px 8px; font-size: 11px; text-align: left; }
      #nxs-print-overlay thead th { background: #0c1125 !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: A4; margin: 0; }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(overlay);

  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.body.removeChild(overlay);
      document.head.removeChild(style);
    }, 500);
  }, 300);
}

export function PrintDialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const contentId = `print-content-${title.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0">
        <div className="no-print sticky top-0 z-10 flex items-center justify-between bg-card border-b border-border px-4 py-3">
          <span className="font-semibold">{title}</span>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => handlePrint(contentId)}>
              <Printer className="h-4 w-4 mr-1" /> Print / PDF
            </Button>
            <Button size="sm" variant="outline" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
        </div>
        <div id={contentId} className="p-8 bg-white text-black" style={{ fontFamily: "Inter, Arial, sans-serif" }}>
          <Letterhead />
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { COMPANY, fmtAED, fmtNum, fmtDate };
