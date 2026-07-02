export const COMPANY = {
  name: "NXS Contracting & Building Maintenance LLC",
  shortName: "NXS",
  address: "#339, Bin Fahad Bldg, Damascus St, Al Qusais, Dubai, U.A.E",
  phone: "+971 0501895175",
  landline: "(04) 236 7842",
  email: "info@nxs-uae.com",
  website: "nxs-uae.com",
  logo: "https://nxs-uae.com/wp-content/uploads/2024/10/nxs-logo-b.png",
  bank: {
    name: "Emirates NBD",
    account: "1015XXXXXX01",
    iban: "AE07 0331 2345 6789 0123 456",
    swift: "EBILAEAD",
  },
  vat: 0.05,
  currency: "AED",
};

export function fmtAED(n: number | string | undefined | null): string {
  const v = Number(n || 0);
  return "AED " + v.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtNum(n: number | string | undefined | null, dp = 2): string {
  const v = Number(n || 0);
  return v.toLocaleString("en-AE", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function fmtDate(d?: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return String(d);
  }
}

export function computeTotals(items: { quantity?: number; unit_price?: number; amount?: number }[]) {
  const subtotal = (items || []).reduce((s, it) => {
    const amt = it.amount != null ? Number(it.amount) : Number(it.quantity || 0) * Number(it.unit_price || 0);
    return s + amt;
  }, 0);
  const vat = Math.round(subtotal * COMPANY.vat * 100) / 100;
  return { subtotal, vat, total: Math.round((subtotal + vat) * 100) / 100 };
}

export function nextNumber(prefix: string): string {
  const y = new Date().getFullYear();
  const seq = Date.now().toString().slice(-5);
  return `${prefix}-${y}-${seq}`;
}

export const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  planning: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  on_hold: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  completed: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  submitted: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  converted: "bg-purple-100 text-purple-800",
  sent: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  paid: "bg-green-100 text-green-800",
  partial: "bg-amber-100 text-amber-800",
  overdue: "bg-red-100 text-red-800",
  signed: "bg-green-100 text-green-800",
  received: "bg-green-100 text-green-800",
  reconciled: "bg-green-100 text-green-800",
  pending: "bg-slate-100 text-slate-700",
  expired: "bg-red-100 text-red-800",
};
