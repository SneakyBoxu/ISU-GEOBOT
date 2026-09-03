"""
Rule baseline vs Random Forest, on REAL observations.

    python machine-learning/train_from_validations.py
    python machine-learning/train_from_validations.py --exclude-overrides
    python machine-learning/train_from_validations.py --protocol observation_first

WHY THIS SCRIPT EXISTS, SEPARATELY FROM train_availability_model.py
------------------------------------------------------------------
That trainer learns from the SIM-01..SIM-37 cohort. Its synthetic timetable
carries 425 `class` blocks and ZERO `consultation` blocks --
generate_synthetic_attendance.py hardcodes 'class' for every row it writes. The
rule baseline was therefore handed a schedule with one block type deleted, could
never emit `available_consultation`, and scored 0.0000 on it. The published
"96.97% vs 74.45%" is not a comparison; it is a rule reading a redacted
schedule. Nothing here reuses those numbers.

This script uses the data the researchers actually collected:

    features  the REAL CCSICT timetable + the real ISU calendar
    labels    faculty_validation.actual_status -- a person walked over and looked

IS THIS CIRCULAR?
-----------------
train_availability_model.py:115 refuses to persist a model whose features AND
labels are both schedule-derived, because such a forest reproduces
schedule_lookup_status() by construction. That guard does not apply here and is
not touched: the labels come from direct human observation, so the forest is
being asked where the timetable and reality DIVERGE. That divergence is the only
thing it can learn, and it is exactly the thesis's question.

WHY THE hist_* FEATURES ARE ABSENT
----------------------------------
All 37 real lecturers have zero rows in attendance_record. hist_presence_rate,
hist_punctuality_rate and hist_early_departure_rate would be constant at 0.0
across every sample -- zero variance, zero information, and a constant feature
invites a reader to think presence history was considered when it was not.
Their absence is a finding to report, not a shortcut taken.

SAMPLE SIZE
-----------
This is a small study. Every table it writes states n and the fold spread, and
the caller is expected to read them. A macro-F1 from ~200 rows across 3 classes
is an estimate with real width, not a headline percentage.
"""

from __future__ import annotations

import argparse
import csv
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from sklearn.model_selection import StratifiedGroupKFold, StratifiedKFold

import database_connector as db
from dataset_loader import CAMPUS, _block_at, _schedule_label
from feature_engineering import semester_phase_of

TABLES = Path(__file__).resolve().parent.parent / "notebooks" / "tables"
CAMPUS_TZ = ZoneInfo("Asia/Manila")
SEMESTER = "2026-2027-1"

CLASSES = ["available_consultation", "in_scheduled_class", "unavailable_off_schedule"]

FEATURE_NAMES = [
    "day_of_week",
    "hour_of_day",
    "minute_of_day",
    "is_consultation_hour",
    "is_scheduled_class",
    "exam_period_flag",
    "campus_event_flag",
    "semester_phase",
]


# --------------------------------------------------------------------- loading
def load_validations(protocol: str, exclude_overrides: bool) -> list[dict]:
    sql = """
        select v.id::text            as id,
               v.faculty_id::text    as faculty_id,
               v.queried_at,
               v.actual_status,
               v.status_source,
               v.collection_protocol
          from geobot.faculty_validation v
          join geobot.faculty f on f.id = v.faculty_id
         where v.actual_status is not null
           and f.data_origin = 'real'
    """
    params: list = []
    if protocol != "all":
        sql += " and v.collection_protocol = %s"
        params.append(protocol)
    if exclude_overrides:
        # Neither engine ran on these: a guard departure or an official event
        # short-circuits before the schedule lookup and before the model, so
        # including them measures a third thing.
        sql += " and coalesce(v.status_source, '') <> 'override'"
    sql += " order by v.queried_at"
    return db.fetch_all(sql, tuple(params) if params else None)


def load_real_schedule() -> dict[str, list[dict]]:
    """Real blocks only. Synthetic rows share the semester id but not the ids."""
    rows = db.fetch_all(
        """
        select fs.faculty_id::text as faculty_id, fs.day_of_week,
               fs.start_time, fs.end_time, fs.block_kind, fs.campus
          from geobot.faculty_schedule fs
          join geobot.faculty f on f.id = fs.faculty_id
         where fs.semester = %s and fs.data_origin = 'real' and f.data_origin = 'real'
        """,
        (SEMESTER,),
    )
    out: dict[str, list[dict]] = {}
    for r in rows:
        out.setdefault(r["faculty_id"], []).append(r)
    return out


def load_events() -> dict:
    rows = db.fetch_all(
        "select event_date, event_type, disrupts_schedule "
        "from geobot.institutional_event where disrupts_schedule"
    )
    return {r["event_date"]: r for r in rows}


def load_window():
    rows = db.fetch_all(
        "select event_date, title from geobot.institutional_event "
        "where event_type = 'other' and title like 'Academic window%%' "
        "order by event_date"
    )
    if len(rows) != 2:
        raise SystemExit(
            "No academic window in institutional_event. semester_phase cannot be "
            "computed and this script will not invent one -- run "
            "database/sample-data/006_official_calendar.sql first."
        )
    return rows[0]["event_date"], rows[1]["event_date"]


# -------------------------------------------------------------------- features
def build(rows, schedule, events, sem_start, sem_end):
    """One feature vector per observation, plus the rule's answer for the same row."""
    X, y, groups, slots, rule, skipped = [], [], [], [], [], 0

    for r in rows:
        # The backend sends campus-local naive time to /predict
        # (toCampusLocalNaive); training must resolve slots the same way or the
        # weekday and the block boundaries shift by the UTC offset.
        when = r["queried_at"].astimezone(CAMPUS_TZ).replace(tzinfo=None)

        blocks = schedule.get(r["faculty_id"], [])
        if not blocks:
            # A validated lecturer with no real timetable cannot produce
            # schedule features. Dropping is honest; zero-filling would assert
            # "no classes" as though it were known.
            skipped += 1
            continue

        block = _block_at(blocks, when)
        ev = events.get(when.date())
        campus_event = 1 if ev else 0
        exam = 1 if ev and ev["event_type"] == "exam_period" else 0

        X.append([
            (when.weekday() + 1) % 7,          # DB convention: Sun=0
            when.hour,
            when.hour * 60 + when.minute,
            1 if block == "consultation" else 0,
            1 if block == "class" else 0,
            exam,
            campus_event,
            semester_phase_of(when, sem_start, sem_end),
        ])
        y.append(r["actual_status"])
        groups.append(r["faculty_id"])
        # The day-hour this observation was made in. Grouping folds on this is
        # the leakage test run in main().
        slots.append(when.strftime("%a-%H"))
        rule.append(_schedule_label(block, campus_event))

    return (np.array(X, dtype=float), np.array(y), np.array(groups),
            np.array(slots), np.array(rule), skipped)


# --------------------------------------------------------------------- scoring
def make_cv(y, groups, n_splits):
    """
    Grouped by lecturer, so no professor appears in both train and test.

    With ~30 people and ~200 rows the realistic failure is person leakage: a
    forest that memorises "ALADO is usually in class" would score well and
    generalise to nobody.
    """
    counts = {c: int((y == c).sum()) for c in set(y)}
    smallest = min(counts.values())
    n_splits = min(n_splits, smallest, len(set(groups)))
    if n_splits < 2:
        raise SystemExit(
            f"Not enough data to cross-validate: class counts {counts}. "
            "Collect more observations before reading anything into a score."
        )
    try:
        cv = StratifiedGroupKFold(n_splits=n_splits, shuffle=True, random_state=42)
        list(cv.split(np.zeros(len(y)), y, groups))
        return cv, n_splits, True
    except ValueError:
        print("  ! grouped folds not satisfiable at this size; falling back to")
        print("    StratifiedKFold. Scores may be optimistic -- the same lecturer")
        print("    can then appear in train and test. Disclose this.")
        return StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42), n_splits, False


def evaluate(X, y, groups, rule, n_splits):
    cv, n_splits, grouped = make_cv(y, groups, n_splits)
    splitter = cv.split(X, y, groups) if grouped else cv.split(X, y)

    y_true_all, y_pred_all, y_rule_all, fold_f1 = [], [], [], []

    for tr, te in splitter:
        clf = RandomForestClassifier(
            n_estimators=300,
            min_samples_leaf=2,
            # The observed classes are uneven and the minority one
            # (available_consultation) is the one the thesis cares about most.
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        )
        clf.fit(X[tr], y[tr])
        pred = clf.predict(X[te])

        y_true_all.extend(y[te])
        y_pred_all.extend(pred)
        y_rule_all.extend(rule[te])     # scored on the SAME held-out rows
        fold_f1.append(f1_score(y[te], pred, average="macro", zero_division=0))

    return (np.array(y_true_all), np.array(y_pred_all), np.array(y_rule_all),
            np.array(fold_f1), n_splits, grouped)


# ---------------------------------------------------------------------- output
def report(name, y_true, y_pred):
    print(f"\n{name}")
    print(classification_report(y_true, y_pred, labels=CLASSES,
                                zero_division=0, digits=4))
    print("  confusion matrix (rows = observed, cols = predicted)")
    cm = confusion_matrix(y_true, y_pred, labels=CLASSES)
    print("    " + "  ".join(f"{c[:12]:>12}" for c in CLASSES))
    for c, row in zip(CLASSES, cm):
        print(f"    {c[:24]:<24} " + "  ".join(f"{v:>12}" for v in row))
    return f1_score(y_true, y_pred, average="macro", zero_division=0)


def write_tables(meta, y_true, y_pred, y_rule, rule_f1, model_f1, fold_f1, slot_f1):
    TABLES.mkdir(parents=True, exist_ok=True)
    header = (
        f"n = {meta['n']} real observations · {meta['folds']}-fold "
        f"{'grouped ' if meta['grouped'] else ''}cross-validation · "
        f"label_source = observation_derived · protocol = {meta['protocol']}"
    )

    lines = [
        "### Table 4.4: Rule baseline vs Random Forest on real field observations",
        "",
        f"*{header}*",
        "",
        "| Model | Macro F1 | " + " | ".join(f"{c} F1" for c in CLASSES) + " |",
        "| :--- | :---: | " + " | ".join([":---:"] * len(CLASSES)) + " |",
    ]
    for label, pred, macro in (("Rule-based schedule lookup", y_rule, rule_f1),
                               ("Random Forest (observation-trained)", y_pred, model_f1)):
        per = f1_score(y_true, pred, average=None, labels=CLASSES, zero_division=0)
        lines.append(f"| {label} | {macro:.4f} | " +
                     " | ".join(f"{v:.4f}" for v in per) + " |")
    lines += [
        "",
        f"Random Forest fold macro-F1: {fold_f1.mean():.4f} ± {fold_f1.std():.4f} "
        f"(min {fold_f1.min():.4f}, max {fold_f1.max():.4f})",
        "",
        f"Observations fall in {meta['slots']} distinct day-hour slots "
        f"({meta['per_slot']:.1f} each).",
    ]
    # The leakage figure travels WITH the table. Splitting them is how the
    # inflated number ends up quoted on its own.
    if slot_f1 is not None:
        lines += [
            "",
            f"**Time-slot leakage check.** Re-running the folds grouped by "
            f"day-hour instead of by lecturer gives macro-F1 "
            f"**{slot_f1:.4f}** (against {model_f1:.4f} lecturer-grouped).",
        ]
        if model_f1 - slot_f1 > 0.10:
            lines += [
                "",
                "> The gap means the lecturer-grouped score is inflated by the "
                "forest recognising *when* the observations were collected "
                "rather than how lecturers behave. The lecturer-grouped figure "
                "is NOT reportable at this sample.",
            ]
    lines += [
        "",
        "Attendance-history features are absent: no real lecturer has any row in "
        "`attendance_record`, so they would be constant at 0.0.",
    ]
    md = TABLES / "table4_real_validation_rule_vs_model.md"
    md.write_text("\n".join(lines) + "\n", encoding="utf-8")

    csv_path = TABLES / "table4_real_validation_rule_vs_model.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["model", "macro_f1"] + [f"{c}_f1" for c in CLASSES])
        for label, pred, macro in (("rule_based", y_rule, rule_f1),
                                   ("random_forest", y_pred, model_f1)):
            per = f1_score(y_true, pred, average=None, labels=CLASSES, zero_division=0)
            w.writerow([label, f"{macro:.4f}"] + [f"{v:.4f}" for v in per])
    return md, csv_path


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--protocol", default="all",
                    choices=["all", "observation_first", "estimate_first"])
    ap.add_argument("--exclude-overrides", action="store_true")
    ap.add_argument("--folds", type=int, default=5)
    ap.add_argument("--no-write", action="store_true",
                    help="print only; do not touch notebooks/tables")
    args = ap.parse_args()

    rows = load_validations(args.protocol, args.exclude_overrides)
    print(f"validation rows: {len(rows)}  (protocol={args.protocol}, "
          f"overrides {'excluded' if args.exclude_overrides else 'included'})")
    if not rows:
        raise SystemExit("nothing to train on")

    schedule = load_real_schedule()
    events = load_events()
    sem_start, sem_end = load_window()
    X, y, groups, slots, rule, skipped = build(
        rows, schedule, events, sem_start, sem_end)

    if skipped:
        print(f"  skipped {skipped} row(s): the lecturer has no real timetable")
    print(f"usable rows: {len(y)}   lecturers: {len(set(groups))}")
    for c in CLASSES:
        print(f"    {c:<28} {int((y == c).sum())}")

    if len(y) < 40:
        print("\n  ! PRELIMINARY. Under 40 rows is a smoke test of the method,")
        print("    not a result. Do not quote these numbers.")

    y_true, y_pred, y_rule, fold_f1, folds, grouped = evaluate(
        X, y, groups, rule, args.folds)

    rule_f1 = report("RULE BASELINE  (schedule_lookup_status on the real timetable)",
                     y_true, y_rule)
    model_f1 = report("RANDOM FOREST  (folds grouped by LECTURER)", y_true, y_pred)

    # ---- the time-slot leakage test ---------------------------------------
    # Grouping folds by lecturer stops the forest memorising a PERSON. It does
    # not stop it memorising a TIME. Observations are collected in batches, so
    # a slot walked once can be homogeneous -- "Wed 09:00, everyone was out" --
    # and that is a fact about the researchers' route, not about lecturers. It
    # generalises across people, so lecturer-grouped folds never catch it.
    #
    # Re-grouping on the day-hour removes the shortcut. If the model's lead
    # survives only in the lecturer-grouped number, the lead is an artefact of
    # when the walking happened and must not be reported.
    slot_f1 = slot_rule_f1 = None
    try:
        s_true, s_pred, s_rule, _sf, _sn, _sg = evaluate(
            X, y, slots, rule, args.folds)
        slot_f1 = f1_score(s_true, s_pred, average="macro", zero_division=0)
        slot_rule_f1 = f1_score(s_true, s_rule, average="macro", zero_division=0)
    except SystemExit:
        print()
        print("  ! too few distinct day-hour slots to run the leakage test")

    print()
    print("=" * 68)
    print(f"  distinct day-hour slots            {len(set(slots))}  "
          f"({len(y) / max(len(set(slots)), 1):.1f} observations each)")
    print(f"  rule macro-F1                      {rule_f1:.4f}")
    print(f"  model, folds grouped by LECTURER   {model_f1:.4f}   "
          f"(diff {model_f1 - rule_f1:+.4f})")
    if slot_f1 is not None:
        print(f"  model, folds grouped by TIME SLOT  {slot_f1:.4f}   "
              f"(diff {slot_f1 - slot_rule_f1:+.4f})   <-- the honest one")
        if model_f1 - slot_f1 > 0.10:
            print()
            print("  ** TIME-SLOT LEAKAGE DETECTED.")
            print("     The lecturer-grouped score is inflated: the forest is")
            print("     recognising WHEN you walked, not how lecturers behave.")
            print("     Do NOT quote the lecturer-grouped number.")
            print("     Fix by spreading observations over many more distinct")
            print("     day-hour slots -- few observations each, many slots.")
    if not grouped:
        print("  NOTE: ungrouped folds -- see the warning above.")
    print("=" * 68)

    if not args.no_write:
        md, csv_path = write_tables(
            {"n": len(y), "folds": folds, "grouped": grouped,
             "protocol": args.protocol, "slots": len(set(slots)),
             "per_slot": len(y) / max(len(set(slots)), 1)},
            y_true, y_pred, y_rule, rule_f1, model_f1, fold_f1, slot_f1)
        print(f"\nwrote {md.relative_to(TABLES.parent.parent)}")
        print(f"wrote {csv_path.relative_to(TABLES.parent.parent)}")


if __name__ == "__main__":
    sys.exit(main())
