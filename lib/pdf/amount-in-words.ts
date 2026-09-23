import { moneyUnit } from "@/lib/money";

const ONES = [
  "",
  "BİR",
  "İKİ",
  "ÜÇ",
  "DÖRT",
  "BEŞ",
  "ALTI",
  "YEDİ",
  "SEKİZ",
  "DOKUZ",
];

const TENS = [
  "",
  "ON",
  "YİRMİ",
  "OTUZ",
  "KIRK",
  "ELLİ",
  "ALTMIŞ",
  "YETMİŞ",
  "SEKSEN",
  "DOKSAN",
];

function threeDigits(n: number): string {
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;
  const tens = Math.floor(remainder / 10);
  const ones = remainder % 10;
  const parts: string[] = [];
  if (hundreds === 1) parts.push("YÜZ");
  else if (hundreds > 1) parts.push(`${ONES[hundreds]} YÜZ`);
  if (tens) parts.push(TENS[tens]);
  if (ones) parts.push(ONES[ones]);
  return parts.join(" ");
}

export function integerToWords(n: number): string {
  if (n === 0) return "SIFIR";
  const groups: { value: number; label: string }[] = [
    { value: 1_000_000_000, label: "MİLYAR" },
    { value: 1_000_000, label: "MİLYON" },
    { value: 1_000, label: "BİN" },
  ];
  const parts: string[] = [];
  let remaining = n;
  for (const group of groups) {
    const count = Math.floor(remaining / group.value);
    if (count) {
      if (group.label === "BİN" && count === 1) parts.push("BİN");
      else parts.push(`${threeDigits(count)} ${group.label}`);
      remaining %= group.value;
    }
  }
  if (remaining) parts.push(threeDigits(remaining));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function amountInWords(value: number, currency?: string | null): string {
  const unit = moneyUnit(currency);
  const rounded = Math.round(Math.abs(value) * 100);
  const major = Math.floor(rounded / 100);
  const minor = rounded % 100;
  const prefix = value < 0 ? "EKSİ " : "";
  const majorWords = integerToWords(major);
  if (minor === 0) return `${prefix}${majorWords} ${unit.label}`;
  return `${prefix}${majorWords} ${unit.label} ${integerToWords(minor)} ${unit.minor}`;
}
