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
  });

  it("leaves quotedTo out when the quote has no recipient", () => {
    expect(quoteToRequest({ id: "q1", lines: [] }).quotedTo).toBeUndefined();
  });
});
