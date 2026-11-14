import { z } from "zod";

export const ChatResponseSchema = z.object({
  answer: z.string().min(1).max(4000),
  source_ids: z.array(z.string()).max(20),
  related_deal_ids: z.array(z.string()).max(20),
  suggested_questions: z.array(z.string().max(200)).max(5),
  uncertainties: z.array(z.string().max(500)).max(10),
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

export const SummaryResponseSchema = z.object({
  summary: z.string().min(1).max(2000),
  highlighted_benefits: z.array(z.string().max(400)).max(6),
  key_differences: z.array(z.string().max(400)).max(6),
  important_restrictions: z.array(z.string().max(400)).max(8),
  related_deal_ids: z.array(z.string()).max(30),
  source_ids: z.array(z.string()).max(30),
  uncertainties: z.array(z.string().max(400)).max(8),
});
export type SummaryResponse = z.infer<typeof SummaryResponseSchema>;

const stringArray = { type: "array", items: { type: "string" } } as const;

/** JSON Schemas for OpenAI strict structured outputs (all properties required). */
export const CHAT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "source_ids", "related_deal_ids", "suggested_questions", "uncertainties"],
  properties: {
    answer: { type: "string" },
    source_ids: stringArray,
    related_deal_ids: stringArray,
    suggested_questions: stringArray,
    uncertainties: stringArray,
  },
} as const;

export const SUMMARY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "highlighted_benefits", "key_differences", "important_restrictions", "related_deal_ids", "source_ids", "uncertainties"],
  properties: {
    summary: { type: "string" },
    highlighted_benefits: stringArray,
    key_differences: stringArray,
    important_restrictions: stringArray,
    related_deal_ids: stringArray,
    source_ids: stringArray,
    uncertainties: stringArray,
  },
} as const;
