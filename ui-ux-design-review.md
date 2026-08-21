# ISU-GeoBot — UI/UX Review Document

This document describes every screen and component in the current system, what each one does, what it looks like now, and honest notes on what could be improved. Give this to ChatGPT and ask it to suggest specific design improvements.

---

## Design System (global)

**Color palette — dark theme only**
- Background: `ink-950` (#020617) — near-black
- Surface / cards: `ink-900` (#0F172A) with `backdrop-blur`
- Borders: `white/10` (very subtle)
- Body text: `ink-100` (#F1F5F9)
- Muted text: `ink-400` (#94A3B8), `ink-600` (#475569)
- Brand / accent: `brand-500` (#10B981) — emerald green
- Brand light: `brand-400` (#34D399)

**Typography**
- Font: Inter (sans-serif), ui-monospace for code/labels
- Section headings: `text-3xl sm:text-4xl font-bold tracking-tight text-white`
- Eyebrow labels: `text-xs font-semibold uppercase tracking-[0.18em] text-brand-400`

**Components**
- `.card` — `rounded-2xl border border-white/10 bg-ink-900/60 backdrop-blur`
- `.btn-primary` — emerald green, `bg-brand-500 text-ink-950`, shadow glow on hover
- `.btn-ghost` — bordered, `border-white/15`, subtle hover
- `.chip` — pill badge, `rounded-full border px-3 py-1 text-xs`

**Motion**
- Scroll-reveal: elements fade up from 26px below, 720ms ease
- Stagger: children delay by `var(--i) * 70ms`
- 3D tilt cards with pointer-tracking glare effect
- Aurora blobs (blurred radial gradients, drifting slowly)
- Parallax perspective floor grid in hero
- Floating animation on hero cards
- Shine sweep on hover for primary buttons
- Animated conic border ring on hover

---

## Page: Landing (`/`)

**Layout:** Single-page scroll with sections stacked vertically. Nav is sticky at top.

### Nav
- Sticky, `bg-ink-950/70 backdrop-blur` (transparent variant on landing, solid elsewhere)
- Left: Compass icon + "ISU-GeoBot" logo text
- Right (desktop): anchor links (Architecture, Privacy, Research) + "Launch Assistant" primary button
- Right (mobile): hamburger menu toggling a dropdown panel
- **Missing:** No links to portals (validate, guard, admin) — this is currently being added

### Hero section
**Visual layers (back to front):**
1. Three aurora blobs (green, sky blue, emerald) — slowly drifting
2. 3D animated node field (`CampusField` canvas component)
3. Perspective floor grid (scrolling, tilted)
4. Radial vignette overlay for text contrast
5. Copy (centered, staggered reveal)
6. Two floating tilt cards

**Copy:**
- Chips row: "Enhanced RAG Architecture", "Privacy-Preserving AI", "ISU Echague Main Campus"
- H1: "Find your way around campus" + gradient line "and know before you go."
- Subtext: brief system description
- Two CTAs: "Launch Assistant" (primary) + "Explore Campus Map" (ghost)
- Two specimen cards below: one showing a navigation query, one showing a faculty availability StatusChip

**Current issues:**
- The two CTAs sit side by side but "Explore Campus Map" scrolls to the POI grid section, not the actual map — slightly confusing
- Hero is visually very busy (5 layers) — on slower machines or mid-range phones this may feel heavy
- "and know before you go." gradient text is catchy but vague about what "know" means
- No indication of who this is for (students? visitors?) until you read the subtext

### DemoWidget section
**Purpose:** Side-by-side comparison of Standard RAG vs Enhanced RAG responses to the same query.

**Layout:**
- Section heading + description
- Row of query picker buttons (curated list from API)
- "Run comparison" primary button
- After running: two-column result cards (Standard | Enhanced) + Context Fusion breakdown metrics

**Standard card:** plain border, white title
**Enhanced card:** brand-tinted border, slightly scaled up (`scale-[1.02]`), "this study" chip

**Fusion breakdown:** three metric tiles showing chunks retrieved, status injected (yes/no), total context items

**Current issues:**
- If API is down, shows an amber warning box — good, but the rest of the section looks empty
- The query picker buttons are unlabelled beyond the query text itself — no hint what category they represent (navigation vs availability)
- "Run comparison" button gives no hint of expected wait time (can be 3-5s)
- On mobile, the two result columns stack vertically which is fine, but there's no visual separator between them

### Architecture section
**Purpose:** Interactive pipeline walkthrough — click a stage to see its detail.

**Layout:** Two columns
- Left: vertical pipeline list (7 stages, numbered, with icon + title + mono tag)
- Right: sticky detail panel (title, description, "Design note" box)
- Active item highlighted with brand tint and slight translate
- Bottom: tech stack chip row (13 technologies)

**Stages:** Query Routing → Presence Override → Random Forest → Status Masking Boundary → Retrieval → Context Fusion → Response Generation

**Current issues:**
- Default active stage is "mask" (Status Masking Boundary, stage 4) — jumps the user straight to the middle. Stage 1 (Query Routing) would be more logical as default
- The connecting vertical line on the left rail is decorative but doesn't animate with the active state
- Tech stack chips at the bottom have no grouping (frontend vs backend vs ML) — 13 items in a flat row is overwhelming
- Detail panel uses `lg:sticky` which only sticks on desktop — on mobile/tablet you scroll past it before reading it

### PoiGrid section
**Purpose:** Display campus buildings and points of interest with category filter.

**Layout:**
- Heading + description
- Category filter pill buttons (All, College, Administrative, etc.)
- 3-column card grid (responsive: 1 col mobile, 2 col tablet, 3 col desktop)
- Each card: icon, name, department, description (2-line clamp), "Locate on map" link

**States:** Loading (skeleton pulse), Ready, Empty (no locations yet), Error

**Current issues:**
- Placeholder data shows amber "placeholder data" chip on each card — correct behavior but means the grid looks visually noisy in demo mode
- "Locate on map" navigates to `/app?poi=ID` — good, but there's no preview of where on campus this is (no mini-map thumbnail)
- Cards are uniform height due to line-clamp — looks clean but descriptions get cut off mid-sentence

### Privacy section
**Purpose:** Explain the ethical/privacy design — what crosses the masking boundary vs what stays inside.

**Layout:**
- Heading + subtext
- Split tilt card: "Stays inside the server" (left) vs "Crosses to LLM and user" (right)
- 6-card grid of safeguards (icons + title + description)
- Small legal disclaimer at bottom

**The boundary card:**
- Left side (dark): lists raw classifier output, probability distribution, schedule rows, guard entries, feature vectors
- Right side (brand-tinted): lists the three status strings only

**Current issues:**
- The split card is the most important visual on the page but it's easy to scroll past — no visual weight drawing attention to it
- Safeguard cards are text-heavy for a marketing/presentation context
- The legal disclaimer at the bottom is in `text-ink-600` (very muted) — it contains important info about what "RA 10173 compliance" means vs doesn't mean

### Research section
**Purpose:** Academic context — who built this, what the study is, evaluation status.

**Layout:** Two columns
- Left: study description, key-value metadata table (researchers, degree, college, institution, design)
- Right: 4 research objectives as cards + evaluation status card

**Evaluation status card:** shows empty state ("No evaluation results yet") until real runs exist.

**Current issues:**
- Left column metadata table uses `text-ink-600` for labels — very hard to read
- Objectives are verbatim thesis text — dense and academic, not scannable
- The empty evaluation state card is honest but visually dead — a progress indicator or timeline showing "what comes next" would be more informative

### Footer
**Layout:** 3 columns
- Left: logo + tagline
- Middle: "Portals" links (Assistant, Security Presence Dashboard, Faculty Portal, Campus Location Manager)
- Right: Academic notice (research prototype disclaimer)
- Bottom bar: evaluation status note + copyright

**Current issues:**
- All four portal links are visible in the footer to every visitor — guard and admin links are operational tools that most users will never need
- Footer links use `text-ink-400` with no hover underline — easy to miss as links

---

## Page: App / Workspace (`/app`)

**Layout:** Full-height split pane
- Left panel (wider, ~53%): Campus Map
- Right panel (~47%): Chat Interface
- Mobile: tab switcher (Assistant | Campus Map) at top

### Campus Map
- Leaflet.js map, dark-styled tiles
- Pins for all campus POIs
- Clicking a pin shows a popup
- When chatbot mentions a building, map flies to it and highlights the pin
- Map controls (zoom) styled to match dark theme

**Current issues:**
- No legend explaining what the different pin colors/types mean
- No search/filter on the map itself — you have to use the chat to find a building
- Map fills the full height which is good on desktop, but on mobile it's just the tab panel
- Popup content is minimal — just name, no description preview

### Chat Interface
- Header: Compass icon + "Campus Assistant" title + subtitle ("Enhanced RAG · grounded in university documents")
- Message history: user messages right-aligned (brand green bubble), assistant messages left-aligned (dark card)
- Loading state: three pulsing dots
- Suggestion chips (shown only when conversation is empty): 4 example questions
- Input: text field + send button
- Footer disclaimer: "Availability is a schedule-derived estimate, not a confirmed observation…"

**Message card features:**
- StatusChip shown above answer text when availability was returned
- Source list shown below answer (document titles)
- Clarification buttons when query matches multiple faculty (e.g., "Prof. Santos — Dept A", "Prof. Santos — Dept B")
- Copy button on each assistant message

**Current issues:**
- No session persistence — refreshing the page clears the conversation
- No conversation context — each query is standalone, pronouns ("her office") don't resolve
- The chat header subtitle says "Enhanced RAG" always, even though the pipeline mode isn't something users control — slightly technical jargon for a general user
- Source list shows document titles only, no excerpt or relevance indicator
- Suggestion chips disappear after the first message and never return — no way to see example queries again
- No character count shown in input (max 500)
- No "clear conversation" button
- On mobile, switching to the map tab and back loses scroll position in chat

---

## Page: Guard Portal (`/guard`)

**Access:** Login required. Demo: `guard@demo.local / demo`

**Layout:**
- Nav + DemoBanner
- Login screen (PortalLogin component) if not authenticated
- After login: full presence dashboard

### Login Screen (shared PortalLogin component)
- Centered card: icon + title + description + email/password form
- Demo mode: amber box showing demo credentials
- Non-demo: note that accounts are researcher-provisioned
- No self-registration (by design)

**Current issues:**
- All four portals use identical login UI — no visual differentiation between "faculty logging in" vs "guard logging in" beyond the title text
- Password field has no "show/hide" toggle
- No "forgot password" link (by design for a controlled study, but confusing for users)

### Presence Dashboard
- Header: title + description + Refresh + Sign out buttons
- Search bar to filter faculty list
- Faculty roster cards, each showing:
  - Name + department
  - Status chip (On campus / Departed / No log today) with last event time
  - Arrival and Departure buttons
- Help card at bottom explaining why "No log today" is its own state

**Status styles:**
- On campus: brand green border/background
- Departed: neutral dark
- No log today: amber

**Current issues:**
- Arrival/Departure buttons are the same visual weight — easy to tap the wrong one, no confirmation dialog
- No undo — tapping Departure and then immediately Arrival is the correction mechanism, which is correct by design (append-only), but not explained to the user in the moment
- Search only filters by name — no filter by department
- If a faculty member has many log entries today, there's no way to see the history from this view
- No indication of how many faculty have been logged today vs total roster

---

## Page: Faculty Validation Portal (`/validate`)

**Access:** Login required. Demo: `faculty@demo.local / demo`

**Layout:**
- Nav + DemoBanner
- Login screen if not authenticated
- After login: two-column layout + history table

### Validation View
**Left column (system estimate):**
- Shows what ISU-GeoBot currently estimates for the logged-in faculty member
- StatusChip with code + label + timestamp
- Note if override was applied (guard log used instead of classifier)
- Empty state if classifier not trained yet

**Right column (ground truth form) — spans both rows:**
- Radio buttons for actual status (one per status option)
- Three correctness buttons: Correct / Partially / Incorrect
- Optional notes textarea (max 500 chars)
- "Record entry" submit button
- Success/error message

**Below the grid:**
- PrivacyControls component (right to object / pause participation)
- Personal entry history table: time, estimated status, actual status, correctness result, matrix inclusion flag
- Footer note explaining that accuracy is computed only at end of evaluation period

**Current issues:**
- The two-column layout doesn't make it obvious the form on the right is for submitting ground truth about the left panel's estimate — the relationship between the two panels isn't immediately clear
- No explanation of what "Partially correct" means for users who haven't read the thesis
- History table has no pagination — all entries in one scroll
- The "exclude from matrix" note appears as `(excl. matrix)` with no tooltip explaining what that means to a non-researcher
- Correctness buttons look like navigation tabs — could be confused with the status radio buttons above them

---

## Page: Admin / Location Manager (`/admin`)

**Access:** Login required. Demo: `admin@demo.local / demo`

**Layout:**
- Nav + DemoBanner
- Login screen if not authenticated
- After login: two-column layout (form left, POI list right)

### Location Manager
**Left column (sticky form):**
- "Add a new location" / "Edit location" heading
- Fields: name, type (dropdown), department (dropdown), latitude, longitude, building function, description, survey method (radio), data origin (real vs placeholder), featured checkbox, change note
- Survey method options: On-site GPS / Floor plan / Estimated / Not recorded
- Data origin: green "Real ISU data" vs amber "Placeholder" buttons
- Submit button

**Right column (POI list):**
- Count heading
- Cards showing: name, placeholder/estimated/unpublished chips, coordinates, department
- Edit button on each card

**Amber warning banner** if placeholder locations exist, with count and note that evaluation won't run until they're replaced.

**Current issues:**
- The form is long (11 fields) with no section grouping — identity fields, coordinates, content fields, and metadata fields are all in one vertical list
- Latitude/longitude are raw number inputs with no map picker — user has to know the exact coordinates
- No visual preview of where the coordinates place the pin on the map
- "Change note" field purpose isn't clear — it's for the audit trail but looks like an optional comment
- No bulk import option (not required, but means adding 20+ buildings one by one)
- The POI list on the right has no search/filter

---

## Shared Components

### DemoBanner
- Amber top banner: "Demonstration mode. Availability is produced by a deterministic schedule lookup…"
- Dismissible per session (X button)
- Reappears on page reload
- Shows on every page when `DEMO_MODE=true`

**Current issues:**
- Text is long and technical — most users won't read it fully
- Dismissing it doesn't persist across pages — if you navigate from `/` to `/app`, it reappears

### StatusChip
- Two variants: full (with icon, description, timestamp) and compact (pill with dot)
- Full variant shows: status label + "Estimated as of [time] · schedule-derived, not observed"
- Three status codes: `available` (green), `in_scheduled_class` (amber), `unavailable` (red/dark)

**Current issues:**
- Compact variant has no "estimated" qualifier — just the label and colored dot
- Timestamp says "as of [time]" but in demo mode this is a fake timestamp

### PortalLogin (shared across guard/validate/admin)
- Icon + title + description + email/password form
- Demo credential box (amber)
- No self-registration note

**Current issues:**
- Identical layout for all three portals — only the title/description/icon change
- No password visibility toggle
- Error messages appear below the form with no animation

### Loading
- (Not read but exists as a Suspense fallback) — likely a spinner or skeleton

---

## Summary of the Biggest UX Problems

In order of user impact:

1. **No portal navigation in the Nav** — faculty and guards have no way to find `/validate` or `/guard` without knowing the URL. Currently being fixed.

2. **Chat has no conversation memory** — pronouns don't resolve, context is lost between messages. Makes the chat feel primitive.

3. **Validation portal relationship unclear** — the two-column layout (system estimate | your ground truth) doesn't communicate that you're being asked to compare and judge the left panel.

4. **Admin form too long and unstructured** — 11 fields in one column with no grouping. Coordinate entry without a map picker is friction-heavy.

5. **Guard portal has no mistake safety** — Arrival/Departure buttons of equal weight, no confirmation, no undo explanation. One mis-tap logs the wrong event.

6. **Architecture section defaults to middle stage** — starts on stage 4 of 7, confusing for first-time visitors.

7. **Hero is visually overloaded** — 5 parallax layers + 2 tilt cards + aurora + floor grid. On lower-end hardware this may feel slow or distracting.

8. **Research section objectives are verbatim thesis text** — dense and academic. Not scannable for non-researchers visiting the landing page.

9. **DemoBanner doesn't persist across page navigation** — dismissing it on one page and navigating to another brings it back.

10. **No clear wayfinding for first-time users** — once you land on the homepage, the path to "I want to find a faculty member" vs "I want to find a building" isn't immediately obvious.
