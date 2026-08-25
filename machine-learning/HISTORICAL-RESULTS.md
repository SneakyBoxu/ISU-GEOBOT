# HISTORICAL — trained before the official-calendar correction

**Do not delete. Do not overwrite.** These are the results the system produced
*before* the academic calendar was corrected against
<https://isu.edu.ph/school-calendar/>. They are preserved so the thesis can
distinguish the earlier implementation from the corrected one, and so the effect
of the correction is measurable rather than asserted.

Frozen 2026-08-22, immediately before regeneration.

## What produced them

| | Value |
|---|---|
| Model version | `rf-20260821-123459` |
| Trained at | 2026-08-21 12:35 UTC |
| Training window | **2026-08-10 → 2026-12-18** (placeholder) |
| Label source | `attendance_derived` |
| Split | `time_based`, 80/20 |
| `data_origin` | `synthetic` |
| Training rows | 78,105 |

### The calendar these were trained against

Placeholder `institutional_event` rows, invented before the official source was
consulted:

| | Placeholder used | Official (ISU) |
|---|---|---|
| Mid-term examination | 2026-10-12 → 10-16 | **2026-09-15 → 09-17** |
| Final examination | 2026-12-14 → 12-18 | **2026-11-10 → 11-12** (graduating) |
| | | **2026-11-17 → 11-19** (non-graduating) |
| Semester window | Aug 10 – Dec 18 | **Jul 20 – Nov 19** |

Six national-holiday rows were unchanged by the correction and are common to
both runs.

## Historical metrics

### Random Forest

| Metric | Value |
|---|---|
| Accuracy | **0.9698** |
| Macro F1 | **0.9512** |
| CV macro F1 | 0.9305 ± 0.0181 |

| Class | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| `available_consultation` | 0.884 | 0.932 | **0.907** | 1,923 |
| `in_scheduled_class` | 0.942 | 0.994 | **0.967** | 3,323 |
| `unavailable_off_schedule` | 0.989 | 0.969 | **0.979** | 14,281 |

### Rule baseline

| Metric | Value |
|---|---|
| Accuracy | **0.8889** |
| Macro F1 | **0.6308** |
| `available_consultation` F1 | **0.000** |

The 0.000 is structural, not a failure to learn: the schedule of record contains
no `consultation` blocks, so a rule over the timetable cannot express that class
at all. It is unchanged by the calendar correction.

## Why these numbers cannot simply be compared to the new ones

The correction changed the *data*, not the model. Three things moved at once:

1. **The sampling window** shifted by roughly three weeks at the start and four
   at the end, so the corrected run samples a different set of days.
2. **`exam_period_flag`** was wrong on ten days in each direction — set on days
   that were not examinations, unset on days that were.
3. **`campus_event_flag` and the labels** followed, because
   `_schedule_label(block, campus_event)` returns `unavailable_off_schedule`
   whenever a disrupting event is present.

A change in accuracy between the two therefore reflects a change in the problem,
not an improvement or regression in the method. Both runs remain **simulations**
on generated attendance and are stamped `data_origin = 'synthetic'`.
