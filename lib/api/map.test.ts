import { describe, expect, it } from "vitest";
import type { QuoteResponse } from "@/lib/api/generated/model";
import { quoteToRequest } from "@/lib/api/map";

describe("quoteToRequest", () => {
  /**
   * Sohbette kurulan katalog bağı, elle düzenleme sonrası gelen PUT ile
   * sessizce silinmemeli; bu alanlar düşerse teklif raporlarda kaybolur.
   */
  it("keeps the catalog links when saving", () => {
    const quote: QuoteResponse = {
      id: "q1",
      lines: [],
      quotedTo: {
        customerId: "c1",
        institutionId: "i1",
        institution: "ODTÜ",
        contactPerson: "Ayşe Yılmaz",
      },
    };
    const request = quoteToRequest(quote);
    expect(request.quotedTo?.customerId).toBe("c1");
    expect(request.quotedTo?.institutionId).toBe("i1");
    expect(request.brand).toBe("TEKNOTIP");
  });

  it("leaves quotedTo out when the quote has no recipient", () => {
    expect(quoteToRequest({ id: "q1", lines: [] }).quotedTo).toBeUndefined();
  });

  it("keeps the quote brand when saving", () => {
    const request = quoteToRequest({
      id: "q1",
      brand: "OPTOSENSE",
      lines: [],
    });
    expect(request.brand).toBe("OPTOSENSE");
  });

  it("keeps quote terms when saving", () => {
    const request = quoteToRequest({
      id: "q1",
      lines: [],
      terms: { delivery: "10-12 weeks order approval" },
    });
    expect(request.terms?.delivery).toBe("10-12 weeks order approval");
  });
});
