/*
 * Seeds the database.
 *   npm run db:seed          -> reference data only (categories, merchants, bank names). Production-safe.
 *   npm run db:seed:demo     -> reference data + FICTIONAL demonstration data (development only).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runImport } from "@/lib/admin/import";
import { createSql } from "@/lib/db/client";
import { resolveDateTokens } from "@/lib/admin/date-tokens";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const withDemo = process.argv.includes("--demo");
  if (withDemo && process.env.NODE_ENV === "production" && !process.argv.includes("--force-demo")) {
    throw new Error("Refusing to seed demonstration data with NODE_ENV=production (pass --force-demo for a preview database)");
  }
  const sql = createSql(url, process.env.DATABASE_SSL === "true");
  try {
    const files = [join("data", "reference", "reference.json"), ...(withDemo ? [join("data", "demo", "demo-dataset.json")] : [])];
    for (const file of files) {
      const data = resolveDateTokens(JSON.parse(readFileSync(file, "utf8")));
      const report = await sql.begin((tx) => runImport(tx, data, { mode: "seed", dryRun: false }));
      const summary = Object.entries(report.counts)
        .filter(([, c]) => c.create + c.update + c.unchanged > 0)
        .map(([k, c]) => `${k}: +${c.create} ~${c.update} =${c.unchanged}`)
        .join(", ");
      console.log(`${file}: ${report.ok ? "ok" : "FAILED"} (${summary})`);
      for (const e of report.errors) console.error(`  error ${e.entity}[${e.index}] ${e.key}: ${e.message}`);
      if (!report.ok) process.exitCode = 1;
    }
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
