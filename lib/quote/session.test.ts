import { describe, expect, it } from "vitest";
import {
  emptyQuoteSession,
  parseQuoteSession,
  QUOTE_SESSION_VERSION,
} from "./session";

describe("quote session", () => {
  it("round-trips a filled session", () => {
    const session = emptyQuoteSession();
    session.draft = {
      quoteNumber: "T-20260910-ABCD",
      items: [
        {
          lineId: "ln_1",
          productId: "p_cvd",
          modelId: "m_1",
          quantity: 1,
          selections: [],
        },
      ],
    };
    session.messages = [
      { role: "user", content: "CVD fırın olsun" },
      { role: "assistant", content: "CVD eklendi." },
    ];
    session.missing = [
      {
        productId: "p_cvd",
        groupId: "g_teknik",
        label: "Tüp çapı",
        options: ["50 mm"],
      },
    ];
    session.document = {
      quotedTo: {
        id: "",
        name: "",
        institution: "",
        contactPerson: "",
        date: "2026-09-10",
        quoteNumber: "T-20260910-ABCD",
      },
      products: [],
      priceSummary: {
        subtotal: 0,
        discount: 0,
        tax: 0,
        taxRatePercent: 20,
        totalAfterDiscount: 0,
        totalAfterTax: 0,
      },
      preparedBy: "",
    };

    const restored = parseQuoteSession(JSON.stringify(session));
    expect(restored?.version).toBe(QUOTE_SESSION_VERSION);
    expect(restored?.draft.quoteNumber).toBe("T-20260910-ABCD");
    expect(restored?.messages).toHaveLength(2);
    expect(restored?.missing[0]?.label).toBe("Tüp çapı");
    expect(restored?.document?.quotedTo.quoteNumber).toBe("T-20260910-ABCD");
  });

  it("rejects corrupt or version-mismatched payloads", () => {
    expect(parseQuoteSession(null)).toBeNull();
    expect(parseQuoteSession("{")).toBeNull();
    expect(parseQuoteSession(JSON.stringify({ version: 0 }))).toBeNull();
    expect(
      parseQuoteSession(
        JSON.stringify({
          version: 1,
          draft: { quoteNumber: 12, items: [] },
          document: null,
          missing: [],
          messages: [],
        }),
      ),
    ).toBeNull();
  });
});
