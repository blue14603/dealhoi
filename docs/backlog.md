# DealHoi product backlog

**Status:** proposal awaiting Product Owner approval · **Date:** 16/11/2026

**Inputs:** the original product spec, the current code on `main`, the [product audit](product-audit-2026-11-16.md) and the [user research plan](user-research-plan.md).

**Objective:** a trustworthy and useful MVP that helps Vietnamese consumers discover and compare credit card benefits. Items are prioritised for accuracy and trust, the purchase-first journey, time to a relevant deal, understanding of savings and eligibility, critical functionality and security, and assumption validation.

**Evidence rules:**

- **No user research results exist yet.** RICE is **not** used, because there are no reach or confidence numbers and none are invented. Ordering uses qualitative impact versus effort; section 3 explains how to switch to RICE later.
- Supporting evidence cites audit findings tested **[T]** or confirmed in code **[C]**, spec requirements **[Spec]**, assumptions **[A]**, or **unvalidated** research hypotheses **[H#]**. No item claims user evidence.
- Effort (S ≈ ≤2 days, M ≈ 3–5 days, L ≈ 1–2 weeks, XL ≈ more than 2 weeks for one engineer) is a rough estimate.

**Priority definitions:**

- **P0:** critical issue blocking a trustworthy or functional MVP.
- **P1:** important improvement directly supporting the core user journeys.
- **P2:** valuable enhancement that can wait until the core experience is validated.
- **P3:** future opportunity or non-essential feature.

---

## 1. Summary

| Group | ID | Item | Pri | Effort | Impact |
|---|---|---|---|---|---|
| **Immediate fixes** | DH-01 | Stop presenting welcome bonuses / cross-category offers as purchase savings | P0 | S | High |
| | DH-02 | Security headers | P0 | S | Med |
| | DH-03 | Admin: show publish/withdraw errors | P1 | S | Med |
| | DH-04 | Trust only the platform-provided client IP for rate limits | P1 | S | Med |
| | DH-05 | Keep demo data fresh for demos and research | P1 | S | Med |
| **Next sprint** | DH-06 | AI claim validation v2 (attribution, dates, qualitative claims) | P0 | M–L | High |
| | DH-07 | Live AI verification + Vietnamese evaluation set | P0 | M | High |
| | DH-08 | Staging deployment (Vercel + Supabase) with health check | P0 | M | High |
| | DH-09 | Real-data pilot: 1 bank × 2 categories | P0 | L | Very high |
| | DH-10 | Legal / compliance review *(non-dev, PO-owned)* | P0 | M | High |
| | DH-11 | Search v2: multi-word, bank names, intent words, no-result fallback | P1 | M | High |
| | DH-12 | Run user research (8 sessions) *(non-dev)* | P1 | M | High |
| **Upcoming releases** | DH-13 | Admin: edit eligible cards and create a deal in the UI | P1 | M | Med |
| | DH-14 | Minimal privacy-respecting product analytics | P1 | M | Med–High |
| | DH-15 | Database-outage handling and correct 404 status codes | P2 | S | Med |
| | DH-16 | Savings comprehension improvements *(gated by H6)* | P2 | S–M | Med |
| | DH-17 | "Thẻ của tôi": filter by cards I own *(gated by H5)* | P2 | M | High if H5 holds |
| | DH-18 | Broaden quiz spending categories + "other" | P2 | S–M | Med |
| | DH-19 | Data-ops tooling: expiry reminders and stale-data report | P2 | M | Med |
| | DH-20 | Shared rate-limit store and per-page query reduction | P2 | M | Low–Med |
| | DH-21 | Accessibility scan and mobile chat-button overlap | P2 | S | Low–Med |
| **Future opportunities** | DH-22 – 26 | Sale-day alerts, more banks, "best card overall", distribution, revenue policy | P3 | — | Unknown |
| **Out of scope** | — | Card applications, approval prediction, bank connections, affiliate tracking, native apps, scraping, ML recommendations, user accounts | — | — | — |

---

## 2. Backlog items

### Immediate fixes

#### DH-01: Stop presenting welcome bonuses and cross-category offers as purchase savings · P0 · S

1. **Epic:** Accurate savings
2. **User story:** As a shopper entering an amount in the deal directory, I want the ranking to show only savings that apply to that purchase, so I'm not misled about which offer is worth most.
3. **User problem:** At 1.000.000 ₫ the top result is "Thưởng 300.000 ₫ cho chủ thẻ mới", a sign-up bonus for new cardholders, shown as "Tiết kiệm ước tính 300.000 ₫". Coffee, travel and concert offers are also ranked against one amount, though the purchase can only be one of them.
4. **Business value:** Removes the one confirmed case where DealHoi overstates savings, which directly protects its core trust promise.
5. **Evidence:** Audit #6 and gap #4 [T]; spec §3 "compare actual economic benefits" [Spec].
6. **Functional requirements:**
   - Welcome offers are never given a purchase-savings figure and are labelled "Ưu đãi cho chủ thẻ mới".
   - Directory sorting by savings is enabled only when a category or merchant filter is set; otherwise the amount field explains why.
   - The `/api/deals` behaviour matches the page.
7. **Acceptance criteria:**
   - *Given* the directory with an amount and no category, *when* results load, *then* no savings ranking is applied and a hint asks the user to choose a category or merchant.
   - *Given* any page with an amount, *when* a welcome offer is shown, *then* it has no "Tiết kiệm ước tính" value and is never marked best.
   - *Given* category "Cà phê" and 150.000 ₫, *when* sorted, *then* only coffee and general offers are ranked.
8. **Technical dependencies:** Savings engine, deal directory page, API route; update the unit and e2e tests.
9. **Effort:** S
10. **Priority:** P0
11. **Success metric:** 0 non-purchase offers ranked as savings (automated test plus a manual check).
12. **Risks and uncertainties:** Users may want a "best card overall" view; that is deferred (DH-24).

#### DH-02: Security headers · P0 · S

1. **Epic:** Security
2. **User story:** As the operator, I want standard browser security headers, so the site resists clickjacking, content sniffing and script injection.
3. **User problem:** Indirect: protects users from a compromised or framed site.
4. **Business value:** Baseline before any public URL exists; cheap.
5. **Evidence:** Audit #24 [T]: no CSP, X-Frame-Options, HSTS, Referrer-Policy or nosniff.
6. **Functional requirements:** Set CSP (self, plus Google Fonts if used), `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS in production, and a Permissions-Policy.
7. **Acceptance criteria:**
   - *Given* any page, *when* fetched, *then* all of the headers above are present.
   - *Given* the CSP, *when* all journeys run (e2e), *then* there are no CSP violations in the console.
8. **Technical dependencies:** `next.config.ts`; Next.js inline scripts may need nonces.
9. **Effort:** S
10. **Priority:** P0
11. **Success metric:** Headers verified by an automated test; e2e stays green.
12. **Risks and uncertainties:** A too-strict CSP can break the app; mitigated by running the e2e suite.

#### DH-03: Admin: show publish/withdraw errors · P1 · S

1. **Epic:** Data administration
2. **User story:** As an editor, I want to see why publishing failed, so I can fix the record instead of assuming it went live.
3. **User problem:** Publish and withdraw actions discard the database result; a blocked publish looks like nothing happened.
4. **Business value:** Prevents editors from believing an unpublished offer is live (or the reverse) once real data arrives.
5. **Evidence:** Audit #21 [C].
6. **Functional requirements:**
   - Publish and withdraw return a result that is shown in a message area.
   - The publish button is hidden or disabled while blockers exist, with the blockers listed (no reviewed source, no eligible cards, not verified).
7. **Acceptance criteria:**
   - *Given* a verified deal with no eligible cards, *when* the editor clicks "Xuất bản", *then* an error says a card is required and the deal stays a draft.
   - *Given* a successful publish, *when* the list reloads, *then* a success message appears and the status shows "published".
8. **Technical dependencies:** Admin actions and pages.
9. **Effort:** S
10. **Priority:** P1
11. **Success metric:** 0 silent failures (test).
12. **Risks and uncertainties:** Low.

#### DH-04: Trust only the platform-provided client IP for rate limits · P1 · S

1. **Epic:** Security / cost control
2. **User story:** As the operator, I want AI rate limits that can't be bypassed by a fake header, so one client can't run up OpenAI costs.
3. **User problem:** Indirect (cost and availability).
4. **Business value:** Caps AI spend and abuse before public exposure.
5. **Evidence:** Audit #25 [T]: rotating `x-forwarded-for` bypassed the limit locally. Whether Vercel overwrites this header is [A].
6. **Functional requirements:**
   - Use the platform's client-IP source (e.g., Vercel's request IP); ignore client-supplied forwarding headers unless the deployment is configured as behind a trusted proxy.
   - Add a global per-minute cap on AI calls.
7. **Acceptance criteria:**
   - *Given* 13 chat requests in a minute from one client with different `x-forwarded-for` values, *when* they're processed on staging, *then* the 13th gets 429.
   - *Given* the global cap is reached, *when* any user asks a question, *then* they see the "DealHoi đang gặp sự cố" message and browsing still works.
8. **Technical dependencies:** DH-08 (behaviour must be verified on the real platform).
9. **Effort:** S
10. **Priority:** P1
11. **Success metric:** Bypass test fails on staging.
12. **Risks and uncertainties:** Platform header behaviour must be confirmed on staging.

#### DH-05: Keep demo data fresh for demos and research · P1 · S

1. **Epic:** Research enablement
2. **User story:** As a researcher, I want demo offers that are active on the day of the session, so tasks behave consistently.
3. **User problem:** Demo dates are set at seed time; the next demo offer expires 30/11 and 4 expire within 30 days, so tasks silently change.
4. **Business value:** Reliable user-testing sessions (DH-12).
5. **Evidence:** Audit #18 [T].
6. **Functional requirements:**
   - A one-command demo reset.
   - A staging check that warns when a demo offer used in the research script expires within 7 days.
   - A note in the research plan's setup section.
7. **Acceptance criteria:** *Given* the reset command, *when* run, *then* all research-script offers (Starbucks 20%, 30.000 ₫ discount, Hoa Sen Travel) are active for at least 30 days.
8. **Technical dependencies:** Seed script.
9. **Effort:** S
10. **Priority:** P1
11. **Success metric:** 0 sessions disrupted by expired demo data.
12. **Risks and uncertainties:** Low.

### Next sprint

#### DH-06: AI claim validation v2 · P0 · M–L

1. **Epic:** Trustworthy AI
2. **User story:** As a user asking the assistant, I want every rate, cap, date and condition in its answer to be true for the offer it describes, so I can rely on it.
3. **User problem:** The validator only blocks numbers that appear nowhere in the data. These all pass:
   - "Thẻ B hoàn 20%" when 20% belongs to card A
   - an invented expiry date
   - "Bạn có thể kết hợp cả hai ưu đãi" (you can combine both offers)
   - "hoàn không giới hạn" (unlimited cashback)
4. **Business value:** AI misinformation is the highest trust risk; this closes the confirmed gaps.
5. **Evidence:** Audit #11 and gap #3 [T]; spec §8.2 "never invent…" [Spec].
6. **Functional requirements:**
   - The model returns structured claims (offer ID + field + value) alongside the answer; each claim is checked against that offer's record and the app's calculation.
   - Dates in the answer must match a date in the data.
   - Phrases about combining offers, "unlimited" or guarantees are allowed only when the data supports them.
   - Failures are retried once with feedback, then the existing safe fallback is shown.
   - Validation failures are logged without personal data.
7. **Acceptance criteria:**
   - *Given* a mocked answer attributing offer A's 20% to offer B, *when* validated, *then* it's rejected.
   - *Given* an answer containing a date not present in the data, *when* validated, *then* it's rejected.
   - *Given* "có thể kết hợp" and no offer whose terms allow combining, *when* validated, *then* it's rejected.
   - *Given* a correct answer, *when* validated, *then* it's shown unchanged with valid sources.
8. **Technical dependencies:** AI schemas and validation module, tests; feeds into DH-07.
9. **Effort:** M–L
10. **Priority:** P0
11. **Success metric:** 0 unsupported financial claims in the DH-07 evaluation set; fallback rate tracked (target set after DH-07).
12. **Risks and uncertainties:**
    - Stricter validation raises the fallback rate and lowers usefulness.
    - Phrase detection in Vietnamese can produce false positives.
    - Mitigated by measuring both in DH-07.

#### DH-07: Live AI verification and evaluation set · P0 · M

1. **Epic:** Trustworthy AI
2. **User story:** As the PO, I want evidence of how the real model behaves on realistic Vietnamese questions, so I can decide whether the assistant is fit for users.
3. **User problem:** The assistant has only run against a mock model.
4. **Business value:** Converts the AI from unverified to measured; required before any user sees it.
5. **Evidence:** Audit #10, #13 and gap #2 [T].
6. **Functional requirements:**
   - 30–50 Vietnamese questions with expected outcomes, covering: best offer, caps, minimum spend, combining offers, fees, expiry, missing information, off-topic questions and prompt injection.
   - A repeatable evaluation script run against the configured model, with a stored report per run (pass/fail per case, fallback rate, latency).
   - The existing live test is run once.
7. **Acceptance criteria:**
   - *Given* the evaluation set, *when* run against the configured model, *then* a report is produced and committed.
   - *Given* the report, *when* reviewed, *then* the pass rate, unsupported claims (target 0), "honest unknown" rate and median latency are listed.
8. **Technical dependencies:** OpenAI key (PO to provide); DH-06.
9. **Effort:** M
10. **Priority:** P0
11. **Success metric:** ≥95% cases pass and 0 unsupported claims (proposed threshold for PO approval).
12. **Risks and uncertainties:**
    - API cost (small).
    - Model drift; re-run on every prompt or model change.
    - Evaluation cases written by the team may not reflect how real users ask; add real questions after DH-12.

#### DH-08: Staging deployment (Vercel + Supabase) · P0 · M

1. **Epic:** Platform readiness
2. **User story:** As the PO, I want a deployed staging site, so pilot users and stakeholders can use DealHoi outside a developer machine.
3. **User problem:** The product can't be tested by real users today.
4. **Business value:** Prerequisite for the data pilot and remote research.
5. **Evidence:** Audit #19, #26, #27 and gap #10 [C].
6. **Functional requirements:**
   - Create a Supabase project and run migrations.
   - Verify RLS under the `anon` role and the database pooler connection.
   - Test Supabase Auth admin login with the `admin_users` table.
   - Set up Vercel environment variables.
   - Add a `/api/health` endpoint (database + config check).
   - Turn the README steps into a tested checklist.
7. **Acceptance criteria:**
   - *Given* staging, *when* the e2e suite runs against its URL, *then* all tests pass (mocked AI or live key).
   - *Given* the public (anon) role, *when* querying draft deals or `admin_users` directly, *then* access is denied.
   - *Given* an admin user in Supabase Auth plus `admin_users`, *when* they log in, *then* they reach `/admin`; a Supabase user not in `admin_users` is refused.
8. **Technical dependencies:** Supabase and Vercel accounts (PO); DH-02.
9. **Effort:** M
10. **Priority:** P0
11. **Success metric:** Staging URL live; health check green; e2e suite green on staging.
12. **Risks and uncertainties:** Supabase role permissions may differ from local Postgres (the migration catches this but must be confirmed).

#### DH-09: Real-data pilot: 1 bank × 2 categories · P0 · L *(data team / PO + engineering support)*

1. **Epic:** Verified data
2. **User story:** As a shopper, I want to compare real, verified offers from an actual bank, so DealHoi helps with my real purchase.
3. **User problem:** All offers are fictional; there is no real value yet.
4. **Business value:** The product's core value; enables testing actual usefulness rather than just usability.
5. **Evidence:** Audit #1 and gap #1 [T]; spec §4 and §13 [Spec].
6. **Functional requirements:**
   - Choose 1 bank (Techcombank, TPBank or VIB) and 2 categories (proposed: coffee and online shopping).
   - Collect card details and promotions from official pages into the import templates, including source URL, excerpt and retrieval time.
   - A human reviewer marks each source reviewed; publish only offers that pass review.
   - Write a data-ops runbook: who checks what, and how often (proposed weekly).
7. **Acceptance criteria:**
   - *Given* the pilot dataset, *when* imported to staging, *then* every published offer has a reviewed official source, verification date and validity dates, and no unknown values are filled with guesses.
   - *Given* a sample of 100% of pilot offers, *when* independently re-checked against the source, *then* zero mismatches are found.
   - *Given* production config, *when* staging runs with demo data off, *then* only pilot data is visible.
8. **Technical dependencies:** DH-08, DH-10 (legal), DH-03; templates and import (done).
9. **Effort:** L (mostly manual research and review)
10. **Priority:** P0
11. **Success metric:** Pilot offers published with 0 mismatches at re-check; median verification age ≤ 7 days.
12. **Risks and uncertainties:**
    - Bank terms are often PDFs or images, ambiguous or quickly changed.
    - Effort per offer is unknown; measure it during the pilot.
    - AI can help draft records from official pages, but a human must verify them.

#### DH-10: Legal and compliance review · P0 · M *(non-dev, PO-owned)*

1. **Epic:** Launch readiness
2. **User story:** As the PO, I want legal confirmation of how we may display bank offers and names, so we can publish real data without regulatory or trademark risk.
3. **User problem:** Indirect: protects users and the business.
4. **Business value:** Prevents takedowns, disputes or regulatory issues once real banks are named.
5. **Evidence:** Audit risk section [A]. Requirements in Vietnam have not been verified.
6. **Functional requirements:** Review the disclaimer, the "not financial advice" wording, use of bank names and offer text, any future affiliate model, and the privacy statement for quiz data kept in the browser.
7. **Acceptance criteria:** *Given* the pilot plan, *when* reviewed by counsel, *then* written guidance is received and the required copy changes are logged as backlog items.
8. **Technical dependencies:** None (start now, in parallel).
9. **Effort:** M (calendar time)
10. **Priority:** P0 (blocks publishing real data publicly)
11. **Success metric:** Sign-off received before public beta.
12. **Risks and uncertainties:** Findings may require copy or scope changes.

#### DH-11: Search v2 · P1 · M

1. **Epic:** Purchase-first discovery
2. **User story:** As a shopper, I want to type what I want to buy in my own words, so I reach the right comparison in one step.
3. **User problem:** "iphone 15", "macbook air", bank names ("techcombank") and generic intents ("thẻ hoàn tiền") return nothing; "cafe" finds no coffee shops.
4. **Business value:** Search is the first step of journey A; misses end the journey and work against the "time to relevant deal" objective.
5. **Evidence:** Audit #3 and gap #6 [T]; [H12] is unvalidated.
6. **Functional requirements:**
   - Match each word of the query separately, ignoring accents, with ranking.
   - Include bank names (showing "chưa có thẻ đã xác minh" where there are none).
   - Add intent words for benefit types (hoàn tiền, trả góp, tích điểm, giảm giá) that route to the directory filters.
   - Category aliases return that category's merchants.
   - A no-results page shows the closest categories.
   - Optionally log anonymous no-result queries (with DH-14).
7. **Acceptance criteria:**
   - *Given* "iphone 15", *when* searched, *then* Apple and "Điện tử & công nghệ" appear.
   - *Given* "techcombank", *when* searched, *then* the bank appears, with an honest empty state if it has no verified cards.
   - *Given* "thẻ hoàn tiền", *when* searched, *then* the directory opens filtered to cashback.
   - *Given* "cafe", *when* searched, *then* Starbucks, Highlands and Phúc Long appear.
8. **Technical dependencies:** Catalogue search query; possibly a database index change; tests.
9. **Effort:** M
10. **Priority:** P1
11. **Success metric:** Search success rate (search → comparison or card page). Measured in research (A1 task) and later via DH-14; target to be set after the baseline.
12. **Risks and uncertainties:** Real user phrasing is unknown until DH-12; keep the synonym list as data that's easy to edit.

#### DH-12: Run user research (8 sessions) · P1 · M *(non-dev)*

1. **Epic:** Assumption validation
2. **User story:** As the PO, I want evidence on H1–H5, so the next release builds what users actually need.
3. **User problem:** Every user hypothesis has zero evidence today.
4. **Business value:** Decides whether purchase-first has a real trigger, whether trust in third parties exists, and whether "my cards" matters. This avoids building the wrong features.
5. **Evidence:** Research plan §3 (all hypotheses unvalidated).
6. **Functional requirements:**
   - Follow the [research plan](user-research-plan.md): recruit 8 people across S1–S4, run 60-minute sessions, synthesise findings and record them in the research log.
   - Use the decision rules agreed in advance.
7. **Acceptance criteria:** *Given* 8 completed sessions, *when* synthesised, *then* each of H1–H12 is scored Supported / Mixed / Refuted / Unclear, with participant counts and quotes, and the backlog is re-prioritised.
8. **Technical dependencies:** DH-01, DH-05; DH-07 if the chat is tested.
9. **Effort:** M (≈2 weeks of calendar time)
10. **Priority:** P1
11. **Success metric:** Decisions documented for H1–H5.
12. **Risks and uncertainties:**
    - With fictional data, the study tests concept and usability, not real value.
    - Small sample: report counts, not rates.

### Upcoming releases

#### DH-13: Admin: edit eligible cards and create deals in the UI · P1 · M

1. **Epic:** Data administration
2. **User story:** As an editor, I want to add a deal and change which cards are eligible without re-importing a file, so weekly updates are fast and less error-prone.
3. **User problem:** Creating a deal and changing eligible cards, merchant, category or source are possible only by re-importing.
4. **Business value:** Lowers the per-offer cost of the data operations that DH-09 depends on.
5. **Evidence:** Audit #21 and gap #8 [C].
6. **Functional requirements:**
   - A create-deal form with the same validation as import.
   - A card-mapping editor, including per-card conditions.
   - Editing merchant, category and source.
   - All writes are audited and land as drafts.
7. **Acceptance criteria:**
   - *Given* a published deal, *when* the editor removes its last eligible card, *then* saving is blocked with a clear message.
   - *Given* a new deal entered in the form, *when* saved, *then* it's a draft with an audit entry.
8. **Technical dependencies:** DH-03.
9. **Effort:** M
10. **Priority:** P1 (urgency rises with DH-09's data volume)
11. **Success metric:** Editor time per offer (measure in DH-09, then compare).
12. **Risks and uncertainties:** Scope creep into a full CMS; keep to these fields.

#### DH-14: Minimal privacy-respecting analytics · P1 · M

1. **Epic:** Measurement
2. **User story:** As the PO, I want anonymous funnel metrics, so I can measure the success metrics instead of guessing.
3. **User problem:** Indirect.
4. **Business value:** Enables RICE and the success metrics; without it, the pilot can't be evaluated.
5. **Evidence:** The research plan's post-launch metrics require it; no analytics exist [C].
6. **Functional requirements:**
   - Track these events with no personal data, no card data and no quiz answers: search (with a result/no-result flag), comparison viewed, amount entered, source clicked, chat question asked, chat answer helpful or not, quiz started and completed.
   - A cookie or consent approach confirmed with DH-10.
7. **Acceptance criteria:**
   - *Given* a session, *when* events are inspected, *then* none contain free-text quiz amounts, IP addresses or card details.
   - *Given* a week of staging traffic, *when* the dashboard is viewed, *then* each funnel step shows a count.
8. **Technical dependencies:** DH-08, DH-10; choice of tool.
9. **Effort:** M
10. **Priority:** P1
11. **Success metric:** The success metrics from the research plan are measurable.
12. **Risks and uncertainties:** Privacy rules; tool cost.

#### DH-15: Database-outage handling and correct status codes · P2 · S

1. **Epic:** Reliability
2. **User story:** As a user during an outage, I want a clear message and a retry option, not a crash.
3. **User problem:** With the database down, pages return 500 and the API returns a generic error. Missing cards return 200 instead of 404.
4. **Business value:** Reliability and SEO before public beta.
5. **Evidence:** Audit #22, #23 [T].
6. **Functional requirements:** Classify database failures as 503 with the "đang gặp sự cố" message and a retry option; real 404 for unknown cards and merchants.
7. **Acceptance criteria:**
   - *Given* the database is down, *when* `/api/search` is called, *then* it returns 503 SERVICE_UNAVAILABLE.
   - *Given* an unknown card slug, *when* requested, *then* the status is 404.
8. **Technical dependencies:** DH-08 health check.
9. **Effort:** S
10. **Priority:** P2
11. **Success metric:** Status checks pass in tests.
12. **Risks and uncertainties:** Next.js streaming behaviour may need page restructuring.

#### DH-16: Savings comprehension improvements · P2 · S–M *(gated by H6)*

1. **Epic:** Understanding savings
2. **User story:** As a shopper, I want to understand instantly whether a figure is guaranteed or conditional.
3. **User problem:** Unknown. [H6] tests whether "Ước tính có điều kiện" is understood; there's no evidence yet.
4. **Business value:** Prevents correct numbers being misread.
5. **Evidence:** [H6] unvalidated.
6. **Functional requirements:** Defined after research. Candidates: a short inline legend; a one-line plain-language reason per row; a clearer tie explanation.
7. **Acceptance criteria:** *Given* the revised design, *when* tested with 5 users, *then* ≥4 explain "conditional" correctly.
8. **Technical dependencies:** DH-12 results.
9. **Effort:** S–M
10. **Priority:** P2 (P1 if H6 is refuted)
11. **Success metric:** A3 comprehension rate.
12. **Risks and uncertainties:** Adding text may slow scanning.

#### DH-17: "Thẻ của tôi": filter by cards I own · P2 · M *(gated by H5)*

1. **Epic:** Purchase-first discovery
2. **User story:** As a cardholder, I want to see only the offers on cards I own, so I know what I can use at checkout.
3. **User problem:** Cardholders can't narrow comparisons to cards they can actually use.
4. **Business value:** Potentially the main reason to return. Not yet validated.
5. **Evidence:** The spec requires the chatbot to receive "selected cards"; this is missing [C][Spec]. User need [H5] is unvalidated.
6. **Functional requirements:** Select owned cards (names only, stored in the browser); a "Thẻ của tôi" toggle on comparisons; owned cards passed to the chat context.
7. **Acceptance criteria:**
   - *Given* 2 owned cards are selected, *when* viewing Starbucks, *then* the toggle shows only offers on those cards, plus a count of better offers on other cards.
   - *Given* any selection, *when* inspecting network calls, *then* no card numbers exist and nothing is stored on the server.
8. **Technical dependencies:** DH-12 (H5); DH-09 (only meaningful with real data).
9. **Effort:** M
10. **Priority:** P2 (P1 if H5 is supported)
11. **Success metric:** Share of comparisons using the toggle; 30-day return rate of users who used it.
12. **Risks and uncertainties:** Low value if users hold cards from banks DealHoi doesn't cover yet.

#### DH-18: Broaden quiz spending categories · P2 · S–M

1. **Epic:** Card-fit accuracy
2. **User story:** As a quiz taker, I want to state my real main spending (groceries, dining, bills, fuel), so the score isn't inflated.
3. **User problem:** Only 5 categories exist, so users can't express uncovered spending and scores skew high.
4. **Business value:** Score credibility (supports the "understanding eligibility" objective).
5. **Evidence:** Audit #15, #16 [T][C].
6. **Functional requirements:** Add common categories plus "khác" (other); uncovered spending counts toward the total.
7. **Acceptance criteria:** *Given* a user whose main spending is groceries and the card has no grocery benefit, *when* scored, *then* category alignment reflects that spending share.
8. **Technical dependencies:** Reference data; scoring tests.
9. **Effort:** S–M
10. **Priority:** P2
11. **Success metric:** B5 interpretation accuracy; share of provisional results.
12. **Risks and uncertainties:** New categories have no offers until data expands.

#### DH-19: Data-ops tooling · P2 · M

1. **Epic:** Verified data
2. **User story:** As an editor, I want reminders before offers expire and a list of stale sources, so data stays correct without manual hunting.
3. **User problem:** There's no reminder mechanism.
4. **Business value:** Keeps freshness sustainable as data grows.
5. **Evidence:** [C]; relevance depends on DH-09.
6. **Functional requirements:** A dashboard listing offers expiring within 7 days and sources older than N days; an optional email digest.
7. **Acceptance criteria:** *Given* an offer ending in 5 days, *when* the editor opens the dashboard, *then* it's listed.
8. **Technical dependencies:** DH-09.
9. **Effort:** M
10. **Priority:** P2
11. **Success metric:** Median verification age; 0 expired-but-published offers.
12. **Risks and uncertainties:** Low.

#### DH-20: Shared rate-limit store and query reduction · P2 · M

1. **Epic:** Performance / cost
2. **User story:** As the operator, I want limits enforced across server instances and fewer database queries per page, so costs and latency stay predictable.
3. **User problem:** Indirect (latency, availability).
4. **Business value:** Scales the pilot safely.
5. **Evidence:** Rate-limit counters are per server instance [C]; the homepage runs per-merchant queries; every chat message loads all merchants and cards [C].
6. **Functional requirements:** Shared store (e.g., a Redis service or a database table); batch the homepage counts; cache the entity list used for chat.
7. **Acceptance criteria:**
   - *Given* 2 instances, *when* one client exceeds the limit, *then* both enforce it.
   - *Given* the homepage, *when* loaded, *then* database queries are cut to at most 5.
8. **Technical dependencies:** DH-08.
9. **Effort:** M
10. **Priority:** P2
11. **Success metric:** p95 page latency on staging (baseline to be measured first).
12. **Risks and uncertainties:** Adds infrastructure.

#### DH-21: Accessibility scan and mobile overlap · P2 · S

1. **Epic:** UX quality
2. **User story:** As a mobile or assistive-technology user, I want all content reachable and readable.
3. **User problem:** The floating chat button covers content on mobile.
4. **Business value:** Inclusive, polished experience for research and beta.
5. **Evidence:** Audit #28 [T, screenshot]; there's no automated accessibility check [A].
6. **Functional requirements:** Reserve bottom padding on mobile; add an automated accessibility check to the e2e suite; fix serious violations.
7. **Acceptance criteria:**
   - *Given* mobile comparison pages, *when* scrolled to the end, *then* no content is hidden under the button.
   - *Given* the accessibility check, *when* run, *then* there are 0 serious or critical violations.
8. **Technical dependencies:** e2e suite.
9. **Effort:** S
10. **Priority:** P2
11. **Success metric:** Violation count.
12. **Risks and uncertainties:** Low.

### Future opportunities (P3: listed, not specified)

These depend on validated findings, so they aren't specified to the 12-field level yet:

- **DH-22** Sale-day / weekly deal alerts by Zalo or email (requires H9 and DH-17).
- **DH-23** Expand to all 3 target banks and more categories (after DH-09 measures the cost per offer).
- **DH-24** "Best card overall for my spending" across categories (needs a sound method; risks repeating DH-01's misleading ranking).
- **DH-25** Distribution partnerships and Zalo mini-app.
- **DH-26** Revenue model and independence policy (affiliate is out of scope per the spec).

### Out of scope (per spec §15 and the current objectives)

Card applications; approval prediction; bank or transaction connections; payments; credit scoring; accounts and persistent profiles stored on the server; social features; subscriptions; affiliate tracking; native apps; automated scraping; ML recommendation models; autonomous financial advice.

---

## 3. Impact versus effort, and recommended order

| | **Small effort** | **Medium** | **Large** |
|---|---|---|---|
| **High impact** | DH-01, DH-02 → **do first** | DH-06, DH-07, DH-08, DH-11 → **next** | DH-09 → **start now, finish in sprint 2** |
| **Medium impact** | DH-03, DH-04, DH-05, DH-15, DH-21 | DH-13, DH-14, DH-18, DH-19 | — |
| **Unknown until research** | DH-16 | DH-17 | DH-22 – 24 |

**Order:**

1. DH-01, DH-02, DH-05 (quick fixes; unblock research).
2. DH-06 → DH-07 (AI trust).
3. DH-08 → DH-04 (staging, then verify the rate limit on the real platform).
4. DH-03 (needed before real data).
5. DH-11 (purchase-first entry point).
6. In parallel, owned by the PO: DH-10, DH-12, and data collection for DH-09.
7. After the research decision rules are applied: re-rank DH-16, DH-17, DH-18; then DH-13, DH-14.

**Switching to RICE later:** once DH-14 has run for 2–4 weeks and DH-12 is complete, use:

- **Reach**: measured weekly users of the affected journey step.
- **Impact**: research findings mapped to a 0.25–3 scale.
- **Confidence**: Supported = 100%, Mixed = 50%, Unclear = 20%.
- **Effort**: estimated person-weeks.

---

## 4. Recommended Sprint 1 (2 weeks)

**Sprint goal:** *"Every savings figure and AI answer DealHoi shows can be traced to its source data, and the product runs on staging, ready for moderated user research and the real-data pilot."*

**Smallest engineering scope that achieves it:**

| Item | Why it's needed for the goal |
|---|---|
| DH-01 | Removes the known overstated savings figure |
| DH-06 | Closes the confirmed AI loopholes |
| DH-07 | Proves AI behaviour with measured results |
| DH-08 | Gives a staging site that research and the pilot can use |
| DH-02 | Security baseline before staging is shared |
| DH-05 | Research tasks stay stable |

- **Stretch (if capacity allows):** DH-03, DH-04, DH-11.
- **Parallel, non-engineering (PO):** start DH-10 (legal), recruit for DH-12, begin collecting pilot data for DH-09 (published in Sprint 2).

**Definition of done for the sprint:**

- All six items meet their acceptance criteria.
- Unit, integration and e2e tests pass locally and on staging.
- The evaluation report is committed.
- No new unknown values are presented as fact.

**Inputs needed from the Product Owner to start:**

1. Approval of this scope, or changes to it.
2. An OpenAI API key for DH-07.
3. Supabase and Vercel access for DH-08.
4. Which pilot bank and categories to use for DH-09.

---

## Change log

| Date | Change |
|---|---|
| 16/11/2026 | Initial backlog proposal (awaiting PO approval) |
