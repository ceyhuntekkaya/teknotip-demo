import { indexCatalog, missingSlots, type MissingSlot } from "@/lib/catalog/rules";
import type { Catalog } from "@/lib/catalog/types";
import { applyActions } from "./apply";
import { hydrateQuote } from "./hydrate";
import type {
  ApplyWarning,
  ChatAction,
  ConversationFocus,
  QuoteDocument,
  QuoteDraft,
} from "./types";

export type QuoteEditResult = {
  draft: QuoteDraft;
  document: QuoteDocument;
  missing: MissingSlot[];
  warnings: ApplyWarning[];
  focus: ConversationFocus;
};

export function applyQuoteEdit(
  catalog: Catalog,
  draft: QuoteDraft,
  actions: ChatAction[],
  focus?: ConversationFocus,
): QuoteEditResult {
  const lookup = indexCatalog(catalog);
  const applied = applyActions(catalog, draft, actions, lookup);
  const requested = actions.find(
    (action) =>
      Boolean(action.lineId) &&
      applied.draft.items.some((item) => item.lineId === action.lineId),
  )?.lineId;
  const lastTouchedLineId =
    requested ??
    (focus?.lastTouchedLineId &&
    applied.draft.items.some((item) => item.lineId === focus.lastTouchedLineId)
      ? focus.lastTouchedLineId
      : applied.draft.items.at(-1)?.lineId);

  return {
    draft: applied.draft,
    document: hydrateQuote(catalog, applied.draft),
    missing: applied.draft.items.flatMap((line) => {
      const product = lookup.products.get(line.productId);
      return product ? missingSlots(product, line.selections) : [];
    }),
    warnings: applied.warnings,
    focus: { lastTouchedLineId },
  };
}
