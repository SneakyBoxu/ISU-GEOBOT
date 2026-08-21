# Scope and ethics decisions

Decisions taken during implementation that narrow what the study collects.
Recorded here so Chapter 3 (methodology) and Chapter 5 (limitations) describe
the same system that was actually built, and so a panelist asking "why didn't
you..." gets an answer rather than a silence.

Date of record: 2026-08-20. Basis: RA 10173 (Data Privacy Act), advisor
guidance, and research feasibility.

---

## D1 — No real biometric or HR attendance data

**Excluded.** Live integration with HR biometrics or departmental time records
is not part of this study.

**Why.** Daily Time Records are sensitive personal information. Obtaining them
for 37 people, storing them in a shared database, and deriving individual
punctuality profiles is a disclosure risk disproportionate to a thesis, and the
advisor ruled it out directly.

**Instead.** The Random Forest and the rule baseline are demonstrated on a
generated dataset — `database/sample-data/003_synthetic_attendance.sql`,
5,166 intraday punches across a synthetic cohort `SIM-01`…`SIM-37` carrying the
real teaching *shapes* and none of the real identities.

**Consequence, which must be stated plainly.** Every availability metric is a
**simulation result**. It answers *"does the pipeline recover the behavioural
patterns that were deliberately injected?"* and never *"does the system predict
real faculty availability?"*. This is enforced, not merely intended:

- every row is `data_origin = 'synthetic'`
- `corpus_is_research_ready()` therefore returns false for `attendance_record`
- `train_availability_model.py` refuses to persist metrics unless the run is
  explicitly flagged `--simulation`, which stamps `rf_model_version.data_origin
  = 'synthetic'`

**What it still supports.** On identical rows and split, the forest beats the
rule baseline **0.970 vs 0.860 accuracy** and **0.951 vs 0.600 f1-macro**. The
substantive finding is per-class: the rule baseline scores **0.000 f1** on
`available_consultation` — it cannot detect consultation availability at all,
because a timetable does not encode it — against **0.906** for the forest. That
is a real architectural result about what schedule lookup cannot do, and it does
not depend on the attendance being real.

---

## D2 — No active guard gate logging

**Excluded.** Security personnel will not log faculty arrivals and departures
during this study.

**Why.** A staffed checkpoint recording named individuals' entries and exits is
surveillance-adjacent, and it produces exactly the movement history the Status
Masking Protocol exists to prevent leaking. Building the protocol and then
operating the collection it guards against would be incoherent.

**Instead.** The tri-state presence design — `confirmed_on_campus`,
`confirmed_off_campus`, `unknown` — and the deterministic security override
remain implemented and documented as an architectural capability. The tables
(`guard_user`, `guard_presence_event`), the `/guard` portal, and the override
path in `faculty-presence-service.js` all exist and are exercised by the test
suite. They are simply not fed.

**Consequence.** Every faculty member resolves to `unknown`, so the Random
Forest is invoked on every availability query. That is the branch the thesis's
contribution lives in, so the demonstration is unaffected; what is lost is the
override path's *empirical* validation. Chapter 3 should describe the override
as designed and tested rather than measured.

---

## D3 — Consent and validation scoped to a pilot cohort

**Re-scoped.** 3–5 CCSICT instructors or advisers, not all 37.

**Why.** Informed consent means each person understands what is collected, what
a student can see, and that they may withdraw. Five colleagues briefed properly
is a stronger claim than 37 signatures gathered quickly, and it keeps the study
proportionate.

**The remaining ~33 stay `is_consented = false` deliberately.** This is not an
unfinished task. A system that answers about everyone demonstrates nothing about
its privacy boundary; one that answers about five and declines for the rest
demonstrates the boundary is enforced in code. The refusal is a result, and the
evaluation set registers it as one.

**Consequence.** Objective 4 (faculty ground-truth validation) is evaluated on a
pilot rather than the 15 validators the thesis proposes. Chapter 3's sample size
needs amending, and Chapter 5 should carry the reduced statistical weight
honestly.

---

## D4 — Satellite georeferencing instead of an on-site GPS survey

**Changed.** Coordinates are digitised against high-resolution satellite imagery
in the Campus Location editor. No physical GPS walk is conducted.

**Why.** Walking 28 buildings with a receiver is days of fieldwork for accuracy
the application does not need: the map answers "which building is that and where
is it relative to me", not survey-grade positioning.

**How it is recorded.** `poi.survey_method = 'satellite_imagery'` on all 28
published locations. This value exists precisely so the distinction stays
reportable — it is not `gps_survey` and does not claim to be.

**One correction made during this work.** Three locations previously read
`gps_survey`. Two were junk test rows (`Alamario`, `Simbulan`) created by an
unauthenticated client and have been removed. The third, `University Library`,
had been flipped `satellite_imagery → gps_survey` on 2026-08-20 03:35 by the
same client; no survey took place, so it has been corrected, with the reason
recorded in `poi_audit`.

**Consequence.** Thesis §3.4.1(a), which specifies on-site GPS mapping verified
against physical landmarks, is **superseded rather than unmet**. Chapter 3 must
describe the georeferencing method actually used. `preflight-check.js` now
treats `satellite_imagery` as a valid method and warns only when provenance is
*unrecorded* — the case nobody can describe.

---

## What this leaves the study

| Objective | Status |
|---|---|
| **O1** RF integrated into the RAG pipeline | Demonstrated, on simulated attendance (D1) |
| **O2** Standard vs Enhanced RAG, Response Time + RAGAS | **Fully achievable** — needs institutional documents and the registered test set, neither of which requires anyone's consent |
| **O3** Deployed web system | Satisfied — running live against Supabase |
| **O4** Faculty ground-truth validation | Pilot scale (D3), or a stated limitation if consent is not obtained |

O2 is the largest single result still fully in reach, and nothing in these
decisions constrains it.
