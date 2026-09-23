import { describe, expect, it } from "vitest";
import type {
  ProductResponse,
  QuoteLineResponse,
} from "@/lib/api/generated/model";
import { resolveLineImageSrc } from "@/lib/pdf/product-images";

const STORED = "2026/09/0f1e2d3c-1111-4222-8333-444455556666.jpg";

describe("resolveLineImageSrc", () => {
  it("uses the line image when it is a stored path", () => {
    const line: QuoteLineResponse = { image: STORED, productId: "p1" };
    expect(resolveLineImageSrc(line)).toBe(`/backend/v1/files/${STORED}`);
  });

  it("falls back to the catalog product when the line has a placeholder", () => {
    const line: QuoteLineResponse = {
      image: "https://via.placeholder.com/150",
      productId: "p1",
    };
    const products = new Map<string, ProductResponse>([
      ["p1", { id: "p1", image: STORED }],
    ]);
    expect(resolveLineImageSrc(line, products)).toBe(
      `/backend/v1/files/${STORED}`,
    );
  });

  it("returns null when neither line nor product has a usable image", () => {
    const line: QuoteLineResponse = {
      image: "https://via.placeholder.com/150",
      productId: "p1",
    };
    const products = new Map<string, ProductResponse>([
      ["p1", { id: "p1", image: "https://via.placeholder.com/150" }],
    ]);
    expect(resolveLineImageSrc(line, products)).toBeNull();
  });
});
