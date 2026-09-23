type MoneyUnit = {
  symbol: string;
  label: string;
  minor: string;
};

const UNITS: Record<string, MoneyUnit> = {
  TRY: { symbol: "₺", label: "TL", minor: "KR" },
  USD: { symbol: "$", label: "USD", minor: "CENT" },
  EUR: { symbol: "€", label: "EUR", minor: "CENT" },
  GBP: { symbol: "£", label: "GBP", minor: "PENCE" },
};

export function moneyUnit(currency?: string | null): MoneyUnit {
  const code = (currency ?? "TRY").trim().toUpperCase();
  if (code === "TL") return UNITS.TRY;
  return UNITS[code] ?? { symbol: code || "₺", label: code || "TL", minor: "CENT" };
}

/** Ön izleme: tam sayı, sembol sonda. TRY için `1.234 ₺`. */
export function formatQuoteAmount(value: number, currency?: string | null): string {
  const rounded = Math.round(value);
  const grouped = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = rounded < 0 ? "-" : "";
  return `${sign}${grouped} ${moneyUnit(currency).symbol}`;
}

export function formatQuoteAddOn(
  value: number | undefined,
  currency?: string | null,
): string | null {
  if (value === undefined) return null;
  const grouped = String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `+${grouped} ${moneyUnit(currency).symbol}`;
}

/** PDF: kuruşlu, birim kodu sonda. TRY için `1.234,56 TL`. */
export function formatDocumentAmount(value: number, currency?: string | null): string {
  const [intPart, frac = "00"] = Math.abs(value).toFixed(2).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = value < 0 ? "-" : "";
  return `${sign}${grouped},${frac} ${moneyUnit(currency).label}`;
}
