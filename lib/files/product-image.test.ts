import { describe, expect, it } from "vitest";
import { isStoredProductImage, productImageSrc } from "@/lib/files/product-image";

const PATH = "2026/09/0f1e2d3c-1111-4222-8333-444455556666.jpg";

describe("productImageSrc", () => {
  it("points a stored path at the backend file endpoint", () => {
    expect(productImageSrc(PATH)).toBe(`/backend/v1/files/${PATH}`);
    expect(isStoredProductImage(PATH)).toBe(true);
  });

  it("keeps an already proxied path", () => {
    expect(productImageSrc(`/backend/v1/files/${PATH}`)).toBe(
      `/backend/v1/files/${PATH}`,
    );
  });

  it("still shows a real external image", () => {
    expect(productImageSrc("https://cdn.example/urun.jpg")).toBe(
      "https://cdn.example/urun.jpg",
    );
    expect(isStoredProductImage("https://cdn.example/urun.jpg")).toBe(false);
  });

  it("hides placeholders and paths that leave the storage root", () => {
    expect(productImageSrc("https://via.placeholder.com/150")).toBeNull();
    expect(productImageSrc("2026/09/../../etc/passwd")).toBeNull();
    expect(productImageSrc("")).toBeNull();
  });
});
