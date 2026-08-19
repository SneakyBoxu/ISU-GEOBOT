# Open Decisions — resolved by the build brief, and the three it did not resolve

The build brief closed most of the audit's Section C questions. This file records
what it settled, what it left open, and how the scaffold resolves each remaining
item so implementation is not blocked.

---

## Closed by the build brief

| Audit | Question | Brief's answer |
|---|---|---|
| C1 | RF target | Three status classes, schedule-derived ✅ |
| C3 | Masked status as a RAGAS `contexts` item | Yes ✅ — `eval_run.status_as_context` |
| C6 | Static office vs live whereabouts | Egress filter blocks room numbers during availability inquiries ✅ |
| C11 | Consent-gated roster | "search consented faculty" ✅ — `faculty.is_consented` |
| C12 | Rule-based baseline | `baseline_rule.py` ✅ |
| C13 | Guard validity window | Same-day ✅ — `resolve_presence()` |
| C14 | Validation capture | In-system `/validate` ✅ |
| C17 | Global vs per-faculty model | Global, pseudonymised `faculty_id` feature ✅ |

---

## Still open — and how the scaffold handles it

### 1. C4 / F-18 — attendance data, and a circularity the brief makes worse · BLOCKER

The brief's RF feature list is: `day_of_week`, `time_slot`, `is_consultation_hour`,
`exam_period_flag`, `campus_event_flag`, `semester_phase`, pseudonymised `faculty_id`.

**Every one of those is derivable from the schedule.** Thesis §3.5.2 requires a
fourth category the list drops entirely — *"historical attendance patterns …
individual tendencies toward punctuality, early departure, or extended office
hours"*.

That omission has a consequence beyond fidelity. If the **features** are
schedule-derived and the **labels** are also schedule-derived, the Random Forest
is learning `schedule_lookup_status()` by construction. It cannot outperform the
rule-based baseline, because it *is* the rule-based baseline with a `faculty_id`
column attached. Reporting its accuracy as evidence that ML beats rules would be
circular — and F-20 already established that the thesis's stated justification
(feature importance) does not support that claim either.

**Scaffold resolution — do not block, but make the circularity impossible to
report by accident:**

- `attendance_record` exists now, pseudonymous and FK-free, so the feature block
  switches on without a migration the moment real logs arrive.
- `attendance_record.granularity ∈ (intraday | daily | unknown)`. `train_rf.py`
  must refuse to derive intra-day labels from `daily` sources.
- `rf_model_version.label_source ∈ (schedule_derived | attendance_derived |
  hybrid)` is recorded on every trained model, and the comparison report must
  print it next to the accuracy figure.

**Researcher action, unchanged and still blocking a reportable result:** obtain a
real sample of ISU attendance data and confirm its time granularity. If it is a
daily sign-in sheet, the ML formulation has to change and Chapter 3 needs
amending. Development proceeds meanwhile; *reporting* does not.

### 2. Class label strings deviate from the thesis's evaluated vocabulary · MAJOR

The brief specifies `"In Scheduled Class / Lecture"` and
`"Unavailable / Off-Schedule"`. Thesis §3.9 evaluates
`"Currently in a Lecture"` and `"Unavailable"`.

The brief's strings are **better** — they are honest that the estimate is
schedule-derived rather than observed, which matches the system's actual
epistemic position. But they are the strings faculty validators confirm against
in §3.9, so changing them silently changes the instrument.

**Scaffold resolution:** `availability_status` holds `code`, `display_label`
(brief's wording, what users and the LLM see) and `thesis_label` (§3.9 wording,
frozen). The deviation is data, auditable, and reconcilable without a migration.

**Researcher action:** decide whether Chapter 3 adopts the clearer wording, or
the UI reverts to the thesis wording. Do not leave both in play at defense.

### 3. Landing-page arm toggle vs. server-side `mode` · MAJOR

The brief asks for a homepage widget that lets visitors *"toggle between Standard
and Enhanced RAG"*. Audit F-16 requires `mode` to be server-controlled: a public
toggle lets anyone drive the baseline arm and makes evaluation runs
indistinguishable from live traffic in the logs.

Both are right. The demo is genuinely the best way to show the contribution.

**Scaffold resolution — keep the demo, keep the invariant:**

- `demo_query` is a curated allowlist. The widget accepts **only** these
  pre-approved queries, never arbitrary text.
- The comparison runs on `POST /api/demo/compare`, separate from `/api/chat`,
  rate-limited, writing to `chat_log` with `is_demo = true` — never to
  `eval_result`.
- `/api/chat` stays hard-wired to `enhanced` with no `mode` parameter.

This also closes the aggregation surface from F-29: a canned query list cannot be
polled to reconstruct anyone's presence timeline.

---

## Resolved by engineering judgment (defaults, changeable)

| Audit | Item | Default chosen | Where |
|---|---|---|---|
| C5 | Guard override in evaluation | Record `eval_result.override_applied`; compute RF accuracy with those rows excluded, report override-rate separately | `schema.sql` |
| C7 | Public access | Public + per-IP rate limit + present-moment-only; no historical or predictive availability queries | Express layer |
| C9 | RAGAS judge | Configurable; `eval_run` has a CHECK forcing judge ≠ generator | `schema.sql` |
| C15 | "Partially correct" | Captured, excluded from the confusion matrix via generated column, reported separately | `faculty_validation` |
| C19 | Top-K / floor | K = 5 default, recorded per `eval_run`; never tuned after seeing RAGAS output | `eval_run` |
| C20 | Retention | Not yet set — still a researcher decision | — |

---

## Unchanged research-integrity constraints

No fabricated faculty, schedules, attendance, coordinates, documents, accuracy
figures, RAGAS scores, validation results, or conclusions. `metrics`,
`feature_importance`, and every `ragas_score` row are written only by the real
pipeline. UI metric cards render an empty state until a real run exists.
`corpus_is_research_ready()` makes "could synthetic data have contaminated your
results?" a one-query answer.
