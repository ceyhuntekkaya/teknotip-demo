export function parseIsoDate(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!match) return new Date();
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(year, month - 1, day);
}

export function formatQuoteDate(iso: string): string {
  const date = iso.trim() ? parseIsoDate(iso) : new Date();
  const day = date.getDate();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

export function addDaysFormatted(iso: string, days: number): string {
  const date = iso.trim() ? parseIsoDate(iso) : new Date();
  date.setDate(date.getDate() + days);
  const day = date.getDate();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

export function formatTl(value: number): string {
  const [intPart, frac = "00"] = Math.abs(value).toFixed(2).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = value < 0 ? "-" : "";
  return `${sign}${grouped},${frac} TL`;
}

export function dashed(value: string, fallback = "..........................."): string {
  const trimmed = value.trim();
  return trimmed || fallback;
}

export function assetUrl(origin: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = origin.replace(/\/$/, "");
  const relative = path.startsWith("/") ? path : `/${path}`;
  return `${base}${relative}`;
}

export function usableProductImage(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.includes("placeholder")) return false;
  return /^(https?:\/\/|\/)/i.test(trimmed);
}
