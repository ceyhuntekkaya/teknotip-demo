import type { ChatMessage } from "@/lib/quote/types";

export const QUOTE_WORKSPACE_KEY = "teknotip.quote-workspace";
export const QUOTE_WORKSPACE_VERSION = 3;

export type QuoteWorkspace = {
  version: number;
  quoteId: string | null;
  messages: ChatMessage[];
};

export function emptyQuoteWorkspace(): QuoteWorkspace {
  return {
    version: QUOTE_WORKSPACE_VERSION,
    quoteId: null,
    messages: [],
  };
}

export function loadQuoteWorkspace(): QuoteWorkspace {
  if (typeof localStorage === "undefined") return emptyQuoteWorkspace();
  try {
    const raw = localStorage.getItem(QUOTE_WORKSPACE_KEY);
    if (!raw) return emptyQuoteWorkspace();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyQuoteWorkspace();
    const record = parsed as Record<string, unknown>;
    if (record.version !== QUOTE_WORKSPACE_VERSION) return emptyQuoteWorkspace();
    return {
      version: QUOTE_WORKSPACE_VERSION,
      quoteId: typeof record.quoteId === "string" ? record.quoteId : null,
      messages: Array.isArray(record.messages)
        ? (record.messages as ChatMessage[])
        : [],
    };
  } catch {
    return emptyQuoteWorkspace();
  }
}

export function saveQuoteWorkspace(workspace: QuoteWorkspace): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      QUOTE_WORKSPACE_KEY,
      JSON.stringify({ ...workspace, version: QUOTE_WORKSPACE_VERSION }),
    );
  } catch {
    // ignore
  }
}

export function clearQuoteWorkspace(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(QUOTE_WORKSPACE_KEY);
  } catch {
    // ignore
  }
}
