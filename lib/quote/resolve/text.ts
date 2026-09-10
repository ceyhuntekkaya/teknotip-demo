const FOLD_MAP: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  i: "i",
  ö: "o",
  ş: "s",
  ü: "u",
};

const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";

export function foldTurkish(value: string): string {
  return value
    .replace(/[₀-₉]/g, (ch) => String(Math.max(0, SUBSCRIPTS.indexOf(ch))))
    .replace(/İ/g, "i")
    .replace(/I/g, "i")
    .toLocaleLowerCase("tr")
    .replace(/[çğıiöşü]/g, (ch) => FOLD_MAP[ch] ?? ch)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function squeezeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeCode(value: string): string {
  return foldTurkish(value).replace(/[\s_-]+/g, "");
}

export function normalizeText(value: string): string {
  return squeezeSpaces(foldTurkish(value));
}

const UNIT_ALIASES: Record<string, { unit: string; toBase: number }> = {
  mm: { unit: "mm", toBase: 1 },
  cm: { unit: "mm", toBase: 10 },
  m: { unit: "mm", toBase: 1000 },
  "l/s": { unit: "l/s", toBase: 1 },
  ls: { unit: "l/s", toBase: 1 },
  sccm: { unit: "sccm", toBase: 1 },
  c: { unit: "c", toBase: 1 },
  "degc": { unit: "c", toBase: 1 },
};

export type ParsedMeasure = {
  numbers: number[];
  unit?: string;
  range: boolean;
  text: string;
};

function stripDecor(value: string): string {
  return value
    .replace(/°\s*c/gi, " c")
    .replace(/derece/gi, " c")
    .replace(/℃/g, " c");
}

export function parseMeasure(value: string): ParsedMeasure {
  const folded = stripDecor(normalizeText(value));
  const range = /[–—-]/.test(folded) && (folded.match(/\d/g) ?? []).length >= 2;
  const numbers: number[] = [];
  const numberRe = /(\d{1,3}(?:[.\s]\d{3})+|\d+(?:[.,]\d+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = numberRe.exec(folded))) {
    const raw = match[1].replace(/\s/g, "");
    const normalized =
      raw.includes(",") && !raw.includes(".")
        ? raw.replace(",", ".")
        : raw.replace(/\./g, "");
    const parsed = Number.parseFloat(normalized.replace(",", "."));
    if (Number.isFinite(parsed)) numbers.push(parsed);
  }

  let unit: string | undefined;
  const unitMatch = folded.match(/\b(sccm|l\/s|ls|mm|cm|m|c)\b/);
  if (unitMatch) {
    const alias = UNIT_ALIASES[unitMatch[1]];
    if (alias) {
      unit = alias.unit;
      if (alias.toBase !== 1) {
        for (let i = 0; i < numbers.length; i += 1) {
          numbers[i] *= alias.toBase;
        }
      }
    }
  }

  return { numbers, unit, range, text: folded };
}

export function measureKey(parsed: ParsedMeasure): string | null {
  if (!parsed.numbers.length) return null;
  const nums = parsed.numbers.map((n) => String(n)).join("-");
  return parsed.unit ? `${nums}:${parsed.unit}` : nums;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return row[b.length];
}

export function similarity(a: string, b: string): number {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const max = Math.max(left.length, right.length);
  return 1 - levenshtein(left, right) / max;
}

export function tokenSet(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);
}

export const FLAG_ADD = new Set(["ekle", "ac", "olsun", "evet", "var"]);
export const FLAG_REMOVE = new Set(["cikar", "kaldir", "iptal", "hayir", "yok"]);

export function flagIntent(value: string): "add" | "remove" | null {
  const folded = normalizeText(value);
  if (FLAG_ADD.has(folded)) return "add";
  if (FLAG_REMOVE.has(folded)) return "remove";
  return null;
}

const ORDINALS: Record<string, number> = {
  ilk: 0,
  birinci: 0,
  "1": 0,
  s1: 0,
  ikinci: 1,
  "2": 1,
  s2: 1,
  ucuncu: 2,
  üçüncü: 2,
  "3": 2,
  s3: 2,
  dorduncu: 3,
  "4": 3,
  s4: 3,
  sonuncu: -1,
  son: -1,
};

export function parseLineOrdinal(value: string): number | null {
  const folded = normalizeText(value).replace(/^satir\s+/, "");
  const direct = folded.match(/^s(\d+)$/);
  if (direct) return Number.parseInt(direct[1], 10) - 1;
  if (folded in ORDINALS) return ORDINALS[folded];
  return null;
}

export function isIncrementPhrase(value: string): boolean {
  const folded = normalizeText(value);
  return (
    folded.includes("bir tane daha") ||
    folded.includes("bir adet daha") ||
    folded === "bir tane daha ekle" ||
    folded === "arttir" ||
    folded === "bir arttir"
  );
}

export function isAffirmative(value: string): boolean {
  const folded = normalizeText(value);
  return ["evet", "olur", "tamam", "onay", "onayla", "sil", "kaldir"].includes(
    folded,
  );
}

export function isNegative(value: string): boolean {
  const folded = normalizeText(value);
  return ["hayir", "vazgec", "iptal", "olmasin"].includes(folded);
}
