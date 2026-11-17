import { parseRobots, type Robots } from "./robots";
import type { Fetcher } from "./types";

export const USER_AGENT = "DealHoiCrawler/0.1";

export interface PoliteFetcherOptions {
  /** Minimum delay between two requests to the same host. */
  delayMs?: number;
  timeoutMs?: number;
  retries?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export class RobotsDisallowedError extends Error {
  constructor(readonly url: string) {
    super(`robots.txt disallows ${url}`);
    this.name = "RobotsDisallowedError";
  }
}

/**
 * A fetcher that obeys robots.txt, waits between requests to the same host,
 * and retries transient failures. Requests are sequential by design.
 */
export function createPoliteFetcher(opts: PoliteFetcherOptions = {}): Fetcher {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const delayMs = opts.delayMs ?? 1500;
  const timeoutMs = opts.timeoutMs ?? 20000;
  const retries = opts.retries ?? 2;
  const robotsByHost = new Map<string, Promise<Robots>>();
  const lastRequestAt = new Map<string, number>();

  async function raw(url: string): Promise<{ status: number; text: string }> {
    const host = new URL(url).host;
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const wait = (lastRequestAt.get(host) ?? 0) + delayMs * (attempt + 1) - Date.now();
      if (wait > 0) await sleep(wait);
      lastRequestAt.set(host, Date.now());
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetchImpl(url, {
          headers: { "user-agent": USER_AGENT, accept: "text/html,application/xml;q=0.9,*/*;q=0.8" },
          signal: controller.signal,
          redirect: "follow",
        });
        const text = await res.text();
        if (res.status === 429 || res.status >= 500) {
          lastError = new Error(`HTTP ${res.status} for ${url}`);
          continue;
        }
        return { status: res.status, text };
      } catch (e) {
        lastError = e;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`);
  }

  function robotsFor(url: string): Promise<Robots> {
    const u = new URL(url);
    let p = robotsByHost.get(u.host);
    if (!p) {
      p = raw(`${u.protocol}//${u.host}/robots.txt`).then(
        (r) => parseRobots(r.status === 200 ? r.text : "", USER_AGENT),
        () => parseRobots("", USER_AGENT),
      );
      robotsByHost.set(u.host, p);
    }
    return p;
  }

  return async (url: string) => {
    const robots = await robotsFor(url);
    if (!robots.isAllowed(url)) throw new RobotsDisallowedError(url);
    return raw(url);
  };
}
