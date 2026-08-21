# ISU-GeoBot — Step-by-Step Setup

What **you** need to do manually, in order. Everything before Phase 6 can be done
today. Phases 7–9 are blocked on data you are still requesting, so they are last.

**Right now the app runs fully in demo mode with no accounts, no keys, and no
data.** Start there, show it to whoever needs to see it, and work down this list
as things arrive.

---

## Phase 0 — Run the demo (works today, nothing needed)

Two terminals.

**Terminal 1 — API:**
```bash
cd backend && npm install && npm run dev
```

**Terminal 2 — web:**
```bash
cd frontend && npm install && npm run dev
```

Open **http://localhost:5173**

- [ ] Landing page loads with the amber "Demonstration mode" banner
- [ ] Comparison widget: pick "Faculty availability" → **Run comparison** → two arms differ
- [ ] `/app` — ask *"Where is the College of Computing Studies?"* → map flies to the marker
- [ ] `/guard` — sign in `guard@demo.local` / `demo` → log a Departure → status flips
- [ ] `/validate` — sign in `faculty@demo.local` / `demo` → record an entry, then
      pause your own availability and watch the assistant stop answering
- [ ] `/admin` — sign in `admin@demo.local` / `demo` → add a building → ask the
      assistant about it immediately, no restart needed
- [ ] Ask about a faculty member while signed out → availability is withheld;
      sign in as `student@demo.local` / `demo` → the same question is answered

`backend/.env` already has `DEMO_MODE=true`. Nothing else is required.

> **What is fake in demo mode:** availability is a schedule lookup (not a Random
> Forest), replies are templated (not Llama 3.1 8B), embeddings are lexical (not
> all-MiniLM-L6-v2), and all data is placeholder. The banner says so on every
> screen, and the evaluation harness refuses to run. Nothing from demo mode may
> be screenshotted into the thesis as a result.

---

## Phase 1 — Supabase project

1. [ ] Create a project at [supabase.com](https://supabase.com) (free tier is fine).
       Region: Singapore or Tokyo for lowest latency from Isabela.
2. [ ] **Database → Extensions** → enable **`vector`**.
3. [ ] Apply the schema. Two ways; the script is the safer one because the
       order matters and it refuses to drop a schema that already holds data:

       ```bash
       python database/apply-database-migrations.py                    # dry run, changes nothing
       python database/apply-database-migrations.py --initial --run    # first install
       python database/apply-database-migrations.py --run              # later: migrations only
       ```

       Or paste them into the **SQL Editor** yourself, **in this order**:
       - [ ] `database/tables-and-structure.sql`
       - [ ] `database/database-functions.sql`
       - [ ] `database/security-and-permissions.sql`
       - [ ] `database/migrations/002_user_roles_and_place_records.sql`
       - [ ] `database/migrations/003_isu_echague_campus_locations.sql` — the 28 real campus
             locations. Safe to re-run: it matches on `slug` and updates rather
             than duplicating.
4. [ ] Check what is still missing before switching off demo mode:

       ```bash
       npm run preflight --prefix backend
       ```

       It reports, separately, what blocks the **map** and what blocks the
       **assistant** — the map needs only a database, and there is no reason to
       wait for a language model to see real locations on it.

5. [ ] Run the security check:
       ```sql
       select * from geobot.rls_audit();
       ```
       Every row must show `rls_enabled = true` and `rls_forced = true`.
       `anon_readable` must be **true for `availability_status` only**.
       **Screenshot this** — it is defense evidence.
5. [ ] **Settings → API** → copy `URL`, `anon key`, `service_role key`.
6. [ ] **Settings → Database** → copy the connection string (URI).

> The `service_role` key bypasses all security. It goes in `backend/.env` only —
> never in `frontend/.env`, never in a `VITE_` variable, never committed.

Optional, to see the real database working before real data arrives:
- [ ] Run `database/sample-data/001_sample_campus_records.sql` (every row is marked synthetic)

---

## Phase 2 — Groq API key

1. [ ] Sign up at [console.groq.com](https://console.groq.com) (free tier).
2. [ ] Create an API key.
3. [ ] **Check the model id is still served.** Open the Models page and confirm
       `llama-3.1-8b-instant` is listed.
       - If it is gone, pick the closest Llama 3.1 8B variant, put it in
         `GROQ_MODEL`, and **write down the substitution and the date**. The
         thesis names this model; a silent swap makes earlier numbers
         non-comparable.

---

## Phase 3 — Python ML service

1. [ ] Install Python 3.11.
2. [ ] ```bash
       cd machine-learning
       pip install -r requirements.txt
       cp .env.example .env
       ```
3. [ ] Put the Supabase connection string into `machine-learning/.env` as `DATABASE_URL`.
4. [ ] ```bash
       python ai_api_service.py
       ```
       First run downloads all-MiniLM-L6-v2 (~90 MB). Wait for
       `embedder ready (dim=384, max_seq_length=256)`.
5. [ ] Check http://127.0.0.1:5001/healthz → `rf_ready: false` is **correct**
       at this stage. No model has been trained yet.

---

## Phase 4 — Switch off demo mode

> **The demonstration logins stop working here.** `admin@demo.local / demo` and
> the other three are recognised only by a server running `DEMO_MODE=true`. The
> moment you set it to `false`, every portal authenticates against Supabase, and
> until Phase 5 provisions real accounts there is nobody who can sign in. That
> is not a fault — it is the point — but it surprises people who expected the
> map to go live and the portals to keep working. The public map and the
> assistant are unaffected; only the four portals need accounts.


1. [ ] Edit `backend/.env`:
       ```
       DEMO_MODE=false
       SUPABASE_URL=...
       SUPABASE_ANON_KEY=...
       SUPABASE_SERVICE_ROLE_KEY=...
       GROQ_API_KEY=...
       GROQ_MODEL=llama-3.1-8b-instant
       RETRIEVAL_SIMILARITY_FLOOR=0.25
       SESSION_SALT=<long random string>
       ```
       Note: remove the `0.06` floor — that value exists only for the demo's
       lexical embedder.
2. [ ] Edit `frontend/.env`:
       ```
       VITE_SUPABASE_URL=...
       VITE_SUPABASE_ANON_KEY=...
       ```
3. [ ] Restart both servers. The amber banner disappears.
4. [ ] `curl http://localhost:4000/api/health` → `demoMode: false`

---

## Phase 5 — Accounts and roles

Supabase → **Authentication → Users → Add user** (manually — there is no
self-registration by design).

### The permission model

| Role | Can do | Cannot do |
|---|---|---|
| **anonymous** | Campus map, navigation and institutional questions | Ask about faculty availability |
| **student** | + faculty availability queries | Edit the map, see other people's data |
| **faculty** | + pause/resume their own availability disclosure, see what the system holds about them | Edit the map |
| **validator** | + the validation checklist (§3.8.2) | Edit the map |
| **guard** | Log arrivals and departures for today | Everything else |
| **admin** | Add and correct campus locations | Run evaluations |
| **researcher** | Everything, plus evaluation runs | — |

Two of these are worth being able to explain at defense:

- **Availability requires an account.** Status masking protects the granularity
  of one answer but does nothing about volume — an anonymous endpoint can be
  polled to reconstruct someone's daily presence timeline. Requiring a campus
  account makes that attributable and rate-limitable per person. The map and
  institutional Q&A stay open, so nothing about the navigation half of the
  thesis is affected.
- **Students cannot edit the map.** Not a trust judgement: geospatial data is
  institutional record-keeping, and §3.4.1(a) specifies GPS survey verified
  against landmarks. Crowd-sourced coordinates would make the survey
  methodology unreportable.

### Provisioning

- [ ] Create one account per security guard
- [ ] Create one account per faculty validator
- [ ] Create student accounts (or open self-registration restricted to your
      institutional email domain — your call)
- [ ] Create an admin account for whoever maintains the campus map
- [ ] For each, run in SQL Editor:
      ```sql
      -- guard
      insert into geobot.guard_user (auth_user_id, display_name)
      values ('<auth-uid>', 'Full Name');
      insert into geobot.app_user_role (auth_user_id, role)
      values ('<auth-uid>', 'guard');

      -- validator (faculty_id comes from Phase 8)
      insert into geobot.app_user_role (auth_user_id, role, faculty_id)
      values ('<auth-uid>', 'validator', '<faculty-uuid>');

      -- faculty member (separate from 'validator': a person may withdraw from
      -- the validation study while remaining a data subject, or vice versa)
      insert into geobot.app_user_role (auth_user_id, role, faculty_id)
      values ('<auth-uid>', 'faculty', '<faculty-uuid>');

      -- student
      insert into geobot.app_user_role (auth_user_id, role)
      values ('<auth-uid>', 'student');

      -- campus map maintainer
      insert into geobot.app_user_role (auth_user_id, role)
      values ('<auth-uid>', 'admin');

      -- yourselves
      insert into geobot.app_user_role (auth_user_id, role)
      values ('<auth-uid>', 'researcher');
      ```

- [ ] Point each faculty member at `/validate` and show them the pause control.
      A signature on a consent form is a one-time act; RA 10173 also gives a
      data subject an ongoing right to object. Being able to say "they can turn
      it off themselves, here" is a much stronger answer than "they can email
      us".

---

## Phase 6 — Institutional documents

Usually the easiest data to obtain, and it is the **critical path for RAGAS** —
your primary evaluation. Chase this first among the data items.

1. [ ] Collect from administrative offices: memoranda, academic calendar,
       student handbook, announcements.
2. [ ] Convert each to plain `.txt` or `.md` in `machine-learning/data/documents/`.
       Name them so the type is detectable: `memo-*.txt`, `calendar-*.txt`,
       `handbook-*.txt`.
3. [ ] ```bash
       cd machine-learning && python document_knowledge_importer.py --path ./data/documents --origin real
       ```
4. [ ] Confirm the output shows `max <= 220 tokens`.

> **Faculty directory files:** strip everything except name, department and
> office. No phone numbers, no personal emails, no home addresses. The system
> deliberately never combines an office location with a live availability
> status in one answer — decide and write down that position before ingesting
> anything with office assignments in it.

---

## Phase 7 — Campus map data *(mostly done — GPS verification outstanding)*

Blocks: nothing. The map and the navigation answers work now.
Outstanding: the coordinates are not yet survey data.

**What is already loaded.** `database/migrations/003_isu_echague_campus_locations.sql` inserts 28
real ISU Echague locations — colleges, administrative offices, the library, the
oval, the covered court, the cacao centre, the bike station. They carry real
names, functions and descriptions, and they are what the map and the assistant
use today.

**What is not yet true about them.** Their coordinates were traced from
satellite imagery, not walked with a GPS receiver. Every one is stored as
`survey_method = 'satellite_imagery'`, which is a distinct value from
`gps_survey` precisely so this is visible in a query rather than remembered.
Thesis §3.4.1(a) specifies GPS mapping verified against physical landmarks, so
until the walk happens, §3.4.1(a) is not satisfied and should not be written up
as though it were.

To see exactly what still needs verifying:

```sql
select name, lat, lng from geobot.poi
where survey_method <> 'gps_survey' and is_published
order by name;
```

1. [ ] Walk the campus with a phone GPS. For each location above, stand at the
       building and record the reading.
2. [ ] Cross-check each coordinate against a physical landmark.
3. [ ] Correct it at `/admin` → open the location → update the coordinates and
       set **Survey method** to *On-site GPS survey*. This writes an audit entry
       and regenerates the location's place-card in the same operation.
4. [ ] Re-run the query above. When it returns no rows, §3.4.1(a) is satisfied
       and that is the sentence you can put in the paper.

**Adding a location that is not in the list** (a new building, a missed office):
sign in at `/admin` and use the form. It assigns the slug, records provenance,
writes the audit entry, and re-embeds the place-card so the assistant can answer
about it immediately. A map pin the chatbot has never heard of is worse than no
pin at all.

Bulk SQL loading is still possible but is the slower path, because it skips all
of the above and you have to regenerate the place-cards yourself:

```bash
python document_knowledge_importer.py --place-cards --origin real
```

`poi_type` ∈ `college | administrative | laboratory | library | facility |
landmark | sports | other`

5. [ ] Confirm no synthetic locations remain:
       `select count(*) from geobot.poi where data_origin = 'synthetic' and is_published;`
       Migration 003 unpublishes the originals; this should return 0.
6. [ ] Check the initial map view in `frontend/src/frontend-utilities/appConstants.js` → `CAMPUS_CENTER`
       still frames the campus once the real coordinates are in.

---

## ⏳ Phase 8 — Faculty roster, consent and schedules *(waiting on request)*

Blocks: availability queries, faculty validation.

1. [ ] Request official class schedules from department heads / registrar.
2. [ ] **Obtain written informed consent** from each faculty member the system
       will answer about — not only the 15 validators. The roster is
       consent-gated in code: `is_consented = false` means the assistant will
       not answer questions about that person.
3. [ ] Run the roles-and-locations migration if you have not already:
       ```bash
       psql "$DATABASE_URL" -f database/migrations/002_user_roles_and_place_records.sql
       ```
4. [ ] Load departments, then faculty:
       ```sql
       insert into geobot.faculty
         (full_name, honorific, department_id, is_consented, consent_date, data_origin)
       values ('Juan Dela Cruz', 'Prof.', '<dept-uuid>', true, '2026-01-15', 'real');
       ```
4. [ ] Add surname aliases so the router can resolve names:
       ```sql
       insert into geobot.faculty_alias (faculty_id, alias, alias_kind, data_origin)
       values ('<faculty-uuid>', 'Dela Cruz', 'surname', 'real');
       ```
5. [ ] Create a pseudonym for every faculty member (the model never sees names):
       ```sql
       insert into geobot.faculty_pseudonym_map (faculty_id)
       select id from geobot.faculty
       on conflict do nothing;
       ```
6. [ ] Load schedules — one row per teaching or consultation block:
       ```sql
       insert into geobot.faculty_schedule
         (faculty_id, day_of_week, start_time, end_time, block_kind,
          semester, course_code, room_label, data_origin)
       values ('<uuid>', 1, '08:00', '10:00', 'class',
               '2025-2026-1', 'CS 101', 'CCS-301', 'real');
       ```
       `day_of_week`: **0 = Sunday** … 6 = Saturday.
       `block_kind` ∈ `class | consultation | admin`.
7. [ ] Load the academic calendar:
       ```sql
       insert into geobot.institutional_event
         (event_date, event_type, title, disrupts_schedule, data_origin)
       values ('2026-03-15', 'exam_period', 'Midterm examinations', true, 'real');
       ```
8. [ ] Delete placeholder faculty: `delete from geobot.faculty where data_origin = 'synthetic';`

---

## ⏳ Phase 9 — Attendance data *(waiting — and this one can change the plan)*

**Do this before writing anything into Chapter 4.**

1. [ ] Request historical attendance from department logbooks or HR biometrics.
2. [ ] **Look at a sample and answer one question: does it record times within
       the day, or only that someone came in that day?**

   | What you have | What it means |
   |---|---|
   | **Check-in / check-out times** | Good. Load with `granularity = 'intraday'`. The model can learn real presence patterns. |
   | **A daily sign-in sheet** | The intended model does not work. You cannot derive "available at 2:30 PM" from "signed in today" without guessing it from the schedule — and then the classifier is just reproducing the schedule lookup it is supposed to beat. |

3. [ ] If it is daily-only, **tell your adviser before writing code around it.**
       The realistic options are to narrow the target (predict presence per
       half-day block rather than per moment), or to collect attendance
       prospectively during the evaluation period. Either way Chapter 3 needs
       amending.
4. [ ] Load, pseudonymised, with no names:
       ```sql
       insert into geobot.attendance_record
         (pseudonym_id, event_time, event_type, source, granularity, data_origin)
       values ('<pseudonym>', '2026-01-15 08:12:00+08', 'check_in',
               'biometric', 'intraday', 'real');
       ```

---

## Phase 10 — Train the model and its comparison floor

```bash
cd machine-learning

# The rule baseline FIRST — it is your comparison floor.
python schedule_rule_baseline.py --semester 2025-2026-1 \
  --start 2025-08-11 --end 2025-12-19 --label-source attendance_derived

# Then the forest, on the same rows and the same split.
python train_availability_model.py --semester 2025-2026-1 \
  --start 2025-08-11 --end 2025-12-19 \
  --label-source attendance_derived --attendance-features \
  --split time_based
```

- [ ] Record both accuracy figures side by side
- [ ] Restart `machine-learning/ai_api_service.py` so it picks up the new model
- [ ] `curl http://127.0.0.1:5001/model/info` → `rf_ready: true`

If the forest does not beat the baseline, that is a finding, not a failure —
and far better discovered now than at the defense. `--split random` exists only
to *demonstrate* data leakage; never report a number from it.

---

## Phase 11 — Evaluation

1. [ ] **Write down the test-query mix before running anything.** How many
       navigation / institutional / availability / combined questions, and why.
       Deciding this after seeing results is p-hacking and a panelist may say so.
2. [ ] Insert the curated queries with their ground-truth answers into
       `geobot.eval_query`.
3. [ ] Pick a judge model **different from `llama-3.1-8b-instant`**. The
       database rejects a run where they match.
4. [ ] ```bash
       node backend/src/services/evaluation-runner.js --label "run-01" --judge <judge-model>
       python machine-learning/evaluate_rag_quality.py --run <eval_run_id>
       ```
5. [ ] Deploy, orient the 15 validators, and run the validation period.

If the harness refuses to start, read the message — it means synthetic rows are
still present somewhere. That check is the whole point.

---

## Phase 12 — Before the defense

- [ ] `npm test` in `backend/` passes — this is your evidence the masking
      protocol works
- [ ] `select * from geobot.rls_audit();` screenshot on file
- [ ] Every `data_origin` is `'real'`; the harness runs without complaint
- [ ] Model version, prompt version, top-K and judge model recorded on the run
- [ ] Both RAG arms ran interleaved in one session
- [ ] RF accuracy and rule-baseline accuracy both reported
- [ ] Nothing anywhere in the UI, README or slides shows a number that was not
      measured

---

## Quick reference

| Where | Command |
|---|---|
| API | `cd backend && npm run dev` |
| Web | `cd frontend && npm run dev` |
| Add a building | sign in at `/admin` |
| ML | `cd machine-learning && python ai_api_service.py` |
| Privacy tests | `cd backend && npm test` |
| Ingest docs | `cd machine-learning && python document_knowledge_importer.py --path ./data/documents --origin real` |
| Place-cards | `cd machine-learning && python document_knowledge_importer.py --place-cards --origin real` |

| Problem | Cause |
|---|---|
| Banner still showing | `DEMO_MODE` is still `true` in `backend/.env` |
| Availability returns 503 | No model trained yet — expected until Phase 10 |
| Empty answers | Corpus not ingested, or `RETRIEVAL_SIMILARITY_FLOOR` still at the demo value |
| Chat 500s | Groq key missing or the model id was retired |
| Harness refuses to run | Synthetic rows present — working as designed |
