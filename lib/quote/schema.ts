import { z } from "zod";
import {
  INTENT_OPS,
  VALUE_MODES,
  type ChatIntent,
  type ChatTurnOutput,
} from "./types";

export const chatTurnSchema = z.object({
  reply: z.string(),
  intents: z.array(
    z.object({
      op: z.enum(INTENT_OPS),
      productRef: z.string().nullable().optional(),
      lineRef: z.string().nullable().optional(),
      modelRef: z.string().nullable().optional(),
      propertyRef: z.string().nullable().optional(),
      value: z.string().nullable().optional(),
      values: z.array(z.string()).optional(),
      valueMode: z.enum(VALUE_MODES).nullable().optional(),
      price: z.number().nullable().optional(),
      quantity: z.number().nullable().optional(),
      customer: z
        .object({
          institution: z.string().nullable().optional(),
          contactPerson: z.string().nullable().optional(),
          title: z.string().nullable().optional(),
        })
        .optional(),
    }),
  ),
});

const nullableString = { type: ["string", "null"] };

export function chatTurnJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["reply", "intents"],
    properties: {
      reply: { type: "string" },
      intents: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["op"],
          properties: {
            op: { type: "string", enum: [...INTENT_OPS] },
            productRef: nullableString,
            lineRef: nullableString,
            modelRef: nullableString,
            propertyRef: nullableString,
            value: nullableString,
            values: { type: "array", items: { type: "string" } },
            valueMode: { type: ["string", "null"], enum: [...VALUE_MODES, null] },
            price: { type: ["number", "null"], minimum: 0 },
            quantity: { type: ["integer", "null"], minimum: 1 },
            customer: {
              type: ["object", "null"],
              additionalProperties: false,
              properties: {
                institution: nullableString,
                contactPerson: nullableString,
                title: nullableString,
              },
            },
          },
        },
      },
    },
  };
}

export function parseChatTurn(raw: unknown): ChatTurnOutput {
  const parsed = chatTurnSchema.parse(raw);
  return {
    reply: parsed.reply,
    intents: parsed.intents as ChatIntent[],
  };
}
