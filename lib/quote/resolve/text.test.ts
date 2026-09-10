import { describe, expect, it } from "vitest";
import {
  measureKey,
  normalizeCode,
  normalizeText,
  parseMeasure,
  parseLineOrdinal,
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
  });

  it("folds gas subscripts", () => {
    expect(normalizeText("H₂")).toBe("h2");
  });
});
