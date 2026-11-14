import { readFileSync } from "node:fs";
import postgres from "postgres";
import { resolveDateTokens } from "@/lib/admin/date-tokens";
import { runImport } from "@/lib/admin/import";
import { createSql } from "@/lib/db/client";
import { migrate } from "../../scripts/migrate";

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:5432/dealhoi_test";

export async function databaseAvailable(): Promise<boolean> {
  const sql = postgres(TEST_DATABASE_URL, { max: 1, connect_timeout: 3, onnotice: () => {} });
  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

/** Drops and recreates the schema, applies migrations and seeds reference + demo data. */
export async function resetTestDatabase(now = new Date()) {
  const admin = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  await admin.unsafe("drop schema if exists public cascade; drop schema if exists extensions cascade; create schema public;");
  await admin.end();
  await migrate(TEST_DATABASE_URL, () => {});
  const sql = createSql(TEST_DATABASE_URL);
  for (const file of ["data/reference/reference.json", "data/demo/demo-dataset.json"]) {
    const data = resolveDateTokens(JSON.parse(readFileSync(file, "utf8")), now);
    const report = await sql.begin((tx) => runImport(tx, data, { mode: "seed", dryRun: false }));
    if (!report.ok) throw new Error(`seed failed: ${JSON.stringify(report.errors)}`);
  }
  return sql;
}
