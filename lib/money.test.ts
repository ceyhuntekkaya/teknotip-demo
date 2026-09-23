import { describe, expect, it } from "vitest";
import { formatDocumentAmount, formatQuoteAmount, moneyUnit } from "./money";

describe("moneyUnit", () => {
  it("defaults blank currency to TRY", () => {
    expect(moneyUnit(undefined).label).toBe("TL");
    expect(moneyUnit("").symbol).toBe("₺");
    expect(moneyUnit("tl").label).toBe("TL");
  });

  it("maps supported codes", () => {
    expect(moneyUnit("usd")).toEqual({ symbol: "$", label: "USD", minor: "CENT" });
    expect(moneyUnit("EUR").symbol).toBe("€");
    expect(moneyUnit("GBP").symbol).toBe("£");
  });
});

describe("formatQuoteAmount", () => {
  it("keeps the lira symbol for TRY", () => {
    expect(formatQuoteAmount(19000)).toBe("19.000 ₺");
    expect(formatQuoteAmount(19000, "TRY")).toBe("19.000 ₺");
  });

  it("uses the quote currency symbol", () => {
    expect(formatQuoteAmount(19000, "USD")).toBe("19.000 $");
    expect(formatQuoteAmount(-12.4, "EUR")).toBe("-12 €");
  });
});

describe("formatDocumentAmount", () => {
  it("keeps TL for TRY documents", () => {
    expect(formatDocumentAmount(12345.6)).toBe("12.345,60 TL");
  });

  it("prints the currency code on foreign quotes", () => {
    expect(formatDocumentAmount(12345.67, "USD")).toBe("12.345,67 USD");
  });
});
