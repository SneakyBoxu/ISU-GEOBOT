# ISU-GeoBot — how the system actually works

A walkthrough for defending this system. It follows real requests through real
files, so you can answer "what happens when…" by naming the code rather than
describing it in the abstract.

Every file path here is real and every claim is checkable in the running system.

---

## The 60-second version

Three programs run at once. They do not share memory; they talk over HTTP.

```
Browser (React, port 5173)
    │  fetch
    ▼
Express API (Node, port 4000)  ← the only thing that talks to the database
    │  HTTP                    ← the only thing that holds the service-role key
    ▼
ML service (Python Flask, port 5001)
    ├─ all-MiniLM-L6-v2   turns text into a 384-number vector
    └─ Random Forest      turns a schedule + history into one of three states

Express also calls out to:
    Supabase (PostgreSQL + pgvector)   all data
    Groq (openai/gpt-oss-120b)         writes the final sentence
```

**Why three and not one.** The embedder and the forest are Python libraries with
no usable Node equivalent, and loading a 135 MB model into the API process would
make every restart take a minute. Splitting them means the API restarts
instantly and the model loads once.

**What breaks if each goes down:**

| Down | Still works | Breaks |
|---|---|---|
| ML service (5001) | map, POI popups, admin dashboard | chat entirely — no query can be embedded |
| Groq | retrieval, map, admin | the final sentence; retrieval still finds the right chunks |
| Supabase | nothing | everything |
| Frontend (5173) | the API itself | the UI |

If chat breaks during the demo, **check port 5001 first.** That is the usual
cause, and the ML service must be restarted after any edit to a `.py` file
because Python holds the old code in memory.

---

## Trace 1 — you type a question and press enter

This is the most likely thing you will be asked to explain.

**1. The browser sends it.**
`frontend/src/components/main-assistant/FloatingChatDock.jsx` collects the text
and calls `api.chat()` in
`frontend/src/frontend-utilities/backendApiClient.js`, which `POST`s to
`/api/chat`.

**2. Express receives it.**
`backend/src/routes/index.js:105`. Note what it does *before* anything else:

```js
const signedIn = Boolean(req.user);
```

Availability answers require a signed-in account; the map and institutional Q&A
stay open. The reason is in the comment at line 109 and is worth quoting in the
defense: masking protects the *granularity* of one answer, but not the
*volume* of many. An anonymous availability endpoint can be polled repeatedly
to reconstruct a presence timeline. Requiring an account makes that attributable
and rate-limitable.

**3. `runPipeline()` runs.** `backend/src/services/knowledge-search-service.js:209`.
Five numbered stages, and the timings collected here are exactly the ones that
become Table 4.5:

**Stage 1 — route.** `intent-query-router.js` asks one binary question: *does
this query need an availability status?* It answers with a gazetteer lookup
against the faculty roster plus an intent lexicon — no LLM call. That is
deliberate and defensible three ways: it costs ~2 ms instead of 150–300 ms, it
is deterministic so a re-run gives the same answer, and the roster is a known
closed list, which makes it a lookup problem rather than an NLU problem.

If two lecturers match the name, the pipeline **stops and asks** rather than
guessing (line 226).

**Stage 2–3 — retrieval, always.** Retrieval runs in *both* arms and is never
conditional on the route (line 241). The query is embedded by the ML service,
then compared against `document_chunk.embedding` by exact cosine similarity —
top 5, similarity floor 0.25.

There is **no ANN index**, on purpose: 232 chunks is small enough that an exact
scan takes ~170 ms and always returns the true nearest neighbours. An
approximate index would add a failure mode and save nothing.

**Stage 4 — availability, enhanced arm only.** This is the *only* place the two
architectures diverge (line 244). Two gates are checked **before** the
classifier is invoked:

- `allowAvailability` — is the caller signed in?
- `faculty_is_answerable` — is this lecturer active, consented, and not
  self-paused?

Both are checked before prediction, not after. A paused lecturer's estimate is
**never computed**, not computed-then-hidden. That distinction is the whole
difference between respecting an objection and merely honouring it in the
presentation layer — and it is measurable: the recorded classifier time for a
refused query is `0.0 ms`.

**Stage 5 — context fusion.** The retrieved chunks and (if any) the masked
status are assembled into one prompt by `ai-prompt-templates.js` and sent to
Groq at temperature 0.

**4. The egress boundary.** Back in `routes/index.js:129`:

```js
const dto = assertNoLeak(toChatDto(result));
```

`assertNoLeak` (`middleware/privacy-masking-middleware.js:299`) serialises the
entire response and throws if it contains any of:

```
probabilities, rf_proba, predicted_class, raw_prediction,
room_label, feature_list, fused_prompt, embedding
```

This is a backstop, not the primary control. The masking already happened
upstream. This exists so that a future bug that *would* leak fails loudly
instead of silently. In `run-03-simulation` it never fired — `egress_filter_hit`
is `false` on all 78 rows, which is the result you want: the boundary was
satisfied by construction, not by interception.

---

## Trace 2 — "Where is SIM-22?" (the refusal)

Worth rehearsing, because it demonstrates the privacy claim better than any
slide.

The router classifies this as **`campus_navigation`**, not availability — it
asks for a location, and the system does not answer location questions about
people. So `route.needsAvailability` is false, the classifier is never reached,
and the answer is:

> "I'm sorry, but I don't have that information."

Three things to point out if asked:

1. **The recorded classifier time is `0.0 ms`.** Not "we computed it and hid
   it" — the prediction never happened. That is in `eval_result` and you can
   show it.
2. **The wording is identical** to the refusal for an unknown building. So
   exercising the privacy rule does not advertise that it was exercised.
3. **The same applies to a self-paused lecturer** (`knowledge-search-service.js:301`).
   The system deliberately does *not* say "this person opted out", because
   announcing that someone exercised their right to object discloses a choice
   about their own data and invites exactly the social pressure the right exists
   to prevent. Pausing and simply having no data are made indistinguishable from
   outside.

**Across all 12 availability responses in `run-03-simulation`, no answer named a
room, building, floor or office.** The standard arm answered none of the six
questions at all — baseline RAG cannot reach timetables, so it correctly
refuses.

---

## Trace 3 — you click a map pin

1. `useCampusLocations.js` fetched `/api/map/pois` once on page load.
2. `routes/index.js` selects the published POIs and reshapes each into the
   twelve fields the browser sees — including `imageUrl` and `imageAlt`.
3. `InteractiveCampusMap.jsx` draws the markers;
   `PlaceDetailCard.jsx` renders the popup, photo banner first.

**The POI is stored twice, on purpose.** The `poi` row drives the map. A
generated natural-language "place card" is written as a `document` and embedded,
so the same building is findable by *asking* as well as by *looking*. Both are
written in the same operation (`campus-places-service.js:95 reindexPoi`) so the
map and the corpus cannot drift apart.

A photograph does **not** re-embed the place card — a picture is not retrievable
text, and re-embedding on a photo swap would be wasted work.

---

## Trace 4 — you upload a schedule or a document

Two steps, and the second will not run without the first.

1. **Preview.** The file is parsed, and the server returns what it *would* write
   plus a **checksum** of the parsed content.
2. **Apply.** The client sends the checksum back. If it does not match, the
   apply is refused.

This exists so nothing is written that a human has not seen. `schedule_upload.py`
decides whether a workbook is a timetable or an academic calendar by looking at
its *contents*, not its filename.

Uploaded documents are chunked with their **section heading carried onto every
chunk**. That single change fixed a real bug: the assistant refused to say when
the second semester began, because the chunk holding the date did not say which
semester it described. The heading had fallen into a different chunk. The model
declined rather than guess — correct behaviour, wrong input.

---

## Where the data lives

**Use the `geobot` schema.** If you open Supabase and look at `public`, you will
see five leftover prototype tables that nothing reads. All 27 real tables are in
`geobot`.

Tables worth knowing by name:

| Table | Holds |
|---|---|
| `poi` | campus locations (35 rows, 34 published) |
| `document` / `document_chunk` | the RAG corpus (37 docs / 232 chunks) |
| `faculty` | 37 real lecturers + 37 synthetic (SIM-01…SIM-37) |
| `faculty_schedule` | 425 real CCSICT blocks + 496 synthetic |
| `attendance_record` | generated attendance for the SIM cohort only |
| `eval_run` / `eval_result` | every evaluation run and its per-stage timings |
| `rf_model_version` | which features each trained model actually used |

### `data_origin` — the single most important column

Every table that can hold invented data carries `data_origin`, and it is only
ever `'real'` or `'synthetic'`. This is how the study keeps its promise that no
generated number is ever presented as an observation. `eval_run.data_origin`
stamps whole runs; `run-03-simulation` is stamped `synthetic`, and its artifacts
are named `-SIMULATION`.

**If asked "how do we know you didn't mix them?" — that column is the answer,**
and it is enforced by a database constraint, not by discipline.

---

## The two questions you should expect

### "Your Random Forest is trained on fake data. What does that prove?"

It proves the pipeline recovers the behavioural patterns that were injected into
the data — nothing about real lecturer availability, and the paper says exactly
that, in those words.

Real Daily Time Records were ruled out on privacy grounds. The alternative was
to use no data at all. The honest path was to generate a cohort that carries the
real *teaching shapes* and none of the identities, label every artifact it
produces, and state the limit plainly. §4.4 and Table 4.3 both carry a
**SIMULATION RESULT** banner.

Note that it is a *real* comparison, not a tautology: the labels come from
attendance while the rule baseline sees only the schedule, so the forest can
learn the consultation pattern the rule misses. That is the 0.1818 → 0.9008 F1
gain on `available_consultation`.

### "Is the Enhanced architecture actually better?"

**Not faster — 169 ms slower**, and say so before they find it. An earlier draft
claimed a 94 ms advantage; that was an artifact of a query set with no
availability questions in it, which meant both arms ran the identical path and
the "difference" was noise.

The real advantage is capability: **the standard arm answered 0 of 6
availability questions; the enhanced arm answered 5 and correctly refused the
6th.** What the 169 ms buys is an entire class of question the baseline cannot
answer, under an enforced disclosure limit.

---

## Glossary, in defendable words

- **RAG** — retrieval-augmented generation. Instead of trusting the language
  model's memory, find the relevant passages first and hand them to it. The
  model writes the sentence; the documents supply the facts.
- **Embedding** — a sentence turned into 384 numbers, positioned so that
  passages meaning similar things land near each other. Ours are unit-length,
  which is why cosine similarity is just a dot product.
- **Cosine similarity** — the angle between two of those vectors. 1.0 is
  identical direction; our floor of 0.25 discards weak matches rather than
  padding the prompt with noise.
- **Chunk** — a passage small enough to retrieve precisely. Ours cap at 220
  tokens, enforced by a database constraint.
- **Random Forest** — 300 decision trees that vote. Each sees a random subset of
  the data, so their errors are uncorrelated and the vote is steadier than any
  one tree.
- **class_weight="balanced"** — consultation windows are rarer than class hours,
  so without this the forest could score well by never predicting the rare class.
  This makes rare mistakes cost more.
- **Time-based split** — the test set is the *latest* data, never a random
  sample. A random split lets the model see Thursday while being tested on
  Wednesday, which flatters it.
- **Masking protocol** — the rule that an availability answer may be exactly one
  of three coarse states, and never a room, building or floor.

---

## Running it

```
start.bat                      # all three services
```

Then check:

```
npm run preflight --prefix backend    # database, corpus, ML service, keys
npm test --prefix backend             # 136 tests
python machine-learning/test_schedule_rule_contract.py
```

**After editing any `.py` file, restart the ML service.** Python caches the old
code in memory, and the symptom is a 404 or 500 that makes no sense against the
code you are reading.

---

## Two diagrams worth using in slides

`frontend/src/components/landing-page/LandingRagPipelineDiagram.jsx` and
`LandingPrivacyMaskingDiagram.jsx` are interactive, accurate diagrams of the
architecture and the masking boundary. They are not currently rendered on any
page, but they are correct and they encode two facts a generic flowchart gets
wrong: retrieval and availability run in **parallel**, and only the availability
branch crosses the masking boundary.
