/*
 * Crawl one bank's promotions into DealHoi import files.
 *
 *   npm run crawl -- techcombank [--limit=20] [--no-llm] [--force] [--out=.crawl/out]
 *
 * Output (in <out>/<bank>/<date>/):
 *   bundle.json  sources + draft deals   → npm run data:import -- bundle.json --dry-run
 *   stubs.json   cards + new merchants   → import once, then complete by hand
 *   parsed.json  structured data read from each active credit card page
 *   report.md    summary, warnings, offers to enter by hand
 *
 * --no-llm parses pages without calling the model (no OPENAI_API_KEY needed).
 * State is kept in .crawl/state/<bank>.json so later runs only process new or
 * changed pages.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createStructuredCaller } from "@/lib/ai/openai-client";
import { todayInVietnam } from "@/lib/domain/validity";
import { techcombank } from "./banks/techcombank";
import { createPoliteFetcher } from "./core/http";
import { renderReport, runCrawl } from "./core/run";
import { loadState, saveState } from "./core/state";
import type { BankAdapter } from "./core/types";

const BANKS: Record<string, BankAdapter> = { techcombank };

/** Loads .env.local (git-ignored) so API keys never need to be typed on the command line. */
function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // Missing file: nothing to load.
    }
  }
}

/** Shows which key is used (last 4 characters only) and where it came from. */
function describeKey(key: string | undefined, fromShell: boolean): string {
  if (!key) return "none";
  return `…${key.slice(-4)} (${fromShell ? "from the shell environment, overrides .env.local" : "from .env.local"})`;
}

async function main() {
  const keyFromShell = Boolean(process.env.OPENAI_API_KEY);
  loadLocalEnv();
  const args = process.argv.slice(2);
  const bankSlug = args.find((a) => !a.startsWith("--"));
  const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const bank = bankSlug ? BANKS[bankSlug] : undefined;
  if (!bank) throw new Error(`Usage: crawl <${Object.keys(BANKS).join("|")}> [--limit=N] [--no-llm] [--force] [--out=dir]`);

  const noLlm = args.includes("--no-llm");
  const apiKey = process.env.OPENAI_API_KEY;
  if (!noLlm && !apiKey) throw new Error("OPENAI_API_KEY is not set. Use --no-llm to parse pages without extraction.");
  if (!noLlm) console.error(`OpenAI key: ${describeKey(apiKey, keyFromShell)}`);
  const caller = noLlm
    ? null
    : createStructuredCaller({
        apiKey,
        model: process.env.CRAWLER_OPENAI_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        baseUrl: (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, ""),
        timeoutMs: 60000,
        maxOutputTokens: 6000,
      });

  const reference = JSON.parse(readFileSync("data/reference/reference.json", "utf8")) as {
    categories: { slug: string; name: string; aliases?: string[] }[];
    merchants: { slug: string }[];
  };
  const statePath = join(".crawl", "state", `${bank.slug}.json`);
  const state = loadState(statePath);
  const today = todayInVietnam();
  const limit = opt("limit") ? Number(opt("limit")) : undefined;

  const report = await runCrawl({
    bank,
    fetcher: createPoliteFetcher(),
    caller,
    state,
    today,
    retrievedAt: new Date().toISOString(),
    categories: reference.categories.map((c) => ({ slug: c.slug, name: c.name, aliases: c.aliases })),
    knownMerchantSlugs: new Set(reference.merchants.map((m) => m.slug)),
    limit,
    force: args.includes("--force"),
    log: (l) => console.error(l),
  });

  const outDir = join(opt("out") ?? join(".crawl", "out"), bank.slug, today);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "bundle.json"), JSON.stringify(report.bundles.main, null, 2));
  writeFileSync(join(outDir, "stubs.json"), JSON.stringify(report.bundles.stubs, null, 2));
  writeFileSync(join(outDir, "parsed.json"), JSON.stringify(report.parsed, null, 2));
  writeFileSync(join(outDir, "report.md"), renderReport(report));
  saveState(statePath, state);

  console.log(renderReport(report));
  console.error(`\nFiles written to ${outDir}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
