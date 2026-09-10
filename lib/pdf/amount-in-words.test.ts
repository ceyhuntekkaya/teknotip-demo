import { describe, expect, it } from "vitest";
import { amountInWords, integerToWords } from "./amount-in-words";

describe("integerToWords", () => {
  it("writes zero and small values", () => {
    expect(integerToWords(0)).toBe("SIFIR");
    expect(integerToWords(1)).toBe("BİR");
    expect(integerToWords(100)).toBe("YÜZ");
    expect(integerToWords(200)).toBe("İKİ YÜZ");
  });

  it("writes thousands without bir bin", () => {
    expect(integerToWords(1000)).toBe("BİN");
    expect(integerToWords(1001)).toBe("BİN BİR");
    expect(integerToWords(12345)).toBe("ON İKİ BİN ÜÇ YÜZ KIRK BEŞ");
    expect(integerToWords(19000)).toBe("ON DOKUZ BİN");
  });

  it("writes millions", () => {
    expect(integerToWords(1_000_000)).toBe("BİR MİLYON");
  });
});

describe("amountInWords", () => {
  it("omits kuruş when zero", () => {
    expect(amountInWords(0)).toBe("SIFIR TL");
    expect(amountInWords(19000)).toBe("ON DOKUZ BİN TL");
  });

  it("includes kuruş", () => {
    expect(amountInWords(12345.67)).toBe(
      "ON İKİ BİN ÜÇ YÜZ KIRK BEŞ TL ALTMIŞ YEDİ KR",
    );
  });
});
