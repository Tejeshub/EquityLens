/** Full sentence for prose and section-level states. */
export const NA = "Not available from the current source";
/** Short placeholder for numeric slots; render via <NumText> so it carries the NA sentence as title/aria-label. */
export const NA_SHORT = "—";

export const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function fmtNumber(v: number | null | undefined, digits = 2): string {
  return isNum(v) ? v.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : NA_SHORT;
}

export function fmtPrice(v: number | null | undefined, currency = "INR"): string {
  if (!isNum(v)) return NA_SHORT;
  const sym = currency === "INR" ? "₹" : `${currency} `;
  return `${sym}${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtPercent(v: number | null | undefined, signed = true): string {
  if (!isNum(v)) return NA_SHORT;
  return `${signed && v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export function fmtVolume(v: number | null | undefined): string {
  return isNum(v) ? v.toLocaleString("en-IN") : NA_SHORT;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return NA;
  if (iso.length === 10) return fmtDate(iso);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NA;
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return NA;
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return NA;
  return d.toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: iso.length === 10 ? "UTC" : undefined });
}

/** Only http(s) URLs are safe to render as links. */
export function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Up to 2 decimals, no forced trailing zeros; for reported statement values. */
export function fmtReported(v: number | null | undefined): string {
  return isNum(v) ? v.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : NA_SHORT;
}

/** Tailwind text colour class for a derived percentage / change: zero or missing is neutral, never "up". */
export function signClass(v: number | null | undefined): string {
  if (!isNum(v) || v === 0) return "text-muted-foreground";
  return v > 0 ? "text-chart-up" : "text-chart-down";
}

export const periodTypeLabel = (t: string | null | undefined): string =>
  t === "Q" ? "Quarterly" : t === "FY" ? "Annual" : t ?? "";
