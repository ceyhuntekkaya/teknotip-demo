import { describe, expect, it } from "vitest";
import {
  extractLineRef,
  looksLikeLineLabel,
  measureKey,
  measuresCompatible,
  normalizeCode,
  normalizeText,
  parseCount,
  parseMeasure,
  parseLineOrdinal,
  parsePrice,
} from "./text";

describe("resolve text", () => {
  it("folds Turkish and codes", () => {
    expect(normalizeText("Çalışma Sıcaklığı")).toBe("calisma sicakligi");
    expect(normalizeCode("opt as-2000")).toBe("optas2000");
    expect(normalizeCode("OPT-AS2000")).toBe("optas2000");
  });

  it("parses numbers and units", () => {
    expect(measureKey(parseMeasure("1400°C"))).toBe("1400:c");
    expect(measureKey(parseMeasure("1.400"))).toBe("1400");
    expect(measureKey(parseMeasure("6 cm"))).toBe("60:mm");
    expect(measureKey(parseMeasure("0-500"))).toBe("0-500");
    expect(measureKey(parseMeasure("0–500 sccm"))).toBe("0-500:sccm");
  });

  it("parses line ordinals", () => {
    expect(parseLineOrdinal("S2")).toBe(1);
    expect(parseLineOrdinal("ikinci")).toBe(1);
    expect(parseLineOrdinal("sonuncu")).toBe(-1);
    expect(parseLineOrdinal("ikinci satır")).toBe(1);
  });

  it("parses prices and counts from utterances", () => {
    expect(parsePrice("ürün fiyatı 25000 tl olsun")).toBe(25000);
    expect(parsePrice("25000")).toBe(25000);
    expect(parsePrice("25.000 tl")).toBe(25000);
    expect(parsePrice("vakum pompası 4 olsun")).toBeNull();
    expect(parseCount("2 adet yap")).toBe(2);
    expect(parseCount("mfc adet 2 olsun")).toBe(2);
    expect(parseCount("ana ürün adeti 1 olsun")).toBe(1);
  });

  it("matches a single number to a repeated dimension", () => {
    expect(
      measuresCompatible(parseMeasure("300lük"), parseMeasure("300 × 300 × 300 mm")),
    ).toBe(true);
    expect(looksLikeLineLabel("S1: Ürün / Model 1 x2")).toBe(true);
    expect(extractLineRef("S1: Ürün / Model 1 x2")).toBe("S1");
  });

  it("folds gas subscripts", () => {
    expect(normalizeText("H₂")).toBe("h2");
  });
});
