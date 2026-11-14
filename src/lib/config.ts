import "server-only";
import { z } from "zod";

const boolish = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  DATABASE_SSL: boolish.optional(),
  DB_PUBLIC_ROLE: z.string().regex(/^[a-z_]*$/).optional(),
  DEALHOI_DEMO_DATA: boolish.optional(),
  DEALHOI_STALE_AFTER_DAYS: z.coerce.number().int().positive().optional(),
  DEALHOI_SCORING_WEIGHTS: z.string().optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  OPENAI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().optional(),
  AI_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().optional(),
  ADMIN_SESSION_SECRET: z.string().min(32).optional(),
  ADMIN_AUTH_PROVIDER: z.enum(["supabase", "env"]).optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD_HASH: z.string().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
});

function emptyToUndefined(env: NodeJS.ProcessEnv) {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) out[k] = v === "" ? undefined : v;
  return out;
}

const parsed = EnvSchema.safeParse(emptyToUndefined(process.env));
if (!parsed.success) {
  // Fail loudly with the names of the invalid variables (never their values).
  const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
  throw new Error(`Invalid environment configuration: ${names}`);
}
const env = parsed.data;
const isProduction = process.env.NODE_ENV === "production";

export const config = {
  isProduction,
  databaseUrl: env.DATABASE_URL,
  databaseSsl: env.DATABASE_SSL ?? false,
  /** Role used for public reads so Row Level Security applies. Empty string disables. */
  dbPublicRole: env.DB_PUBLIC_ROLE ?? "anon",
  /** Demonstration data is excluded in production unless explicitly enabled. */
  includeDemoData: env.DEALHOI_DEMO_DATA ?? !isProduction,
  staleAfterDays: env.DEALHOI_STALE_AFTER_DAYS ?? 90,
  scoringWeightsJson: env.DEALHOI_SCORING_WEIGHTS,
  ai: {
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL ?? "gpt-4.1-mini",
    baseUrl: (env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, ""),
    timeoutMs: env.OPENAI_TIMEOUT_MS ?? 20000,
    maxOutputTokens: env.OPENAI_MAX_OUTPUT_TOKENS ?? 900,
    rateLimitPerMinute: env.AI_RATE_LIMIT_PER_MINUTE ?? 12,
  },
  admin: {
    sessionSecret: env.ADMIN_SESSION_SECRET,
    provider: env.ADMIN_AUTH_PROVIDER ?? (env.SUPABASE_URL && env.SUPABASE_ANON_KEY ? "supabase" : "env"),
    email: env.ADMIN_EMAIL,
    passwordHash: env.ADMIN_PASSWORD_HASH,
    supabaseUrl: env.SUPABASE_URL,
    supabaseAnonKey: env.SUPABASE_ANON_KEY,
  },
} as const;

export const TIMEZONE = "Asia/Ho_Chi_Minh";
