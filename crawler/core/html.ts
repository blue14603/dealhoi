/** Minimal HTML helpers so the crawler needs no HTML-parsing dependency. */

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return NAMED[code.toLowerCase()] ?? m;
  });
}

/** Reads one attribute of the first element with the given tag name. */
export function readAttribute(html: string, tag: string, attr: string): string | null {
  const open = new RegExp(`<${tag}\\b[^>]*?\\s${attr}\\s*=\\s*('([^']*)'|"([^"]*)")`, "i");
  const m = html.match(open);
  if (!m) return null;
  return decodeEntities(m[2] ?? m[3] ?? "");
}

/** Converts an HTML fragment to readable plain text, keeping list items and line breaks. */
export function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*li\b[^>]*>/gi, "\n- ")
    .replace(/<\s*\/\s*(p|div|ul|ol|li|h[1-6]|tr)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(withBreaks)
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Extracts [text, href] pairs from anchors in an HTML fragment. */
export function readLinks(html: string): { title: string; href: string }[] {
  const out: { title: string; href: string }[] = [];
  for (const m of html.matchAll(/<a\b[^>]*?\shref\s*=\s*("([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi)) {
    out.push({ href: decodeEntities(m[2] ?? m[3] ?? ""), title: htmlToText(m[4]) });
  }
  return out;
}
