# DealHoi crawler

Collects promotions from official bank websites and turns them into **draft**
import files for the existing review workflow (`/admin/import`). Nothing is
published automatically: every deal still needs a reviewed source and a person
to verify it.

```bash
npm run crawl -- techcombank --no-llm --limit=10   # parse only, no API key needed
```

```bash
npm run crawl -- techcombank                        # parse + extract offers
```

The crawler reads `OPENAI_API_KEY` from `.env.local` (git-ignored), so the key
never has to be typed on the command line or end up in shell history.

Options: `--limit=N` (pages to fetch this run), `--force` (re-extract unchanged
pages and re-check expired ones), `--no-llm`, `--out=dir`. Set
`CRAWLER_OPENAI_MODEL` to use a different model than the chatbot's
`OPENAI_MODEL`.

## Output

Files go to `.crawl/out/<bank>/<date>/` (git-ignored):

| File | Contents | What to do |
| --- | --- | --- |
| `report.md` | Counts, warnings, offers that failed validation, card keys without a card page, URLs that look like promotions but match no pattern | Read first |
| `stubs.json` | Card and new-merchant records with only the fields the bank publishes | Import **once**, then complete fees and details by hand in `/admin/cards` |
| `bundle.json` | Sources + draft deals | `npm run data:import -- bundle.json --dry-run`, then import and review |
| `parsed.json` | Structured data read from each active credit card page | Reference while reviewing |

Stubs are kept out of `bundle.json` on purpose: the importer overwrites every
field of an existing card, so re-importing a stub would erase fees you entered.
Deals that reference a card that does not exist yet are refused by the importer
("Không tìm thấy thẻ"), so import `stubs.json` before the first bundle.

State is kept in `.crawl/state/<bank>.json`. Later runs skip expired pages and
only send new or changed pages (by content hash) to the model.

## Pipeline

```
sitemap ─► promotion URLs (per-bank patterns, slug blocklist)
        ─► fetch (robots.txt, 1.5 s between requests, retries)
        ─► adapter parses the page into a common shape        deterministic
        ─► drop expired / non-credit-card / unchanged          deterministic
        ─► LLM splits the offer text into offers               model
        ─► validate every offer against the page text          deterministic
        ─► bundle.json + stubs.json + report.md
```

Validation rejects an offer when any percentage, amount, installment term or
date is not written on the page, when its `evidence` is not a word-for-word
quote, or when it names a card or merchant the page does not list. The model
gets one retry with the problems; offers that still fail are listed in the
report for manual entry. Debit-only offers are skipped.

## Card pages

When the adapter implements `parseCardPage`, each card page is read too:

- the card's facts (annual fee, waiver terms, network, tier, minimum income,
  short description) are extracted and checked against the page text, then
  written into the card's entry in `stubs.json`, with the card page as its
  source;
- ongoing benefits on the page become deals in `bundle.json`; campaigns and
  welcome offers are left to the promotion pages, to avoid duplicates;
- for a card already written to an earlier `stubs.json`, nothing is
  overwritten: the report lists "Đề xuất cập nhật thẻ" (old → new) to apply by
  hand in `/admin/cards`.

Card facts still need a person to verify them before the card is published.

## Adding a bank

Create `crawler/banks/<bank>.ts` implementing `BankAdapter`
(`crawler/core/types.ts`) and register it in `crawler/cli.ts`:

- `discover()` returns promotion and card URLs (from a sitemap, a listing page
  or the bank's own JSON API) plus any promotion-like URLs it could not
  classify;
- `parse()` returns a `ParsedPromo`: title, plain text, expiry, the credit
  cards the bank lists, merchants, T&C links and a content hash.

Prefer structured data the bank already publishes (embedded JSON, API
responses) and leave only free text to the model.

## Techcombank notes

- Promotions: `/khach-hang-ca-nhan/uu-dai/<slug>` and the older
  `/khach-hang-ca-nhan/chi-tieu/the/khuyen-mai/<slug>`; cards:
  `/khach-hang-ca-nhan/chi-tieu/the/the-tin-dung/<slug>`. Only the Vietnamese
  child sitemaps are read.
- Each promotion page embeds its data as JSON in the `data-cf` attribute of
  `<tcb-promotion-detail>`; no browser is needed.
- `isOutdated` is unreliable (false after expiry); `expiryDateTime` is used.
- `lastmod` is unreliable (bulk re-publishes); content hashes are used.
- Card keys in promotions mostly equal the card page slug without the
  `the-tin-dung-` prefix, sometimes the key itself. Other mismatches appear in
  the report; add them to `CARD_KEY_ALIASES` once confirmed.
- T&C PDFs are linked in the deal's terms but not read yet.
