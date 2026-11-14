# DealHoi — AI-powered credit card discovery (MVP)

DealHoi is an independent Vietnamese credit card discovery and comparison website. Users can start from **what they want to buy** (Starbucks, Shopee, iPhone, airline tickets…) or from **a specific credit card**, compare the real value of offers, and check whether a card suits their spending habits.

DealHoi is **not** a bank, lender, payment processor or card application service.

> ⚠️ **Data status.** The repository ships **fictional demonstration data**: three invented banks ("Ngân hàng Sao Mai/Hoa Sen/Biển Xanh (Demo)"), their cards and promotions. Every demo record is flagged `is_demo`, labelled "Minh họa" in the UI, and excluded in production by default. Techcombank, TPBank and VIB appear only as bank names with **no cards or offers**: no verified real offers were available while building this, and the app never invents them. Real data must be collected from official sources and imported through the review workflow (see [Replacing demo data with real data](#replacing-demo-data-with-real-data)).

---

## Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Local development](#local-development)
4. [Environment variables](#environment-variables)
5. [Database & migrations](#database--migrations)
6. [Testing](#testing)
7. [Production build & deployment (Vercel + Supabase)](#production-build--deployment-vercel--supabase)
8. [Data ingestion & verification](#data-ingestion--verification)
9. [Calculation & scoring rules](#calculation--scoring-rules)
10. [AI system](#ai-system)
11. [Key product & engineering decisions](#key-product--engineering-decisions)
12. [Status: implemented, verified, needs configuration](#status-implemented-verified-needs-configuration)

---

## Features

| Area | What is implemented |
| --- | --- |
| Homepage `/` | Search box ("Bạn đang muốn mua gì?") with live, accent-insensitive suggestions; category chips; featured merchants (with offer counts); featured active deals; featured cards; empty states. "Featured" is an editorial flag; nothing is called "most popular". |
| Purchase-first `/so-sanh?merchant=…` or `?category=…` | Verified-offer count, last verification date, filters (bank, benefit type, payment channel), optional purchase amount (validated, kept in URL), deterministic savings with "best" highlight. Comparison table on desktop, stacked cards on mobile. Installments and non-monetary benefits are listed separately. Expired/upcoming offers are listed but excluded. Includes an on-demand AI summary and the contextual chatbot (side panel on desktop, bottom sheet on mobile). |
| Deal directory `/uu-dai` | Search by merchant/category/product alias; filters for category, bank, benefit type and channel; active-only by default (option to include expired/upcoming); sort by estimated savings when an amount is given. Works without JavaScript (GET form). |
| Card directory `/the-tin-dung` | Filter by bank, benefit category and name. Truthful empty state for banks without verified cards. |
| Card detail `/the-tin-dung/[slug]` | Card facts (network, tier, annual fee, waiver, published minimum income, official page, verification date). Up to 3 highlights chosen by a published rule. Deterministic lifestyle profile. Full benefit list split into ongoing/welcome vs. temporary vs. inactive. AI summary, chatbot and a responsible-use notice. |
| Compatibility quiz `/the-tin-dung/[slug]/phu-hop` | 6 questions, no sensitive data, answers kept in `localStorage`. Rule-based 0–100 score with a breakdown per dimension, reasons, drawbacks, usable benefits, blocking conditions, a provisional/insufficient state, a separate warning for carrying a balance, and an optional AI explanation that cannot change the score. |
| Methodology `/phuong-phap` | Explains sources, calculations, scoring weights, the highlight rule and AI safeguards. |
| Admin `/admin` | Protected login; dashboard (needs-review, drafts, expired-but-published, unreviewed sources, audit log); deal and card editing with business-rule validation; publish/withdraw; bulk-withdraw expired deals; source review; JSON/CSV import with dry-run preview and duplicate detection. |
| APIs | `GET /api/search`, `GET /api/deals`, `GET /api/cards`, `GET /api/cards/[slug]`, `POST /api/compare`, `POST /api/chat`, `POST /api/quiz`, `POST /api/summarize`, `POST /api/admin/import`. All validate input with Zod and return `{ error: { code, message, details? } }` on failure. |

## Architecture

```
Next.js 15 (App Router, TypeScript strict, Tailwind v4, shadcn-style components)
│
├── src/app/                     Pages (server components) and API route handlers
├── src/components/              Reusable UI: layout, search, deals (comparison table/workspace),
│                                cards, chat, quiz, ai summary, admin forms, ui primitives
├── src/lib/domain/              PURE logic shared by server and browser (unit tested)
│   ├── savings.ts               deterministic savings engine & ranking
│   ├── validity.ts              promotion lifecycle, Vietnam "today", staleness
│   ├── compatibility.ts         rule-based compatibility score
│   ├── highlights.ts            transparent highlight rule
│   ├── deal-rules.ts            benefit-type business rules (save / publish / warn)
│   └── lifestyle.ts, quiz.ts, format.ts, text.ts, types.ts
├── src/lib/services/            Server-only services
│   ├── catalog.ts               public read queries (runs under the `anon` role ⇒ RLS applies)
│   ├── comparison.ts            purchase-first retrieval + comparison
│   └── ai.ts                    retrieval for chat, chat orchestration, summarizer
├── src/lib/ai/                  OpenAI client (timeouts, retries), prompts, schemas,
│                                grounding/validation, rate limiting
├── src/lib/admin/               auth (session cookie, scrypt, Supabase Auth), import pipeline,
│                                CSV parser, admin data access
├── src/lib/db/client.ts         postgres.js client (Supabase-pooler compatible)
├── db/migrations/               SQL migrations (schema, constraints, triggers, indexes, RLS)
├── data/reference/              production-safe reference data (categories, merchants, bank names)
├── data/demo/                   FICTIONAL demo dataset (generated by scripts/generate-demo-data.mjs)
├── data/templates/              CSV & JSON import templates
├── scripts/                     migrate, seed, import, hash-password, generate-demo-data
└── tests/                       unit, integration (PostgreSQL), e2e (Playwright + mock AI)
```

There is no separate backend service: route handlers and server components call the services directly. Retrieval uses structured SQL only (no vector DB, no browsing agent).

## Local development

Prerequisites: Node.js 20.19+ (22 recommended) and PostgreSQL 15+ with the `unaccent`, `pg_trgm` and `pgcrypto` extensions available (standard `postgresql-contrib`), or a Supabase project.

```bash
npm install
```

```bash
cp .env.example .env.local
```

Edit `.env.local` and set at least `DATABASE_URL`. To use the admin area, also set `ADMIN_SESSION_SECRET`, `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH`. Generate the hash with:

```bash
npm run admin:hash-password -- 'choose-a-long-password'
```

Create the schema and seed the reference data plus the fictional demo data:

```bash
npm run db:migrate
```

```bash
npm run db:seed:demo
```

```bash
npm run dev
```

Open http://localhost:3000. The admin area is at http://localhost:3000/admin.

Without `OPENAI_API_KEY`, browsing, comparison, savings and quiz scoring all work. The chatbot, summaries and quiz explanation show "DealHoi đang gặp sự cố. Bạn vui lòng thử lại sau." with a retry button.

## Environment variables

See [`.env.example`](.env.example) for the full annotated list. All variables are server-side; nothing is exposed with `NEXT_PUBLIC_`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string (on Vercel, use Supabase's transaction pooler URL, port 6543) |
| `DATABASE_SSL` | Supabase: `true` | Require TLS |
| `DB_PUBLIC_ROLE` | no (default `anon`) | Role assumed for public reads so RLS applies; empty disables |
| `DEALHOI_DEMO_DATA` | no | Show demo data. Default `true` in development, `false` in production |
| `DEALHOI_STALE_AFTER_DAYS` | no (90) | Verification age that triggers "cần xác minh lại" |
| `DEALHOI_SCORING_WEIGHTS` | no | JSON weights for the compatibility score |
| `OPENAI_API_KEY` | for AI features | OpenAI key (server only) |
| `OPENAI_MODEL` | no (`gpt-4.1-mini`) | Any chat model that supports structured outputs (`json_schema`) |
| `OPENAI_BASE_URL`, `OPENAI_TIMEOUT_MS`, `OPENAI_MAX_OUTPUT_TOKENS`, `AI_RATE_LIMIT_PER_MINUTE` | no | AI tuning |
| `ADMIN_SESSION_SECRET` | for admin | ≥ 32 random characters; signs the admin cookie |
| `ADMIN_AUTH_PROVIDER` | no | `supabase` or `env` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` | `env` provider | Single administrator with an scrypt hash |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | `supabase` provider | Supabase Auth password verification |

## Database & migrations

* `db/migrations/0001_init.sql`: enums, tables (spec §11 plus `is_demo`, `import_key`, `minimum_spend_period`, `categories.is_browsable/sort_order`, `merchants.is_featured`, `admin_users` and `admin_audit_log`), CHECK constraints (non-negative VND, 0–100 %, date ranges, slug format, http(s) URLs), and publication rules:
  * a published deal must be `verified` and have a `source_id` (CHECK constraints);
  * a published deal must cite a **reviewed** source (`verified_at` set) and have **at least one eligible card**. These are enforced by deferred constraint triggers checked at COMMIT, so a deal and its card mappings can be written in one transaction;
  * a verified card must cite a reviewed source;
  * un-reviewing a source automatically unpublishes dependent deals and cards;
  * indexes on merchant/category/card names (accent-insensitive trigram on `dh_normalize(name)`), slugs, statuses, validity dates and deal–card relationships.
* `db/migrations/0002_rls.sql`: Row Level Security. The `anon`/`authenticated` roles can only `SELECT` published + verified deals, verified + active cards, reviewed sources, and the reference tables. There are no public write policies. `admin_users` and the audit log are not readable.

Run migrations with `npm run db:migrate`. The runner records applied files in `schema_migrations` and applies each file in a transaction. It is safe to re-run.

Search is case- and Vietnamese-accent-insensitive through the immutable `public.dh_normalize()` wrapper around `unaccent` (e.g. `ve may bay` finds "vé máy bay", and `phuc long` finds "Phúc Long").

## Testing

```bash
npm test
```

Runs the **unit and integration tests** (Vitest; 84 tests plus 1 opt-in live test). The integration tests need a PostgreSQL database at `TEST_DATABASE_URL` (default `postgres://postgres@localhost:5432/dealhoi_test`); they drop and recreate its schema. If the database is unreachable, the integration suites are skipped.

* Unit: percentage cashback, caps (per-transaction vs. per-period), fixed discounts, minimum spend (per transaction vs. cumulative vs. unknown), promotion validity and Vietnam time zone, unknown caps, non-comparable benefit types, ranking/ties, compatibility scoring (weights, unknown data, provisional, balance warning, configurable weights), AI output validation (schema, invalid IDs, unsupported numbers, retry/give-up), OpenAI client (retries, no retry on 401, timeout, invalid/truncated JSON), session tokens, password hashing, rate limiting.
* Integration: accent-insensitive search, merchant/category retrieval (specific, category-wide and general offers; drafts, withdrawn and welcome offers excluded), multiple cards per deal, RLS enforcement, duplicate deal–card mappings, publication constraints, invalid values, source un-review cascade, import dry-run, duplicate import detection, re-import of changed terms, CSV parsing.

```bash
npm run build
```

```bash
npm run test:e2e
```

Runs the **end-to-end tests** (Playwright, 8 tests) against the production build: purchase-first journey (search → compare → amounts → invalid input → sources → chatbot), rejection of AI answers with unsupported numbers, category browsing and empty states, API validation, card-first journey (card → highlights → quiz validation → result → persistence), provisional score for unknown fees, admin login/authorization/import validation, and mobile layout with the chat sheet. They use a separate database (`E2E_DATABASE_URL`, default `dealhoi_e2e`).

**Mocked vs. real AI.** The e2e tests start `tests/e2e/mock-openai.mjs`, a **mock** OpenAI-compatible server, so the real retrieval → model call → validation → rendering pipeline is exercised without credentials. Unit tests also use mocked model responses. These are not the production integration. To test one **real** OpenAI request:

```bash
OPENAI_API_KEY_LIVE=sk-... npx vitest run tests/integration/live-ai.test.ts
```

> This live test has **not** been run, because no OpenAI credentials were available in the build environment. The production OpenAI integration (Chat Completions with `response_format: json_schema`, strict mode) is implemented but unverified against the live API.

## Production build & deployment (Vercel + Supabase)

1. **Supabase**: create a project. Under *Database → Extensions*, make sure `unaccent` and `pg_trgm` are available (the migration installs them into the `extensions` schema). Copy the connection strings.
2. **Migrate** from your machine using the *direct* connection string:
   ```bash
   DATABASE_URL='postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres' DATABASE_SSL=true npm run db:migrate
   ```
   ```bash
   DATABASE_URL='…same…' DATABASE_SSL=true npm run db:seed
   ```
   `db:seed` loads only the production-safe reference data. Do not run `db:seed:demo` against production; it refuses when `NODE_ENV=production` unless `--force-demo` is passed for a preview database.
3. **Admin users (Supabase Auth)**: create the user under *Authentication → Users*, then authorize it:
   ```sql
   insert into public.admin_users (auth_user_id, email) values ('<auth user uuid>', 'editor@example.com');
   ```
4. **Vercel**: import the repository and set the environment variables: `DATABASE_URL` (the **transaction pooler** URL, port 6543), `DATABASE_SSL=true`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `ADMIN_SESSION_SECRET`, `ADMIN_AUTH_PROVIDER=supabase`, `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Leave `DEALHOI_DEMO_DATA` unset (false) for production. Build command `npm run build`; output is the Next.js default.
5. Visit `/admin/login`, import verified data, review sources and publish.

Local production build:

```bash
npm run build
```

```bash
npm start
```

> Deployment to Vercel and Supabase has **not** been performed from this environment (no credentials). The steps above are the intended procedure. Everything else was verified against a local PostgreSQL 16.

## Data ingestion & verification

The LLM is never used to create data. The workflow:

1. **Collect** card details and promotions from official bank/merchant pages (manual research; no scraping in the MVP).
2. **Convert** them to the import format using `data/templates/` (`import-template.json`, `deals.csv`, `cards.csv`, `sources.csv`). Money is integer VND. **`null` means unknown**: use `minimum_spend_vnd: 0` only when the source says there is no minimum, and `cap_is_unlimited: true` only when the source says there is no cap. Record each source URL, retrieval time and an excerpt of the key terms.
3. **Import** via `/admin/import` (dry-run preview first) or `npm run data:import -- file.json --dry-run`. Records are matched by slug (banks, categories, merchants, cards), URL (sources) and `import_key` (deals). Duplicate keys in a file are rejected, duplicate card mappings are collapsed, and identical re-imports are reported as "unchanged". Uploaded records **always land as drafts**; changing the terms of a published deal unpublishes it and marks it `needs_review`.
4. **Review** each source in `/admin/sources` (open it, compare it against the imported terms, mark it reviewed), then set deals to `verified` and publish them. The database refuses to publish without a reviewed source and at least one card.
5. **Maintain**: the dashboard flags expired-but-published deals (with one-click withdrawal), `needs_review` records and stale verification (older than `DEALHOI_STALE_AFTER_DAYS`). Public pages show "cần xác minh lại" for stale sources.

Active status is computed from verified validity dates, publication status and withdrawal status, in the Asia/Ho_Chi_Minh calendar. A **temporary** promotion without both a start and an end date is never treated as active.

### Replacing demo data with real data

* Production excludes demo data automatically (`DEALHOI_DEMO_DATA` defaults to false), so a production database seeded with `npm run db:seed` contains no demo records.
* To remove demo data from an existing database:
  ```sql
  delete from deals where is_demo; delete from credit_cards where is_demo; delete from banks where is_demo; delete from sources where is_demo;
  ```
* Import real records using the templates above, with `is_demo: false` (the default).

## Calculation & scoring rules

**Savings** (`src/lib/domain/savings.ts`, shared by server and browser):

* Percentage: `floor(amount × % / 100)`, then the cap. A per-**transaction** cap gives an *exact* estimate. A per-month/quarter/year/campaign cap gives a *conditional* estimate, because DealHoi cannot know the user's remaining allowance. A cap with unknown period is also conditional.
* Unknown cap (and not explicitly unlimited) gives **insufficient information**, never "unlimited".
* Fixed amount: `min(fixed, amount)`, exact.
* Minimum spend: below a known **per-transaction** minimum, the offer is excluded. Below a cumulative minimum, the estimate is conditional. Unknown minimum gives a conditional estimate.
* A category-wide or general offer viewed for a specific merchant is conditional (merchant classification/MCC is unknown).
* Points, vouchers, travel perks and "other" are not comparable and never converted to VND. Installments are shown separately with months and fee.
* Offers are never combined. "Best" goes to the highest exact or conditional figure; ties are all marked.
* Welcome bonuses are card-level and are excluded from purchase comparisons (they appear on card pages).

**Compatibility score** (`src/lib/domain/compatibility.ts`): category alignment 40 %, spending conditions 25 %, reward alignment 20 %, annual fee 15 % (configurable). A dimension without data is marked *insufficient* and is **not** treated as a match; the score is computed over dimensions with data and labelled *provisional*. With no category data or no verified active benefits, no score is shown. "No preference" removes the reward dimension. Carrying a balance triggers a separate warning and does not change the score.

**Highlights**: editorial `is_featured` first, then ongoing before welcome before temporary, then monetary with a known value, then higher cap, then higher percentage.

## AI system

Flow (`src/lib/services/ai.ts`):

1. Validate the input (Zod; message ≤ 500 characters, ≤ 8 history turns, rate limit per IP).
2. Identify the context (merchant/category/card from the page; merchants and cards mentioned in the question, matched accent-insensitively).
3. Retrieve the matching verified records with server-side SQL (≤ 25 deals, ≤ 8 cards). The model never queries the database.
4. Compute savings deterministically and include the results in the context.
5. Call OpenAI (system prompt from the spec plus data conventions; context in a separate `<context>` message, treated as data) with a strict JSON schema, a timeout, bounded retries and a token limit.
6. Validate with Zod, drop source/deal IDs not in the context, and **reject any percentage or VND amount not present in the context or the user's own messages**. On failure, retry once with feedback. If it fails again, show a safe fallback instead of the unverified answer.
7. Render readable text with source links, related deals, uncertainties and suggested follow-ups. Raw JSON is never displayed.

If no verified records match, the chatbot answers "DealHoi chưa có thông tin ưu đãi đã được xác minh cho nội dung này." without calling the model. If the AI fails, comparison data stays visible and a retry action is offered. Summaries are cached in memory for 1 hour per identical context.

## Key product & engineering decisions

* **Plain PostgreSQL client (postgres.js) instead of supabase-js** for data access. It works with any Postgres (local, CI, Supabase) and supports transactions for import and publication rules. RLS is still enforced for public reads by running them under the `anon` role (`DB_PUBLIC_ROLE`).
* **Admin auth** uses a signed, HTTP-only, `SameSite=Strict` session cookie (HMAC-SHA256, 8 h), checked in middleware **and** in every admin page, server action and API route. Credentials are verified with Supabase Auth plus the `admin_users` table (production), or with an env-configured admin and scrypt hash (local/self-hosted). Login attempts are rate-limited. Hidden URLs are not relied on.
* **Schema extensions beyond the spec**: `minimum_spend_period` (is a minimum per transaction or cumulative?), `import_key` (duplicate detection), `is_demo` (demo isolation), `categories.is_browsable` ("Chi tiêu chung" for general offers), `merchants.is_featured`, and the audit log.
* **`minimum_spend_vnd = 0` vs `null`**: 0 means "no minimum (confirmed)", null means unknown. This keeps "unknown ≠ zero" without an extra flag column.
* **Server components + GET forms** for directories (fast, shareable, work without JS); a client workspace for the comparison page (instant recalculation using the same pure engine as the server).
* **Card artwork**: no bank card images or logos are bundled. A neutral generated illustration is shown unless an official `image_url` is stored.
* **Rate limiting** is in-memory per server instance (basic abuse prevention). For multi-instance production, back it with Redis or a database table.

## Status: implemented, verified, needs configuration

| Item | Status |
| --- | --- |
| Pages, components, API routes, admin area | Implemented; type-check, lint and production build pass |
| Domain logic (savings, validity, scoring, rules) | Implemented; unit tested |
| PostgreSQL schema, constraints, triggers, RLS, search | Implemented; verified against local PostgreSQL 16 with integration tests |
| Import pipeline & templates | Implemented; integration tested; templates parsed in tests |
| Both user journeys, admin auth, mobile layout | Verified end to end with Playwright (desktop and Pixel 7) |
| Chat / summarizer pipeline | Verified with a **mock** OpenAI server; **live OpenAI not tested** (no API key available) |
| Supabase Auth admin provider | Implemented; **not tested** (no Supabase project available) |
| Vercel / Supabase deployment | Instructions provided; **not performed** |
| Real bank data | **Not included.** Fictional demo data only; real records require manual collection from official sources and review |

Known limitations:

* With Next.js streaming, `notFound()` and `redirect()` on dynamic pages render the correct UI but return HTTP 200 (client-side redirect / not-found page) rather than 404/307.
* The rate limiter and summary cache are per server instance.
* Cumulative spend across purchases and remaining cashback allowance are unknown to DealHoi by design (no account connectivity), so such estimates are always conditional.
