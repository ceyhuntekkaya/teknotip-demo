import { describe, expect, it } from "vitest";
import { resolveLineDescription, textLines } from "@/lib/quote/line-text";

describe("textLines", () => {
  it("keeps internal blank lines and drops only the edges", () => {
    expect(textLines("Satır 1\n\nSatır 2\n")).toEqual(["Satır 1", "", "Satır 2"]);
  });

  it("returns nothing for blank text", () => {
    expect(textLines(" \n ")).toEqual([]);
  });
});

describe("resolveLineDescription", () => {
  it("prefers the line snapshot and falls back to the catalog product", () => {
    const products = new Map([["p1", { description: "Katalog açıklaması" }]]);
    expect(resolveLineDescription({ description: "Satır", productId: "p1" }, products)).toBe(
      "Satır",
    );
    expect(resolveLineDescription({ description: "  ", productId: "p1" }, products)).toBe(
      "Katalog açıklaması",
    );
  });
});
