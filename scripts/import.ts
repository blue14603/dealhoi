/*
 * Server-side import of a JSON bundle or CSV file.
 *   npm run data:import -- <file.json|file.csv> [--entity=cards|deals|...] [--dry-run] [--mode=admin|seed]
 * Default mode "admin": new or changed records land as drafts that must be reviewed in /admin.
 */
import { readFileSync } from "node:fs";
import { csvToRecords } from "@/lib/admin/csv";
import { runImport } from "@/lib/admin/import";
import { createSql } from "@/lib/db/client";

/** Loads DATABASE_URL etc. from .env.local / .env when not already set in the shell. */
function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // Missing file: nothing to load.
    }
  }
}

async function main() {
  loadLocalEnv();
  const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!file) throw new Error("Usage: data:import <file> [--entity=deals] [--dry-run] [--mode=admin|seed]");
  const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const mode = (arg("mode") ?? "admin") as "admin" | "seed";
  const dryRun = process.argv.includes("--dry-run");
  const text = readFileSync(file, "utf8");
  let bundle: unknown;
  if (file.endsWith(".csv")) {
    const entity = arg("entity");
    if (!entity) throw new Error("--entity is required for CSV files");
    bundle = { [entity]: csvToRecords(text) };
  } else bundle = JSON.parse(text);
  const sql = createSql(process.env.DATABASE_URL ?? "", process.env.DATABASE_SSL === "true");
  try {
    const report = await sql.begin((tx) => runImport(tx, bundle, { mode, dryRun, actorEmail: "cli" }));
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
