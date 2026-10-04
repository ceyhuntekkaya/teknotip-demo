import type { CatalogValueSuggestion } from "@/lib/api/generated/model/quoteChatResponse";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  catalogValueSuggestion?: CatalogValueSuggestion;
};
