# Teammate Integration — Architecture Assessment

**Source studied:** `https://github.com/SneakyBoxu/ISU-GEOBOT.git` (1 commit, 2026-08-19, 3,271 lines)
**Base system:** this repository. Restore point: `295149f`.

---

## 0. SECURITY — read this first

The teammate repository is **public** (unauthenticated GitHub API returns 200) and contains
live credentials in plaintext:

| Finding | File | Impact |
|---|---|---|
| **Live Groq API key** | `chatbot.js:13` | Anyone can spend against the account or exhaust the free-tier quota |
| **Supabase URL + anon key** | `supabase-config.js:4-5` | Direct database access from anywhere |
| **`ALTER TABLE public.locations DISABLE ROW LEVEL SECURITY`** | `setup-supabase.sql:13` | With the anon key above, **anyone on the internet can read, edit and DELETE every campus location** |
| **`editor.html` has no authentication of any kind** | `editor.js` | `insert` / `update` / `delete` run straight from the browser |

The SQL file states the reason plainly: *"Turn off Row Level Security so our simple HTML
editor can read and write without logging in."*

**Required action, independent of this integration:**
1. Revoke the Groq key at console.groq.com and issue a new one.
2. Rotate the Supabase anon key, re-enable RLS on `public.locations`, and add policies.
3. Purge both from git history (`git filter-repo`), or delete and recreate the repository —
   rotating alone is not enough while the old values remain in the log.

**None of these credentials have been copied into this repository.** They are quoted here
by file and line only.

---

## 1. What the two systems actually are

|  | This system | Teammate system |
|---|---|---|
| Frontend | React 18 + Vite, token-based design system | Vanilla HTML/CSS/JS, 3 script tags |
| Backend | Node 20 + Express, service layer | **None** — browser talks to Supabase directly |
| ML | Python/Flask, Random Forest + embeddings | None |
| Auth | Supabase Auth + roles + RLS deny-by-default | **None** |
| Chat | Enhanced RAG: route → retrieve → mask → fuse → LLM | Direct Groq call from the browser |
| Map data | `geobot.poi` + generated place-cards in pgvector | Flat `locations` table, RLS off |
| Map editing | `/admin` portal, server-enforced role check | `editor.html`, no check at all |
| Secrets | Server-side env vars only | Committed in source |

These are not two implementations of the same architecture. The teammate project is a
**single-tier client-side application**; this project is three-tier with an enforced
privacy boundary. Wholesale adoption of their architecture would delete the thesis's
central contribution (Enhanced RAG + status masking) and every authorization control.

So the integration takes **their data and their interaction ideas**, not their architecture.

---

## 2. Merge map

### 2a. KEEP from this system (untouched)

- Entire landing page (`web/src/components/landing/**`) — **protected by Rule 2**
- `db/schema.sql`, `functions.sql`, `policies.sql`, `migrations/002_*` — richer schema, RLS, audit trail
- `server/src/middleware/maskingMiddleware.js` + 27 privacy tests — thesis contribution
- `server/src/services/{router,ragService,presenceService,poiService,evalRunner}.js`
- `server/src/routes/{index,admin}.js` — auth, roles, rate limiting
- `/admin` Campus Location portal — **the sole map-editing authority, Rule 3**
- `/guard`, `/validate` portals; ML service; evaluation harness
- Design system, theme system, all UI primitives

### 2b. IMPORT / ADAPT from teammate

| What | Why | How it is adapted |
|---|---|---|
| **28 real ISU campus locations** (`setup-supabase.sql`) | Highest-value asset. Real names, categories, descriptions, coordinates for the actual campus. Replaces 8 placeholder POIs. | Loaded into `geobot.poi` with `survey_method` recorded honestly (see §4), not into a new table |
| **`[LOCATION_ID: …]` map-control protocol** (`chatbot.js`) | Genuine capability gain: "show me the library" moves the map. This system only focuses the map when a place-card happens to be retrieved. | **Server-side**, and the id is validated against the authoritative POI list before it is returned. The model cannot invent one. Read-only. |
| **Marker click → chat prefill** (`app.js` → `locationSelected`) | Good coupling this system lacks | Reimplemented in React state, no custom DOM events |
| **Satellite / street basemap toggle** | Genuinely useful for a 355-hectare campus | Added to the workspace map, tokenised, Monochrome-aware |
| **"Get directions" deep link** | Practical for real students | Added to the POI popup |
| **Campus facts** in the system prompt | Real, checkable institutional detail (355 ha, est. 1978, contact) | Merged into the existing grounded prompt without weakening its constraints |
| **`sports` category** | The real campus has an oval and a gymnasium | Added to the `poi_type` vocabulary via migration |

### 2c. RECONCILED (both implement it, one wins)

| Conflict | Resolution | Reason |
|---|---|---|
| Two chatbots | **Keep this system's.** Import the map-control idea only. | Theirs has no retrieval, no grounding, no masking, and puts the API key in the browser. Ours is the thesis contribution. |
| Two maps | **Keep this system's Leaflet component.** Import basemap toggle + directions. | Theirs is good but assumes a global `LOCATIONS` array and vanilla DOM. |
| Two schemas | **Keep `geobot.poi`.** Migrate their rows in. | Theirs has no provenance, no audit, no publish state, no RLS. |
| Two editors | **Keep `/admin`.** Discard `editor.html`. | Theirs is unauthenticated CRUD — the exact thing Rule 3 forbids. |
| `id TEXT` vs `id uuid` | Keep uuid; store their slug in a new `slug` column | Their slugs (`admin-building`) are what the chatbot's location protocol references, and they are human-readable. Worth keeping as a stable external key. |
| Category vocabularies | Map theirs onto ours, extend with `sports` | See §4 mapping table |
| Icon strings (FontAwesome) | **Dropped.** | This system uses lucide-react. Importing FA adds a dependency and a second icon language for no benefit. |
| Model choice | **Keep `llama-3.1-8b-instant`.** | Thesis §3.7 names Llama 3.1 8B. Theirs uses `openai/gpt-oss-120b`, which would be an undisclosed deviation. |

### 2d. NOT imported, explicitly

- `supabase-config.js` — client-side credentials
- `chatbot.js` wholesale — browser-side API key
- `editor.html` / `editor.js` — unauthenticated map mutation
- `setup-supabase.sql` schema — RLS disabled by design
- `index.html`, `style.css`, `app.js` wholesale — would replace the landing page and workspace (Rule 2)
- FontAwesome CDN dependency

---

## 3. Target architecture after merge

```
Campus Location portal (/admin)          ← the ONLY writer
   │  POST/PATCH /api/admin/pois
   │  requireAuth + requireRole('admin','researcher')   ← server-enforced
   ▼
geobot.poi  (authoritative)  ──► poiService.reindexPoi()
   │                                 └─► poi_document + document_chunk (pgvector)
   │                                          │
   ├──► GET /api/map/pois ──► workspace map, campus index   (read-only)
   │
   └──► router gazetteer ──► retrieval ──► Context Fusion ──► LLM
                                                  │
                                                  ▼
                                    answer + validated poiFocus  (read-only)
```

One source of truth. The chatbot is a **consumer**: it can read locations and ask the map
to move, and it has no code path that writes to `poi`.

---

## 4. Data provenance — a research-integrity decision

The teammate's `locations.js` header states the coordinates were *"verified against Google
Maps satellite imagery (2026)"*.

Thesis §3.4.1(a) specifies **on-site GPS mapping verified against physical landmarks**.
Satellite tracing is not that. These coordinates are therefore imported as:

- `survey_method = 'satellite_imagery'` — a **new** value added for exactly this case
- `data_origin = 'real'` — the names, categories and descriptions are real institutional
  facts about a real campus, and the harness gate is about fabricated data, not about
  coordinate precision

This keeps the distinction reportable: the campus map is populated with real locations,
and the record states plainly that the positions came from imagery rather than a survey.
Replacing them later with surveyed coordinates is a `survey_method` update, not a
re-import.

**Category mapping applied:**

| Teammate | This system | Notes |
|---|---|---|
| `academic` | `college` | |
| `admin` | `administrative` | |
| `facility` | `facility` | except Library → `library`, ICT Center → `laboratory` |
| `sports` | `sports` | new value added by migration |
| `landmark` | `landmark` | |

---

## 5. Authorization model (unchanged, and re-verified)

Map mutation endpoints and their guards:

| Endpoint | Guard |
|---|---|
| `POST /api/admin/pois` | `requireAuth` + `requireRole('admin','researcher')` |
| `PATCH /api/admin/pois/:id` | `requireAuth` + `requireRole('admin','researcher')` |
| `POST /api/admin/pois/:id/unpublish` | `requireAuth` + `requireRole('admin','researcher')` |
| `POST /api/admin/pois/:id/reindex` | `requireAuth` + `requireRole('admin','researcher')` |

Enforced server-side in Express, and again at the database by RLS (`db/policies.sql`
grants `anon` nothing on `poi`). The chatbot has **no** mutation path: `ragService` and
`router` only read.
