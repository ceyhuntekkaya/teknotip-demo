import { z } from "zod";
import type { Catalog } from "@/lib/catalog/types";
import { CHAT_OPS, type ChatTurnOutput, type QuoteDraft } from "./types";

const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

export const chatTurnSchema = z.object({
  reply: z.string(),
  actions: z.array(
    z.object({
      op: z.enum(CHAT_OPS),
      lineId: z.string().nullable().optional(),
      productId: z.string().nullable().optional(),
      modelId: z.string().nullable().optional(),
      propertyId: z.string().nullable().optional(),
      choiceIds: z.array(z.string()).optional(),
      quantity: z.number().nullable().optional(),
      price: z.number().nullable().optional(),
    }),
  ),
});

function stringOrEnum(values: string[]) {
  const items = unique(values);
  if (!items.length) {
    return { type: ["string", "null"] };
  }
  return {
    anyOf: [{ type: "string", enum: items }, { type: "null" }],
  };
}

export function chatTurnJsonSchema(catalog: Catalog, draft: QuoteDraft) {
  const productIds: string[] = [];
  const modelIds: string[] = [];
  const propertyIds: string[] = [];
  const choiceIds: string[] = [];

  for (const product of catalog) {
    productIds.push(product.id);
    for (const model of product.models) modelIds.push(model.id);
    for (const group of product.propertyGroups) {
      for (const property of group.properties) {
        propertyIds.push(property.id);
        for (const choice of property.choice ?? []) choiceIds.push(choice.id);
      }
    }
  }

  return {
    type: "object",
    additionalProperties: false,
    required: ["reply", "actions"],
    properties: {
      reply: { type: "string" },
      actions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["op"],
          properties: {
            op: { type: "string", enum: [...CHAT_OPS] },
            lineId: stringOrEnum(draft.items.map((item) => item.lineId)),
            productId: stringOrEnum(productIds),
            modelId: stringOrEnum(modelIds),
            propertyId: stringOrEnum(propertyIds),
            choiceIds: {
              type: "array",
              items: choiceIds.length
                ? { type: "string", enum: unique(choiceIds) }
                : { type: "string" },
            },
            quantity: { type: ["integer", "null"], minimum: 1 },
            price: { type: ["number", "null"], minimum: 0 },
          },
        },
      },
    },
  };
}

export function parseChatTurn(raw: unknown): ChatTurnOutput {
  return chatTurnSchema.parse(raw);
}
