import {
  isAffirmative,
  isNegative,
  normalizeText,
  parseLineOrdinal,
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
  }

  const picked = pickCandidate(folded, pending.candidates);
  if (!picked) return null;

  const resume = pending.resume;
  if (pending.kind === "which_line") {
    return [
      {
        ...(resume ?? { op: "set_value" }),
        lineRef: picked.ref,
      },
    ];
  }
  if (pending.kind === "which_product") {
    return [
      {
        ...(resume ?? { op: "add_line" }),
        productRef: picked.ref,
      },
    ];
  }
  if (pending.kind === "which_value") {
    return [
      {
        ...(resume ?? { op: "set_value" }),
        propertyRef: resume?.propertyRef ?? picked.label,
        value: resume?.value ?? picked.ref,
        values: resume?.values,
      },
    ];
  }
  return [resume ?? { op: "add_line", productRef: picked.ref }];
}

function pickCandidate(
  folded: string,
  candidates: { label: string; ref: string }[],
) {
  const ordinal = parseLineOrdinal(folded);
  if (ordinal !== null && candidates.length) {
    const index = ordinal < 0 ? candidates.length - 1 : ordinal;
    if (candidates[index]) return candidates[index];
  }
  return candidates.find((candidate) => {
    const ref = normalizeText(candidate.ref);
    const label = normalizeText(candidate.label);
    return folded === ref || folded === label || label.includes(folded) || folded.includes(ref);
  });
}
