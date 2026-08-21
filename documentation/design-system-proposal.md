# ISU-GeoBot — Visual Redesign Proposal

**Status: approved and implemented.** This document is kept as the record of
what was proposed and agreed. It is not edited to match later decisions —
amendments are listed below instead, so the design history stays readable.

---

## Amendments since approval

### A1 — Monochrome replaced by Dark (19 Aug 2026)

The second theme is now **Dark**, not Monochrome. Section C's Monochrome
palette, and the Monochrome references in §F and the open questions, are
superseded.

**What changed and why.** Monochrome was proposed as a hueless light theme whose
purpose was partly demonstrative: switching to it proved the availability status
never depended on colour. That property is still required, but it no longer
needs a whole theme to carry it — status is distinguished by icon, label and
type weight in both themes, and the tokens are checked against every ground.

The system signal changed with it. Monochrome was resolved from
`prefers-contrast: more`, an inference standing in for a preference nobody could
express. Dark is resolved from `prefers-color-scheme`, which is the literal
question.

**What Dark is not.** Not an inversion, not a filter, and not the neon/glass
aesthetic the original redesign removed. The ground is a very dark desaturated
green-grey rather than neutral charcoal or pure black; the accent is the same
institutional green lifted to `#6FAF8E`, which is where it has to sit to be
legible on that ground. Every text token is verified against
`--surface-raised`, the lightest ground any of them can land on — the lowest
ratio in the theme is 5.00:1.

The basemap follows: `cartocdn/dark_all` rather than a grayscale filter over the
day tiles.

### A2 — Category colour added to map pins (19 Aug 2026)

§F specified markers distinguished by "shape + letterform, not colour alone".
Pins now carry a category colour as well, as teardrops with a white centre disc.

The rule that mattered is intact and is now stated more precisely: **colour
reinforces, it never carries.** Every pin, chip, card and legend swatch that
paints a category colour also draws the category letter, and the letter sits in
a white disc with near-black ink so it is legible whatever the body colour is —
in either theme. Nothing on the map is identified by hue alone.

### A3 — Workspace is no longer a split pane (19 Aug 2026)

§F's "split preserved (map left, chat right)" no longer holds. The map is the
full window; the assistant is a docked bubble that opens a compact panel; the
campus index is a permanent left column above `md` and a drawer below it.

---

Working from the live codebase (`web/`, 4,091 lines, 27 files) rather than a
Markdown export, so the inventory below is measured, not estimated.

---

## What is actually wrong (measured)

| Symptom | Count | Diagnosis |
|---|---|---|
| `card` class | 31 uses | Every content group is a rounded translucent box. This is the single biggest "AI-generated" tell. |
| `aurora` blobs | 7 | Decorative, communicates nothing |
| `tilt` / `tilt-glare` / `scene` | 17 | Pointer 3D on static content |
| `ring-glow`, `shine`, `text-gradient` | 8 | Ornament |
| `animate-float`, `parallax`, `grid-floor` | 6 | Motion without meaning |
| `CampusField.jsx` | 197 lines | 3D node field — pure decoration |
| Hardcoded `ink-*` / `brand-*` classes | 294 | No token layer; themes impossible |
| Leaflet basemap | `cartocdn/dark_all` | Dark-first, must change |

The problem is not the palette. **Recoloring these onto white would still look
AI-generated**, exactly as you predicted. The fix is deleting most of the boxes
and rebuilding hierarchy from type, rule and space.

---

## A. Visual direction

The honest metaphor for this product is the **cartographic document** — survey
drawings, transit diagrams, architectural plans, academic journals. They share a
grammar:

- hairline rules instead of filled containers
- generous, uneven margins; a visible measure
- ink on paper, not light on glass
- **color as notation, never as decoration** — a surveyor's drawing uses red
  because red *means* something
- typography carries hierarchy; nothing floats

Applied here:

| Principle | Consequence |
|---|---|
| **Paper, not glass** | Warm ivory ground. No blur, no translucency, no glass. |
| **Rules, not boxes** | `card` count drops 31 → ~8. Elevation only where something genuinely floats: menu, dialog, map popup, toast. |
| **Near-square corners** | radius 2–4px. Pills only for status indicators, where the shape *is* the semantic. |
| **Color is notation** | Green marks the institution and primary action. Amber/red are status only. A section does not get a tint because it is a section. |
| **Asymmetry** | Editorial 12-column grid with deliberate off-centre compositions, not centred stacks. |
| **Ink discipline** | Three text weights, three text tones. That is the whole palette for 90% of the UI. |

**One deliberate through-line:** a fine 8px coordinate grid and hairline rules
appear as structural elements across the product — the hero, section dividers,
the map, table headers. It reads as survey drafting and it ties marketing to
workspace. It is drawn in CSS, costs nothing, and is not animated.

---

## B. Color tokens

Semantic names only. Both themes fill the same tokens; no component ever names a
hue.

### Light (default)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#FBFAF8` | page ground, warm ivory |
| `--bg-sunken` | `#F4F2EE` | recessed areas, table headers |
| `--surface` | `#FFFFFF` | genuine panels |
| `--surface-raised` | `#FFFFFF` + shadow | menu, dialog, popup |
| `--text` | `#16181C` | primary |
| `--text-muted` | `#5C6068` | secondary |
| `--text-subtle` | `#8A8F98` | metadata, captions |
| `--border` | `#E4E1DB` | hairline rules |
| `--border-strong` | `#CFCBC3` | input borders, active dividers |
| `--accent` | `#1F5D45` | deep institutional green |
| `--accent-hover` | `#174936` | |
| `--accent-subtle` | `#EDF3F0` | selected row, active nav |
| `--accent-contrast` | `#FFFFFF` | text on accent |
| `--success` | `#2E6B4F` | |
| `--warning` | `#8A5A16` | warm amber, dark enough for body text |
| `--error` | `#9B2C2C` | |
| `--info` | `#2C5578` | muted slate-blue, functional only |
| `--focus` | `#1F5D45` | 2px ring, 2px offset |
| `--shadow-sm` | `0 1px 2px rgba(20,22,26,.06)` | |
| `--shadow-md` | `0 4px 16px -4px rgba(20,22,26,.10)` | menus |
| `--shadow-lg` | `0 12px 32px -8px rgba(20,22,26,.16)` | dialogs |

`#1F5D45` is a forest/institutional green — it reads as a university crest, not
as a terminal prompt. Nothing fluoresces.

### Monochrome

| Token | Value |
|---|---|
| `--bg` | `#FCFCFC` |
| `--bg-sunken` | `#F2F2F2` |
| `--surface` | `#FFFFFF` |
| `--text` | `#0A0A0A` |
| `--text-muted` | `#55555A` |
| `--text-subtle` | `#86868A` |
| `--border` | `#E2E2E2` |
| `--border-strong` | `#C4C4C4` |
| `--accent` | `#0A0A0A` (black *is* the accent) |
| `--accent-subtle` | `#F0F0F0` |
| `--accent-contrast` | `#FFFFFF` |

**Decision to confirm — monochrome status indicators carry no hue at all.**

You allowed colored accents "where absolutely necessary for semantic status".
I want to go further and use none, differentiating the three availability states
by **icon + label + tonal weight** (filled black / outlined / muted gray).

The reason is not aesthetic. §15 requires status to be readable without color for
colorblind users. If Monochrome mode is genuinely hueless, then **switching to it
is a live proof that the status system never depended on color** — it becomes an
accessibility test you can demonstrate in the defense room rather than a claim.
Semantic *alerts* (error/warning banners) keep a single desaturated hue, because
those are transient and carry an icon anyway.

---

## C. Typography

### Families

| Role | Face | Rationale |
|---|---|---|
| Display & section headings | **Source Serif 4** | A serif headline over a sans body is the single fastest way to read "editorial institution" instead of "AI startup". ~34KB woff2, latin subset. |
| UI, body, controls | **Inter** | Already loaded. Excellent at small sizes, wide numerals. |
| Data | `ui-monospace` | Coordinates, IDs, model versions, timestamps **only**. |

**Veto point:** if you would rather not add a second family, the fallback is
Inter throughout with display set at `-0.025em` tracking and weight 600 rather
than 800. It is good; it is just less distinctive. Say the word.

### Scale

| Token | Size / line-height | Tracking | Face |
|---|---|---|---|
| `display` | 56 / 1.02 | −0.02em | serif |
| `h1` | 40 / 1.08 | −0.018em | serif |
| `h2` | 30 / 1.16 | −0.014em | serif |
| `h3` | 21 / 1.30 | −0.008em | sans 600 |
| `body-lg` | 17 / 1.65 | 0 | sans |
| `body` | 15.5 / 1.65 | 0 | sans |
| `meta` | 13.5 / 1.5 | 0 | sans |
| `label` | 12.5 / 1.4 | +0.005em | sans 500 |
| `mono` | 13 / 1.5 | 0 | mono |

Display clamps down to 34px at mobile. Body never goes below 15px anywhere.

**Uppercase is retired** except for table column headers and one eyebrow per
section — currently it is on ~20 elements and it is a large part of why the UI
reads as templated.

---

## D. Component hierarchy

Three tiers. Everything consumes tokens; no component names a hue.

**Primitives** (`components/ui/`)
`Button` · `IconButton` · `Input` · `Textarea` · `Select` · `Radio` · `Checkbox`
· `Field` · `Rule` · `Badge` · `StatusIndicator` · `Table` · `Menu` · `Dialog`
· `Tooltip` · `Skeleton` · `Alert` · `Toast` · `EmptyState` · `ThemeToggle`

**Button hierarchy** (replaces `btn-primary` / `btn-ghost`):
`primary` (filled accent) · `secondary` (bordered) · `tertiary` (tinted) ·
`text` · `destructive` · `icon`. Sizes `sm | md | lg`. Every variant gets hover,
active, focus-visible, disabled and loading states.

**Patterns** (`components/patterns/`)
`PageHeader` · `SectionHeader` · `PortalShell` · `AuthCard` · `FilterBar` ·
`DataList` · `KeyValue` · `Stepper` · `BoundaryDiagram` · `MapPicker`

**Views** — the existing 22 components, rewritten against the above.

---

## E. Landing page structure

| Section | Redesign |
|---|---|
| **Nav** | Brand · section links · **Portals** menu (unchanged behaviour) · **theme toggle** · `Launch Assistant`. Mobile becomes a full-height sheet grouped Product / Research / Portals / Appearance. |
| **Hero** | Asymmetric 7/5 split. Left: serif display headline, one paragraph, two CTAs, scroll cue. Right: a **static SVG campus schematic** — building footprints, a route polyline, hairline coordinate grid, three labelled markers. Drawn from real POI geometry, no animation, no canvas. `CampusField.jsx` is deleted. |
| **Problem** *(new)* | Editorial spread: scattered artefacts (a printed map, a departmental timetable, an office door sign) set against the question a student actually has. Type-led, no cards. |
| **Solution** *(new)* | One line: map + institutional knowledge + availability intelligence → one assistant. A single wide diagram. |
| **RAG comparison** | Query selector as a segmented control. Two columns separated by a vertical rule — not two tinted cards. Enhanced is marked by a thin accent rule and a label, nothing more. Context-fusion breakdown becomes an inline definition list. |
| **Architecture** | Horizontal 7-stage stepper, **defaulting to `Query Routing`** (currently opens mid-pipeline on `mask` — a real bug). Connectors drawn. Detail panel below on mobile, beside on desktop. Technologies grouped Frontend / Backend / Data / ML / AI. |
| **Privacy** | The strongest section. A full-width three-band editorial diagram: `PRIVATE INTERNAL DATA` → `STATUS MASKING` → `SAFE USER-FACING INFORMATION`, with the boundary as a heavy horizontal rule. The six safeguard cards become a two-column prose list. |
| **Campus / POI** | A **location index** — alphabetised, ruled rows, category filters, coordinates in mono, optional 40×40 schematic thumbnail. Reads as a gazetteer, not a product grid. |
| **Research** | Two-column editorial: metadata list left, objectives and evaluation roadmap right. Empty evaluation state stays and gets a proper explanation. |
| **Footer** | Ruled, multi-column, restrained. Academic notice retained verbatim. |

---

## F. Workspace structure

Split preserved (map left, chat right), with a real header bar.

**Map**
- Basemap → `cartocdn/light_all`; Monochrome applies `filter: grayscale(1)` to
  the tile pane. One line of CSS, no extra provider, no API key.
- Markers redrawn: small precise pins, category by **shape + letterform**, not
  colour alone. Selected state gets a ring and a label.
- Persistent legend, search, category filter as a compact toolbar — not floating
  translucent panels over the map.
- Popups: white, square, hairline border, typographic.
- `flyTo` retained (that is meaningful motion).

**Chat**
- Answer gets visual primacy: larger measure, generous leading.
- Sources collapse to a single ruled line — expandable, not five icon rows.
- Status indicator sits above the answer as a bordered block, never a floating chip.
- Suggestion chips → text buttons on a ruled row.
- Loading → contextual skeleton with the stage being executed, replacing dots.
- Empty state explains what the assistant can and cannot answer.
- **New:** clear-conversation action (§14).

---

## G. Portal structure

Shared `PortalShell` (header, breadcrumb, content measure) with per-portal
identity carried by **one accent detail and the header lockup only** — same
family, different room.

| Portal | Identity | Key changes |
|---|---|---|
| **Faculty** `/validate` | Academic | Two-panel opposition made unmistakable: *What the system estimated* ▸ *What actually happened*, joined by a labelled connector. Correct / Partially / Incorrect get plain-language explanations. History gets pagination + tooltips. Privacy controls become a bordered section, visually trustworthy. |
| **Guard** `/guard` | Operational | Ops dashboard: summary strip (total faculty, logged today, recent changes), search, department filter. **Arrival and Departure stop having equal weight** — Arrival is secondary, Departure is destructive-styled and requires confirmation. Tri-state remains explicit. |
| **Admin** `/admin` | System management | The 431-line form is split into fieldsets: Identity / Location / Description / Provenance / Publishing. **Map picker added** — coordinates render a live marker preview for visual verification. POI list gets search + filter. |
| **Logins** | Per-portal | One `AuthCard`; contextual heading, icon and one-line purpose per portal. Adds password visibility toggle, inline validation, proper focus. Demo credentials stay clearly labelled. |

---

## H. Interaction principles

| Rule | Value |
|---|---|
| Durations | 120ms (state) · 180ms (menu/tooltip) · 240ms (dialog/page) · 600ms (map flyTo) |
| Easing | `cubic-bezier(.2,0,0,1)` entering · `cubic-bezier(.4,0,1,1)` exiting |
| Scroll reveal | Retained but reduced: 12px rise, 400ms, opacity+transform only, **once**, no stagger beyond 3 items |
| Deleted | tilt, glare, float, aurora drift, conic borders, shine sweeps, perspective floor, node field, gradient text |
| Focus | `:focus-visible` only, 2px accent ring + 2px offset, never removed |
| Hover | Never the sole affordance; every hover state has a focus equivalent |
| Touch targets | ≥44px |
| Reduced motion | Transforms → 0, opacity retained, `flyTo` → `setView` |

Motion budget: **at most one animated property per interaction.**

---

## I. Untouched

No file outside `web/src` is modified. Specifically preserved:

- **Routes** — `/`, `/app`, `/guard`, `/validate`, `/admin`, catch-all
- **All API calls** in `lib/api.js` — signatures and payloads unchanged
- **Auth** — `lib/supabase.js`, `PortalLogin` behaviour, demo session handling
- **Portals menu** behaviour just built (dropdown, Escape, outside-click, mobile)
- **Map ↔ chat coordination** — `poiFocus` → `flyTo`, `?poi=` deep link
- **Demo-mode safeguards** — banner stays impossible to miss, `[DEMO]` prefixes,
  placeholder badges, demo-account labelling
- **Research integrity** — no metrics invented; empty evaluation state stays
  empty; no confidence values, probabilities, room numbers or locations surfaced
- **Status logic** — the three thesis states, the estimate qualifier, the
  freshness timestamp
- **Server, ML, DB** — entirely untouched

---

## Open questions

1. **Serif display face** — add Source Serif 4, or stay all-Inter?
   *Recommend: add it. It is the strongest single anti-"AI template" signal.*
2. **Monochrome status = zero hue?**
   *Recommend: yes. It turns colorblind-safety into a demonstrable property.*
3. **Demo banner** — I will make it a slim ruled bar with a warning icon,
   persistent, high contrast, but no longer a filled amber slab. Confirm that
   still meets your "impossible to miss" bar.
4. **Accent green `#1F5D45`** — confirm, or supply the official ISU colour if
   there is one you would rather anchor to.

## Proposed sequence

1. Tokens, theme provider, Tailwind config, base CSS
2. UI primitives + patterns
3. Nav, Footer, DemoBanner, StatusChip, Loading
4. Landing
5. Workspace (map + chat)
6. Portals (faculty, guard, admin, logins)
7. Responsive + accessibility + consistency pass

Each stage builds and runs, so you can look at it as it lands rather than
receiving one large drop.
