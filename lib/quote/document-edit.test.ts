import { describe, expect, it } from "vitest";
import type { ProductResponse, QuoteResponse } from "@/lib/api/generated/model";
import {
  addFreeLine,
  addProductLine,
  applyCustomer,
  applyInstitution,
  customerLinkState,
  greetingName,
  isManualLine,
  moveLine,
  nextFreeCode,
  patchQuotedTo,
} from "@/lib/quote/document-edit";

const emptyQuote: QuoteResponse = { lines: [] };

const catalogProduct: ProductResponse = {
  id: "p1",
  code: "CVDFRN",
  name: "CVD FIRIN",
  price: 19000,
};

describe("document-edit", () => {
  it("nextFreeCode skips used numeric codes", () => {
    expect(nextFreeCode([])).toBe("001");
    expect(nextFreeCode([{ code: "001", name: "A" }, { code: "2", name: "B" }])).toBe("003");
  });

  it("addFreeLine creates a line without productId", () => {
    const next = addFreeLine(emptyQuote, {
      code: "010",
      name: "Özel vakum bağlantısı\nuzun açıklama",
      quantity: 2,
      price: 1500,
    });
    expect(next.lines).toHaveLength(1);
    expect(isManualLine(next.lines![0])).toBe(true);
    expect(next.lines![0].productId).toBeUndefined();
    expect(next.lines![0].name).toContain("uzun açıklama");
    expect(next.lines![0].quantity).toBe(2);
    expect(next.lines![0].price).toBe(1500);
  });

  it("addFreeLine ignores blank names", () => {
    expect(addFreeLine(emptyQuote, { name: "   " }).lines).toEqual([]);
  });

  it("moveLine swaps adjacent rows", () => {
    const quote = addProductLine(
      addFreeLine(emptyQuote, { name: "Elle", code: "001" }),
      catalogProduct,
    );
    const moved = moveLine(quote, 1, -1);
    expect(moved.lines![0].name).toBe("CVD FIRIN");
    expect(moved.lines![1].name).toBe("Elle");
    expect(moved.lines![0].sortOrder).toBe(0);
    expect(moved.lines![1].sortOrder).toBe(1);
  });

  it("moveLine is a no-op at the edges", () => {
    const quote = addFreeLine(emptyQuote, { name: "Tek" });
    expect(moveLine(quote, 0, -1)).toBe(quote);
    expect(moveLine(quote, 0, 1)).toBe(quote);
  });

  it("greetingName joins title and contact person", () => {
    expect(greetingName("Prof.", "Ayşe Yılmaz")).toBe("Prof. Ayşe Yılmaz");
    expect(greetingName(undefined, "Ayşe Yılmaz")).toBe("Ayşe Yılmaz");
    expect(greetingName("  ", "  ")).toBeUndefined();
  });

  it("patchQuotedTo updates institution, person and greeting", () => {
    const next = patchQuotedTo(emptyQuote, {
      institution: "ODTÜ",
      contactPerson: "Ayşe Yılmaz",
      title: "Prof.",
    });
    expect(next.quotedTo?.institution).toBe("ODTÜ");
    expect(next.quotedTo?.contactPerson).toBe("Ayşe Yılmaz");
    expect(next.quotedTo?.greetingName).toBe("Prof. Ayşe Yılmaz");
  });

  it("applyCustomer copies nested institution fields into quotedTo", () => {
    const next = applyCustomer(emptyQuote, {
      id: "c1",
      contactPerson: "Ayşe Yılmaz",
      title: "Prof.",
      department: "Lab",
      phone: "3120000000",
      email: "ayse@example.com",
      greetingName: "Prof. Ayşe Yılmaz",
      institution: {
        id: "i1",
        name: "ODTÜ",
        address: "Ankara",
        taxOffice: "Çankaya",
        taxNumber: "1234567890",
      },
    });
    expect(next.quotedTo).toMatchObject({
      customerId: "c1",
      institution: "ODTÜ",
      contactPerson: "Ayşe Yılmaz",
      title: "Prof.",
      department: "Lab",
      phone: "3120000000",
      email: "ayse@example.com",
      address: "Ankara",
      taxOffice: "Çankaya",
      taxNumber: "1234567890",
      greetingName: "Prof. Ayşe Yılmaz",
    });
  });

  it("applyCustomer links the institution so reports can find the quote", () => {
    const next = applyCustomer(emptyQuote, {
      id: "c1",
      contactPerson: "Ayşe Yılmaz",
      institution: { id: "i1", name: "ODTÜ" },
    });
    expect(next.quotedTo?.institutionId).toBe("i1");
    expect(customerLinkState(next)).toBe("contact");
  });

  it("applyInstitution links the institution without a contact", () => {
    const next = applyInstitution(emptyQuote, {
      id: "i1",
      name: "ODTÜ",
      address: "Ankara",
      taxOffice: "Çankaya",
      taxNumber: "1234567890",
    });
    expect(next.quotedTo).toMatchObject({
      institutionId: "i1",
      institution: "ODTÜ",
      address: "Ankara",
      taxOffice: "Çankaya",
      taxNumber: "1234567890",
    });
    expect(next.quotedTo?.customerId).toBeUndefined();
    expect(customerLinkState(next)).toBe("institution");
  });

  it("applyInstitution drops a contact that belongs to another institution", () => {
    const linked = applyCustomer(emptyQuote, {
      id: "c1",
      contactPerson: "Ayşe Yılmaz",
      institution: { id: "i1", name: "ODTÜ" },
    });
    const moved = applyInstitution(linked, { id: "i2", name: "Gazi Üniversitesi" });
    expect(moved.quotedTo?.customerId).toBeUndefined();
    expect(moved.quotedTo?.institutionId).toBe("i2");
  });

  it("applyInstitution keeps the contact when the institution is unchanged", () => {
    const linked = applyCustomer(emptyQuote, {
      id: "c1",
      contactPerson: "Ayşe Yılmaz",
      institution: { id: "i1", name: "ODTÜ" },
    });
    const same = applyInstitution(linked, { id: "i1", name: "ODTÜ" });
    expect(same.quotedTo?.customerId).toBe("c1");
  });

  it("customerLinkState reports free-text quotes as unlinked", () => {
    const freeText = patchQuotedTo(emptyQuote, { institution: "Kayıtsız Kurum" });
    expect(customerLinkState(freeText)).toBe("none");
  });
});
