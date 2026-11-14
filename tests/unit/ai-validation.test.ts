import { describe, expect, it, vi } from "vitest";
import { groundedCall } from "@/lib/ai/grounded-call";
import { buildContext, extractNumbers, findUnsupportedNumbers, allowedNumbers, validateGroundedResponse } from "@/lib/ai/grounding";
import { AiInvalidResponseError, AiUnavailableError, createStructuredCaller } from "@/lib/ai/openai-client";
import { ChatResponseSchema, CHAT_JSON_SCHEMA } from "@/lib/ai/schemas";
import { compareDeals } from "@/lib/domain/savings";
import { TODAY, makeCard, makeDeal } from "../fixtures/builders";

// NOTE: every model response in this file is a MOCK. Production calls go to the
// real OpenAI API through createStructuredCaller with a configured key.

const deal = makeDeal({ id: "d1", percentage: 20, maximumBenefitVnd: 50_000, minimumSpendVnd: 100_000 });
const outcome = compareDeals([deal], { amountVnd: 150_000, today: TODAY });
const index = buildContext({
  today: TODAY,
  page: { page: "compare" },
  purchaseAmountVnd: 150_000,
  deals: [deal],
  cards: [makeCard()],
  calculations: new Map(outcome.results.map((r) => [r.dealId, r])),
});
const ok = (answer: string, extra: object = {}) => ({ answer, source_ids: ["src-1"], related_deal_ids: ["d1"], suggested_questions: [], uncertainties: [], ...extra });
const validate = (raw: unknown, userTexts: string[] = []) => validateGroundedResponse(raw, ChatResponseSchema, index, (v) => [v.answer, ...v.uncertainties], userTexts);

describe("number extraction", () => {
  it("reads Vietnamese money and percent formats and ignores dates", () => {
    expect(extractNumbers("Hoàn 20% tối đa 50.000 ₫, hết hạn 31/12/2026")).toEqual({ percents: [20], amounts: [50000] });
    expect(extractNumbers("0,5% và 1,5 triệu và 50k")).toEqual({ percents: [0.5], amounts: [1_500_000, 50_000] });
    expect(extractNumbers("Trả góp 12 tháng năm 2026").amounts).toEqual([]);
  });
});

describe("AI output validation", () => {
  it("accepts answers whose figures and ids come from the context", () => {
    const r = validate(ok("Bạn được hoàn 20%, khoảng 30.000 ₫, tối đa 50.000 ₫ mỗi giao dịch."));
    expect(r.ok).toBe(true);
  });
  it("rejects invalid schema (malformed JSON object)", () => {
    expect(validate({ answer: 42 }).ok).toBe(false);
    expect(validate("not an object").ok).toBe(false);
  });
  it("removes source and deal ids not present in the supplied context", () => {
    const r = validate(ok("Xem ưu đãi.", { source_ids: ["src-1", "made-up"], related_deal_ids: ["d1", "ghost"] }));
    expect(r.ok).toBe(true);
    expect(r.value?.source_ids).toEqual(["src-1"]);
    expect(r.value?.related_deal_ids).toEqual(["d1"]);
    expect(r.problems.join()).toMatch(/invalid_source_ids:made-up/);
  });
  it("rejects unsupported financial figures", () => {
    const r = validate(ok("Thẻ hoàn 35%, tối đa 2.000.000 ₫."));
    expect(r.ok).toBe(false);
    expect(r.problems.join()).toMatch(/35%/);
    expect(findUnsupportedNumbers(["phí 1.000.000 ₫"], allowedNumbers(index.context, []))).toEqual(["1000000"]);
  });
  it("allows figures the user supplied", () => {
    expect(validate(ok("Với 2.500.000 ₫ bạn…"), ["tôi định chi 2.500.000"]).ok).toBe(true);
  });
});

describe("grounded call with retries on invalid output", () => {
  const args = {
    systemPrompt: "x",
    index,
    conversation: [{ role: "user" as const, content: "Thẻ nào tốt?" }],
    schemaName: "chat",
    jsonSchema: CHAT_JSON_SCHEMA,
    schema: ChatResponseSchema,
    textFields: (v: { answer: string }) => [v.answer],
    userTexts: [],
  };
  it("retries once with feedback, then succeeds", async () => {
    const caller = vi.fn().mockResolvedValueOnce(ok("Hoàn 99%")).mockResolvedValueOnce(ok("Hoàn 20%"));
    const r = await groundedCall({ ...args, caller });
    expect(r.attempts).toBe(2);
    expect(caller.mock.calls[1][0].messages.at(-1).content).toMatch(/failed validation/);
  });
  it("gives up after two invalid responses", async () => {
    const caller = vi.fn().mockResolvedValue(ok("Hoàn 99%"));
    await expect(groundedCall({ ...args, caller })).rejects.toBeInstanceOf(AiInvalidResponseError);
  });
});

describe("OpenAI client", () => {
  const cfg = { apiKey: "k", model: "m", baseUrl: "https://x", timeoutMs: 1000, maxOutputTokens: 100, sleep: async () => {} };
  const resp = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
  const good = { choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ a: 1 }) } }] };

  it("fails fast without an API key", async () => {
    await expect(createStructuredCaller({ ...cfg, apiKey: undefined })({ messages: [], schemaName: "s", jsonSchema: {} })).rejects.toBeInstanceOf(AiUnavailableError);
  });
  it("retries transient failures with a bound", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(resp(503, {})).mockResolvedValueOnce(resp(429, {})).mockResolvedValueOnce(resp(200, good));
    const r = await createStructuredCaller({ ...cfg, fetchImpl })({ messages: [], schemaName: "s", jsonSchema: {} });
    expect(r).toEqual({ a: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const always = vi.fn().mockResolvedValue(resp(500, {}));
    await expect(createStructuredCaller({ ...cfg, fetchImpl: always })({ messages: [], schemaName: "s", jsonSchema: {} })).rejects.toBeInstanceOf(AiUnavailableError);
    expect(always).toHaveBeenCalledTimes(3);
  });
  it("does not retry auth errors", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(resp(401, {}));
    await expect(createStructuredCaller({ ...cfg, fetchImpl })({ messages: [], schemaName: "s", jsonSchema: {} })).rejects.toBeInstanceOf(AiUnavailableError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("reports invalid JSON and truncated output as invalid responses", async () => {
    const bad = vi.fn().mockResolvedValue(resp(200, { choices: [{ finish_reason: "stop", message: { content: "{oops" } }] }));
    await expect(createStructuredCaller({ ...cfg, fetchImpl: bad })({ messages: [], schemaName: "s", jsonSchema: {} })).rejects.toBeInstanceOf(AiInvalidResponseError);
    const cut = vi.fn().mockResolvedValue(resp(200, { choices: [{ finish_reason: "length", message: { content: "{}" } }] }));
    await expect(createStructuredCaller({ ...cfg, fetchImpl: cut })({ messages: [], schemaName: "s", jsonSchema: {} })).rejects.toBeInstanceOf(AiInvalidResponseError);
  });
  it("times out slow responses", async () => {
    const slow = vi.fn((_u: string, init: RequestInit) => new Promise<Response>((_, rej) => init.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")))));
    await expect(createStructuredCaller({ ...cfg, timeoutMs: 20, fetchImpl: slow as unknown as typeof fetch })({ messages: [], schemaName: "s", jsonSchema: {} })).rejects.toBeInstanceOf(AiUnavailableError);
    expect(slow).toHaveBeenCalledTimes(3);
  });
});
