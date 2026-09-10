import type { GroupState, GroupType } from "@/lib/catalog/types";

export type QuoteLineSelection = {
  groupId: string;
  propertyId: string;
  choiceIds: string[];
  priceOverride?: number;
};

export type QuoteLine = {
  lineId: string;
  productId: string;
  modelId: string;
  quantity: number;
  selections: QuoteLineSelection[];
  basePriceOverride?: number;
};

export type QuoteDraft = {
  quoteNumber: string;
  items: QuoteLine[];
};

export type QuoteDocumentQuotedTo = {
  id: string;
  name: string;
  institution: string;
  contactPerson: string;
  date: string;
  quoteNumber: string;
};

export type QuoteDocumentProperty = {
  id: string;
  type: string;
  name: string;
  value: string;
  price: number;
  choiceId?: string;
};

export type QuoteDocumentGroup = {
  id: string;
  name: string;
  state: GroupState;
  type: GroupType;
  price: number;
  properties: QuoteDocumentProperty[];
};

export type QuoteDocumentProduct = {
  lineId: string;
  id: string;
  name: string;
  modelId: string;
  modelName: string;
  price: number;
  quantity: number;
  description: string;
  image: string;
  category: string;
  propertyGroups: QuoteDocumentGroup[];
  lineTotal: number;
};

export type PriceSummary = {
  subtotal: number;
  discount: number;
  tax: number;
  taxRatePercent: number;
  totalAfterDiscount: number;
  totalAfterTax: number;
};

export type QuoteDocument = {
  quotedTo: QuoteDocumentQuotedTo;
  products: QuoteDocumentProduct[];
  priceSummary: PriceSummary;
  preparedBy: string;
};

export const CHAT_OPS = [
  "add_line",
  "remove_line",
  "set_model",
  "set_choice",
  "set_price",
  "remove_property",
  "set_quantity",
] as const;

export type ChatOp = (typeof CHAT_OPS)[number];

export type ChatAction = {
  op: ChatOp;
  lineId?: string | null;
  productId?: string | null;
  modelId?: string | null;
  propertyId?: string | null;
  choiceIds?: string[];
  quantity?: number | null;
  price?: number | null;
};

export type ChatTurnOutput = {
  reply: string;
  actions: ChatAction[];
};

export type ApplyWarning = {
  op: ChatOp;
  message: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  warnings?: ApplyWarning[];
};

export type ApplyResult = {
  draft: QuoteDraft;
  warnings: ApplyWarning[];
};
