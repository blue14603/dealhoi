import { todayInVietnam } from "@/lib/domain/validity";

function shiftDate(today: string, days: number): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Resolves "@today±N" (dates, Vietnam calendar) and "@now-Nd" (timestamps) tokens. Used only for demo data. */
export function resolveDateTokens<T>(value: T, now = new Date()): T {
  const today = todayInVietnam(now);
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      const d = /^@today([+-]\d+)?$/.exec(v);
      if (d) return shiftDate(today, d[1] ? Number(d[1]) : 0);
      const t = /^@now-(\d+)d$/.exec(v);
      if (t) return new Date(now.getTime() - Number(t[1]) * 86_400_000).toISOString();
      return v;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}
