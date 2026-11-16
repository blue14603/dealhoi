# DealHoi: user research and validation plan

**Date:** 16/11/2026 · **Roles:** product manager, UX researcher

**Evidence status:** there is no user evidence yet. Everything below about users is a hypothesis drawn from the product brief, the MVP and general reasoning. No interviews, surveys or analytics exist yet, and the MVP has no analytics installed. Each claim is labelled:

- **[Assumption]**: a belief to be tested; there is no evidence for it yet.
- **[Product fact]**: something confirmed in the codebase or the [product audit](product-audit-2026-11-16.md).
- **[To validate]**: the research below is designed to answer it.

---

## 1. User segments [Assumption]

| Segment | Who (hypothesised) | Situation | Likely current behaviour | Most relevant MVP feature |
|---|---|---|---|---|
| **S1. Active optimisers** | Holds 2+ credit cards, usually urban, shops online often | About to pay and wondering which card gives more back | Checks bank apps, Facebook deal groups and merchant banners; may keep a mental "card X for Shopee" rule | Purchase-first comparison |
| **S2. Passive holders** | Holds one card, often given with a salary account or bank promotion | Pays with whatever card they have; may not know what it offers | Rarely looks for promotions; finds out by accident, through bank notifications | Card detail ("what does my card give me?") |
| **S3. First-card considerers** | Young professionals; cautious about credit as debt | Deciding whether to get a card at all, and which one | Asks friends and colleagues, sees bank ads, staff at the branch recommend one | Card-first journey and quiz; responsible-use warnings |
| **S4. Big-purchase planners** (a situation rather than a group) | Anyone buying a phone, laptop, flights or concert tickets | High-value purchase where savings or installments matter a lot | Compares installment offers at the retailer, asks staff in the store | Purchase-first with installments |
| **Anti-segment: revolvers** | Regularly carry an unpaid balance | Rewards are outweighed by interest | — | Warnings only. **Not a target**; DealHoi must not push them to spend more |

Main uncertainty **[To validate]**: whether S1 is large and frequent enough to support repeat use, and whether S3 trusts an independent site more than bank staff.

---

## 2. Jobs to Be Done [Assumption]

| ID | Job statement | Segment | Kind |
|---|---|---|---|
| **J1** | When I'm about to pay for something, I want to know which of my cards gives the most back, so I don't miss savings | S1, S4 | Functional, frequent |
| **J2** | When I see an advertised promotion, I want to know what I'll actually get after caps and conditions, so I'm not disappointed or tricked | S1, S2, S4 | Functional + emotional (avoid feeling cheated) |
| **J3** | When I already have a card, I want to know what benefits it has, so I get value from the fee I pay | S2 | Functional |
| **J4** | When I'm considering a first or new card, I want to understand which card fits how I actually spend, so I don't pay fees for benefits I won't use | S3 | Functional + emotional (fear of debt, fear of choosing wrong) |
| **J5** | When I'm deciding about credit, I want to feel confident I'm not being sold to, so I can trust the decision | S3 | Emotional, social |
| **J6** | When I make a big purchase, I want to compare installment or discount options, so I keep monthly payments affordable | S4 | Functional |

How these jobs map to the current MVP **[Product fact]**:

- **J2, J4 and J6**: directly addressed (actual savings after caps, the lifestyle quiz, installments shown separately).
- **J1**: only partly addressed. The comparison shows *all* cards, while a cardholder usually needs "which of *my* cards". There's no way to say which cards you own.
- **J3**: addressed through card pages. Whether passive holders would ever go looking is **[To validate]**.

---

## 3. Prioritised hypothesis matrix

Current evidence for **every** hypothesis below is **none**. Priority is a judgement of how damaging it would be if the hypothesis were wrong, and how uncertain it is.

| # | Hypothesis (and the risk if wrong) | Area | Segment | How to test (in this study) | Signal that supports it | Signal that refutes it | Priority |
|---|---|---|---|---|---|---|---|
| **H1** | People think about which card to use before at least some purchases. *If wrong: the purchase-first journey has no trigger moment* | Problem frequency | S1, S4 | Ask about specific recent purchases | Most S1 participants describe ≥1 real instance in the last month, unprompted, with detail | They can't recall an instance, or say they "just tap whatever card" | **P1** |
| **H2** | Understanding the real value of a promotion (caps, minimum spend, conditions) is a real pain point. *If wrong: the core differentiator doesn't matter* | Pain | S1, S2, S4 | Ask for a story of a promotion that didn't deliver; observe how they read a promo in the test | Stories of unexpected caps or rejected cashback; misreading in the test | No such stories; conditions are seen as obvious | **P1** |
| **H3** | Current alternatives (bank apps, Facebook groups, merchant banners) are fragmented enough that a single place adds value. *If wrong: DealHoi duplicates a habit that already works* | Alternatives | S1 | Ask them to show where they currently check offers (in the session, on their own phone; screens with personal info are not recorded) | Several sources and visible effort | One app (e.g., the bank's or the merchant's) answers it at checkout | **P1** |
| **H4** | Users will trust an independent site's offer information if it shows source and date. *If wrong: they'll always double-check with the bank, so DealHoi only adds a step* | Trust | All | Ask what they trust today; observe reactions to source links, dates and "conditional" badges | They say source and date raise confidence; they click sources | They distrust any third party, or trust only bank staff | **P1** |
| **H5** | Existing cardholders mainly need "which of my cards", not "which card in the market". *If wrong: card-ownership features would be wasted effort* | Value / scope | S1, S2 | Observe the first thing they look for in the comparison; ask what they'd do with the result | They try to find their own cards first; ignore cards they don't own | They're happy to compare the whole market | **P1** |
| **H6** | Users understand the savings estimate and the difference between exact, conditional and insufficient-information figures. *If wrong: accurate numbers are still misread* | Comprehension | All | Comprehension check after the task | ≥80% explain "conditional" correctly in their own words | They read conditional figures as guaranteed | **P2** |
| **H7** | First-card considerers want a fit assessment before applying, and find a rule-based score credible. *If wrong: the quiz is a gimmick* | Value / trust | S3 | Quiz task plus follow-up | They can explain *why* the score is what it is and say what they'd do next | They ignore the score, or read it as approval odds | **P2** |
| **H8** | The AI chat answers questions the table doesn't, and users trust it. *If wrong: it's costly decoration* | Value | All | Observe whether they use chat unprompted; compare to the table | Unprompted use for condition or eligibility questions | Ignored; or answers trusted *more* than sources (a risk) | **P2** |
| **H9** | Users will return for future purchases (repeat trigger exists). *If wrong: there's no sustainable usage* | Retention | S1, S4 | Ask about upcoming purchases; at the end, ask if they want to be contacted again (a behavioural signal, not hypothetical) | They name specific upcoming moments (sale days, travel); they leave contact details | "Maybe someday" | **P2** |
| **H10** | First-card considerers find credit-as-debt fear a barrier that education can lower. *If wrong: DealHoi's "responsible" framing doesn't move decisions* | Pain / emotion | S3 | Interview | They name specific fears (interest, overspending) and current coping strategies | No fear, or fear that no information would change | **P3** |
| **H11** | Users accept a site with no account and no personal data, and won't share card details. *If wrong: personalisation must work differently* | Privacy | All | Ask what they'd be comfortable sharing | Comfortable listing card names, not numbers | Unwilling even to list card names | **P3** |
| **H12** | Search by "what I want to buy" matches how users phrase intent. *If wrong: the entry point fails* (the audit already found misses such as "iphone 15") | Usability | All | Observe exact words typed in the test | Words map to merchants or categories in the system | Phrases like "thẻ nào hoàn nhiều nhất" | **P2** |

---

## 4. User interview questions (non-leading)

These follow the "Mom Test" approach: ask about **past behaviour and specifics**, never about hypothetical future use or whether they like the idea. Don't mention DealHoi until the usability section. Questions are in Vietnamese for participants; the intent is in English.

**Opening (2 min)**

- "Anh/chị đang dùng những loại thẻ thanh toán nào? Thẻ nào dùng nhiều nhất?" — Map their cards. Don't ask for card numbers or bank details.

**Recent behaviour (most important, 10 min)**

1. "Lần gần nhất anh/chị thanh toán bằng thẻ tín dụng là khi nào? Mua gì?" — Anchor on a real event.
2. "Lúc đó anh/chị chọn thẻ đó như thế nào?" — How decisions actually get made (H1).
3. "Trước khi thanh toán, anh/chị có xem ưu đãi ở đâu không? Có thể cho mình xem không?" — Current alternatives, observed (H3).
4. "Trong tháng vừa rồi, có lần nào anh/chị chủ động tìm xem thẻ nào có ưu đãi tốt hơn không? Kể cho mình nghe." — Frequency (H1).
5. "Lần đó mất bao lâu? Phần nào mất công nhất?" — Effort and pain.

**Promotions experience (5 min)**

6. "Có lần nào anh/chị nghĩ mình được ưu đãi nhưng cuối cùng không nhận được, hoặc nhận ít hơn không? Chuyện gì đã xảy ra?" — Pain with conditions and caps (H2).
7. "Sau lần đó anh/chị có làm gì khác đi không?" — Whether the pain changed behaviour.
8. "Anh/chị biết thẻ của mình có những quyền lợi gì? Biết qua đâu?" — Awareness (J3).

**Trust (4 min)**

9. "Khi muốn chắc chắn một ưu đãi là thật và còn hiệu lực, anh/chị kiểm tra ở đâu?" — Source of truth (H4).
10. "Có nguồn nào anh/chị từng tin nhưng sau đó thấy sai không?" — Trust failures.

**First card / choosing a card (S3, or anyone who opened a card recently; 5 min)**

11. "Anh/chị mở thẻ gần nhất như thế nào? Ai hoặc điều gì ảnh hưởng đến quyết định?" — Real decision process (H7, J5).
12. "Có điều gì làm anh/chị lo lắng khi dùng thẻ tín dụng không?" — Fear of debt (H10). Ask neutrally; don't suggest debt.
13. (If they have no card) "Gần đây có lúc nào anh/chị cân nhắc mở thẻ không? Điều gì khiến anh/chị chưa mở?" — Barriers.

**Upcoming behaviour (2 min)**

14. "Trong 1–2 tháng tới anh/chị có dự định mua gì lớn không?" — Return triggers (H9). Ask before showing the product.

**Wrap-up**

15. "Có điều gì về chuyện dùng thẻ và ưu đãi mà mình chưa hỏi nhưng anh/chị thấy quan trọng?"

**Avoid asking:** "Bạn có dùng app so sánh thẻ không?", "Tính năng này có hữu ích không?", "Bạn có trả tiền cho...?". These invite polite yeses. When a participant says "chắc là có" (probably yes), follow up with "Lần gần nhất là khi nào?" (When was the last time?).

---

## 5. Usability testing scenarios

**Setup [Product fact].** The MVP contains only fictional demo banks and offers. Before running sessions:

- Re-seed the demo data (`npm run db:seed:demo`); some demo offers expire from 30/11.
- Configure an OpenAI key, or skip the chat tasks.
- Avoid the known issue of the welcome bonus ranked first in `/uu-dai` with an amount: don't use that page with an amount.

**Introduction to read:** "Đây là bản thử nghiệm với dữ liệu minh họa, các ngân hàng và ưu đãi là hư cấu. Mình đang thử sản phẩm, không phải thử anh/chị. Không có câu trả lời sai. Anh/chị vui lòng nói to suy nghĩ trong lúc làm."

After each task, ask: "Việc này dễ hay khó, từ 1 (rất khó) đến 7 (rất dễ)?" This is the Single Ease Question (SEQ).

### Journey A: purchase-first (around 15 min)

| Task | Instruction to participant | Success criteria | What to observe |
|---|---|---|---|
| **A1. Find** | "Anh/chị sắp mua đồ uống ở Starbucks khoảng 150.000 ₫. Hãy dùng trang này để tìm thẻ có lợi nhất." | Reaches the Starbucks comparison and enters the amount, unaided | Exact words typed in search (H12); search vs. category chips; time taken |
| **A2. Understand** | "Theo anh/chị, nếu dùng thẻ được gợi ý thì anh/chị sẽ được bao nhiêu tiền, và cần điều kiện gì?" | Names the amount and at least 1 condition (minimum or cap) | Do they read the conditions? Do they notice there are two tied offers? |
| **A3. Comprehension check** | Point at a "≈ 15.000 ₫ · Ước tính có điều kiện" row: "Con số này có nghĩa là gì với anh/chị?" | Explains it isn't guaranteed and why (H6) | Do they read it as a guaranteed amount? |
| **A4. Below minimum** | "Nếu anh/chị chỉ mua 80.000 ₫ thì sao?" | Notices the 20% offer is no longer eligible | Whether the change is noticed |
| **A5. Verify** | "Nếu muốn tự kiểm tra lại ưu đãi này, anh/chị sẽ làm gì?" | Finds the source link and the verification date (H4) | Do they look for the source? Do they mention the bank app instead? |
| **A6. Ask** | "Anh/chị có thắc mắc gì về ưu đãi này không? Hãy thử tìm câu trả lời." Don't point to the chat. | Gets an answer (any method) | Unprompted chat use (H8); trust in the AI answer vs. the table |
| **A7. Own cards** (open question) | "Nếu đây là dữ liệu thật, anh/chị sẽ dùng kết quả này như thế nào khi thanh toán?" | — (no success criterion) | Whether they look for their own cards (H5) |

### Journey B: card-first (around 15 min)

| Task | Instruction | Success criteria | What to observe |
|---|---|---|---|
| **B1. Choose** | "Anh/chị hay đi du lịch và muốn tìm hiểu một thẻ phù hợp. Hãy tìm và mở một thẻ anh/chị thấy đáng xem." | Opens a relevant card page (e.g., Hoa Sen Travel Signature) | Path: directory filter vs. search |
| **B2. Key facts** | "Thẻ này mất phí bao nhiêu mỗi năm, và có cách nào để được miễn phí không?" | States the fee and the waiver condition | Time; whether the "facts" section is found |
| **B3. Benefits** | "Những quyền lợi nào của thẻ này có thể dùng lâu dài, cái nào chỉ có thời hạn?" | Separates ongoing from temporary benefits | Do they understand the difference? |
| **B4. Quiz** | "Hãy kiểm tra xem thẻ này có hợp với cách anh/chị chi tiêu không." Ask them to answer roughly as for their real life, without sharing exact numbers. | Completes the quiz and sees the result | Drop-off points; hesitation on any question; whether their spending categories are missing (audit gap) |
| **B5. Interpret** | "Điểm này cho anh/chị biết điều gì? Điều gì làm điểm thấp xuống?" | Explains ≥1 dimension, and that it isn't approval odds (H7) | Do they read it as a chance of being approved? |
| **B6. Next step** | "Sau khi xem kết quả này, anh/chị sẽ làm gì tiếp theo?" | — | Do they trust it, or plan to ask the bank, friends or staff? |

**Closing (2 min):** "Điều gì dễ hiểu nhất? Khó hiểu nhất? Có chỗ nào anh/chị thấy không tin tưởng?"

---

## 6. MVP success metrics

The thresholds below are **proposed targets for discussion, not benchmarks**. There is no industry or user data behind them.

### During research (5–10 sessions)

| Journey | Metric | Proposed target |
|---|---|---|
| A | A1 task success, unaided | ≥ 80% of participants |
| A | Correct reading of "conditional" (A3) | ≥ 80% |
| A | Finds the source when asked to verify (A5) | ≥ 70% |
| A | Average SEQ score across tasks | ≥ 5.5 / 7 |
| B | Finds fee and waiver (B2) | ≥ 80% |
| B | Quiz completion (B4) | ≥ 90% |
| B | Doesn't read the score as approval odds (B5) | 100% (any misreading is a design failure) |
| Both | Trust: "Bạn tin thông tin này đến mức nào?" (1–7) | Median ≥ 5, with the stated reasons recorded |
| Both | Behaviour signal: leaves contact details to test the real-data version | ≥ 50% |

### After launch (requires adding privacy-respecting analytics; the MVP has none [Product fact])

| Journey | Metric | Why it matters |
|---|---|---|
| A | Search success rate: searches leading to a comparison page | Is the entry point working (H12) |
| A | Comparisons where an amount is entered | Is the savings calculation valued |
| A | Source-link clicks per comparison | Indicates trust behaviour |
| A | Chat questions per comparison session, and the rate of answers rated useful | Value of AI (H8) |
| B | Card page → quiz start → quiz completion | Funnel health |
| B | Quiz results that are "provisional" or "insufficient" | Data coverage gaps |
| Retention | Users returning within 30 days; return visits on big sale days (11.11, 12.12, Tết) | Repeat trigger (H9) |
| Guardrails | Reported wrong or expired offers; AI unsupported-claim rate from the evaluation set | Trust protection; these should be near 0 |

---

## 7. Recommended research plan (about 2 weeks, 8 participants)

**Recruit 8 people:**

- 3 × S1 (2+ cards, pay online regularly)
- 2 × S2 (1 card, rarely checks promotions)
- 2 × S3 (no card, or opened their first card within the last 6 months)
- 1 × S4 (planning a big purchase within 2 months)

Mix Hà Nội / TP.HCM if possible. Remote sessions over Google Meet or Zoom with screen share work fine.

**Screener questions:**

1. Number of credit cards held.
2. How often they pay online (per month).
3. Last time they opened, or considered opening, a card.
4. Planned big purchases.

Exclude people who work in banking or marketing. Recruit through friends of friends, Facebook groups, or university and alumni networks. Offer a thank-you gift, for example a 200.000 ₫ voucher **[Assumption: adjust to local norms]**.

**Session (60 min):**

- 5 min: consent and introduction. Say that you won't ask for card numbers, and ask permission to record audio.
- 20 min: interview (section 4). This comes **before** showing the product.
- 30 min: usability (section 5); alternate whether Journey A or B comes first.
- 5 min: closing questions and the contact-details request.

**Roles:** one facilitator and one note-taker. Use a shared note template with columns: participant, segment, quote, behaviour observed, hypothesis ID.

**Synthesis (days 9–10):**

1. Tag each note to a hypothesis.
2. Score each hypothesis as **Supported / Mixed / Refuted / Unclear**, citing participant counts and quotes.
3. Write one page of decisions.

Five to ten sessions reveal behaviour patterns and usability problems. They can't show market size or exact percentages, so report findings as "6 of 8 participants…", not as rates.

**Decision rules (agree on these before the research):**

| Finding | Decision |
|---|---|
| H1 + H3 refuted (no recurring trigger; bank or merchant apps already suffice) | Rethink purchase-first; focus on card choice (S3) |
| H5 supported (people look for their own cards first) | Prioritise card-ownership personalisation in the next milestone |
| H4 refuted (no trust in third parties) | Invest in source transparency before adding any features |
| H6 or H7 refuted (misreading of estimates or scores) | Fix wording and design before collecting real data |

**What to validate first:** H1, H2, H3, H4 and H5. These decide *whether* and *for whom* DealHoi is worth building out. H6–H8 matter only once that's settled. In the meantime, the trust work from the audit (real data, AI claim checking) is worth doing whatever the research shows, because no segment will use a source it can't trust.

---

## Research log

_No sessions have been conducted yet. Add findings here (participant ID, segment, date, hypothesis outcomes) as the research happens._
