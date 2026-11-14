import "server-only";
import postgres from "postgres";
import { config } from "@/lib/config";

export type Sql = postgres.Sql<Record<string, unknown>>;
export type TxSql = postgres.TransactionSql<Record<string, unknown>>;

const types = {
  // BIGINT money (VND) fits comfortably in a JS number (< 2^53).
  bigint: { to: 20, from: [20], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
  numeric: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
  // Keep DATE values as 'YYYY-MM-DD' strings to avoid timezone shifts.
  date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x },
};

export function createSql(url: string, ssl = false): Sql {
  return postgres(url, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    // Compatible with Supabase's transaction pooler.
    prepare: false,
    ssl: ssl ? "require" : undefined,
    types,
    onnotice: () => {},
  }) as unknown as Sql;
}

const globalForDb = globalThis as unknown as { __dealhoiSql?: Sql };

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not configured");
  }
}

export function getSql(): Sql {
  if (!config.databaseUrl) throw new DatabaseNotConfiguredError();
  if (!globalForDb.__dealhoiSql) {
    globalForDb.__dealhoiSql = createSql(config.databaseUrl, config.databaseSsl);
  }
  return globalForDb.__dealhoiSql;
}

/**
 * Run read-only public queries with reduced privileges so that Supabase Row Level
 * Security policies apply (defence in depth on top of explicit WHERE filters).
 */
export async function withPublicRead<T>(fn: (sql: TxSql) => Promise<T>): Promise<T> {
  const sql = getSql();
  const role = config.dbPublicRole;
  return (await sql.begin("read only", async (tx) => {
    if (role) await tx.unsafe(`set local role ${role}`);
    return fn(tx);
  })) as T;
}

/** Administrative writes. Callers MUST verify the admin session first. */
export async function withAdminTx<T>(fn: (sql: TxSql) => Promise<T>): Promise<T> {
  const sql = getSql();
  return (await sql.begin(async (tx) => fn(tx))) as T;
}
