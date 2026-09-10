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

export type QuoteCustomer = {
  institution?: string;
  contactPerson?: string;
  title?: string;
};

export type QuoteDraft = {
  quoteNumber: string;
  items: QuoteLine[];
  quotedTo?: QuoteCustomer;
};

export type QuoteDocumentQuotedTo = {
  id: string;
  name: string;
  institution: string;
  contactPerson: string;
  title?: string;
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
  basePrice: number;
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
  "set_customer",
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
  customer?: QuoteCustomer;
};

export const INTENT_OPS = [
  "add_line",
  "remove_line",
  "set_model",
  "set_value",
  "set_price",
  "remove_property",
  "set_quantity",
  "set_customer",
  "clarify",
] as const;

export type IntentOp = (typeof INTENT_OPS)[number];

export const VALUE_MODES = ["set", "add", "remove"] as const;
export type ValueMode = (typeof VALUE_MODES)[number];

export type ChatIntent = {
  op: IntentOp;
  productRef?: string | null;
  lineRef?: string | null;
  modelRef?: string | null;
  propertyRef?: string | null;
  value?: string | null;
  values?: string[];
  valueMode?: ValueMode | null;
  price?: number | null;
  quantity?: number | null;
  customer?: QuoteCustomer;
};

export type ChatTurnOutput = {
  reply: string;
  intents: ChatIntent[];
};

export type ClarifyKind =
  | "which_line"
  | "which_product"
  | "which_value"
  | "confirm_remove";

export type ClarifyCandidate = {
  label: string;
  ref: string;
};

export type ClarifyResult = {
  kind: ClarifyKind;
  question: string;
  candidates: ClarifyCandidate[];
  resume?: ChatIntent;
};

export type ConversationFocus = {
  lastTouchedLineId?: string;
  pending?: {
    kind: ClarifyKind;
    question: string;
    candidates: ClarifyCandidate[];
    resume?: ChatIntent;
  };
};

export type ResolveOk = { action: ChatAction };
export type ResolveClarify = { clarify: ClarifyResult };
export type ResolveOutcome = ResolveOk | ResolveClarify;

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
