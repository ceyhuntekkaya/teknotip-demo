import type { QuoteDraft } from "./types";

export type EvalExpect =
  | { kind: "draft"; check: string }
  | { kind: "clarify"; check: string }
  | { kind: "reject"; check: string };

export type EvalCase = {
  id: number;
  title: string;
  turns: string[];
  expect: EvalExpect;
  phase: 0 | 1 | 2 | 4 | 5;
};

export const GOLDEN_CASES: EvalCase[] = [
  {
    id: 1,
    title: "CVD + sıcaklık 1400 + çap 60 mm",
    turns: ["CVD fırın, sıcaklık 1400, çap 60 mm"],
    expect: { kind: "draft", check: "cvd-1400-60" },
    phase: 1,
  },
  {
    id: 2,
    title: "Sonra sıcaklık 1700 — yeni satır yok",
    turns: ["CVD fırın, maksimum sıcaklık 1400, çap 60 mm", "maksimum sıcaklık 1700 olsun"],
    expect: { kind: "draft", check: "cvd-1700-same-line" },
    phase: 1,
  },
  {
    id: 3,
    title: "2 adet yap → satır adedi",
    turns: ["CVD fırın olsun", "2 adet yap"],
    expect: { kind: "draft", check: "quantity-2" },
    phase: 1,
  },
  {
    id: 4,
    title: "2 adet CVD fırın → merge",
    turns: ["2 adet CVD fırın olsun"],
    expect: { kind: "draft", check: "quantity-2" },
    phase: 1,
  },
  {
    id: 5,
    title: "bir tane daha ekle → adet +1",
    turns: ["CVD fırın olsun", "bir tane daha ekle"],
    expect: { kind: "draft", check: "quantity-2" },
    phase: 1,
  },
  {
    id: 6,
    title: "vakum pompası fiyatı 6000",
    turns: ["CVD fırın olsun", "vakum pompası ekle", "vakum pompasının fiyatı 6000 olsun"],
    expect: { kind: "draft", check: "pump-price-6000" },
    phase: 1,
  },
  {
    id: 7,
    title: "birim fiyat 800",
    turns: ["CVD fırın olsun", "birim fiyat 800 olsun"],
    expect: { kind: "draft", check: "base-800" },
    phase: 1,
  },
  {
    id: 8,
    title: "flag ekle / çıkar",
    turns: ["CVD fırın olsun", "dijital gösterge ekle", "dijital gösterge çıkar"],
    expect: { kind: "draft", check: "flag-removed" },
    phase: 1,
  },
  {
    id: 9,
    title: "turbomoleküler pompa 600",
    turns: ["CVD fırın olsun", "turbomoleküler pompa 600 ekle"],
    expect: { kind: "draft", check: "turbo-600" },
    phase: 1,
  },
  {
    id: 10,
    title: "multiple_choice gaz set/add/remove",
    turns: [
      "CVD fırın olsun",
      "gaz tipi Ar ve H₂",
      "H₂'yi çıkar",
      "CO₂ da ekle",
    ],
    expect: { kind: "draft", check: "gas-ar-co2" },
    phase: 1,
  },
  {
    id: 11,
    title: "belirsiz sıcaklık → clarify",
    turns: ["Tüp fırın ekle", "sıcaklık 1700"],
    expect: { kind: "clarify", check: "which_value" },
    phase: 4,
  },
  {
    id: 12,
    title: "belirsiz satır → clarify",
    turns: ["CVD fırın, maksimum sıcaklık 1400", "CVD fırın, maksimum sıcaklık 1700", "çapı 80 yap"],
    expect: { kind: "clarify", check: "which_line" },
    phase: 4,
  },
  {
    id: 13,
    title: "CS 310 M model",
    turns: ["Potansiyostat ekle", "CS 310 M olsun"],
    expect: { kind: "draft", check: "cs-310-m" },
    phase: 1,
  },
  {
    id: 14,
    title: "müşteri + ürün aynı tur",
    turns: ["Ankara Üniversitesi Tıp Fakültesi Prof. Dr. Ceyhun Tekkaya'ya CVD fırın hazırla"],
    expect: { kind: "draft", check: "customer-and-cvd" },
    phase: 2,
  },
  {
    id: 15,
    title: "kapsam dışı",
    turns: ["hava nasıl?"],
    expect: { kind: "reject", check: "out_of_scope" },
    phase: 4,
  },
  {
    id: 16,
    title: "katalogda yok",
    turns: ["plazma kesici ekle"],
    expect: { kind: "clarify", check: "which_product" },
    phase: 1,
  },
  {
    id: 17,
    title: "STT varyantları",
    turns: ["CVD fırın, çap 6 cm"],
    expect: { kind: "draft", check: "diameter-60" },
    phase: 5,
  },
  {
    id: 18,
    title: "required_one radyo",
    turns: ["Akış kontrol ekle", "Adet 2 olsun"],
    expect: { kind: "draft", check: "mfc-radio-adet" },
    phase: 1,
  },
];

export function emptyEvalDraft(quoteNumber = "T-EVAL"): QuoteDraft {
  return { quoteNumber, items: [] };
}
