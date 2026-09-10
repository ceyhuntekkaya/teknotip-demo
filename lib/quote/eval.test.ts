import { describe, expect, it } from "vitest";
import { indexCatalog } from "@/lib/catalog/rules";
import { GOLDEN_CASES } from "./eval-cases";
import { emptyDraft } from "./draft";
import { processTurn } from "./turn";
import { loadTestCatalog } from "./test-catalog";
import type { ChatIntent } from "./types";

const catalog = loadTestCatalog();
const lookup = indexCatalog(catalog);

const SCRIPTS: Record<number, ChatIntent[][]> = {
  1: [
    [
      { op: "add_line", productRef: "CVD fırın" },
      { op: "set_value", value: "1400" },
      { op: "set_value", value: "60 mm" },
    ],
  ],
  16: [[{ op: "add_line", productRef: "plazma kesici" }]],
};

describe("golden eval (intent scripts, no LLM)", () => {
  it("lists all 18 cases", () => {
    expect(GOLDEN_CASES).toHaveLength(18);
    expect(GOLDEN_CASES.map((item) => item.id)).toEqual(
      Array.from({ length: 18 }, (_, i) => i + 1),
    );
  });

  it("case 1 produces a CVD line", () => {
    const result = processTurn({
      catalog,
      lookup,
      draft: emptyDraft(),
      userMessage: GOLDEN_CASES[0].turns[0],
      intents: SCRIPTS[1][0],
    });
    expect(result.draft.items).toHaveLength(1);
    expect(result.clarifications).toEqual([]);
  });

  it("case 16 does not invent a product", () => {
    const result = processTurn({
      catalog,
      lookup,
      draft: emptyDraft(),
      userMessage: GOLDEN_CASES[15].turns[0],
      intents: SCRIPTS[16][0],
    });
    expect(result.draft.items).toHaveLength(0);
    expect(result.clarifications[0]?.kind).toBe("which_product");
  });
});
