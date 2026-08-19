# Casa Libre Buyer-Portal — v5.2 Pixel-Match + Audit-Fix Implementation Plan (Track A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the four buyer-portal pages (Landing, Listings/Marketplace, Publicar, Detalle) a pixel/text match to the v5.2 reference HTML mockups AND close every buyer-portal audit item, where the audit governs any conflict with the mock.

**Architecture:** Edit the existing Next.js 14 App Router components in place (plain JS + Tailwind, Casa Libre brand tokens). No new framework, no schema changes. Shared helpers (pluralization, zone title-case, placeholder caption, phone normalization, CL-ref) go in `lib/`; page-specific pixel/copy fixes go in the page components. The detail contact card is rebuilt to the reference; the four contact events are wired through the existing `lib/analytics.js` `track()` wrapper.

**Tech Stack:** Next.js 14.2.x App Router, React 18, Tailwind (config at `tailwind.config.js`, tokens in `app/globals.css`), plain JavaScript, posthog-js via `lib/analytics.js`.

**Spec:** This plan is self-contained. The authoritative visual source is the v5.2 reference set in `C:\Users\HP\Desktop\airosofts\casa-libre-portal-v5.2\portal\` — `Casa Libre Landing.dc.html`, `Casa Libre Listings.html`, `Casa Libre Publicar.dc.html`, `Casa Libre Detalle.html`. The authoritative correction source is `CASA-LIBRE-AUDIT-ACTIONS-FOR-OMAR.md` in the same folder. **When mock and audit disagree, the audit wins** (user decision, 2026-08-20).

## Testing Reality (read before executing)

This repository has **no test framework** — there are no test files and no test runner configured. The deliverable is *visual parity*, which unit tests cannot assert. Therefore each task's verification step is:

1. `npm run build` completes with no new errors (from repo root `casa-libre-BuyerPortal`).
2. `npm run lint` is clean for the touched files (if the script exists; otherwise skip).
3. A **visual-diff checklist** against the exact reference values listed in the task (open the reference `.html` in a browser beside `npm run dev` at the matching route).

This is a deliberate, stated deviation from strict TDD because the repo has no test harness and the work is pixel-visual. Do not fabricate unit tests for CSS values.

## Global Constraints (every task inherits these — verbatim from CLAUDE.md + audit)

- **No emojis anywhere, ever.**
- **Spanish (es) is default; English only via the existing `useLang` toggle.** Every user-visible string must exist in both the `es` and `en` objects.
- **Palette: ink `#111` / paper `#f9f4ee` only.** Red/green strictly for destructive/success functional states. WhatsApp green `#25D366` is the one functional-action exception, already in use.
- **Publishing is instant on the front end** — no "verification time" / "48 hs" / "nuestro equipo verifica" copy anywhere in live flows.
- **Free launch** — no listing fees, tiers, prices, or Stripe UI in any live flow.
- **Wordmark `casa-libre.py` is branding only.** All contact identity uses `hola@casa-libre.com` / `www.casa-libre.com`.
- **Mascot is "Cuate"**, asset `/mascot.png` (production `casa-libre-mascot-trim.png`). Never "Casi".
- **WhatsApp pre-written message is ALWAYS Spanish**, in the locked short format: `¡Hola! ¿Sigue disponible esta propiedad?` + a working listing URL on our domain. Optional buyer name: `¡Hola, soy <name>! …`. No property title/price/zone text.
- **Every contact trigger is a distinct tracked event:** `contact_whatsapp_click`, `contact_call_click`, `contact_copy_click`, `report_unresponsive`, each carrying a listing ref.
- **All listings fully public** — no login gates; the account control stays in the nav (accounts only gate saving/publishing).
- **Audit governs over the mock on conflict.** Specifically: remove `4.9★`; keep the DB-driven live count (never hardcode `12.400+`); no `48 hs`; no paid tiers/Stripe; rewrite Tres pasos around WhatsApp/phone.
- **Card/marker click navigates to the detail page** (user decision) — do not revert to the mock's on-page flyTo-only behavior.

## Decisions already made (do not re-litigate)

- **#9 count:** keep the dynamic `${count}+` (audit rule), do NOT restore `12.400+`.
- **Seller role line:** neutral `Publicado por el propietario` / `Listed by the owner` (NOT the mock's fabricated "Propietaria · Responde en ~1 h").
- **Placeholder caption:** generic mono `[ foto ]` (the DB has no per-listing caption to fill the mock's `[ foto: … ]`).
- **Result-count "en Asunción":** keep the accurate `${n} propiedades` (no "en Asunción") — live data spans Paraguay, not only Asunción. Intentional divergence for accuracy.
- **Message URL:** use the real working detail URL on our domain (`${SITE}/propiedad/${slug}`), not the mock's aspirational `/p/CL-XXXX` (that route does not exist; CL-slug migration is Track B).
- **Nav tabs (Comprar/Alquilar):** keep them functional (they drive the filter), do not make them the mock's inert dual-highlighted decorations.
- **Map popup:** keep the current rich image-card popup (pairs with detail-page navigation).

---

## Task 1: Shared helpers — pluralization, zone title-case, placeholder caption, CL-ref, phone normalize

**Files:**
- Modify: `lib/ui.js` (add helpers + change `noImg`)
- Reference: `Casa Libre Listings.html` (`.ph` caption), `Casa Libre Detalle.html` (`normalizePy`)

**Interfaces produced (consumed by Tasks 2, 5, 6, 8, 9, 10):**
- `plural(n, sing, plur)` → returns `sing` when `n === 1`, else `plur`.
- `bedWord(n, lang)` → es `dormitorio`/`dormitorios`, en `bedroom`/`bedrooms`; and `bedAbbr(lang)` → es `dorm`, en `bd` (abbr has no plural form in the mock).
- `bathWord(n, lang)` → es `baño`/`baños`, en `bath`/`baths`.
- `parkWord(n, lang)` → es `cochera`/`cocheras`, en `parking space`/`parking spaces` (abbr `coch.`).
- `titleCaseZone(s)` → locale-aware title case with accents preserved (`VILLA MORRA` → `Villa Morra`, `CAPIATA` stays as stored but each word capitalized: `Capiata`; accents already present are preserved).
- `clRef(idOrSlug)` → `"CL-" + <numeric id zero-padded to 4>` when the id is numeric; else `"CL-" + <slug uppercased, non-alnum stripped, first 6>`.
- `normalizePy(phone)` → digits-only wa.me format string (595-prefixed).
- `noImg` in `T.es`/`T.en` changed to the bracket caption.

- [ ] **Step 1: Add helper functions to `lib/ui.js`** (append after the existing `shortUsd` export, before EOF):

```js
// --- Singular/plural + label helpers (audit #11) ---
export const plural = (n, sing, plur) => (Number(n) === 1 ? sing : plur);
export const bedWord = (n, lang) =>
  lang === 'en' ? plural(n, 'bedroom', 'bedrooms') : plural(n, 'dormitorio', 'dormitorios');
export const bedAbbr = (lang) => (lang === 'en' ? 'bd' : 'dorm');
export const bathWord = (n, lang) =>
  lang === 'en' ? plural(n, 'bath', 'baths') : plural(n, 'baño', 'baños');
export const parkWord = (n, lang) =>
  lang === 'en' ? plural(n, 'parking space', 'parking spaces') : plural(n, 'cochera', 'cocheras');

// --- Zone title-case (audit #12). Locale-aware; preserves existing accents. ---
export const titleCaseZone = (s) => {
  if (!s) return '';
  return String(s)
    .toLocaleLowerCase('es-PY')
    .replace(/\b([\p{L}])([\p{L}]*)/gu, (_, a, b) => a.toLocaleUpperCase('es-PY') + b)
    .trim();
};

// --- Internal CL ref for tracking + display (audit #5 UI side) ---
export const clRef = (idOrSlug) => {
  const s = String(idOrSlug ?? '');
  if (/^\d+$/.test(s)) return 'CL-' + s.padStart(4, '0');
  const cleaned = s.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
  return 'CL-' + (cleaned || '0000');
};

// --- Paraguay phone normalize to wa.me digits (matches Detalle.html normalizePy) ---
export const normalizePy = (phone) => {
  const d = String(phone ?? '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('595')) return d;
  if (d.startsWith('0')) return '595' + d.slice(1);
  return '595' + d;
};
```

- [ ] **Step 2: Change the placeholder caption (audit #21)** in `lib/ui.js`. In `T.es` change `noImg: 'Foto próximamente',` → `noImg: '[ foto ]',`. In `T.en` change `noImg: 'Photo coming soon',` → `noImg: '[ photo ]',`. (The striped 45° hatch is already correct via `.cl-hatch`; only the caption text changes.)

- [ ] **Step 3: Verify** — `npm run build` succeeds. Confirm the new exports resolve (grep `plural`, `titleCaseZone`, `clRef`, `normalizePy` importable). No visual change yet on any page.

- [ ] **Step 4: Commit**

```bash
git add lib/ui.js
git commit -m "feat(ui): shared pluralization, zone title-case, CL-ref, phone-normalize helpers + [ foto ] placeholder caption (audit #11/#12/#21)"
```

---

## Task 2: Landing — copy, stats, CTA, Tres pasos (audit #8, #9, #22, #23)

**Files:**
- Modify: `components/LandingClient.js`
- Reference: `Casa Libre Landing.dc.html`

**Interfaces consumed:** none new. **Produces:** nav CTA routes to `/publicar`; stats array is 3 items.

- [ ] **Step 1: Remove the fabricated 4.9★ stat (audit #8).** In `LandingClient.js` the `es` DICT (~line 26) and `en` DICT (~line 50) each contain a stat entry `{ v: '4.9★', l: 'rating de usuarios' }` / `{ v: '4.9★', l: 'user rating' }`. **Delete that entry from both** so the stats array has three items: `[count+, 0%, Al instante]` (es) / `[count+, 0%, Instant]` (en). Do not touch the `0%` or the instant-publish stat.

- [ ] **Step 2: Nav CTA → "Publicar gratis" routing `/publicar` (audit #22).** Change `navCta` in the `es` DICT (~line 11) from `'Empezar →'` to `'Publicar gratis'`, and in the `en` DICT (~line 35) from `'Get started →'` to `'List for free'`. Then find the nav CTA `<Link>` (~line 97) whose `href` is `/propiedades` and change it to `href="/publicar"`. **Keep `<AuthButton/>` in the nav** (user decision — it is the account control, not a duplicate CTA).

- [ ] **Step 3: Rewrite Tres pasos steps 2–3 around WhatsApp/phone (audit #23).** In the `es` DICT (~lines 20–22) and `en` DICT (~lines 44–46), replace the step 2 and step 3 objects. Step 1 stays. Use exactly:

es:
```js
steps: [
  { n: '1', t: 'Contanos qué buscás', d: 'Barrio, presupuesto, cantidad de dormitorios. Cuate te muestra solo lo que vale la pena.' },
  { n: '2', t: 'Contactá al publicador', d: 'Escribile por WhatsApp o llamá directo desde el aviso. Sin intermediarios ni vueltas.' },
  { n: '3', t: 'Cerrá el trato a tu manera', d: 'Coordinás la visita y la operación directamente con quien publica. Vos manejás los tiempos.' },
],
```
en:
```js
steps: [
  { n: '1', t: "Tell us what you're after", d: 'Neighborhood, budget, bedrooms. Cuate only shows you what\'s worth your time.' },
  { n: '2', t: 'Contact the publisher', d: 'Message them on WhatsApp or call straight from the listing. No middlemen, no runaround.' },
  { n: '3', t: 'Close the deal your way', d: 'Arrange the visit and the deal directly with whoever posted it. You set the pace.' },
],
```
(Match the existing `steps` property name/shape in the file; if the keys differ, adapt the field names but keep this copy. No "Agendá online", no "Contrato digital", no legal-contract promise.)

- [ ] **Step 4: Exact-text nits.** (a) Hero EN sub (~line 37): change `…homes in Paraguay.` → `…homes in Asunción.` to match the reference. (b) Mascot `alt` (~line 127): `"Casa Libre"` → `"Cuate, la mascota de Casa Libre"` (audit #6 alt-text requirement). (c) Hero chips (~line 32/56): change the 5 chip labels to the reference set `['Villa Morra','Carmelitas','Recoleta','Las Mercedes','Barrio Jara']` (same in es/en).

- [ ] **Step 5: Verify** — `npm run build`; open `/` beside `Casa Libre Landing.dc.html`. Checklist: exactly 3 stats, no "4.9★" anywhere; nav CTA reads "Publicar gratis" and links to `/publicar`; account button still present; steps 2–3 read the WhatsApp/phone copy; EN hero sub says "Asunción"; chips are the 5 reference barrios.

- [ ] **Step 6: Commit**

```bash
git add components/LandingClient.js
git commit -m "fix(landing): remove 4.9★ stat, nav CTA→Publicar gratis /publicar, rewrite Tres pasos to WhatsApp/phone, hero/chip/alt text (audit #8/#22/#23/#6)"
```

---

## Task 3: Landing — pixel parity (letter-spacing, sizes, mobile collapse)

**Files:**
- Modify: `components/LandingClient.js`
- Reference: `Casa Libre Landing.dc.html` (`<style>` + `@media(max-width:720px)` block)

**Interfaces:** none. Pure CSS-class edits. Use Tailwind arbitrary values (`tracking-[-0.02em]`, `max-[720px]:…`) — no `tailwind.config.js` change needed (JIT supports both).

- [ ] **Step 1: Letter-spacing corrections.** Apply these exact from→to on the listed elements:

| Element | Current class | Change to | Ref |
|---|---|---|---|
| CTA block h2 (~L178) | `tracking-display` (−0.045em) | `tracking-[-0.04em]` | ref CTA h2 −0.04em |
| Card price (~L146) | `tracking-head` (−0.03em) | `tracking-[-0.02em]` | ref card price −0.02em |
| Stat value (~L169) | `tracking-head` (−0.03em) | `tracking-[-0.02em]` | ref stat value −0.02em |

Leave hero h1 at `tracking-display` (−0.045em is correct) and wordmark/section h2 at `tracking-head` (−0.03em correct).

- [ ] **Step 2: Hero h1 size + mobile cap.** Current (~L104) is `text-[clamp(40px,7.5vw,92px)]`. Change the min to 46px and add the mobile override: `text-[clamp(46px,7.5vw,92px)] max-[720px]:text-[clamp(38px,11vw,52px)]`.

- [ ] **Step 3: Mascot width.** Current (~L127) `w-[clamp(220px,28vw,420px)] max-w-[70vw]` → `w-[clamp(220px,32vw,420px)] max-w-[76vw]` (keep the mobile `max-[720px]:w-[132px] max-[720px]:max-w-[40vw]`; add it if missing).

- [ ] **Step 4: Spacing nits.**

| Element | Current | Change to |
|---|---|---|
| Listings header margin-bottom (~L134) | `mb-8` (32px) | `mb-[30px]` |
| How-it-works section padding (~L156) | `py-16` (64px) | `py-[60px]` |
| How-it-works h2 margin-bottom (~L157) | `mb-9` (36px) | `mb-[34px]` |
| Chip vertical padding (~L121) | `py-1.5` (6px) | `py-[7px]` |
| Search button horizontal padding (~L112) | `sm:px-7` (28px) | `sm:px-[clamp(18px,3vw,30px)]` **only if it compiles**; if the arbitrary clamp fails to compile, use `sm:px-[30px]` |

- [ ] **Step 5: Mobile section collapse (≤720px).** Add these arbitrary responsive classes:
  - Listings section (~L133): add `max-[720px]:py-10 max-[720px]:rounded-t-[24px]` (40px padding, 24px top radius) alongside the existing `py-14 rounded-t-section`.
  - How-it-works section (~L156): add `max-[720px]:py-10`.
  - CTA section (~L175): add `max-[720px]:py-10`.
  - Hero sub margin (~L107): ensure mobile is 24px — set `mb-7 md:mb-9 max-[720px]:mb-6` (24px).

- [ ] **Step 6: Card count 3 (mock parity).** The featured feed is sliced in `app/page.js` (`featured = …slice(0,6)`). Change `slice(0, 6)` → `slice(0, 3)` so the landing shows 3 cards like the mock. (This also aligns with audit #1's "hand-curate the homepage feed" spirit — fewer, cleaner cards.)

- [ ] **Step 7: Verify** — `npm run build`; at ≤720px width the hero h1 caps at 52px, sections use 40px vertical padding, listings block top radius is 24px; 3 cards render; letter-spacing on price/stat/CTA visually tighter-but-not-too-tight matches the mock.

- [ ] **Step 8: Commit**

```bash
git add components/LandingClient.js app/page.js
git commit -m "style(landing): pixel parity — letter-spacing, hero h1 46/52, mascot 32vw, mobile 720px collapse, 3 featured cards"
```

---

## Task 4: Landing footer — single footer + contact email (audit #10)

**Files:**
- Modify: `app/page.js` (remove the second footer), `components/LandingClient.js` (add email to the CTA footerLine), `components/Footer.js` (fix wordmark class bug for the pages that still use it)
- Reference: `Casa Libre Landing.dc.html` (single mono footer line)

**Interfaces:** none.

- [ ] **Step 1: Remove the double footer.** In `app/page.js`, the page renders both `<LandingClient/>` (which already contains the mono `footerLine`) and a separate `<Footer/>`. **Remove the `<Footer/>` element and its import from `app/page.js` only.** Do NOT delete `Footer.js` — other marketing routes still use it. After this, the landing page has exactly one footer (the CTA-block mono line).

- [ ] **Step 2: Add the contact email to the landing footer line.** In `LandingClient.js`, `footerLine` (es ~L31, en ~L55) currently reads `© ${year} Casa Libre · www.casa-libre.com · Asunción PY · Términos · Privacidad`. Change to include the email:
  - es: `© ${year} Casa Libre · hola@casa-libre.com · www.casa-libre.com · Asunción PY · Términos · Privacidad`
  - en: `© ${year} Casa Libre · hola@casa-libre.com · www.casa-libre.com · Asunción PY · Terms · Privacy`
  (Keep `www.casa-libre.com` as the domain; the wordmark `casa-libre.py` is NOT used as contact identity here — compliant.)

- [ ] **Step 3: Fix the Footer.js wordmark class bug** (for the other pages that render it). In `Footer.js` (~L41) the wordmark has conflicting classes `font-serif not-italic italic font-normal`. The `.py` should be serif italic. Correct the wordmark markup so the base wordmark is `font-bold` (Space Grotesk) and only the `.py` span is `font-serif italic font-normal` — mirror the working pattern in `LandingClient.js` nav (`casa-libre<em className="font-serif italic font-normal not-italic:false">.py</em>` → use the exact working form from LandingClient's wordmark). Also ensure the mega-footer identity uses `hola@casa-libre.com`, not `casa-libre.py`, as contact (audit #10 applies site-wide).

- [ ] **Step 4: Verify** — `npm run build`; open `/`: exactly one footer, mono line shows `hola@casa-libre.com`; open one marketing route that uses `Footer.js` (e.g. `/comprar`) — its wordmark `.py` renders italic-serif, no doubled footer regression.

- [ ] **Step 5: Commit**

```bash
git add app/page.js components/LandingClient.js components/Footer.js
git commit -m "fix(footer): single footer on landing + hola@casa-libre.com contact, fix Footer wordmark italic (audit #10)"
```

---

## Task 5: Marketplace — filter taxonomy + rental price buckets (audit #20)

**Files:**
- Modify: `components/MarketplaceClient.js`, `lib/propertyType.js` (classifier buckets)
- Reference: `Casa Libre Listings.html` (filter structure) + audit #20 for the required real types

**Interfaces consumed:** none. **Produces:** a type filter whose options cover the real DB taxonomy; a price filter that switches to ₲/mes ranges when `filter === 'alquiler'`.

- [ ] **Step 1: Expand the type filter options.** In `MarketplaceClient.js`, the `m` dict `types` (es ~L15, en ~L24) currently offers only `{all, depto, casa, duplex, comercial, terreno}`. Add the missing real types so each is individually selectable. New option set (keys → labels):

es: `{ all:'Tipo: todos', casa:'Casa', depto:'Departamento', duplex:'Dúplex', terreno:'Terreno', comercial:'Local comercial', oficina:'Oficina', deposito:'Depósito', edificio:'Edificio', condominio:'Condominio', campo:'Campo', otro:'Otro' }`
en: `{ all:'Type: all', casa:'House', depto:'Apartment', duplex:'Duplex', terreno:'Lot', comercial:'Commercial', oficina:'Office', deposito:'Warehouse', edificio:'Building', condominio:'Condo', campo:'Rural land', otro:'Other' }`

(Keep `Dúplex`/`Terreno`→`Lot` as shown — these are accurate labels; the mock's un-accented "Duplex" is a mock artifact, and accurate ES spelling governs.)

- [ ] **Step 2: Update the `typeOf` classifier** so each new filter key maps 1:1 to the real DB types instead of folding them away. In `MarketplaceClient.js` `typeOf(l)` (~L55–63) — and/or `lib/propertyType.js` — return the granular bucket:
  - `casa` ← casa; `depto` ← departamento; `duplex` ← dúplex/duplex; `terreno` ← terreno/loteamiento/lote; `comercial` ← local comercial/comercial; `oficina` ← oficina; `deposito` ← depósito/deposito/galpón; `edificio` ← edificio; `condominio` ← condominio/barrio cerrado; `campo` ← campo/estancia/chacra; `otro` ← everything unmatched (incl. `inmueble productivo`, `hotel`, `propiedad`).
  The filter then compares `typeOf(l) === selectedTypeKey` (with `all` = no filter). Every listed option must actually match at least the DB label it names.

- [ ] **Step 3: Rental price buckets in ₲/mes (audit #20).** The price filter (`m.price` es ~L16 / en ~L25) is USD-only. Make it mode-aware:
  - When `filter === 'alquiler'`, render ₲/mes buckets and filter on the guaraní monthly value (`l.pyg`):
    - es: `{ all:'Precio: todos', p1:'Hasta ₲ 3 M/mes', p2:'₲ 3 – 6 M/mes', p3:'Más de ₲ 6 M/mes' }`
    - en: `{ all:'Price: any', p1:'Under ₲ 3 M/mo', p2:'₲ 3 – 6 M/mo', p3:'Over ₲ 6 M/mo' }`
    - thresholds: p1 `< 3_000_000`, p2 `3_000_000..6_000_000`, p3 `> 6_000_000` (guaraníes/month).
  - Otherwise (venta / todas) keep the existing USD buckets (`Hasta US$ 100k` etc.) filtering on `usdVal(l)`.
  Implement by selecting the bucket set + the value accessor from `filter`, so the dropdown labels and the filter predicate switch together. Reset the selected price bucket to `all` when the user flips between venta/alquiler (avoid a stale USD bucket applied to ₲ data).

- [ ] **Step 4: Verify** — `npm run build`; at `/propiedades`: the Tipo dropdown lists Casa/Departamento/Dúplex/Terreno/Local comercial/Oficina/Depósito/Edificio/Condominio/Campo/Otro and each selection actually filters; flip to "Alquiler" — the Precio dropdown relabels to ₲/mes buckets and filters rentals correctly; flip back to "Venta" — USD buckets return and the bucket resets to "todos".

- [ ] **Step 5: Commit**

```bash
git add components/MarketplaceClient.js lib/propertyType.js
git commit -m "feat(marketplace): full type taxonomy filter + ₲/mes rental price buckets (audit #20)"
```

---

## Task 6: Marketplace — card/text pluralization, title-case, placeholder, pixel nits (audit #11, #12, #14, #21)

**Files:**
- Modify: `components/MarketplaceClient.js` (imports from `lib/ui.js`)
- Reference: `Casa Libre Listings.html`

**Interfaces consumed:** `plural, bedWord, bedAbbr, bathWord, parkWord, titleCaseZone` from `lib/ui.js` (Task 1); `noImg` change (Task 1).

- [ ] **Step 1: Import helpers.** At the top of `MarketplaceClient.js`, add `titleCaseZone, bedAbbr, bathWord, parkWord, plural` to the existing `lib/ui.js` import.

- [ ] **Step 2: Fix meta pluralization (audit #11).** In `meta(l)` (~L109), replace the fixed `` `${l.baths} ${m.bath}` `` and cochera plurals with the helpers:
```js
const parts = [];
if (l.area) parts.push(`${l.area} m²`);
if (l.baths) parts.push(`${l.baths} ${bathWord(l.baths, lang)}`);
if (l.parking) parts.push(`${l.parking} ${parkWord(l.parking, lang)}`);
return parts.join(' · ');
```
(Result: `1 baño`, `2 baños`, `1 cochera`.)

- [ ] **Step 3: Fix title composition (audit #11 beds + mock "Depto" abbreviation + #14 fallback).** In `title(l)` (~L103–108): (a) use `bedAbbr(lang)` for the beds token with a plain space, not ` · `, before it, matching the mock (`Depto 2 dorm · Villa Morra`); (b) abbreviate Departamento → `Depto` for the title type token only; (c) when type is unknown, fall back to `Inmueble` (es) / `Property` (en) — **not** the literal `Propiedad` (audit #14 says unknowns become "Inmueble" only after inference fails). Compose as `` `${typeToken} ${l.beds} ${bedAbbr(lang)} · ${zone}` `` when beds exist, else `` `${typeToken} · ${zone}` ``.

- [ ] **Step 4: Title-case the zone (audit #12).** Wherever the card renders `l.neighborhood || l.city` (title + any zone chip, ~L106), wrap it: `titleCaseZone(l.neighborhood || l.city)`.

- [ ] **Step 5: Card tag text.** The mode tag currently reads `En venta`/`En alquiler`. Match the mock's bare labels: change `forSale`/`forRent` usage on the card tag to `Venta`/`Alquiler` (es) and `For sale`/`For rent` (en). (Update the strings the card tag reads; the mode chips above the list keep `Venta`/`Alquiler` already.)

- [ ] **Step 6: Empty-state + result-count text.** (a) Empty state (`m.empty` es ~L14 / en ~L23): the mock is `Sin resultados — probá con otro barrio` / `No results — try another neighborhood`. Keep the current "o filtro"/"or filter" suffix ONLY if you judge it more helpful; to match the mock exactly, drop the suffix. **Match the mock** (drop suffix). (b) Result count stays `${n} propiedades` (decision — no "en Asunción").

- [ ] **Step 7: Pixel nits.**

| Element | Current | Change to | Ref |
|---|---|---|---|
| Card price letter-spacing (~L305) | `tracking-head` (−0.03) | `tracking-[-0.02em]` | −0.02em |
| Nav CTA weight/pad/border (~L236) | `px-[22px] font-semibold` no border | `px-[18px] font-medium border border-ink` | ref `.pill.active` 500/18px/1px |
| Nav tab pills weight (~L223/225) | verify | `font-medium` (500) | ref 500 |
| Card body bottom padding (~L304) | `py-3.5` (14 both) | `pt-3.5 pb-4` (top 14, bottom 16) | ref 14/16 |
| Select `pr` (~L213) | `pr-8` (32) | `pr-[30px]` | ref 30 |
| Map attribution (~L122) | `attributionControl:false` | `attributionControl:true` + tile `attribution:'© OpenStreetMap contributors'` | ref shows attribution |
| Map initial view (~L121) | `setView([-25.29,-57.6],12)` | `setView([-25.293,-57.60],13)` | ref center/zoom (fitBounds still overrides on data) |

- [ ] **Step 8: Verify** — `npm run build`; at `/propiedades`: a 1-bath listing shows `1 baño`; a `VILLA MORRA` zone renders `Villa Morra`; unknown type shows `Inmueble · …` not `Propiedad`; placeholder cards show mono `[ foto ]`; card price tighter (−0.02em); nav CTA has the 1px border + 500 weight; OSM attribution visible on the map.

- [ ] **Step 9: Commit**

```bash
git add components/MarketplaceClient.js
git commit -m "fix(marketplace): pluralization, zone title-case, Inmueble fallback, [ foto ] caption, tag/empty text, pixel nits (audit #11/#12/#14/#21)"
```

---

## Task 7: Publicar — pixel + copy parity, archive dead pricing strings

**Files:**
- Modify: `components/PublicarClient.js`
- Reference: `Casa Libre Publicar.dc.html`

**Interfaces:** none. **Keep** the added functional fields (Ciudad, Tu nombre, WhatsApp/teléfono, currency select, upload/validation) — they are required for real listings and satisfy contact-presence. **Do NOT** add Plan/Pago steps, tiers, Stripe, IVA, or any "48 hs"/verification copy.

- [ ] **Step 1: Pixel nits.**

| Element | Current | Change to | Ref |
|---|---|---|---|
| H1 letter-spacing (~L224) | `tracking-display` (−0.045) | `tracking-[-0.04em]` | ref −0.04em |
| H1 line-height (~L224, ~L297) | `leading-[1.05]` / `leading-[1.03]` | remove the `leading-*` class (browser default) | ref uses default |
| Subtitle margin-bottom (~L225) | `mb-8` (32) | `mb-[34px]` | ref 34 |
| Mode toggle margin-bottom (~L226) | `mb-6` (24) | `mb-[26px]` | ref 26 |
| Input vertical padding (~L83) | `py-[13px]` | `py-[14px]` | ref 14 |
| Dropzone padding (~L271) | `p-[26px]` | `p-[34px]` | ref 34 |
| Footer nav padding-top (~L312) | `pt-6` (24) | `pt-[26px]` | ref 26 |
| Publish button horizontal pad (~L313) | `px-8` (32) | `px-[28px]` | ref 28 |
| Content wrapper padding-bottom (~L210) | `pb-24` (96) | `pb-[90px]` | ref 90 |

- [ ] **Step 2: Copy nit.** ES type option 3 (~L14): keep `Dúplex` (accurate ES) — this is the accented-spelling decision, matching Task 5. No change. (The mock's "Duplex" is a mock artifact; accurate ES governs, consistent with the filter.)

- [ ] **Step 3: Archive dead pricing/payment strings.** `PublicarClient.js` DICT (~L21–33) still holds unused `s2Title, s2Sub, tierNames, tierFeats, popularLabel, pickLabel, s3Title, s3Sub, sumTitle, sumPlanLabel, sumDurLabel, dur, payBtn, testCard, payError, initError, loadingPay, needLogin, publishError`. Since nothing renders them and they encode paid-tier/Stripe/verification copy the free-launch rule forbids, **delete these keys from the DICT** (both es and en). Keep only keys that are actually rendered by the current 2-step flow (Detalles + confirmation). Verify by grepping each key for a JSX usage before deleting; if a key IS used (e.g. `needLogin`, `publishError` may be used by the publish handler), keep those and delete only the tier/payment/verification-copy ones.

- [ ] **Step 4: Verify** — `npm run build` (no "unused/undefined" errors from deleted keys — confirm none are referenced); open `/publicar`: H1 letter-spacing/line-height, dropzone padding 34px, input padding 14px visually match; no tier/price/Stripe/"48 hs" text anywhere; confirmation screen still shows instant-publish copy + REF.

- [ ] **Step 5: Commit**

```bash
git add components/PublicarClient.js
git commit -m "style(publicar): pixel parity to reference + remove dead paid-tier/Stripe/verification strings (free-launch)"
```

---

## Task 8: Detalle — rebuild the WhatsApp contact card to the reference (audit #24, #26)

**Files:**
- Modify: `components/PropertyContactCard.js` (major rewrite), `components/PropertyDetailView.js` (pass the new props: seller phone/name, listing id/slug for CL-ref + URL)
- Reference: `Casa Libre Detalle.html` (contact card `.contact`, lines ~133–168; `msg()` ~218/231; toasts ~327–344)

**Interfaces consumed:** `normalizePy`, `clRef` from `lib/ui.js` (Task 1). **Produces:** a contact card matching the reference's 8 sub-elements; the WhatsApp message in the locked Spanish format; a report link + toast. (Event wiring is Task 9 — this task builds the UI and the message; Task 9 attaches `track()` calls to the handlers created here.)

- [ ] **Step 1: Replace the `T` dictionary** in `PropertyContactCard.js` with the full reference string set (fixing the EN hint to include the "pre-written in Spanish" clause, and using the neutral seller role):

```js
const T = {
  es: {
    owner: 'El propietario',
    role: 'Publicado por el propietario',
    nameLbl: 'Tu nombre (opcional)', namePh: 'Ej: Carlos',
    msgLbl: 'Tu mensaje',
    msgHint: 'Se abre en WhatsApp — podés editarlo antes de enviar.',
    wa: 'Hablar por WhatsApp', call: 'Llamar', copy: 'Copiar número', copied: 'Número copiado',
    fine: 'Nunca envíes señas ni transferencias sin visitar la propiedad y verificar el título.',
    report: '¿El publicador no responde? Reportá este aviso',
    reported: 'Gracias — reporte recibido',
    noContact: 'Sin contacto disponible',
    // ALWAYS Spanish, both languages. Optional buyer name. Locked format.
    msg: (name, url) => `¡Hola${name ? `, soy ${name.trim()}` : ''}! ¿Sigue disponible esta propiedad?\n${url}`,
  },
  en: {
    owner: 'The owner',
    role: 'Listed by the owner',
    nameLbl: 'Your name (optional)', namePh: 'E.g. Carlos',
    msgLbl: 'Your message',
    msgHint: 'Opens in WhatsApp — pre-written in Spanish, the local language. You can edit it before sending.',
    wa: 'Chat on WhatsApp', call: 'Call', copy: 'Copy number', copied: 'Number copied',
    fine: 'Never send deposits or transfers without visiting the property and verifying the title.',
    report: 'Publisher not responding? Report this listing',
    reported: 'Thanks — report received',
    noContact: 'No contact available',
    // The outgoing message is ALWAYS Spanish regardless of UI language.
    msg: (name, url) => `¡Hola${name ? `, soy ${name.trim()}` : ''}! ¿Sigue disponible esta propiedad?\n${url}`,
  },
};
```

- [ ] **Step 2: Add state + derived values.** The component signature becomes `PropertyContactCard({ sellerName, waDigits, url, listingRef, trackProps })` (add `listingRef` — the `CL-xxxx` string from the parent). Inside:
```js
const [lang] = useLang();
const [name, setName] = useState('');
const [copied, setCopied] = useState(false);
const [reported, setReported] = useState(false);
const t = T[lang] || T.es;
const displayName = sellerName || t.owner;
const initial = displayName.trim().charAt(0).toUpperCase() || '?';
const message = T.es.msg(name, url);          // always Spanish; buyer name feeds it live
const waUrl = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(message)}` : null;
```

- [ ] **Step 3: Rebuild the card body** to include all reference sub-elements in order: seller header (avatar + name + **role**) → **name label + name input** (updates `name` state, maxLength 40) → **message label + live preview box** (renders `message`, `whitespace-pre-line`) → **message hint** → WhatsApp button → call + copy row → **anti-scam fine print** → **report link**. Use the reference styles exactly. Key values: card `1.5px solid #111` / radius 18 / shadow `5px 4px 0 #111`; seller name `font-bold` (weight **700**, not 600); role `font-mono text-[11px] text-ink/50`; name input + preview box `bg-paper border border-ink/30 rounded-[14px]`; msg-preview `text-[13px] px-3.5 py-3`; hint `font-mono text-[10.5px] text-ink/45`; btn-wa `px-[18px] py-[13px]` (13/18, not 12/16), `bg-[#25D366] border-[1.5px] border-ink rounded-pill shadow-[4px_4px_0_#111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#111]`; fine print `font-mono text-[10.5px] text-ink/50 text-center`; report link `underline text-ink/45 text-[11px]`. Keep the existing WhatsApp SVG glyph (byte-identical — do not change it) and the call/copy SVGs.

- [ ] **Step 4: Copy + report handlers (UI only; events added in Task 9).**
```js
const copyNumber = async () => {
  try { await navigator.clipboard.writeText(`+${waDigits}`); } catch { /* ignore */ }
  setCopied(true); setTimeout(() => setCopied(false), 1800);
};
const onReport = (e) => {
  e.preventDefault();
  setReported(true); setTimeout(() => setReported(false), 2600);
};
```
Render the copied feedback as the button-label swap (existing pattern) and the report confirmation as a small inline toast/line reading `t.reported` while `reported` is true. Keep the `noContact` disabled fallback when `waDigits` is empty (but still render the report link — a contactless listing is exactly what "report unresponsive" is for).

- [ ] **Step 5: Parent wiring.** In `PropertyDetailView.js`, where `<PropertyContactCard .../>` is rendered, pass `listingRef={clRef(l.id ?? l.slug)}` (import `clRef` from `lib/ui.js`) and ensure `url` is the real detail URL `${SITE}/propiedad/${l.slug}`. Replace the parent's inline phone-normalization with the shared `normalizePy(l.contact_phone)` for `waDigits` (import from `lib/ui.js`) so the mobile bar and the card use one implementation.

- [ ] **Step 6: Verify** — `npm run build`; open a detail page beside `Casa Libre Detalle.html`. Checklist: card shows seller name (bold-700) + neutral role; typing a name updates the live message preview to `¡Hola, soy <name>! ¿Sigue disponible esta propiedad?` + URL; with empty name the preview is `¡Hola! ¿Sigue disponible esta propiedad?` + URL; the message is Spanish even with EN toggle on (EN hint mentions "pre-written in Spanish"); WA button padding 13/18 with active shadow shrinking to 2px; fine print + report link present; clicking report shows "Gracias — reporte recibido" and does not navigate.

- [ ] **Step 7: Commit**

```bash
git add components/PropertyContactCard.js components/PropertyDetailView.js
git commit -m "feat(detalle): rebuild WhatsApp contact card to reference — name input, live preview, hint, fine print, report link + locked Spanish message (audit #24/#26)"
```

---

## Task 9: Detalle — wire the four distinct contact events (audit #25)

**Files:**
- Modify: `components/PropertyContactCard.js` (attach events to the handlers from Task 8), `components/PropertyDetailView.js` (mobile-bar WA event), optionally `lib/analytics.js` (only if a named-event helper is desired — the generic `track()` is sufficient)
- Coupled edit: `casa-libre-adminPortal/app/(dashboard)/analytics/page.js` — add the four event names to the `EVENT_LABELS`/`PRODUCT_EVENTS` map so they render in the admin analytics.

**Interfaces consumed:** `track` from `lib/analytics.js`; `listingRef` prop (Task 8).

- [ ] **Step 1: Replace the legacy event on the desktop WhatsApp button.** In `PropertyContactCard.js`, the WA `<a onClick={...}>` currently fires `track('contact_seller_clicked', …)`. Change it to:
```js
onClick={() => track('contact_whatsapp_click', { ref: listingRef, ...(trackProps || {}) })}
```

- [ ] **Step 2: Add the call event.** On the `tel:` call `<a>` add:
```js
onClick={() => track('contact_call_click', { ref: listingRef, ...(trackProps || {}) })}
```

- [ ] **Step 3: Add the copy event.** In `copyNumber()` (after the clipboard write, before/after setting `copied`) add:
```js
track('contact_copy_click', { ref: listingRef, ...(trackProps || {}) });
```

- [ ] **Step 4: Add the report event.** In `onReport(e)` (after `preventDefault`, before the toast) add:
```js
track('report_unresponsive', { ref: listingRef, ...(trackProps || {}) });
```

- [ ] **Step 5: Wire the mobile sticky-bar WhatsApp button.** In `PropertyDetailView.js`, the `.mbar` WA link (~L207) is currently a plain `<a>` with no tracking. Add `onClick={() => track('contact_whatsapp_click', { ref: <clRef>, ... })}` using the same `clRef` computed for the card, so desktop and mobile WA taps both fire `contact_whatsapp_click`. Import `track` if not already imported. Remove any remaining `contact_seller_clicked` usage on this page. (Note: `components/PropertyContactButton.js` also fires `contact_seller_clicked` but appears unused on the detail page — confirm it is not rendered; if unused, leave it for a later dead-code pass, do not wire it.)

- [ ] **Step 6: Admin analytics labels (coupled edit).** In `casa-libre-adminPortal/app/(dashboard)/analytics/page.js`, add the four events to the label/known-event maps (mirror the existing entries' shape), e.g.:
```js
contact_whatsapp_click: 'WhatsApp tap',
contact_call_click: 'Call tap',
contact_copy_click: 'Copy number',
report_unresponsive: 'Report unresponsive',
```
and include them in `PRODUCT_EVENTS` so they appear in the product-events KPI list. Match the existing key/label style in that file exactly.

- [ ] **Step 7: Verify** — `npm run build` in the buyer portal AND the admin portal. In the buyer portal, click each control and confirm (via PostHog debug / network) that `contact_whatsapp_click` (desktop + mobile), `contact_call_click`, `contact_copy_click`, and `report_unresponsive` each fire once with `{ ref: 'CL-xxxx', … }`; no `contact_seller_clicked` fires from the detail page. In the admin analytics page, confirm the four new labels render.

- [ ] **Step 8: Commit** (two repos)

```bash
# buyer portal
git add components/PropertyContactCard.js components/PropertyDetailView.js
git commit -m "feat(detalle): distinct contact events contact_whatsapp_click/call/copy + report_unresponsive with CL ref (audit #25)"
# admin portal (separate repo)
cd ../casa-libre-adminPortal && git add "app/(dashboard)/analytics/page.js" \
 && git commit -m "feat(analytics): label the four Casa Libre contact events (audit #25)"
```

---

## Task 10: Detalle — page-body pixel/text parity (ref format, gallery tiles, message URL)

**Files:**
- Modify: `components/PropertyDetailView.js`
- Reference: `Casa Libre Detalle.html`

**Interfaces consumed:** `clRef` from `lib/ui.js`.

- [ ] **Step 1: CL ref format in kicker + pub-meta.** The current ref is `CL-<slug first-6 uppercased>` (~L52). Replace with `clRef(l.id ?? l.slug)` so numeric ids render as `CL-0002` (mock format). Use this same value for the kicker (`{modeLabel} · {ref}`), the pub-meta `Ref …`, and the mobile-bar `Ref …`.

- [ ] **Step 2: Gallery tile count.** `tiles = imgs.slice(0,4)` but only 3 `<Tile>` are rendered (~L144–146). Render up to 4 tiles to match the reference grid (`main + 3`): map over `tiles` (indices 0–3) instead of hardcoding three. Keep the `2fr 1fr` / `180px 180px` grid and the `max-[720px]:[grid-template-columns:1fr_1fr]` mobile rule. Keep the existing lightbox enhancement (user kept navigation/enhancements).

- [ ] **Step 3: Views chip in pub-meta (only if data exists).** The reference pub-meta has three items (`Publicado …`, `N vistas`, `Ref …`); the current page renders two. If the listing object exposes a view count, add the middle `N {vistas|views}` chip (`font-mono text-[11px] text-ink/45`); if no view-count field exists in the data model, **skip this step and note it** — do not fabricate a number. (View counts are a Track C/analytics concern.)

- [ ] **Step 4: Nav CTA weight.** The detail nav CTA "Publicar gratis" is `font-semibold` (600); the reference `.pill.active` is weight 500. Change to `font-medium`. (Consistency with Task 6 marketplace nav.)

- [ ] **Step 5: Specs rail bottom margin.** The `.specs` block uses `my-[18px]`; the reference is `18px 0 24px` (top 18, bottom 24). Change to `mt-[18px] mb-6` (24px bottom).

- [ ] **Step 6: Verify** — `npm run build`; on a detail page: ref reads `CL-0002`-style for numeric ids; the gallery shows up to 4 tiles; nav CTA weight matches; specs bottom spacing 24px; message URL in the WA link is the real `/propiedad/<slug>` on our domain.

- [ ] **Step 7: Commit**

```bash
git add components/PropertyDetailView.js
git commit -m "style(detalle): CL-xxxx ref format, 4 gallery tiles, nav CTA weight, specs spacing parity"
```

---

## Self-Review (completed by author)

**Spec coverage — every buyer-portal audit item mapped to a task:**
- #6 Cuate/alt-text → Task 2 (already largely done; alt-text added). #7 48hs → already done (verified in divergence audit; no task needed). #8 4.9★ → Task 2. #9 count → Task 2 (keep dynamic). #10 footer+email → Task 4. #11 pluralization → Tasks 1+6 (+ Landing card meta uses same helpers — see note). #12 zone title-case → Tasks 1+6. #14 Propiedad→Inmueble → Task 6. #20 filters → Task 5. #21 placeholder → Tasks 1+6. #22 nav CTA → Task 2. #23 Tres pasos → Task 2. #24 contact card → Task 8. #25 events → Task 9. #26 report link → Task 8. Pixel-parity across all four pages → Tasks 3, 6, 7, 8, 10.
- **Note (Landing card pluralization):** the landing listing cards also render bed/bath counts. If `LandingClient.js` composes card meta with fixed plural nouns, apply the same `bathWord/bedWord/parkWord` helpers there as a sub-step of Task 3 (added to the visual checklist). If Landing reuses the marketplace `title()/meta()`, Task 6 already covers it.
- **Out of scope (Tracks B/C/D — separate plans):** #1–#5, #5b, #13, #15 (ingest/data-integrity/FX), #16–#18, #32 (SEO/config), #27–#31 (AI classify/screen, admin consolidation, registry, public-access — public access already satisfied). #19 resolved (comparar stays).

**Placeholder scan:** No "TBD"/"handle edge cases"/"add validation" placeholders — every step names exact files, exact from→to values, and exact strings. Where a value depends on data availability (views chip), the step says explicitly to skip-and-note rather than fabricate.

**Type/name consistency:** helper names (`plural, bedWord, bedAbbr, bathWord, parkWord, titleCaseZone, clRef, normalizePy`) are defined in Task 1 and consumed by name in Tasks 3/6/8/9/10. The contact-card prop set (`sellerName, waDigits, url, listingRef, trackProps`) is defined in Task 8 and used consistently in Task 9. Event names match the audit and CLAUDE.md exactly.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-20-buyer-portal-ui-audit.md`. Two execution options:

1. **Subagent-Driven (recommended)** — a fresh implementer subagent per task, a spec+quality review between tasks, a whole-branch review at the end.
2. **Inline Execution** — execute the tasks in this session with checkpoints for review.

Which approach?
