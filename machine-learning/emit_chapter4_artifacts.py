"""
Emit the Chapter 4 tables and figures from ONE run, reproducibly.

    python machine-learning/emit_chapter4_artifacts.py \
        --semester 2026-2027-1 --start 2026-07-20 --end 2026-11-19 \
        --label-source attendance_derived --attendance-features \
        --data-origin synthetic

WHY THIS EXISTS
---------------
The tables and figures under thesis/ had NO generator anywhere in the repo.
They could not be reproduced, they predated both saved model artifacts, and
Table 4.2 reported an `available_consultation` F1 of 0.0000 that came from a
defect in the data rather than from the rule being weak: every synthetic block
was written as block_kind='class', so the schedule could not express that class
at all. A number nobody can regenerate is not evidence.

Both arms are scored HERE, on ONE sample set and ONE split, so the comparison
cannot drift the way two separate scripts drift. Every artifact carries the
cohort's data_origin in the caption, not only in the surrounding prose: a table
that travels into a slide deck has to take its provenance with it.

WHAT THE NUMBERS MEAN
---------------------
With --data-origin synthetic this is a SIMULATION. It answers "does the
pipeline recover the behavioural traits that were injected?" and never "does
the system predict real faculty availability?". Chapter 4 must say so.
"""

from __future__ import annotations

import argparse
import csv
from datetime import date, datetime, timezone
from pathlib import Path

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix

from dataset_loader import build_samples
from feature_engineering import CLASS_ORDER, FacultyEncoder, build_vector, feature_names
from schedule_rule_baseline import rule_predict
from train_availability_model import split_indices

ROOT = Path(__file__).resolve().parent.parent
TABLES = ROOT / "thesis" / "tables"
FIGURES = ROOT / "thesis" / "figures"

NICE = {
    "available_consultation": "available_consultation",
    "in_scheduled_class": "in_scheduled_class",
    "unavailable_off_schedule": "unavailable_off_schedule",
}


def parse_args():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--semester", required=True)
    p.add_argument("--start", required=True, type=date.fromisoformat)
    p.add_argument("--end", required=True, type=date.fromisoformat)
    p.add_argument("--label-source", default="attendance_derived",
                   choices=["schedule_derived", "attendance_derived"])
    p.add_argument("--data-origin", default=None,
                   help="Pin the cohort, e.g. synthetic.")
    p.add_argument("--split", default="time_based",
                   choices=["time_based", "grouped_faculty", "random"])
    p.add_argument("--test-size", type=float, default=0.2)
    p.add_argument("--n-estimators", type=int, default=300)
    p.add_argument("--max-depth", type=int, default=None)
    p.add_argument("--min-samples-leaf", type=int, default=2)
    p.add_argument("--attendance-features", action="store_true")
    p.add_argument("--no-write", action="store_true",
                   help="Print only; leave thesis/ untouched.")
    return p.parse_args()


def _origin_note(args, n_total, n_test) -> str:
    origin = args.data_origin or "mixed/unpinned"
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    return (f"*data_origin = **{origin}** · label_source = {args.label_source} · "
            f"split = {args.split} ({1 - args.test_size:.0%}/{args.test_size:.0%}) · "
            f"n = {n_total:,} samples, {n_test:,} in test · generated {stamp} by "
            f"`machine-learning/emit_chapter4_artifacts.py`*")


def _sim_warning(args) -> str:
    if args.data_origin != "synthetic":
        return ""
    return ("\n> **SIMULATION RESULT.** Attendance is generated, not observed. These "
            "figures show that the pipeline recovers the behavioural traits injected "
            "by `generate_synthetic_attendance.py`. They are not a measurement of how "
            "well the system predicts real lecturer availability.\n")


def _per_class_table(title, report, note, warn) -> str:
    lines = [f"### {title}", "", note, warn, "",
             "| Category / Class | Precision | Recall | F1-Score | Support (n) |",
             "| :--- | :---: | :---: | :---: | :---: |"]
    for cls in CLASS_ORDER:
        r = report[cls]
        lines.append(f"| `{NICE[cls]}` | {r['precision']:.4f} | {r['recall']:.4f} | "
                     f"{r['f1-score']:.4f} | {int(r['support'])} |")
    acc = report["accuracy"]
    macro = report["macro avg"]
    weighted = report["weighted avg"]
    total = int(report["macro avg"]["support"]) if "support" in report["macro avg"] else 0
    lines += [
        "| :--- | :---: | :---: | :---: | :---: |",
        f"| **Overall Accuracy** | — | — | **{acc:.4f}** | {total} |",
        f"| **Macro Average** | — | — | **{macro['f1-score']:.4f}** | — |",
        f"| **Weighted Average** | — | — | **{weighted['f1-score']:.4f}** | — |",
        "",
    ]
    return "\n".join(lines)


def _plot_confusion(cm, title, path):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(7.2, 6))
    im = ax.imshow(cm, cmap="Blues")
    ax.set_xticks(range(len(CLASS_ORDER)))
    ax.set_yticks(range(len(CLASS_ORDER)))
    short = [c.replace("_", "\n") for c in CLASS_ORDER]
    ax.set_xticklabels(short, fontsize=8)
    ax.set_yticklabels(short, fontsize=8)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("Actual")
    ax.set_title(title, fontsize=11)
    hi = cm.max() if cm.max() else 1
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax.text(j, i, f"{cm[i, j]:,}", ha="center", va="center", fontsize=9,
                    color="white" if cm[i, j] > hi * 0.6 else "black")
    fig.colorbar(im, ax=ax, shrink=0.8)
    fig.tight_layout()
    fig.savefig(path, dpi=160)
    plt.close(fig)


def _plot_comparison(rule_rep, rf_rep, title, path):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    metrics = ["Accuracy", "Macro F1"] + [f"{c}\nF1" for c in CLASS_ORDER]
    rule_vals = [rule_rep["accuracy"], rule_rep["macro avg"]["f1-score"]] + \
                [rule_rep[c]["f1-score"] for c in CLASS_ORDER]
    rf_vals = [rf_rep["accuracy"], rf_rep["macro avg"]["f1-score"]] + \
              [rf_rep[c]["f1-score"] for c in CLASS_ORDER]

    x = np.arange(len(metrics))
    w = 0.38
    fig, ax = plt.subplots(figsize=(9.5, 5.2))
    ax.bar(x - w / 2, rule_vals, w, label="Rule-based schedule lookup", color="#c0392b")
    ax.bar(x + w / 2, rf_vals, w, label="Random Forest", color="#1e7a46")
    for xi, v in zip(x - w / 2, rule_vals):
        ax.text(xi, v + 0.015, f"{v:.3f}", ha="center", fontsize=8)
    for xi, v in zip(x + w / 2, rf_vals):
        ax.text(xi, v + 0.015, f"{v:.3f}", ha="center", fontsize=8)
    ax.set_xticks(x)
    ax.set_xticklabels(metrics, fontsize=8)
    ax.set_ylim(0, 1.12)
    ax.set_ylabel("Score")
    ax.set_title(title, fontsize=11)
    ax.legend(loc="lower right", fontsize=9)
    ax.grid(axis="y", alpha=0.25)
    fig.tight_layout()
    fig.savefig(path, dpi=160)
    plt.close(fig)


def _plot_importance(names, importances, title, path):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    order = np.argsort(importances)
    fig, ax = plt.subplots(figsize=(8.4, 5.4))
    ax.barh([names[i] for i in order], [importances[i] for i in order], color="#1e7a46")
    for i, idx in enumerate(order):
        ax.text(importances[idx] + 0.004, i, f"{importances[idx]:.4f}",
                va="center", fontsize=8)
    ax.set_xlabel("Gini importance")
    ax.set_title(title, fontsize=11)
    ax.grid(axis="x", alpha=0.25)
    fig.tight_layout()
    fig.savefig(path, dpi=160)
    plt.close(fig)


def main():
    args = parse_args()

    print(f"building samples for {args.semester} ({args.start} .. {args.end}) ...")
    samples = build_samples(args.semester, args.start, args.end, args.label_source,
                            data_origin=args.data_origin)
    if not samples:
        raise SystemExit("no samples produced; check the roster, schedule and cohort flags")

    encoder = FacultyEncoder().fit(s.pseudonym_id for s in samples)
    names = feature_names(args.attendance_features)
    X = np.array([build_vector(s.context, encoder, args.attendance_features)
                  for s in samples])
    y = np.array([s.label for s in samples])

    tr_idx, te_idx = split_indices(args, samples)
    X_tr, X_te, y_tr, y_te = X[tr_idx], X[te_idx], y[tr_idx], y[te_idx]
    print(f"{len(samples):,} samples  train={len(tr_idx):,}  test={len(te_idx):,}")

    clf = RandomForestClassifier(
        n_estimators=args.n_estimators,
        max_depth=args.max_depth,
        min_samples_leaf=args.min_samples_leaf,
        criterion="gini",
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    clf.fit(X_tr, y_tr)
    rf_pred = clf.predict(X_te)

    # The rule reads the same test rows, through the same context objects.
    test_samples = [samples[i] for i in te_idx]
    rule_pred = np.array([rule_predict(s) for s in test_samples])

    rf_rep = classification_report(y_te, rf_pred, labels=CLASS_ORDER,
                                   output_dict=True, zero_division=0)
    rule_rep = classification_report(y_te, rule_pred, labels=CLASS_ORDER,
                                     output_dict=True, zero_division=0)

    note = _origin_note(args, len(samples), len(te_idx))
    warn = _sim_warning(args)

    print(f"\n  rule  accuracy {rule_rep['accuracy']:.4f}  macro F1 "
          f"{rule_rep['macro avg']['f1-score']:.4f}")
    print(f"  RF    accuracy {rf_rep['accuracy']:.4f}  macro F1 "
          f"{rf_rep['macro avg']['f1-score']:.4f}")
    consult = rule_rep["available_consultation"]["f1-score"]
    print(f"\n  GATE: rule available_consultation F1 = {consult:.4f}")
    if consult == 0.0:
        print("  !! STILL ZERO. The schedule cannot express available_consultation.")
        print("  !! Check that consultation blocks reached this cohort before")
        print("  !! reporting any comparison -- the rule is being scored against")
        print("  !! a schedule with one block type deleted.")

    if args.no_write:
        print("\nno-write: thesis/ untouched")
        return

    TABLES.mkdir(parents=True, exist_ok=True)
    FIGURES.mkdir(parents=True, exist_ok=True)

    (TABLES / "table1_rf_metrics.md").write_text(
        _per_class_table("Table 4.1: Random Forest Availability Classifier Metrics",
                         rf_rep, note, warn), encoding="utf-8")
    (TABLES / "table2_baseline_metrics.md").write_text(
        _per_class_table("Table 4.2: Rule-Based Schedule Lookup Baseline Metrics",
                         rule_rep, note, warn), encoding="utf-8")

    rows = [["Architecture / Model", "Accuracy (%)", "Macro F1"] +
            [f"{c} F1" for c in CLASS_ORDER]]
    rows.append(["Rule-Based Baseline", f"{rule_rep['accuracy'] * 100:.2f}%",
                 f"{rule_rep['macro avg']['f1-score']:.4f}"] +
                [f"{rule_rep[c]['f1-score']:.4f}" for c in CLASS_ORDER])
    rows.append(["Random Forest", f"{rf_rep['accuracy'] * 100:.2f}%",
                 f"{rf_rep['macro avg']['f1-score']:.4f}"] +
                [f"{rf_rep[c]['f1-score']:.4f}" for c in CLASS_ORDER])
    rows.append(["Difference (Δ)",
                 f"{(rf_rep['accuracy'] - rule_rep['accuracy']) * 100:+.2f}%",
                 f"{rf_rep['macro avg']['f1-score'] - rule_rep['macro avg']['f1-score']:+.4f}"] +
                [f"{rf_rep[c]['f1-score'] - rule_rep[c]['f1-score']:+.4f}"
                 for c in CLASS_ORDER])

    md = ["### Table 4.3: Rule baseline vs Random Forest, same split", "", note, warn, "",
          "| " + " | ".join(rows[0]) + " |",
          "| :--- | " + " | ".join([":---:"] * (len(rows[0]) - 1)) + " |"]
    for r in rows[1:]:
        md.append("| " + " | ".join(r) + " |")
    (TABLES / "table3_comparison_summary.md").write_text(
        "\n".join(md) + "\n", encoding="utf-8")

    with (TABLES / "table3_comparison_summary.csv").open("w", newline="",
                                                         encoding="utf-8") as fh:
        csv.writer(fh).writerows(rows)

    tag = f" ({args.data_origin})" if args.data_origin else ""
    _plot_confusion(confusion_matrix(y_te, rf_pred, labels=CLASS_ORDER),
                    f"Figure 4.1: Random Forest confusion matrix{tag}",
                    FIGURES / "fig1_confusion_matrix_rf.png")
    _plot_confusion(confusion_matrix(y_te, rule_pred, labels=CLASS_ORDER),
                    f"Figure 4.2: Rule baseline confusion matrix{tag}",
                    FIGURES / "fig2_confusion_matrix_baseline.png")
    _plot_comparison(rule_rep, rf_rep,
                     f"Figure 4.3: Rule baseline vs Random Forest{tag}",
                     FIGURES / "fig3_baseline_vs_rf_comparison.png")
    _plot_importance(names, clf.feature_importances_,
                     f"Figure 4.4: Random Forest feature importance{tag}",
                     FIGURES / "fig4_feature_importance.png")

    print(f"\nwrote 4 tables to {TABLES}")
    print(f"wrote 4 figures to {FIGURES}")


if __name__ == "__main__":
    main()
