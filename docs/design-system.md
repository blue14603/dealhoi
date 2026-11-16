# DealHoi design system: "Electric Chrome"

**Version:** 2.0 (replaces the V1 red-and-white interface) · **Date:** 16/11/2026 · **Branch:** `feat/electric-chrome`

A dark-first visual identity for a Gen Z financial discovery product: obsidian surfaces, electric cobalt actions, chrome and titanium materials, ice-white editorial type. The homepage is expressive and editorial; comparison and data pages are quieter and optimised for reading financial information.

Functional scope is unchanged. Database queries, savings calculations, ranking, eligibility logic, compatibility scoring, AI retrieval and validation, routes and APIs were not modified. The only logic added is presentation-level selection of which verified offer an editorial card displays (see [Editorial deal cards](#editorial-deal-cards)).

---

## 1. Tokens

Defined in `src/app/globals.css` (`@theme`) and used as Tailwind utilities (`bg-surface`, `text-ink-muted`, …).

### Colour

| Token | Value | Use |
|---|---|---|
| `canvas` | `#08090D` obsidian | Page background |
| `surface` | `#141720` graphite | Cards, panels |
| `surface-2` | `#1C202C` | Elevated surfaces, inputs, table headers |
| `line` / `line-strong` | `#303646` / `#434B5E` | Hairlines / input borders |
| `brand` | `#2457FF` electric cobalt | **Backgrounds** of primary actions, progress, selected states |
| `brand-hover` | `#3A66FF` | Primary button hover background (see note) |
| `brand-bright` | `#416DFF` | Borders, hover outlines, logo dot, large display accents |
| `brand-soft` | `#131C3D` | Selected-state tint |
| `accent` | `#8EAEFF` | Cobalt for **text and links** on dark |
| `ice` | `#A9C7FF` | Financial highlights (benefit values), focus ring |
| `chrome` | `#C4CAD4` | Editorial labels, metallic accents |
| `ink` / `ink-muted` / `ink-subtle` | `#F4F6FA` / `#A4ADBF` / `#8B94A7` | Text hierarchy |
| `savings` | `#B9F568` acid lime | **Only** positive financial outcomes: exact best savings, "verified" ticks |
| `warn`, `danger`, `info` (+ `-soft`) | `#FFC266`, `#FF7A7A`, `#A9C7FF` | Warnings, errors, informational alerts |

**Contrast** (WCAG 2.2, computed): every text token is ≥ 5.3:1 on every surface (`ink-subtle` on `surface-2` is the minimum at 5.33:1). Raw `#2457FF` is only 3.0–3.7:1 on dark surfaces, so it is never used for body text; `accent` (7.5–9.1:1) is used instead.

**Deviation from the brief:** the specified hover colour `#416DFF` gives white button text 4.32:1 (below AA's 4.5:1). Button hover backgrounds therefore use `#3A66FF` (4.64:1); `#416DFF` is kept as `brand-bright` for borders and large display text, where 3:1 applies (it measures 4.6:1 on obsidian).

**Semantic rules:**

- Lime marks *exact* best savings only. *Conditional* estimates use ice blue, so "probably" never looks like "guaranteed".
- Red appears only for errors and serious warnings. The old red brand colour is gone.
- Compatibility scores use ice (≥ 70), chrome (40–69) or warn (< 40), never lime: a lifestyle match is not a financial outcome.

### Typography

| Role | Font | Where |
|---|---|---|
| Display | **Space Grotesk** 500/600/700 (`.font-display`, tracking −0.03em) | Hero, section titles, product names, benefit values, scores |
| Interface | **Be Vietnam Pro** 400–800 | Body, navigation, forms, tables, chat, conditions |

- **Why this pairing:** Space Grotesk's geometric, slightly quirky forms give the editorial and tech-campaign voice. Be Vietnam Pro was designed for Vietnamese and stays highly legible at small sizes for financial detail.
- **Vietnamese support:** Space Grotesk is loaded with Google Fonts' `vietnamese` subset. The build accepted the subset, and screenshots show correct diacritics in display headings ("Hời mỗi ngày", "Mỗi tháng bạn chi khoảng bao nhiêu bằng thẻ?").
- **Loading:** both fonts come from Google Fonts via `next/font` (OFL licence), self-hosted at build time with `display: swap`.
- **Scale:** hero 44 → 84px; section titles 32–40px; card product names 30–40px; benefit values 38–56px (container-query sized); labels 11px uppercase with 0.22em tracking (`.eyebrow`); body 14–16px; metadata 12–14px; tabular numerals on financial values.

### Shape, elevation, motion

- **Radius:** 12px (controls) · 16px (tiles) · 24px (feature cards). No pill-shaped containers except small badges.
- **Elevation:** `--shadow-lift` (deep drop shadow + 1px cobalt ring) on hover only.
- **Motion:** `--dur-fast` 200ms for colour, border and shadow; `--dur-move` 340ms for asset movement; easing `cubic-bezier(.2,.7,.2,1)`. CSS transforms and opacity only; no animation library.

---

## 2. Editorial deal cards

`src/components/home/editorial-deal-card.tsx` is one shared, configurable component. The four concepts in `src/config/discovery.ts` vary only art direction:

| # | Label | Headline | Target route | Artwork | Hover motion |
|---|---|---|---|---|---|
| 01 | Coffee Culture | Starbucks | `/so-sanh?merchant=starbucks` | Iced coffee, cobalt straw | Rises 12px, straightens from 5° to 2° |
| 02 | Tech & Lifestyle | iPhone | `/so-sanh?merchant=apple` | Floating titanium phone | Rotates −6°, moves forward and up |
| 03 | Shop Smarter | Shopee | `/so-sanh?merchant=shopee` | Liquid-chrome shopping bag | Straightens and lifts 8px |
| 04 | Go Places | Vé máy bay | `/so-sanh?category=du-lich-hang-khong` | Polished silver jet | Climbs diagonally (+14px x, −12px y) |

**Data binding:** the large value, cap, minimum spend, banks, end date and "+N ưu đãi khác" come from **verified, active** database offers. `pickHeadlineDeal` (in `src/lib/services/discovery.ts`) chooses the offer by a fixed rule:

1. merchant-specific offers before category-wide ones;
2. cashback or discount with a known value before other benefit types;
3. then the existing highlight rule.

General "all spending" offers and welcome bonuses are never used as headlines. With no verified offer, the card says "Chưa có ưu đãi" instead of showing a number.

**Composition:**

- Text column limited to about 58–64% of the card width.
- Artwork absolutely positioned at 40–56% width, allowed to bleed off the edge.
- A localized cobalt radial glow sits behind the artwork.
- Values are sized by container queries, so they never wrap inside narrow bento columns.
- Verified by measurement at 360, 768, 1024 and 1440px: every value fits on one line, and no text visually overlaps the artwork.

**Interaction** (`.ed-card` in `globals.css`):

- **Hover** (only on devices with `hover: hover` and a fine pointer):
  - card lifts 5px with the shadow and a cobalt border;
  - artwork moves independently via CSS custom properties (`--hx --hy --hr --hs`) with a drop shadow;
  - glow fades in;
  - CTA turns cobalt and its arrow slides and rotates.
- **Keyboard:** `:focus-visible` gives an ice-blue border, glow and CTA highlight. The asset doesn't move.
- **Touch:** the default state is complete, with a `:active` press scale of 0.99 and a single tap to navigate.
- **`prefers-reduced-motion`:** all lifts and asset motion are disabled (covered by a test).

The whole card is one link, with no nested interactive elements.

---

## 3. Visual assets

All artwork is **original SVG created for DealHoi in this project**, stored in `public/illustrations/`:

| File | Subject | Size |
|---|---|---|
| `hero-cards.svg` | Brushed-titanium card over cobalt glass card, rim light, glow | 4.3 KB |
| `coffee.svg` | Iced coffee: dome lid, ice, milk swirl, condensation, cobalt straw | 3.9 KB |
| `phone.svg` | Angled titanium smartphone, generic punch-hole camera, cobalt screen | 3.2 KB |
| `bag.svg` | Sculptural liquid-chrome shopping bag with cobalt reflection | 2.6 KB |
| `plane.svg` | Polished silver jet, three-quarter view, contrails | 3.2 KB |
| `ticket.svg` | Chrome event ticket with cobalt stub (Entertainment category) | 2.3 KB |
| `sidekick.svg` | Chrome orb with cobalt spark: the DealHoi AI symbol | 0.7 KB |

**Sourcing and licensing:**

- No image generation was available in the build environment.
- Stock photography was **not** sourced. Licensing for isolated product cutouts that suit a black background is often unclear, and real product photos (e.g., an iPhone) would show third-party product designs and trademarks.
- Original vector art has no licensing risk, scales crisply and weighs about 19 KB for the set.
- **No logos, brand marks, real card designs, card numbers or people** appear in any asset. The phone was deliberately made generic (punch-hole camera rather than a manufacturer-specific notch or island).
- The hero card carries no wordmark, so DealHoi never appears to issue cards.
- Card previews use a **generic metallic illustration** with the label "Hình minh họa — không phải thiết kế thẻ thật" unless an official `image_url` is stored for the card, in which case that image is shown unaltered.

**To replace with photography later:** drop licensed WebP or PNG files into `public/illustrations/` and change `art.src`, `width` and `height` in `src/config/discovery.ts`. Record each asset's source and licence in this table.

---

## 4. What changed, page by page

| Area | Change |
|---|---|
| Global | New tokens; dark `color-scheme`; ice focus ring; Space Grotesk display face; V1 red removed; light-mode utilities converted |
| Navigation | `dealhoi.` wordmark with a cobalt full stop; links "Khám phá" (same `/uu-dai` route), "Thẻ tín dụng", "Cách DealHoi tính"; functional "Tìm deal" link to `/tim-kiem` |
| Homepage | Asymmetric hero ("Chi thông minh. Hời mỗi ngày.") with the search as the primary action ("Tìm deal ngay") and a hero card illustration; trust strip; lifestyle category tiles with live offer counts; bento of editorial deal cards; editor picks; "Meet your next card." previews with each card's verified headline benefit, fee and fitting categories; merchant tiles ("phổ biến" wording removed: no popularity data exists) |
| Comparison | Display-type heading; graphite table header; lime left edge on the best exact saving; ice for conditional estimates; frosted sticky controls. Calculations and ranking untouched |
| Card detail | Product-style hero (tilted metallic card, glow, fee / network / active-benefit stats); highlight "feature blocks" with large values; "Is this your card?" lifestyle section |
| Quiz | One question per step, progress bar, Back / Next, large answer cards (category illustrations), per-step validation, focus moved to each new question. Inputs, storage and scoring unchanged |
| Results | Oversized score, editorial headings, gradient dimension bars; disclaimer and balance warning preserved |
| AI assistant | "DealHoi AI — Your deal sidekick." with the chrome sidekick symbol; restyled bubbles, suggestions and errors. Retrieval, grounding, validation and sources unchanged |
| Alerts, badges, inputs, sheets, skeletons | Dark variants using semantic tokens |

---

## 5. Verification (actually run on 16/11/2026)

- `tsc --noEmit` and ESLint: clean. Production build succeeds.
- Unit and integration tests: **84 passed, 1 skipped** (live AI test, no key).
- End-to-end (Playwright): **21 / 21 passed**:
  - the 8 original journey tests, updated for the new copy and the stepper quiz (assertions on scoring and data are unchanged);
  - 4 new design tests: cards bound to data and routes; no emoji on the homepage; hover lift, asset movement and visible focus; reduced motion;
  - 9 accessibility scans.
- **Accessibility:** axe-core scan with WCAG 2.0/2.1/2.2 A/AA tags on 9 pages found **0 serious or critical violations**. On the homepage, 209 elements passed the contrast rule and 13 were "incomplete" (text over artwork or gradients, which axe can't evaluate). Those cases were checked against the token contrast table above.
- **Responsive:** 10 pages × 5 widths (360, 390, 768, 1024, 1440): no horizontal overflow and no console errors.
- **Performance (homepage, local production build):** cumulative layout shift 0.0000. Uncompressed transfer: about 19 KB images, 157 KB fonts, 55 KB CSS, 435 KB JS.

**Not verified:** real-device touch testing; screen-reader walkthroughs (only automated checks were run); Lighthouse scores; visual QA of the admin area beyond automated checks (it inherits the tokens).
