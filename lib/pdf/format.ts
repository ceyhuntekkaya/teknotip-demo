import { productImageSrc } from "@/lib/files/product-image";
import { formatDocumentAmount } from "@/lib/money";

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

const EN_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** OptoSense sample style: `18-Sep-2026`. */
export function formatQuoteDateEn(iso: string): string {
  const date = iso.trim() ? parseIsoDate(iso) : new Date();
  const day = String(date.getDate()).padStart(2, "0");
  return `${day}-${EN_MONTHS[date.getMonth()]}-${date.getFullYear()}`;
}

/** MilimLab sample style: `23/09/2026`. */
export function formatQuoteDateSlash(iso: string): string {
  const date = iso.trim() ? parseIsoDate(iso) : new Date();
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}


export function displayQuotedDate(iso?: string): string {
  if (!iso?.trim()) return "—";
  return formatQuoteDate(iso);
}

export function addDaysFormatted(iso: string, days: number): string {
  const date = iso.trim() ? parseIsoDate(iso) : new Date();
  date.setDate(date.getDate() + days);
  const day = date.getDate();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

export function formatTl(value: number, currency?: string | null): string {
  return formatDocumentAmount(value, currency);
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
  return productImageSrc(url) !== null;
}
