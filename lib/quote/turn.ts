import type { MissingSlot } from "@/lib/catalog/rules";
import { missingSlots } from "@/lib/catalog/rules";
import type { CatalogLookup } from "@/lib/catalog/rules";
import type { Catalog } from "@/lib/catalog/types";
import { applyActions } from "./apply";
import { summarizeTurn } from "./diff";
import { hydrateQuote } from "./hydrate";
import { matchPendingReply } from "./pending";
import { pickPending, resolveIntents } from "./resolve";
import type {
  ApplyWarning,
  ChatIntent,
  ClarifyResult,
  ConversationFocus,
  QuoteDocument,
  QuoteDraft,
} from "./types";

export type TurnInput = {
  catalog: Catalog;
  lookup: CatalogLookup;
  draft: QuoteDraft;
  focus?: ConversationFocus;
  userMessage: string;
  intents: ChatIntent[];
  fromPending?: boolean;
};

export type TurnResult = {
  draft: QuoteDraft;
  document: QuoteDocument;
  missing: MissingSlot[];
  warnings: ApplyWarning[];
  reply: string;
  focus: ConversationFocus;
  clarifications: ClarifyResult[];
};

export function collectMissing(lookup: CatalogLookup, draft: QuoteDraft) {
  return draft.items.flatMap((line) => {
    const product = lookup.products.get(line.productId);
    if (!product) return [];
    return missingSlots(product, line.selections);
  });
}

export function lastTouchedLineId(
  before: QuoteDraft,
  after: QuoteDraft,
  previous?: string,
): string | undefined {
  const beforeIds = new Set(before.items.map((item) => item.lineId));
  const added = after.items.find((item) => !beforeIds.has(item.lineId));
  if (added) return added.lineId;
  for (const line of after.items) {
    const prev = before.items.find((item) => item.lineId === line.lineId);
    if (!prev) continue;
    if (JSON.stringify(prev) !== JSON.stringify(line)) return line.lineId;
  }
  if (previous && after.items.some((item) => item.lineId === previous)) return previous;
  return after.items.at(-1)?.lineId;
}

export function processTurn(input: TurnInput): TurnResult {
  const resolved = resolveIntents(
    input.intents,
    input.catalog,
    input.lookup,
    input.draft,
    input.focus,
    { confirmed: input.fromPending },
  );
  const applied = applyActions(
    input.catalog,
    input.draft,
    resolved.actions,
    input.lookup,
  );
  const pending = pickPending(resolved.clarifications);
  const focus: ConversationFocus = {
    lastTouchedLineId: lastTouchedLineId(
      input.draft,
      applied.draft,
      input.focus?.lastTouchedLineId,
    ),
    pending: pending
      ? {
          kind: pending.kind,
          question: pending.question,
          candidates: pending.candidates,
          resume: pending.resume,
        }
      : undefined,
  };
  const reply = summarizeTurn({
    catalog: input.catalog,
    before: input.draft,
    after: applied.draft,
    warnings: applied.warnings,
    clarifications: resolved.clarifications,
  });
  return {
    draft: applied.draft,
    document: hydrateQuote(input.catalog, applied.draft),
    missing: collectMissing(input.lookup, applied.draft),
    warnings: applied.warnings,
    reply,
    focus,
    clarifications: resolved.clarifications,
  };
}

export function tryPendingTurn(
  input: Omit<TurnInput, "intents" | "fromPending">,
): TurnResult | null {
  const matched = matchPendingReply(input.userMessage, input.focus);
  if (matched === "cancel") {
    return {
      draft: input.draft,
      document: hydrateQuote(input.catalog, input.draft),
      missing: collectMissing(input.lookup, input.draft),
      warnings: [],
      reply: "İşlem iptal edildi.",
      focus: {
        lastTouchedLineId: input.focus?.lastTouchedLineId,
      },
      clarifications: [],
    };
  }
  if (!matched) return null;
  return processTurn({ ...input, intents: matched, fromPending: true });
}
