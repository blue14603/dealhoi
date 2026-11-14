/* Applies SQL migrations in db/migrations in order, once each. Usage: npm run db:migrate */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

export async function migrate(url: string, log = console.log) {
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {}, ssl: process.env.DATABASE_SSL === "true" ? "require" : undefined });
  try {
    await sql`create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
    const applied = new Set((await sql<{ name: string }[]>`select name from public.schema_migrations`).map((r) => r.name));
    const dir = join(process.cwd(), "db", "migrations");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      if (applied.has(file)) continue;
      const body = readFileSync(join(dir, file), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`insert into public.schema_migrations (name) values (${file})`;
      });
      log(`applied ${file}`);
    }
    log("migrations up to date");
  } finally {
    await sql.end();
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  await migrate(url);
}

if (process.argv[1]?.endsWith("migrate.ts")) main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
