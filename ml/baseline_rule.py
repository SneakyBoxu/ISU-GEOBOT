"""
Deterministic schedule-lookup baseline (audit F-20 / open decision C12).

    python baseline_rule.py --semester 2025-2026-1 \
        --start 2025-08-11 --end 2025-12-19 --label-source attendance_derived

WHY THIS SCRIPT EXISTS.

Thesis §3.5.2 claims that feature-importance analysis validates "the necessity
of the machine learning approach over a simple rule-based alternative". It
cannot. Feature importance ranks features *within* the forest; it says nothing
about how an IF/ELSE schedule lookup would have performed. The claim is central
to the study — §2.1.3 and §3.5.2 both lean on "better than rule-based" — and
any panelist with an ML background will spot the gap.

The only way to support the claim is to run the baseline and compare. This
script does that on EXACTLY the sample set and split that train_rf.py uses, so
the numbers are directly comparable.

Either outcome is publishable. If the forest wins, you have quantitative proof
of the study's central premise. If it does not, that is worth knowing before
the panel finds out — and "the RF matched the rule baseline on lecture
detection but outperformed it on availability during unscheduled hours" is a
genuinely interesting finding, not a failure.
"""

from __future__ import annotations

import argparse
from datetime import date

import numpy as np
from sklearn.metrics import (classification_report, confusion_matrix,
                             f1_score, precision_recall_fscore_support)

import db
from dataset import build_samples


def parse_args():
    p = argparse.ArgumentParser(description="Rule-based schedule-lookup baseline")
    p.add_argument("--semester", required=True)
    p.add_argument("--start", required=True, type=date.fromisoformat)
    p.add_argument("--end", required=True, type=date.fromisoformat)
    p.add_argument("--label-source", default="attendance_derived",
                   choices=["schedule_derived", "attendance_derived"])
    p.add_argument("--split", default="time_based",
                   choices=["time_based", "grouped_faculty", "random"])
    p.add_argument("--test-size", type=float, default=0.2)
    return p.parse_args()


def rule_predict(sample) -> str:
    """
    The rule the thesis says ML should beat: an IF/ELSE over the schedule.

    Mirrors geobot.schedule_lookup_status() exactly. Kept in Python rather than
    calling the SQL function per row so the baseline runs over the same
    in-memory sample set as the forest, with no per-row round trip.
    """
    ctx = sample.context
    if ctx.campus_event_flag:
        return "unavailable_off_schedule"
    if ctx.is_scheduled_class:
        return "in_scheduled_class"
    if ctx.is_consultation_hour:
        return "available_consultation"
    return "unavailable_off_schedule"


def main():
    args = parse_args()

    if args.label_source == "schedule_derived":
        print(
            "\n!! label_source=schedule_derived. The baseline will score ~100%\n"
            "!! because the labels ARE this rule. That is the circularity in\n"
            "!! audit F-18 made visible. Use attendance_derived labels for a\n"
            "!! meaningful comparison.\n"
        )

    samples = build_samples(args.semester, args.start, args.end, args.label_source)
    if not samples:
        raise SystemExit("no samples produced")

    # Identical split logic to train_rf.py so the test sets match row for row.
    order = np.argsort([s.when for s in samples])
    if args.split == "time_based":
        cut = int(len(samples) * (1 - args.test_size))
        te_idx = order[cut:]
    elif args.split == "grouped_faculty":
        faculties = sorted({s.faculty_id for s in samples})
        cut = max(1, int(len(faculties) * (1 - args.test_size)))
        train_f = set(faculties[:cut])
        te_idx = np.array([i for i, s in enumerate(samples)
                           if s.faculty_id not in train_f])
    else:
        rng = np.random.default_rng(42)
        perm = rng.permutation(len(samples))
        te_idx = perm[int(len(samples) * (1 - args.test_size)):]

    test = [samples[i] for i in te_idx]
    y_true = np.array([s.label for s in test])
    y_pred = np.array([rule_predict(s) for s in test])

    labels = sorted(set(y_true) | set(y_pred))
    accuracy = float((y_pred == y_true).mean())
    prec, rec, f1, support = precision_recall_fscore_support(
        y_true, y_pred, labels=labels, zero_division=0
    )
    cm = confusion_matrix(y_true, y_pred, labels=labels)

    print("=" * 70)
    print("RULE-BASED SCHEDULE LOOKUP — BASELINE")
    print("=" * 70)
    print(f"semester {args.semester}  split={args.split}  test rows={len(test):,}")
    print(f"\naccuracy  {accuracy:.4f}")
    print(f"f1_macro  {f1_score(y_true, y_pred, average='macro', zero_division=0):.4f}\n")
    print(classification_report(y_true, y_pred, zero_division=0))

    print("confusion matrix (rows=actual, cols=predicted)")
    print("  " + "  ".join(f"{c[:12]:>12}" for c in labels))
    for name, row in zip(labels, cm):
        print(f"  {name[:12]:>12}  " + "  ".join(f"{v:>12,}" for v in row))

    print(
        "\nCompare against train_rf.py run with the SAME --semester, --start,\n"
        "--end, --label-source and --split. Report both figures in Chapter 4.\n"
        "This comparison — not feature importance — is what supports the\n"
        "thesis's claim that ML is necessary over a rule-based alternative.\n"
    )


if __name__ == "__main__":
    main()
