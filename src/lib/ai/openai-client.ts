/**
 * Minimal server-side OpenAI Chat Completions client with structured outputs.
 * - Request timeout (AbortController)
 * - Bounded retries with exponential backoff for transient failures (429, 5xx, network, timeout)
 * - Output token limit
 * The API key is read server-side only; nothing here is shipped to the browser.
 */

export class AiUnavailableError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

export class AiInvalidResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiInvalidResponseError";
  }
}

export interface AiClientConfig {
  apiKey: string | undefined;
  model: string;
  baseUrl: string;
  timeoutMs: number;
  maxOutputTokens: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StructuredRequest {
  messages: ChatMessage[];
  schemaName: string;
  jsonSchema: Record<string, unknown>;
}

export type StructuredCaller = (req: StructuredRequest) => Promise<unknown>;

const TRANSIENT_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);

/** True for errors meaning the account has no credit left; retrying cannot help. */
export function isQuotaError(message: string): boolean {
  return /insufficient_quota|credit_balance_exhausted|billing_hard_limit_reached/.test(message);
}

export function createStructuredCaller(cfg: AiClientConfig): StructuredCaller {
  const fetchImpl = cfg.fetchImpl ?? fetch;
  const sleep = cfg.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const maxRetries = cfg.maxRetries ?? 2;

  return async function callStructured(req: StructuredRequest): Promise<unknown> {
    if (!cfg.apiKey) throw new AiUnavailableError("OPENAI_API_KEY is not configured");
    const body = JSON.stringify({
      model: cfg.model,
      messages: req.messages,
      max_completion_tokens: cfg.maxOutputTokens,
      response_format: {
        type: "json_schema",
        json_schema: { name: req.schemaName, strict: true, schema: req.jsonSchema },
      },
    });

    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) await sleep(Math.min(4000, 500 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 200));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
      try {
        const res = await fetchImpl(`${cfg.baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
          body,
          signal: controller.signal,
        });
        if (!res.ok) {
          // OpenAI explains failures as {"error": {"code": "...", "type": "..."}}; keep only the code.
          let codes: string[] = [];
          try {
            const err = (JSON.parse(await res.text()) as { error?: { code?: string | null; type?: string | null } }).error;
            codes = [...new Set([err?.type, err?.code].filter((c): c is string => Boolean(c)))];
          } catch {
            // No JSON body.
          }
          lastError = new AiUnavailableError(`OpenAI HTTP ${res.status}${codes.length ? ` (${codes.join(", ")})` : ""}`);
          // An exhausted quota is not transient: retrying cannot succeed.
          if (TRANSIENT_STATUS.has(res.status) && !isQuotaError(codes.join(" "))) continue;
          throw lastError; // 400/401/403/404: not retryable
        }
        const json = (await res.json()) as {
          choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
        };
        const choice = json.choices?.[0];
        if (choice?.message?.refusal) throw new AiInvalidResponseError("Model refused the request");
        if (choice?.finish_reason === "length") throw new AiInvalidResponseError("Model output was truncated");
        const content = choice?.message?.content;
        if (!content) throw new AiInvalidResponseError("Empty model response");
        try {
          return JSON.parse(content);
        } catch {
          throw new AiInvalidResponseError("Model returned invalid JSON");
        }
      } catch (e) {
        if (e instanceof AiInvalidResponseError) throw e;
        if (e instanceof AiUnavailableError && (!String(e.message).match(/HTTP (408|409|429|5\d\d)/) || isQuotaError(e.message))) throw e;
        lastError = e;
      } finally {
        clearTimeout(timer);
      }
    }
    throw new AiUnavailableError("AI service unavailable after retries", lastError);
  };
}
