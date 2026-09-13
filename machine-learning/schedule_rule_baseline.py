"""
Deterministic schedule-lookup baseline (audit F-20 / open decision C12).

    python schedule_rule_baseline.py --semester 2025-2026-1 \
        --start 2025-08-11 --end 2025-12-19 --label-source attendance_derived

WHY THIS SCRIPT EXISTS.

Thesis §3.5.2 claims that feature-importance analysis validates "the necessity
of the machine learning approach over a simple rule-based alternative". It
cannot. Feature importance ranks features *within* the forest; it says nothing
about how an IF/ELSE schedule lookup would have performed. The claim is central
to the study — §2.1.3 and §3.5.2 both lean on "better than rule-based" — and
any panelist with an ML background will spot the gap.

The only way to support the claim is to run the baseline and compare. This
script does that on EXACTLY the sample set and split that train_availability_model.py uses, so
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

import database_connector as db
from dataset_loader import build_samples


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
    p.add_argument("--data-origin", default=None,
                   help="Pin the cohort, e.g. synthetic. Must match the "
                        "model run or the comparison is not like-for-like.")
    return p.parse_args()


def rule_predict(sample) -> str:
    """
    The rule the thesis says ML should beat: an IF/ELSE over the schedule.

    Mirrors geobot.schedule_lookup_status(). Kept in Python rather than calling
    the SQL function per row so the baseline runs over the same in-memory
    sample set as the forest, with no per-row round trip.

    "MIRRORS" IS A PROMISE THAT HAS ALREADY BEEN BROKEN ONCE. When migration
    008 taught the SQL function about `campus`, this function was not updated
    and neither was dataset_loader._block_at(), so the live service and the
    baseline disagreed about whether a lecturer teaching in Santiago was in
    class. The docstring still said "exactly".

    The campus rule now lives in _block_at(), which both arms read through
    `is_scheduled_class`, so this function stays a pure translation of the
    context flags and has nothing campus-specific to drift on. Anything else
    added to the SQL function has to be added there, not here.
    """
    ctx = sample.context

    # THE ORDER OF THESE FOUR TESTS IS THE RULE. Each one wins over the ones
    # below it, and swapping any pair changes the prediction:
    #
    #   1. A campus-wide event cancels everything, including a class that the
    #      timetable still shows. Move this below the class test and every
    #      lecturer reads as "in class" on a day the university stood down.
    #   2. A scheduled class beats a consultation window. Some lecturers have
    #      both on the same hour; the class is the commitment they must keep.
    #      Swap these two and a lecturer who is teaching reads as free.
    #   3. A consultation window is the only thing that produces "available".
    #      Delete this test and the baseline can never predict availability at
    #      all -- which is exactly the 0.0000 F1 this project saw before the
    #      synthetic generator declared any consultation windows.
    #   4. Anything else is off-schedule. This is the deliberate refusal at the
    #      heart of the study: an empty hour is NOT free time, because the
    #      timetable does not know where the lecturer is.
    if ctx.campus_event_flag:
        return "unavailable_off_schedule"
    if ctx.is_scheduled_class:
        return "in_scheduled_class"
    if ctx.is_consultation_hour:
        return "available_consultation"
    return "unavailable_off_schedule"


def main():
    args = parse_args()

    # Refuse quietly to be useful: schedule-derived labels make this baseline
    # score near 100% because the labels ARE this rule applied to the same
    # schedule. The comparison would be a tautology, so say so loudly rather
    # than print an impressive number nobody can use.
    if args.label_source == "schedule_derived":
        print(
            "\n!! label_source=schedule_derived. The baseline will score ~100%\n"
            "!! because the labels ARE this rule. That is the circularity in\n"
            "!! audit F-18 made visible. Use attendance_derived labels for a\n"
            "!! meaningful comparison.\n"
        )

    samples = build_samples(args.semester, args.start, args.end, args.label_source,
                            data_origin=args.data_origin)
    if not samples:
        raise SystemExit("no samples produced")

    # THIS SPLIT MUST STAY IDENTICAL TO train_availability_model.py. Both arms
    # have to be scored on the same rows or the comparison in Chapter 4 measures
    # the split instead of the models. Change the sort key, the cut point or the
    # seed here without changing it there and the two numbers stop being
    # comparable -- silently, because both scripts still run and still print.
    #
    # time_based is the default and the honest one: the test set is the LATEST
    # 20% of samples, never a random sample. A random split lets the model see
    # Thursday while being tested on Wednesday, which flatters it.
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

    # Score ONLY on the held-out rows. y_true comes from the attendance-derived
    # labels; y_pred is the rule applied to the same rows' schedule context. The
    # gap between them is what the forest has to beat to justify itself.
    test = [samples[i] for i in te_idx]
    y_true = np.array([s.label for s in test])
    y_pred = np.array([rule_predict(s) for s in test])

    # Union, not just the observed truth: if the rule predicts a class that
    # never actually occurs in the test set, that error has to appear in the
    # report rather than being dropped from the label list.
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
        "\nCompare against train_availability_model.py run with the SAME --semester, --start,\n"
        "--end, --label-source and --split. Report both figures in Chapter 4.\n"
        "This comparison — not feature importance — is what supports the\n"
        "thesis's claim that ML is necessary over a rule-based alternative.\n"
    )


if __name__ == "__main__":
    main()
