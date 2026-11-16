# DealHoi MVP: product audit

**Date:** 16/11/2026 · **Scope:** the MVP on `main` (commit `edc9a45`) · **Roles:** product, UX, QA, technical lead

**Verdict:** a credible internal demo, not yet a product. The engine is sound and well tested. But there is no real data, the AI has never run against a live model, its claim checking is narrower than it looks, and one ranking bug presents a sign-up bonus as purchase savings. **Readiness: 58/100.**

## How this audit was done

The full test suites were run, the APIs and pages were called on a local production build, a scratch script was run against the AI validator, a database outage was simulated, and the code was read. No code was changed. Every finding is tagged:

- **[T]**: tested during the audit.
- **[C]**: confirmed by reading the code.
- **[A]**: an assumption that hasn't been verified.

**Baseline [T]:** type-check and lint are clean; 84 unit and integration tests pass (1 live AI test skipped, no key); 8 of 8 end-to-end tests pass.

---

## A. Feature implementation matrix

Status key: ✅ Done · 🟡 Partial · ❌ Missing · 🎭 Works, but on mock or demo data only. Severity: Critical / High / Med / Low.

| # | Feature | Expected | Actual (evidence) | Status | Severity | Recommended action |
|---|---|---|---|---|---|---|
| 1 | Verified real offers (Techcombank, TPBank, VIB) | Real cards and promotions from official sources | Zero real cards or offers. The three banks exist as names only. All 21 deals and 7 cards are fictional [T] | ❌ | **Critical** | Run a manual sourcing sprint for 1 bank × 2 categories through the import and review workflow |
| 2 | Homepage | Search, suggestions, featured items, categories, empty states | All present. "Featured" is an editorial flag, never "most popular" [T] | ✅ | Low | Cut per-merchant queries (6 queries per load) [C] |
| 3 | Search | Find by merchant, category, product alias and card, ignoring accents | Single words work ("ve may bay", "concert"). These return nothing: "iphone 15", "macbook air", bank names ("techcombank"), generic intents ("the hoan tien"). "cafe" finds the category but no coffee shops [T] | 🟡 | **High** | Match each word separately, search bank names, add a "no results" fallback to categories |
| 4 | Purchase-first comparison | Table with all 10 required fields, amount input, filters, best highlighted | All fields present. Starbucks at 150.000 ₫ correctly shows a 30.000 ₫ tie. Amount validation works [T] | ✅ | Low | — |
| 5 | Savings engine | Deterministic; unknown values never assumed | Caps, minimums, fixed amounts, unknown values, no combining offers: all unit-tested [T] | ✅ | — | — |
| 6 | Deal directory ranking by amount | Savings ranking that makes sense | **Bug:** at 1.000.000 ₫, "Thưởng 300.000 ₫ cho chủ thẻ mới" (a sign-up bonus) ranks #1 as "Tiết kiệm ước tính 300.000 ₫". Offers from unrelated categories are also ranked against one amount [T] | 🟡 | **High** | Exclude welcome bonuses from savings; rank only within a chosen category or merchant |
| 7 | Installments and non-cash benefits | Shown separately, never converted to money | Correct [T] | ✅ | — | — |
| 8 | Expired, withdrawn and upcoming offers | Excluded from rankings | Excluded and listed separately; rules enforced in the database [T] | ✅ | — | — |
| 9 | Stale verification | Flagged when old | "cần xác minh lại" shows for the 200-day-old demo source [T] | ✅ | Low | — |
| 10 | Contextual chatbot | Grounded answers with sources and history | Pipeline verified end to end, but only against a mock model. The live OpenAI path has never run [T] | 🎭 | **High** | Run the live test with a key, then do a 30–50-question evaluation set |
| 11 | AI claim validation | Unsupported claims cannot pass as fact | Catches figures that appear nowhere in the data, and invalid IDs. Lets through: a correct figure attributed to the wrong card, invented dates, invented "you can combine these", invented "unlimited" [T] | 🟡 | **High** | Check figures per offer, check dates, flag combining/unlimited claims not supported by the data |
| 12 | "Selected cards" in chat context | Spec: chatbot receives the user's selected cards | No way to select or own cards. Only a bank filter exists [C] | ❌ | **High** | Build "Thẻ của tôi" (saved in the browser) and feed it to comparison and chat |
| 13 | AI summaries and quiz explanation | Grounded summaries | Implemented with caching and graceful failure. Live model untested [C][T-mock] | 🎭 | Med | Same as #10 |
| 14 | Card detail page | Facts, ≤3 highlights by a fixed rule, full list, ongoing vs. temporary | All present; the highlight rule is shown on the page [T] | ✅ | Low | — |
| 15 | Lifestyle quiz | 6 inputs, no sensitive data, saved in the browser | Works and persists [T]. Only 5 spending categories: no groceries, bills, fuel, dining or healthcare [T] | 🟡 | Med-High | Add common categories plus an "other" option so matches aren't inflated |
| 16 | Compatibility score | 40/25/20/15 weights, unknowns handled, separate balance warning | Correct; "provisional" state verified [T]. Users whose spending isn't covered can't say so, so scores skew high [C] | 🟡 | Med | Fixed by #15 |
| 17 | Demo-data labelling | Clearly separated; off in production | Banner, "Minh họa" badges, "(Demo)" in names, off by default in production [T][C] | ✅ | Low | — |
| 18 | Demo data dates | Stays usable | Dates are set relative to seed time. The next demo offer expires 30/11; 4 expire within 30 days [T] | 🟡 | Low | Re-seed before demos or user tests |
| 19 | Admin login and protection | Secure; no hidden-URL reliance | Signed cookie, checked in middleware and on every action; anonymous import returns 401 [T]. Supabase Auth login has never been tested [C] | 🟡 | Med | Test on a Supabase staging project |
| 20 | Admin import | CSV/JSON, dry run, duplicates, review | Works; duplicates detected; uploads land as drafts [T] | ✅ | Low | — |
| 21 | Admin editing | Edit conditions, verify, feature, deactivate, review sources | Can edit deal and card fields, publish, withdraw, review sources. Cannot create a deal, change eligible cards, merchant, category or source except by re-importing. Publish/withdraw errors are silently dropped [C] | 🟡 | Med | Add card-mapping editor and error feedback |
| 22 | Error handling when services fail | Friendly errors; browsing works without AI | Without AI: fine [T]. With the database down: pages return 500 and the API returns a generic error instead of "service unavailable" [T]. Whether the friendly error page renders is not verified | 🟡 | Med | Classify database failures; add a health check |
| 23 | HTTP status codes | 404 for missing items | Missing card pages return 200 with the not-found screen [T] | 🟡 | Low | Fix before public launch (SEO) |
| 24 | Security headers | Baseline hardening | No CSP, X-Frame-Options, HSTS, Referrer-Policy or nosniff header [T] | ❌ | Med | Add in `next.config` |
| 25 | Rate limiting | Basic abuse prevention | Works per IP (429 after 12). Bypassed by rotating the forwarded-IP header on the local server [T]. Counters are per server instance [C] | 🟡 | Med | Shared store; trust only the platform's IP. Whether Vercel overwrites the header is [A] |
| 26 | Row Level Security | Public sees only approved data | Enforced on local PostgreSQL [T]. The role setup on Supabase is untested [A] | 🟡 | Med | Verify on Supabase |
| 27 | Deployment | Running on Vercel + Supabase | Never deployed; instructions only [C] | ❌ | **High** for beta | Deploy a staging environment |
| 28 | Accessibility | Labels, keyboard use, focus, contrast | Labels, focus states and keyboard search are implemented [C]. No automated accessibility scan or screen-reader test [A]. On mobile the floating chat button covers content [T, screenshot] | 🟡 | Low-Med | Run an automated scan; add bottom padding on mobile |

---

## B. Top 10 product gaps (priority order)

1. **No real verified data [Critical].** The core value proposition is untestable with real users, and a production deploy today would show empty pages.
2. **Live AI never tested [High].** The prompt, structured output and model behaviour on real questions are unknown.
3. **AI validation lets through misattributed numbers and invented qualitative claims [High].** "Thẻ B hoàn 20%" passes when 20% belongs to card A, and "Bạn có thể kết hợp cả hai ưu đãi" also passes. Only the prompt prevents these.
4. **Misleading savings ranking in the deal directory [High].** A conditional sign-up bonus is presented as the top saving on a purchase, which directly contradicts the "real economic value" principle.
5. **No "my cards" concept [High].** Existing cardholders, a primary target user, can't ask "what can I use today?". It's also a spec gap: the chatbot never receives "selected cards".
6. **Search misses common queries [High].** "iphone 15", bank names and "thẻ hoàn tiền" fail at the first step of journey A.
7. **Quiz categories too narrow [Med-High].** Without groceries, dining, bills or fuel, compatibility scores are inflated for most real spending profiles.
8. **Admin can't maintain data efficiently [Med].** No creating offers, no editing eligible cards, silent failures. This matters once real data arrives weekly.
9. **Production hardening missing [Med].** Security headers, a shared rate limiter, correct 404s, database-outage handling and query counts per page.
10. **Deployment path unproven [Med→High for beta].** Supabase permissions, the connection pooler, Supabase Auth and environment configuration are all untested.

---

## C. Main risks

- **Trust risk (highest).** Once real data exists, one wrong cap, expired offer or misattributed AI answer can lose users permanently. The database rules are strong; AI claim checking and data freshness are the weak links.
- **Data operations risk.** The product's value depends on weekly manual checking. There is no owner, schedule or tooling (for example, expiry reminders or source-change alerts) yet.
- **AI risk.** Behaviour on a live model is unmeasured, and there's no evaluation set to catch drift between models.
- **Regulatory and brand risk [A].** Showing named banks' offers and anything resembling financial advice in Vietnam needs a legal review; nothing here has been verified.
- **Business risk [A].** Repeat use is unproven. Bank apps and payment wallets already show offers at checkout, and there's no revenue model yet.
- **Operational risk.** Never deployed, no monitoring, no backups beyond Supabase defaults.

---

## D. Readiness score: 58 / 100

| Dimension (weight) | Score | Evidence |
|---|---|---|
| Core functionality vs. spec (25) | **20** | Both journeys are verified end to end. Missing: selected cards. Partial: search, admin editing. |
| Data quality and coverage (25) | **8** | Excellent pipeline and database rules [T], but **0 real records**. Demo data decays. Ranking bug in the directory. |
| AI quality (15) | **7** | Retrieval-based design, validation against data, safe fallback [T-mock]. Live untested; qualitative claims and attribution not validated [T]. |
| User experience (15) | **11** | Clear, responsive, honest empty states [T]. Search misses, cross-category ranking, mobile chat button overlap, narrow quiz categories. |
| Technical quality and operations (20) | **12** | Strong tests and type-checking [T]. Missing security headers, per-instance rate limit, soft 404s, never deployed. |
| **Total (100)** | **58** | |

**Fitness by stage:**

| Stage | Ready? | Why |
|---|---|---|
| Internal demo | **Yes** | Works today; re-seed the demo data before each demo. |
| User testing (moderated, demo data) | **Yes, after small fixes** | Fix the directory ranking (gap #4) and add an OpenAI key. Without real offers, you can test the concept and usability, not real value. |
| Public beta | **No** | Needs real verified data, a live-AI evaluation, tighter AI validation, a staging deploy, security headers and a legal review. |
| Production launch | **No** | Also needs data operations, monitoring, a shared rate limiter and correct status codes. |

---

## E. Recommended next milestone: "M1 — Trustworthy real-data pilot" (about 2–3 weeks)

**Goal:** put one real bank and two categories in front of 10–15 real users on a deployed staging site, with AI that can't mislead.

1. **Fix trust bugs:** stop ranking welcome bonuses as savings, and rank only within a selected category or merchant.
2. **Harden AI:** check figures per offer, check dates, flag combining or unlimited claims not in the data; run the live test; build a 30–50-question Vietnamese evaluation set and record the results.
3. **Pilot data:** collect, review and publish one bank (for example VIB or TPBank) for coffee plus online shopping from official pages. A person must verify each offer.
4. **Improve search:** match each word separately, search bank names, and add "no results" suggestions.
5. **Deploy staging:** Vercel + Supabase, test RLS and Supabase Auth, add security headers and a health check.
6. **Admin essentials:** editing eligible cards and visible errors on publish.

**Exit criteria:**

- Real offers are live and verified, with no known misranking.
- The live AI evaluation passes at least 95% with zero unsupported financial claims.
- Staging is deployed with its checks passing.
- Moderated user sessions are done.

**M2 (after M1):** "Thẻ của tôi" (my cards), broader quiz categories, deal alerts, and data-operations tooling such as expiry reminders and staleness reports.

> M1/M2 priorities are a recommendation and have not been approved yet. See also [`user-research-plan.md`](user-research-plan.md): its findings may reorder M2.
