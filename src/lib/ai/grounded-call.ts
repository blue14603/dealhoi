import type { z } from "zod";
import { AiInvalidResponseError, type ChatMessage, type StructuredCaller } from "./openai-client";
import { validateGroundedResponse, type ContextIndex } from "./grounding";

/**
 * Calls the model with a limited verified context, validates the structured
 * response and retries once with feedback if validation fails.
 */
export async function groundedCall<T extends { source_ids: string[]; related_deal_ids: string[] }>(args: {
  caller: StructuredCaller;
  systemPrompt: string;
  index: ContextIndex;
  conversation: ChatMessage[];
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  schema: z.ZodType<T>;
  textFields: (v: T) => string[];
  userTexts: string[];
}): Promise<{ value: T; attempts: number }> {
  const messages: ChatMessage[] = [
    { role: "system", content: args.systemPrompt },
    { role: "system", content: `<context>\n${JSON.stringify(args.index.context)}\n</context>` },
    ...args.conversation,
  ];
  let lastProblems: string[] = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const raw = await args.caller({ messages, schemaName: args.schemaName, jsonSchema: args.jsonSchema });
    const outcome = validateGroundedResponse(raw, args.schema, args.index, args.textFields, args.userTexts);
    if (outcome.ok && outcome.value) return { value: outcome.value, attempts: attempt };
    lastProblems = outcome.problems;
    messages.push({ role: "assistant", content: JSON.stringify(raw) });
    messages.push({
      role: "system",
      content: `Your previous response failed validation (${outcome.problems.join("; ")}). Rewrite it using ONLY numbers, deal_id and source_id values that appear in the context. Remove any figure you cannot find there.`,
    });
  }
  throw new AiInvalidResponseError(`AI response failed validation: ${lastProblems.join("; ")}`);
}
