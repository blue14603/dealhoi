import { decodeEntities } from "./html";
import type { DiscoveredUrl, Fetcher } from "./types";

/** Parses a sitemap or sitemap index. */
export function parseSitemap(xml: string): { kind: "index" | "urlset"; entries: DiscoveredUrl[] } {
  const kind = /<sitemapindex\b/i.test(xml) ? "index" : "urlset";
  const tag = kind === "index" ? "sitemap" : "url";
  const entries: DiscoveredUrl[] = [];
  for (const m of xml.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi"))) {
    const loc = m[1].match(/<loc>\s*([\s\S]*?)\s*<\/loc>/i)?.[1];
    if (!loc) continue;
    const lastmod = m[1].match(/<lastmod>\s*([\s\S]*?)\s*<\/lastmod>/i)?.[1] ?? null;
    entries.push({ url: decodeEntities(loc.trim()), lastmod });
  }
  return { kind, entries };
}

/**
 * Fetches a sitemap index and the child sitemaps accepted by `childFilter`,
 * returning every page URL (deduplicated).
 */
export async function collectSitemapUrls(
  fetcher: Fetcher,
  rootUrl: string,
  childFilter: (url: string) => boolean = () => true,
): Promise<DiscoveredUrl[]> {
  const seen = new Map<string, DiscoveredUrl>();
  const queue = [rootUrl];
  const visited = new Set<string>();
  while (queue.length) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);
    let res: { status: number; text: string };
    try {
      res = await fetcher(url);
    } catch (e) {
      const cause = e instanceof Error ? ((e.cause as Error | undefined)?.message ?? e.message) : String(e);
      throw new Error(`Không tải được sitemap ${url}: ${cause}`);
    }
    if (res.status !== 200) throw new Error(`Sitemap ${url} returned HTTP ${res.status}`);
    const parsed = parseSitemap(res.text);
    if (parsed.kind === "index") {
      for (const e of parsed.entries) if (childFilter(e.url)) queue.push(e.url);
    } else {
      for (const e of parsed.entries) if (!seen.has(e.url)) seen.set(e.url, e);
    }
  }
  return [...seen.values()];
}
