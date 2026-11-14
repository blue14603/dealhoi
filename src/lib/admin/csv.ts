/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF, BOM). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === "") inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (inQuotes) throw new Error("CSV không hợp lệ: thiếu dấu ngoặc kép đóng");
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const NUMBER_FIELDS = new Set([
  "annual_fee_vnd",
  "minimum_income_vnd",
  "percentage",
  "fixed_amount_vnd",
  "maximum_benefit_vnd",
  "minimum_spend_vnd",
  "installment_months",
  "installment_fee_vnd",
  "sort_order",
]);
const BOOLEAN_FIELDS = new Set(["is_demo", "is_active", "is_featured", "cap_is_unlimited", "is_browsable"]);
const ARRAY_FIELDS = new Set(["aliases"]);

function coerce(key: string, raw: string): unknown {
  const v = raw.trim();
  if (v === "") return ARRAY_FIELDS.has(key) ? [] : null;
  if (NUMBER_FIELDS.has(key)) {
    const n = Number(v.replace(/[\s_]/g, ""));
    return Number.isFinite(n) ? n : v; // leave invalid values for schema validation to report
  }
  if (BOOLEAN_FIELDS.has(key)) {
    if (/^(true|1|yes|có)$/i.test(v)) return true;
    if (/^(false|0|no|không)$/i.test(v)) return false;
    return v;
  }
  if (ARRAY_FIELDS.has(key)) return v.split("|").map((s) => s.trim()).filter(Boolean);
  return v;
}

/**
 * Converts CSV text into plain records. For deals, `card_slugs` (pipe-separated)
 * becomes the `cards` array.
 */
export function csvToRecords(text: string): Record<string, unknown>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const rec: Record<string, unknown> = {};
    header.forEach((h, i) => {
      if (!h) return;
      if (h === "card_slugs") {
        rec.cards = (r[i] ?? "")
          .split("|")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((card_slug) => ({ card_slug }));
      } else rec[h] = coerce(h, r[i] ?? "");
    });
    return rec;
  });
}
