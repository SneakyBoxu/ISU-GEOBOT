# Controlled Integration — Final Report

**Base system:** `C:\Users\Admin\Desktop\thesis-website` (ISU-GeoBot)
**Reference repository:** `https://github.com/SneakyBoxu/ISU-GEOBOT.git`
**Restore point:** commit `295149f` — *Snapshot before teammate integration*
**Date:** 19 August 2026

---

## ⚠ Read this section first — exposed credentials

This is not a consequence of the merge. It is a pre-existing condition the merge
uncovered, and it is the most urgent item in this document.

**1. A live Groq API key is published on GitHub.**
`chatbot.js:13` of the public reference repository contains a working
`gsk_wTgX…` key in plain text. The repository is public; I confirmed this with an
unauthenticated request. Anyone can bill against that key.

→ **Revoke it now** at <https://console.groq.com/keys>, then issue a new one.

**2. The same key, and a Supabase database password, are in this project's
`.env` files.**

| File | Contains |
|---|---|
| `server/.env` | the exposed `GROQ_API_KEY`, and the `SUPABASE_URL` of the reference project's instance |
| `web/.env` | `VITE_SUPABASE_URL` for the same project |
| `ml/.env` | a `DATABASE_URL` including the database password |

These files are correctly listed in `.gitignore` and are **not** committed — I
verified with `git ls-files`. Nothing was leaked *by this project*. But the key
they hold is already public, so it must be replaced in these files after you
rotate it.

**3. That Supabase project has row-level security switched off.**
`setup-supabase.sql:13` of the reference repository reads
`ALTER TABLE public.locations DISABLE ROW LEVEL SECURITY;`, and its anon key is
public. Anyone who reads the repository can read, edit and delete rows in that
table today.

→ Re-enable RLS on that project, or retire it. Do not point this system at it.

**4. `server/.env` had `DEMO_MODE=false`.** A dev server was running against
that third-party Supabase project when I started. I stopped it and restarted in
demo mode. Nothing in this integration requires that project, and nothing in it
now references it.

**No credential from the reference repository was copied into this codebase.**
Verified by scanning the full tree, excluding `node_modules` and `dist`.

---

## 1. Integration Summary

The two systems solve the same problem at different levels. The reference
project is a single-tier browser application: HTML, vanilla JS, a Supabase
client, and a Groq call, all running in the page. This system is three-tier —
React → Node/Express → Postgres, with a Python ML service — and its middle tier
exists to hold a privacy boundary that a browser-only design cannot hold.

So the merge took the reference project's **data and interaction ideas**, and
none of its architecture. Concretely:

**Imported**

1. **28 real ISU Echague campus locations.** The single highest-value asset in
   that repository: real names, real categories, real descriptions, real
   coordinates. They replace 8 placeholder locations. The map, the campus index
   and the assistant now all describe the actual campus.
2. **The `[LOCATION: id]` map-control protocol.** "Where is the library" now
   moves the map. Reimplemented server-side with the id validated against the
   database — see §6.
3. **Marker → assistant handoff.** Clicking a marker offers to ask the
   assistant about that building, pre-filling the question rather than sending
   it.
4. **A satellite basemap.** Useful on 355 hectares of largely unlabelled ground.
5. **A "Directions" deep link** in each marker popup.
6. **Real campus facts** in the system prompt (location, area, colleges,
   notable facilities), added without loosening any grounding constraint.
7. **A `sports` location category**, because the real campus has an oval and a
   covered court and folding them into "facility" loses a distinction the source
   data makes.

**Deliberately not imported**

- `supabase-config.js` — credentials in the browser
- `chatbot.js` wholesale — API key in the browser, no retrieval, no grounding,
  no masking
- `editor.html` / `editor.js` — insert, update and delete with **no
  authentication at all**. This is precisely what Rule 3 forbids.
- `setup-supabase.sql` — a schema with RLS disabled by design
- `index.html`, `style.css`, `app.js` wholesale — would have replaced the
  landing page and the workspace
- The FontAwesome CDN dependency — this system uses `lucide-react`
- Their model choice (`openai/gpt-oss-120b`). Thesis §3.7 names Llama 3.1 8B;
  swapping it would be an undisclosed deviation.

**Provenance decision (research integrity).** The reference repository states its
coordinates were "verified against Google Maps satellite imagery (2026)". Thesis
§3.4.1(a) specifies **on-site GPS mapping verified against physical landmarks**.
Satellite tracing is not that. Rather than quietly recording them as surveyed, a
new `survey_method` value `satellite_imagery` was added and every imported row
uses it. The gap stays visible in a SQL query, and closing it later is an update
rather than a re-import. `SETUP_STEPS.md` Phase 7 now describes exactly what
remains to be walked.

---

## 2. Files Changed

16 files, +520 / −88. No file was rewritten; every change is additive or a
localised edit.

| File | Change |
|---|---|
| `server/src/lib/prompt.js` | Campus facts; the campus gazetteer block; the `[LOCATION: id]` contract. The gazetteer is **excluded from `contextsForRagas`** — counting reference data as retrieved evidence would inflate context recall in both arms and corrupt the thesis's primary comparison. |
| `server/src/services/ragService.js` | `loadGazetteer()` (60 s cache, published locations only); `extractLocationTag()` (validate, strip, resolve); `poiFocus` now prefers a validated tag over the retrieved place-card. |
| `server/src/routes/index.js` | `slug` exposed on `GET /api/map/pois`; demo-mode notice corrected — it claimed campus data was placeholder, which stopped being true. |
| `server/src/routes/admin.js` | `sports` added to the `poiType` enum; `satellite_imagery` added to `surveyMethod`. |
| `server/src/services/poiService.js` | `slugify()` / `uniqueSlug()`; new locations get a slug automatically, so a location added through the portal is immediately addressable by the assistant. Slugs are **not** regenerated on rename. |
| `server/src/demo/data.js` | The 28 real locations, **generated from the migration SQL** by a script rather than hand-copied, so demo mode and the real database cannot drift. |
| `server/src/demo/db.js` | `like()` added to the query builder (needed by `uniqueSlug`). |
| `server/src/demo/index.js` | The stub LLM now emits `[LOCATION: …]` tags, so the protocol is demonstrable with no Groq key. |
| `web/src/components/app/CampusMap.jsx` | Plan/Satellite toggle; "Ask the assistant" and "Directions" in the popup; `sports` marker letter. Search and category filtering **moved out** to the campus index. Re-invalidates its size when the index collapses. |
| `web/src/components/app/Workspace.jsx` | Marker → assistant handoff (`ask()`), with a nonce so the same building can be asked about twice. Now owns the search/category state so the index and the markers cannot disagree, and adapts the split when the index is open. |
| `web/src/components/app/ChatInterface.jsx` | Accepts a `draft`; fills the box and places the cursor, **does not send**. Rebuilt as a conversation — assistant left with a mark, question right — and shows a "Shown on the map" row naming the location an answer moved to. |
| `web/src/components/admin/LocationManager.jsx` | `sports` category; "Traced from satellite imagery" survey method. |
| `web/src/lib/constants.js` | `sports` in `POI_CATEGORIES`. |
| `web/src/components/shared/DemoBanner.jsx` | Wording narrowed from "Synthetic data only" — see §7. |
| `ml/ingest.py` | Place-card ingestion now skips unpublished locations. Without this, re-running ingestion silently resurrected every location the portal had taken down. |
| `SETUP_STEPS.md` | Migration 003 added to Phase 1. Phase 7 rewritten: campus map data is no longer "waiting on request", and what remains is GPS verification. |

## 3. Files Added

| File | Purpose |
|---|---|
| `db/migrations/003_campus_locations.sql` | The 28 locations; adds `sports` and `satellite_imagery` to the check constraints; adds `slug` + unique index; unpublishes the synthetic locations and removes their place-cards. Idempotent — `on conflict (slug) do update`. |
| `docs/MERGE_ASSESSMENT.md` | The pre-implementation assessment: security findings, system comparison, merge map, target architecture, provenance and authorization decisions. |
| `web/src/components/app/LocationPanel.jsx` | The campus index: searchable, filterable list of every location, becoming a detail view with actions when one is selected. Slides over the map on `transform`, behind a permanent rail. |
| `web/src/components/app/ChatDock.jsx` | The floating bubble and its panel. Keeps `ChatInterface` mounted while closed so the conversation survives. |
| `web/src/components/app/markerGlyph.js` | The category-letter table, shared by the markers, the legend and the index, so the legend cannot drift from what it labels. |
| `server/tests/authorization.test.js` | 30 tests. Evidence for Rule 3. |
| `server/tests/locationProtocol.test.js` | 14 tests. Evidence that the assistant's map control is validated and read-only. |

## 4. Files Removed

**None.** Nothing was deleted from this system.

Within the database, migration 003 **unpublishes** the 8 synthetic placeholder
locations rather than deleting them, and removes their generated place-cards
from the retrieval corpus. Unpublishing was chosen over deletion because an
earlier evaluation run may have retrieved against those rows, and deleting them
would make that run unreproducible.

---

## 5. Architecture

Unchanged. The merge added no tier, no service and no data store.

```
Browser (React + Vite + Leaflet)
   │  fetch, bearer token
   ▼
Node / Express  ── the privacy boundary lives here ──────────────
   │   routeQuery → retrieve → [availability] → fuse → generate
   │                                             │
   │                                    extract + VALIDATE
   │                                    [LOCATION: id]  ← new
   │                                             │
   │   filterEgress → toChatDto (allowlist) → response
   ├──────────────► Python / Flask   embeddings, Random Forest
   └──────────────► Postgres / pgvector (Supabase, service_role, RLS forced)
                    Groq (Llama 3.1 8B) — server-side only
```

Where the imported behaviour sits:

- **Location data** → `geobot.poi`, the table that already existed. Not a second
  `locations` table. One source of truth, one audit trail, one RLS policy set.
- **Map control** → between generation and the egress filter, inside the server.
  The reference implementation parsed the tag in the browser and resolved it
  against a client-side array; here the resolution happens against the database.
- **Basemap, directions, marker handoff** → presentation only. No new data flows.

The `slug` column is the one schema addition. It exists because a language model
can reliably echo `university-library` and cannot reliably echo a UUID. It is an
external key; `id` remains the primary key.

---

## 6. Authorization

### The rule

> Map editing has exactly one authorized location: the Campus Location portal.
> Everyone else views and searches. The assistant may query map data and must
> never become a map administration interface.

### How it is enforced

**Server-side, at the endpoint.** Every mutating location route carries
`requireAuth` followed by `requireRole('admin', 'researcher')`:

```js
admin.post  ('/pois',             requireAuth, requireRole('admin','researcher'), …)
admin.patch ('/pois/:id',         requireAuth, requireRole('admin','researcher'), …)
admin.post  ('/pois/:id/unpublish', requireAuth, requireRole('admin','researcher'), …)
admin.post  ('/pois/:id/reindex', requireAuth, requireRole('admin','researcher'), …)
admin.get   ('/pois',             requireAuth, requireRole('admin','researcher'), …)
```

The public API exposes **`GET /api/map/pois` and nothing else** for locations.
There is no public POST, PATCH, PUT or DELETE on that path — not a hidden one,
not a disabled one. It does not exist.

Beneath that, Postgres row-level security is deny-by-default and `forced`, and
the `service_role` key is server-only. Hiding a button is not part of the
mechanism; the buttons are hidden as well, but that is courtesy, not security.

### Role names

Taken from this system, not invented. `db/migrations/002_roles_and_locations.sql`
defines: `student`, `faculty`, `guard`, `validator`, `researcher`, `admin`.
Map editing is `admin` + `researcher`.

### The assistant

The chat route imports no write path. Its only influence on map data is the
`[LOCATION: id]` tag, and that channel is constrained by construction:

- **It has no verb.** Its entire vocabulary is one identifier, and its entire
  effect is a map pan.
- **The id is validated against the database** before it has any effect. A model
  that invents `secret-vault` moves nothing; the proposal is logged and dropped.
- **Unpublished locations are absent from the gazetteer**, so retiring a
  location in the portal removes it from the assistant too.
- **The pattern accepts `[a-z0-9-]` only**, so path fragments, quotes and SQL
  fragments do not match at all.
- **The tag never reaches the user.** It is stripped before the egress filter
  and before the response DTO.

### Test results — the required cases

| # | Case | Expected | Result |
|---|---|---|---|
| 1 | Authorized user (`admin`) creates a location | success | ✅ 201, slug assigned, audit entry written |
| 2 | Authorized user edits a location | success | ✅ 200, audit entry written |
| 3 | Authorized user deletes (unpublishes) a location | success | ✅ 200, audit entry written |
| 4 | Regular user (`student`) edits a location | denied | ✅ 403 |
| 5 | Regular user deletes a location | denied | ✅ 403 |
| 6 | Chatbot attempts an unauthorized modification | denied | ✅ 5 injection attempts; every location intact afterwards |
| 7 | Direct endpoint call with no authorization | denied | ✅ 401 on all four mutating routes; 401 on a forged token |

Cases 4 and 5 are additionally run for the `guard` and `faculty` roles. After
every denied attempt the suite re-reads the location table and asserts nothing
changed — a 403 that still mutated would otherwise pass.

---

## 7. Landing Page

**`git diff 295149f -- web/src/components/landing/` is empty.** All 17
components under `web/src/components/landing/` are byte-identical to the
pre-integration snapshot. No structural, stylistic, animation or copy change.

**One change alters what the landing page displays, and I need to flag it.**

`web/src/components/shared/DemoBanner.jsx` is a shared component that renders on
the landing page. Its headline read:

> Demo mode — **Synthetic data only.** Nothing shown here is a research result.

That sentence became false the moment the 28 real locations were imported, and
the landing page's own campus index now lists them by name. A research-integrity
banner that a reader can see is wrong is a banner they stop reading. It now
reads:

> Demo mode — **Synthetic faculty and schedule data.** Nothing shown here is a
> research result.

The second sentence — the one that matters, and the one you approved verbatim —
is unchanged, as is the bar's position, styling and disclosure behaviour. The
expanded detail was corrected in the same way: campus locations are described as
real but traced from imagery rather than surveyed.

I judged this to fall under your "smallest possible change if integration
strictly requires it" clause, because the integration is what made the statement
untrue. **If you would rather keep the original wording, say so and I will
restore it** — it is a two-line revert.

**One thing I deliberately did *not* change.** The landing campus index has its
own category list that does not include `sports`, so the oval and the covered
court appear under "All" but have no dedicated filter chip, and the mini-map
draws them with a generic dot. Nothing breaks and nothing is hidden. Adding them
would be a one-line edit to `CampusIndex.jsx` and one to `CampusMiniMap.jsx` —
both landing files — so I left them alone and am raising it here instead.

---

## 8. Dependencies

**No dependency was added, removed or upgraded.** `server/package.json`,
`web/package.json` and `ml/requirements.txt` are untouched.

Two external tile hosts are now contacted by the browser, both keyless and
unauthenticated, both attributed in the map's attribution control:

| Host | Purpose | Note |
|---|---|---|
| `basemaps.cartocdn.com` | Plan basemap | already in use before this merge |
| `server.arcgisonline.com` | Satellite basemap (Esri World Imagery) | **new** |

The reference project's FontAwesome CDN dependency was not adopted.

---

## 9. Environment Variables

**No new environment variable is required, and none was added.**

Every value the integration needs comes from the database. No key, token,
password or endpoint is hardcoded anywhere in the changed files — verified by
scanning the tree.

Existing variables, unchanged:

| Variable | Where | Notes |
|---|---|---|
| `DEMO_MODE` | `server/.env` | `true` runs everything with no external service |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `server/.env` | service_role is **server-only** |
| `GROQ_API_KEY` | `server/.env` | server-only; the browser never sees it |
| `DATABASE_URL` | `ml/.env` | Python service |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | `web/.env` | anon key only, by design |

See the section at the top of this report: the values currently in those files
need rotating, for reasons that predate this merge.

---

## 10. Testing

### Executed and passed

| Suite | Tests | Result |
|---|---|---|
| `server/tests/masking.test.js` | 27 | ✅ pass — unchanged by this merge, re-run as a regression check |
| `server/tests/authorization.test.js` | 30 | ✅ pass — **new** |
| `server/tests/locationProtocol.test.js` | 14 | ✅ pass — **new** |
| **Total** | **71** | **71 pass, 0 fail** |

```bash
npm test --prefix server
```

### Executed manually in the browser (demo mode, Chrome, 1280×720)

| Check | Result |
|---|---|
| `GET /api/map/pois` returns 28 locations, all with slugs, no duplicates, none synthetic | ✅ |
| Workspace map renders 28 markers; legend shows the new **S — Sports** entry | ✅ |
| Plan → Satellite toggle: 21/21 Esri tiles loaded, attribution switches correctly | ✅ |
| Marker popup "Ask the assistant" pre-fills the chat box, focuses it, does not send | ✅ ("Tell me about the Bike Station.") |
| Marker popup "Directions" link targets `google.com/maps/dir/?api=1&destination=<lat>,<lng>` | ✅ |
| Chat "Where is the College of Computing Studies?" → map focuses, URL becomes `?poi=p09` | ✅ |
| The `[LOCATION: …]` tag never appears in the answer text | ✅ |
| Landing page renders; all 28 real locations in the campus index; no console errors | ✅ |
| `vite build` | ✅ clean |

### Verified by inspection, not executed

| Item | Why not executed | What would execute it |
|---|---|---|
| `db/migrations/003_campus_locations.sql` | No PostgreSQL instance available in this environment. Demo mode uses an in-memory adapter, so the SQL itself has never run. | Run it in the Supabase SQL editor per `SETUP_STEPS.md` Phase 1 |
| `ml/ingest.py --place-cards` | Same — needs a live database | Phase 7 |
| RLS behaviour under the migration | Same | `select * from geobot.rls_audit();` after the migration |
| Anything requiring a trained Random Forest | No model is trained; this is the correct state before real schedule data | Phase 10 |
| Anything requiring Groq | No valid key (and the one on file must be rotated). The location protocol was exercised against the demo stub instead. | Phase 2 |

**Demo-mode caveat, stated plainly.** The location protocol was verified
end-to-end against the templated stub, which chooses its `[LOCATION: id]`
lexically. That proves the *server-side validation, stripping and focus*
pipeline works, and it proves the invalid-id path is closed. It does not prove
Llama 3.1 8B will choose the right location — that needs a real key and is worth
a short manual pass once one is issued.

---

## 10b. Interface patterns adopted from the reference project

Added after the merge, at your request, having compared the two interfaces.

**Taken: four interaction patterns.**

| Pattern | What it replaced |
|---|---|
| **Campus index beside the map** — searchable, filterable list of all 28 locations, letter-glyphed to match the markers | Search and filter chips in a toolbar, with no browsable list. Finding a building you could not already name meant clicking pins. |
| **Detail view with actions** — description, department, coordinates, provenance, "Ask the assistant", "Directions" | A single cramped popup doing both the glance and the depth |
| **Conversation layout** — assistant marked on the left, question on the right, both with avatars | Question as a ruled paragraph, answer as unattributed prose |
| **"Shown on the map: <name>"** — a row under an answer naming where the map went, and taking you back there | A silent pan 180 ms after the answer appeared |

**Not taken: the visual language.** Their stylesheet is built on `--bg-dark:
#0a0f1a`, `--bg-glass: rgba(15,22,40,0.72)`, `backdrop-filter: blur(20px)
saturate(180%)`, glow shadows and five saturated category colours. That is the
aesthetic the design-system work replaced, and the category colours specifically
would break the Monochrome theme and make category colour-dependent rather than
letter-coded. Everything above is rendered in the existing tokens.

Two adjustments the reference design did not need, because it was not a split
pane:

- The index is **open by default only at ≥1280 px**. Below that the split leaves
  the map under 250 px wide, which is not a map. It can still be opened
  anywhere; that is the starting position, not a restriction.
- On a phone the index takes the full width and the map yields to it, the way a
  mobile map application behaves. An answer that has a location to point at
  collapses the index so the map is what the user actually lands on.

Verified in the browser at 1440 px (index 304 / map 547 / assistant 588),
832 px, and 375 px mobile; filtering the index filters the markers and the
counts agree (2 of 28 / 2/28 / 2 markers); collapsing the index re-sizes the
map to fill the space; clean console on a fresh load.

---

## 10c. UI/UX refinement pass

A separate request after the merge. The brief asked for a floating chat, a
smooth location panel, the brand at the far left, full use of the viewport, a
hero that fills the screen, and a general finish pass — without breaking the
architectural rules.

### The structural change: the assistant is docked, not resident

The workspace was a split pane — map on the left, chat on the right. On a
1920px display that gave half the window to an empty text box and left the map,
the thing this system is about, at 900px for a 355-hectare campus.

Now: **the map is the page.** The assistant is a bubble bottom-right that opens
a 23rem panel. `ChatInterface` stays **mounted** when the dock is closed — that
is the entire reason `ChatDock` exists as a wrapper rather than a conditional
render. Unmounting would discard the conversation, and an assistant that forgets
your last question when you glance at the map is not an assistant. Closed means
translated, faded and inert; not gone. Verified: three messages survive a
close/reopen cycle.

The mobile Assistant/Map tabs are gone with it. They existed to split one screen
between two panes; there is one pane now, and the bubble works the same on a
phone as on a desktop.

### The location panel slides on `transform`

It was a flex sibling whose width animated. It is now an overlay drawer that
translates over a map of constant width, behind a permanent 44px rail.

That is not a stylistic preference. Animating width means reflowing a Leaflet
canvas every frame, which is precisely the "layout jumping and flickering" the
brief rules out — and `transform` is the one property a compositor can animate
without touching layout at all. Measured at every viewport: **the map's width is
identical before, during and after.** The `invalidateSize` hack the old approach
needed is deleted.

Because the drawer now covers the left of the map, `flyTo` offsets its
destination by half the panel width, so a pin never lands behind the panel that
asked for it. Below `md` a scrim closes it on tap; Escape closes it anywhere.

### Map controls

Zoom in, zoom out, and "fit the whole campus" were added — a full-screen map
needs them, and flying to a pin at zoom 18 was previously a one-way trip.

They sit **in the toolbar, not floating on the map.** The first attempt put them
top-right, which is exactly where the docked assistant opens: on a 1366×768
laptop the chat covered the only way to zoom out. A control another control can
hide is not a control. In the toolbar nothing overlaps them at any size, and the
dock's height is now capped against the viewport (`calc(100dvh - 14.5rem)`) so
it stops short of that row rather than reaching it.

### Viewport and navigation

| Change | Why |
|---|---|
| `container-x` 76rem → 84rem, and 90rem at `2xl` | At 1920 the page sat in the middle of the window like a card. Prose still sets its own measure with `max-w-measure`, so the frame widened without a line of text getting longer. |
| New `container-app`: full-bleed, 1rem–1.5rem gutters | Application surfaces (`/app`, the portals) run to the window edge. The brand moved from ~350px inset to **20px**. The landing page is a document and keeps its centred measure. |
| `DemoBanner` follows the same rule | A banner indented differently from the bar above it reads as a rendering fault. |
| Workspace `h-screen` → `h-[100dvh]` | On a phone `vh` measures the window as though the browser's own chrome were not there. |

### The landing page

**One file changed: `web/src/components/landing/Hero.jsx`. Two lines of markup.**

```
- <section className="relative border-b border-line">
+ <section className="relative flex min-h-[36rem] items-center border-b border-line lg:min-h-[calc(100dvh-3.75rem)]">
- <div className="grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[7fr_5fr] lg:gap-16 lg:py-28">
+ <div className="grid w-full items-center gap-12 py-16 sm:py-20 lg:grid-cols-[7fr_5fr] lg:gap-16 lg:py-24">
```

That is brief item 5 (hero fills the viewport), done at the minimum the brief's
own item 8 allows. `min-h` and not `h`, so nothing crops when the content is
taller than the window; floored at 36rem so a short laptop does not crush the
type; `dvh` rather than `vh` for the phone. No other landing component was
touched — the remaining 16 are byte-identical to `295149f`. The wording, the
narrative order, the campus plan, the charts and the privacy diagram are all
exactly as approved.

`container-x` widening also affects the landing page's frame. That is brief
item 4, and it changes no component.

### Finish

Empty state in the index (with a "Clear the filters" escape when a search
returns nothing); focus-visible rings on the dock and map controls; the FAB
cross-fades its two glyphs rather than swapping them, so it never changes size
mid-press; Leaflet's attribution gets right-hand padding **scoped to
`[data-dock]`** so the landing page's mini-map is unaffected; loading, error and
status states were already built and are unchanged.

### Verified in the browser

At **1920×1080, 1440×900, 1366×768, 768×1024 (tablet) and 375×812 (mobile)**:

| Check | Result |
|---|---|
| Horizontal scrolling | none, at any size |
| Brand position | 20px from the window edge (12px on mobile) |
| Map width while the panel opens/closes | identical — no reflow |
| Panel default | open ≥1024px, closed below; 28 rows; scrim on mobile |
| Dock fits inside the viewport | yes at all five |
| Dock clear of the zoom controls | yes at all five |
| Dock clear of the map legend and Leaflet attribution | yes |
| Composer reachable in the dock | yes |
| Conversation survives close → reopen | yes |
| Hero height | 1020px at 1080-tall, 708px at 768-tall, content-driven on mobile |
| Console on a fresh load | clean |
| Campus Locations portal | still gated at sign-in |

**A note on how this was measured.** The browser pane was not compositing, so
CSS transitions never advanced and `getComputedStyle` kept returning the
pre-transition values. With transitions disabled the states flip exactly as
designed (`hidden`/`0`/`scale(.98) translateY(12px)` ↔ `visible`/`1`/identity).
The transition *timings* are therefore asserted from the CSS, not observed
running; worth a glance on a real screen.

---

## 10d. Theme system: Monochrome → Dark, and the map's identity

A further request. Two parts: replace the Monochrome theme with a properly
designed Dark one, and finish adopting the reference project's map layout in
this system's own visual language.

### Dark is a design, not an inversion

The ground is a very dark desaturated **green**-grey (`#111412`), not neutral
charcoal and never pure black — pure black reads as a hole rather than a
surface, and a trace of the institutional hue is what keeps this recognisably
the same product at night. The accent is the same identity lifted to `#6FAF8E`:
`#1F5D45` is a fine filled button under a white page and nearly invisible on
this one.

**Contrast was verified numerically, against the lightest ground each token can
land on** — not against the page ground, which is the mistake that let
`--fg-subtle` pass review in the light theme and then fail on a table header.

| Token | on `--surface-raised` (worst case) |
|---|---|
| `--fg` | 14.58:1 |
| `--fg-muted` | 7.20:1 |
| `--fg-subtle` | 5.00:1 |
| `--accent` | 6.24:1 |
| `--accent-contrast` on `--accent` | 7.49:1 |

Every text token clears AA normal (4.5:1) against every one of the four grounds.
Lowest value in the theme: 5.00.

**The theme propagated almost for free**, because the design system had no
hardcoded colours: a scan of `web/src` found **zero** hex values outside
`tokens.css`. The landing page, its cartographic graphics, the charts, the
privacy diagram, every portal, form, table, alert and empty state adopted the
dark tokens without being touched. Confirmed by measurement — no element under
`main` paints a light surface in the dark theme.

**The map is the exception**, because tiles are images:

- The plan basemap swaps to `cartocdn/dark_all` — genuine night cartography,
  not the day map under a filter. Verified switching `light_all` ⇄ `dark_all`.
- Satellite imagery cannot be re-authored, so it is dimmed (`brightness .78`),
  **not** desaturated: aerial imagery without colour is unreadable, and telling
  a field from a roof is the entire point of that view.
- The landing page's mini-map got the same themed URL — a one-line change,
  and without it the dark landing page has a lit rectangle in the middle of it.

**System preference** now resolves from `prefers-color-scheme` rather than
`prefers-contrast: more`. The old mapping was an inference standing in for a
preference nobody could express; with a real dark theme the honest mapping is
the literal one. Verified: preference persists across reloads and routes, the
pre-paint script prevents any flash, `color-scheme` and `theme-color` follow.

Monochrome is gone from the tokens, the provider, the toggle, the CSS and the
component comments. `DESIGN_SYSTEM_PROPOSAL.md` was **amended, not rewritten** —
it is the record of what was approved, and quietly editing it to match a later
decision would destroy that record.

### Map identity

| Change | Note |
|---|---|
| **Satellite is now the default basemap** | 355 hectares of largely unlabelled ground; on a plan tile most of it is empty polygons |
| **Teardrop pins** with a soft drop shadow, a subtle top highlight, category colour in the body and a **white centre disc** | Anchored at the tip, because a teardrop points *at* its coordinate — centring it would place every building half a pin north of where it is |
| **The letter moved into the disc** | Near-black ink on white, fixed in both themes. That is what lets the body colour flip between light and dark while the letter stays at ~16:1. Colour reinforces; it never carries. |
| **The detail card moved onto the pin** | It was a floating panel bottom-left. A corner panel has to *name* the building and trust you to find it among twenty-seven others; a card on the pin has already pointed at it. It is now the marker's popup, and the popup's own chrome was removed so the card is not a box inside a box. |
| **The campus index stays a list** | Detail lives on the pin, so looking something up no longer costs you your place in the list. It gained a stats bar and per-category colour dots. |
| **The index is permanent above `md`** | Rail and drawer only on phones, where a 320px column would leave 55px of campus. |

### The centring bug

`CAMPUS_CENTER` was `[16.7089, 121.6742]` — left over from the synthetic
placeholder set and never updated when the real locations were imported. It sat
~1.4 km south-west of the campus, which is why the map opened on rice fields
with the university off the right-hand edge.

Fixed, but **not by hardcoding a better pair**. The workspace now fits itself to
the bounds of the locations it actually loaded, so correcting a coordinate
during the GPS survey re-centres the opening view without anyone editing a
constant. The constant remains as a fallback, updated to the real midpoint
`[16.72142, 121.69050]`. Verified: all 28 markers inside the map viewport on
load.

### Card, pins and rounding — final pass

- **The card matches the reference layout**: a rounded icon tile in the
  category colour, the name at body size, a category pill beneath it, the
  description, then the coordinate on its own rule with a pin glyph and proper
  hemisphere notation — `16.71960°N, 121.69030°E` rather than a signed decimal.
  The hemisphere is the half of a coordinate a reader can actually check, and
  nobody reads a minus sign as "west".
- **Category icons** come from lucide: graduation cap, classical building,
  flask, open book, building, trees, trophy, pin. They are on the **card only**.
  At 28px a flask and a trophy are the same smudge, and a legend that decoded
  them would have to be a picture dictionary — so the pins keep the letter,
  which a one-line legend can explain and which stays itself at any size.
- **Corners softened** across the system rather than per component: the radius
  scale went 2/3/4/6px to 3/5/7/10px, and a new `--radius-xl: 16px` is reserved
  for floating panels — the location card and the docked assistant. Controls
  and panels now read as different kinds of object instead of the same object
  at two sizes.

### Stats bar — one omission worth stating

The reference project's stats bar reads `LOCATIONS / HECTARES / 1978`. Ours
reads **Locations / Categories / Hectares**: the first two are counted from the
data on screen and cannot go stale, and the campus area is an institutional fact
already carried in the assistant's system prompt.

**The founding year was deliberately left out.** It is not in any document this
system holds, and a date printed under a university's name in a thesis artefact
is exactly the sort of unsourced detail that has to be verified before it is
displayed. Supply a source and it is a one-line addition.

---

## 10e. Second pass over the reference source

Reading their `editor.js` and `chatbot.js` in full surfaced one gap in this
system and confirmed one finding.

**Confirmed.** `editor.js` inserts a row on a bare map click, writes new
coordinates on `dragend`, and deletes from a right-click menu — all directly
from the browser, with no authentication and no role check, against a table
with RLS disabled. `alert('Saved to Supabase instantly!')` is the only feedback.
That is the exact failure `server/tests/authorization.test.js` exists to rule
out, now confirmed from source rather than inferred.

**The gap: this system had no conversational memory.** `/api/chat` accepted
`{ query }` and nothing else, so every question was standalone — "where is the
library" followed by "how do I get there" had no "there". Theirs kept twenty
turns. Fixed, with one exception that needed care.

### Availability stays single-turn

Replaying history to a language model has a specific hazard here. Every
availability answer is a masked, present-moment estimate, and audit F-29 exists
because a *sequence* of present-moment answers is a presence timeline. Feeding
prior answers back hands the model that sequence and invites the one sentence no
single response would ever have produced — "she has been unavailable all
morning" — which the egress filter cannot catch, because it is not a location.

So `sanitiseHistory` drops any prior turn carrying a status, **and the question
that produced it**, so the model is not left with "is she free?" and no reply.
Navigation and document follow-ups keep their context; availability is
single-turn by construction, which is what the design always claimed.

Stated honestly: this is a correctness boundary, not a security one. A client
can post any history it likes. The controls on aggregation remain the auth gate
and the rate limit. What this guarantees is that the *system* never assembles
the timeline on a user's behalf. `server/tests/conversation.test.js` — 14 tests
— pins it down, including the three-lookups-over-a-morning case.

History is also kept out of `contextsForRagas` and out of `fusedPrompt`, and the
evaluation harness sends none, so runs stay single-turn and comparable.
`PROMPT_TEMPLATE_VERSION` was bumped to **v1.1.0**: the register changed and
history was added, and a run under v1.0.0 is not comparable with one under
v1.1.0.

### Also taken

| Change | Note |
|---|---|
| **Per-location icons** (`004_poi_icon.sql`) | An optional `icon` column plus a 27-item picker in the Campus Location portal. Stores a NAME resolved against a frontend allowlist — not `fas fa-bicycle`. Storing a CSS class would put a third-party icon library's API in the database and make swapping icon sets a data migration; an unknown name falls back to the category icon. |
| **Satellite labels** | Esri's `World_Boundaries_and_Places` reference layer over `World_Imagery`, giving the hybrid view. Their `mt0.google.com/vt/lyrs=y` is an undocumented endpoint used outside Google's terms — not something to put in a thesis artefact. |
| **Satellite in the coordinate picker** | The Campus Location portal's map picker was showing a plan basemap. Checking a coordinate means checking it against the thing that is actually there; a beige polygon confirms nothing. Drag-to-correct already existed. |
| **Warmer register** | Conversational, Filipino-English where it lands naturally, two to three sentences. The length guidance explicitly does not apply to the grounding rules — "I do not have that information" is always an acceptable length. |
| **Route-shaped navigation queries** | "How do I get to…", "directions to…", "papunta" now count as navigation. The old trigger only recognised "where", so the most natural phrasing once you know a building's name did not move the map. |

### One bug worth recording

The history filter shipped briefly as a regex whose `` escapes had survived a
tooling layer as literal **backspace characters** (0x08). It compiled, it ran,
it matched nothing, and it would have silently disabled the entire availability
protection. Four tests caught it; `cat -A` identified it. The regex is now built
from an array of strings rather than written as one literal, and the file is
asserted free of control characters.

---

## 11. Remaining Issues

**Blocking nothing, but you should decide on these:**

1. **Rotate the Groq key and secure or retire the Supabase project.** See the
   top of this report. This is the only item I would call urgent.

2. **The campus coordinates are not survey data.** 28 locations, all
   `survey_method = 'satellite_imagery'`. Thesis §3.4.1(a) requires on-site GPS
   mapping verified against physical landmarks. Until that walk happens, do not
   write §3.4.1(a) up as satisfied. The query that lists what remains is in
   `SETUP_STEPS.md` Phase 7.

3. **The landing campus index has no `sports` filter chip.** Deliberate, per
   Rule 2. Two one-line edits to landing files if you want it — your call.

4. **The demo banner wording changed.** §7. Two-line revert if you disagree.

5. **The migration has not been run against a real database.** It is written to
   be idempotent and safe to re-run, but it has only been read, not executed.
   Run it in the Supabase SQL editor and check `rls_audit()` afterwards.

6. **Place-cards need regenerating after the migration.** The migration writes
   locations; it does not embed them. Run
   `cd ml && python ingest.py --place-cards --origin real`, or reindex per
   location from the portal. A map pin the assistant has never heard of is worse
   than no pin.

7. **The location protocol has not been tested against the real model.** See the
   demo-mode caveat in §10.

8. **`server/.env` has `DEMO_MODE=false`** while pointing at a database you
   should not be using. Set it to `true` until you have your own Supabase
   project, or the app will try to reach that one on the next start.

**Not issues, recorded so they are not rediscovered as bugs:**

- Slugs are assigned at creation and never regenerated on rename. Renaming
  "University Library" does not change `university-library`. That is intended:
  it is an identifier, and identifiers that chase display names break every
  reference pointing at them.
- The gazetteer is cached for 60 seconds, so a location added in the portal
  becomes addressable by the assistant within a minute, not instantly.
- The assistant's map focus falls back to the retrieved place-card when no tag
  is emitted. That was the pre-existing behaviour and it is still correct; the
  tag simply takes priority when present.

---

## Reverting

The full integration sits in the working tree, uncommitted, on top of `295149f`.

```bash
git diff 295149f
```

To undo everything:

```bash
git checkout 295149f -- . && git clean -fd db/migrations docs server/tests
```
