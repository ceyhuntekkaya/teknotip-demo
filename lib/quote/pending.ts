import {
  extractLineRef,
  isAffirmative,
  isBareAmount,
  isNegative,
  isRequestUtterance,
  messageTokens,
  normalizeText,
  parseCount,
  parseLineOrdinal,
  parsePrice,
  tokenSet,
} from "./resolve/text";
import type { ChatIntent, ConversationFocus } from "./types";

export function matchPendingReply(
  message: string,
  focus?: ConversationFocus,
): ChatIntent[] | "cancel" | null {
  const pending = focus?.pending;
  if (!pending) return null;
  const folded = normalizeText(message);
  if (!folded) return null;

  if (pending.kind === "confirm_remove") {
    if (isAffirmative(folded)) {
      const resume = pending.resume;
      const ref = pending.candidates[0]?.ref;
      return [
        {
          op: "remove_line",
          lineRef: resume?.lineRef ?? ref,
          productRef: resume?.productRef,
        },
      ];
    }
    if (isNegative(folded)) return "cancel";
    return null;
  }

  if (!isPendingAnswer(folded, pending)) return null;

  const resume = pending.resume;
  const price = parsePrice(folded);
  if (resume?.op === "set_price" && price != null && isBareAmount(folded)) {
    return [{ ...resume, price, value: resume.value ?? message.trim() }];
  }

  const count = parseCount(folded);
  if (resume?.op === "set_quantity" && count != null && !isRequestUtterance(folded)) {
    return [{ ...resume, quantity: count, value: resume.value ?? message.trim() }];
  }

  const picked = pickCandidate(folded, pending.candidates);
  if (pending.kind === "which_line") {
    const lineRef = picked?.ref ?? extractLineRef(folded) ?? folded;
    return [
      {
        ...(resume ?? { op: "set_value" }),
        lineRef,
      },
    ];
  }
  if (pending.kind === "which_product") {
    if (!picked) return null;
    return [
      {
        ...(resume ?? { op: "add_line" }),
        productRef: picked.ref,
      },
    ];
  }
  if (pending.kind === "which_value") {
    if (picked) {
      return [
        {
          ...(resume ?? { op: "set_value" }),
          propertyRef: picked.label,
          value: valueAfterCandidatePick(folded, picked, resume),
          values: resume?.values,
        },
      ];
    }
    if (!pending.candidates.length && resume) {
      return [
        {
          ...resume,
          value: resume.value ?? message.trim(),
          price: resume.op === "set_price" ? price ?? resume.price : resume.price,
          quantity:
            resume.op === "set_quantity" ? count ?? resume.quantity : resume.quantity,
        },
      ];
    }
    return null;
  }
  return [resume ?? { op: "add_line", productRef: picked?.ref }];
}

function valueAfterCandidatePick(
  folded: string,
  picked: { label: string; ref: string },
  resume?: ChatIntent,
): string | undefined {
  const leftover = messageTokens(folded).filter(
    (token) => !tokenSet(`${picked.label} ${picked.ref}`).includes(token),
  );
  const numeric = leftover.find((token) => /^\d+(?:[.,]\d+)?$/.test(token));
  if (numeric) return numeric;
  return resume?.value ?? (leftover.length ? leftover.join(" ") : picked.ref);
}

function isPendingAnswer(
  folded: string,
  pending: NonNullable<ConversationFocus["pending"]>,
): boolean {
  if (isBareAmount(folded) && pending.resume?.op === "set_price") return true;
  if (parseLineOrdinal(folded) != null && messageTokens(folded).length <= 2) return true;

  const picked = pickCandidate(folded, pending.candidates);
  if (picked) {
    const leftover = messageTokens(folded).filter(
      (token) => !tokenSet(`${picked.label} ${picked.ref}`).includes(token),
    );
    const extra = leftover.filter((token) => !/^\d+(?:[.,]\d+)?$/.test(token));
    return extra.length === 0 && leftover.length <= 1;
  }

  if (!pending.candidates.length) {
    if (pending.resume?.op === "set_price") return isBareAmount(folded);
    if (pending.resume?.op === "set_quantity") {
      return parseCount(folded) != null && !isRequestUtterance(folded);
    }
    if (pending.resume?.op === "set_value") {
      return messageTokens(folded).length <= 2 && !isRequestUtterance(folded);
    }
  }

  return false;
}

function pickCandidate(
  folded: string,
  candidates: { label: string; ref: string }[],
) {
  const core = messageTokens(folded).filter((token) => !/^\d+(?:[.,]\d+)?$/.test(token));
  const coreText = core.join(" ") || folded;
  const ordinal = parseLineOrdinal(coreText);
  if (ordinal !== null && candidates.length && core.length <= 2) {
    const index = ordinal < 0 ? candidates.length - 1 : ordinal;
    if (candidates[index]) return candidates[index];
  }
  const foldedAll = normalizeText(folded);
  return candidates.find((candidate) => {
    const ref = normalizeText(candidate.ref);
    const label = normalizeText(candidate.label);
    if (foldedAll === ref || foldedAll === label) return true;
    if (coreText === ref || coreText === label) return true;
    const candidateTokens = new Set(tokenSet(`${candidate.label} ${candidate.ref}`));
    if (!candidateTokens.size || !core.length) return false;
    return core.every((token) => candidateTokens.has(token)) && core.length <= candidateTokens.size;
  });
}
