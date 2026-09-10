import type { MissingSlot } from "@/lib/catalog/rules";
import type { ChatMessage, QuoteDocument, QuoteDraft } from "./types";

export const QUOTE_SESSION_KEY = "teknotip.quote-session";
export const QUOTE_SESSION_VERSION = 1;

export type QuoteSession = {
  version: number;
  draft: QuoteDraft;
  document: QuoteDocument | null;
  missing: MissingSlot[];
  messages: ChatMessage[];
};

export function emptyQuoteSession(): QuoteSession {
  return {
    version: QUOTE_SESSION_VERSION,
    draft: { quoteNumber: "", items: [] },
    document: null,
    missing: [],
    messages: [],
  };
}

export function parseQuoteSession(raw: string | null): QuoteSession | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== QUOTE_SESSION_VERSION) return null;
    if (!isDraft(parsed.draft)) return null;
    if (!isDocument(parsed.document)) return null;
    if (!Array.isArray(parsed.missing) || !parsed.missing.every(isMissingSlot)) {
      return null;
    }
    if (!Array.isArray(parsed.messages) || !parsed.messages.every(isChatMessage)) {
      return null;
    }
    return {
      version: QUOTE_SESSION_VERSION,
      draft: parsed.draft,
      document: parsed.document,
      missing: parsed.missing,
      messages: parsed.messages,
    };
  } catch {
    return null;
  }
}

export function loadQuoteSession(): QuoteSession | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return parseQuoteSession(localStorage.getItem(QUOTE_SESSION_KEY));
  } catch {
    return null;
  }
}

export function saveQuoteSession(session: QuoteSession): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      QUOTE_SESSION_KEY,
      JSON.stringify({ ...session, version: QUOTE_SESSION_VERSION }),
    );
  } catch {
    // Quota or private mode — keep working in memory.
  }
}

export function clearQuoteSession(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(QUOTE_SESSION_KEY);
  } catch {
    // ignore
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDraft(value: unknown): value is QuoteDraft {
  if (!isRecord(value)) return false;
  return typeof value.quoteNumber === "string" && Array.isArray(value.items);
}

function isDocument(value: unknown): value is QuoteDocument | null {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  return isRecord(value.quotedTo) && Array.isArray(value.products);
}

function isMissingSlot(value: unknown): value is MissingSlot {
  if (!isRecord(value)) return false;
  return (
    typeof value.productId === "string" &&
    typeof value.groupId === "string" &&
    typeof value.label === "string" &&
    Array.isArray(value.options)
  );
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!isRecord(value)) return false;
  return (
    (value.role === "user" || value.role === "assistant") &&
    typeof value.content === "string"
  );
}
