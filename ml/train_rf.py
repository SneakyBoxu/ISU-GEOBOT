"""
Random Forest training (thesis §3.5.2, §3.7).

    python train_rf.py --semester 2025-2026-1 \
        --start 2025-08-11 --end 2025-12-19 \
        --label-source schedule_derived --plumbing-run

KEY DEPARTURE FROM THE THESIS TEXT, DELIBERATE AND DOCUMENTED (audit F-21):

The thesis says "80-20 ratio". A naive random split on (faculty, timestamp)
rows puts the SAME faculty member on the SAME day in both train and test. The
model then memorises "this person was in on 12 March" instead of learning
temporal patterns, and reports an inflated accuracy. This is one of the most
commonly-raised criticisms in an ML thesis defense.

Default here is a TIME-BASED split: train on the earlier 80% of the semester,
test on the later 20%. It is a stricter test and it matches the deployment
reality — you predict the future from the past. --split grouped_faculty is also
available if you want to claim generalisation to unseen faculty. --split random
exists only so the leakage can be *demonstrated* in Chapter 4; it warns loudly.

Cross-validation uses TimeSeriesSplit for the same reason, not plain KFold.

Metrics are persisted to rf_model_version ONLY when the run is research-grade:
real data (db.assert_research_ready) and non-circular labels. Audit R6.
"""

from __future__ import annotations

import argparse
import json
import platform
from datetime import date, datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (classification_report, confusion_matrix,
                             f1_score, precision_recall_fscore_support)
from sklearn.model_selection import GroupKFold, TimeSeriesSplit, cross_val_score

import db
from dataset import build_samples
from features import (ATTENDANCE_FEATURES, CLASS_ORDER, FacultyEncoder,
                      build_vector, feature_names)

MODEL_DIR = Path(__file__).parent / "models"
MODEL_DIR.mkdir(exist_ok=True)


def parse_args():
    p = argparse.ArgumentParser(description="Train the ISU-GeoBot availability classifier")
    p.add_argument("--semester", required=True)
    p.add_argument("--start", required=True, type=date.fromisoformat)
    p.add_argument("--end", required=True, type=date.fromisoformat)
    p.add_argument("--label-source", default="schedule_derived",
                   choices=["schedule_derived", "attendance_derived"])
    p.add_argument("--split", default="time_based",
                   choices=["time_based", "grouped_faculty", "random"])
    p.add_argument("--test-size", type=float, default=0.2)
    p.add_argument("--n-estimators", type=int, default=300)
    p.add_argument("--max-depth", type=int, default=None)
    p.add_argument("--min-samples-leaf", type=int, default=2)
    p.add_argument("--cv-folds", type=int, default=5)
    p.add_argument("--attendance-features", action="store_true",
                   help="Enable thesis §3.5.2(b) historical attendance features")
    p.add_argument("--plumbing-run", action="store_true",
                   help="Development run. Metrics are printed but NOT persisted.")
    return p.parse_args()


def split_indices(args, samples):
    n = len(samples)
    order = np.argsort([s.when for s in samples])

    if args.split == "time_based":
        cut = int(n * (1 - args.test_size))
        return order[:cut], order[cut:]

    if args.split == "grouped_faculty":
        faculties = sorted({s.faculty_id for s in samples})
        cut = max(1, int(len(faculties) * (1 - args.test_size)))
        train_f = set(faculties[:cut])
        tr = [i for i, s in enumerate(samples) if s.faculty_id in train_f]
        te = [i for i, s in enumerate(samples) if s.faculty_id not in train_f]
        return np.array(tr), np.array(te)

    print(
        "\n!! --split random selected. This LEAKS: the same faculty on the same\n"
        "!! day appears in train and test, and the reported accuracy will be\n"
        "!! inflated. Audit F-21. Use it only to demonstrate the effect.\n"
    )
    rng = np.random.default_rng(42)
    perm = rng.permutation(n)
    cut = int(n * (1 - args.test_size))
    return perm[:cut], perm[cut:]


def main():
    args = parse_args()

    circular = (
        args.label_source == "schedule_derived" and not args.attendance_features
    )
    if circular and not args.plumbing_run:
        raise SystemExit(
            "\nREFUSING TO PERSIST A CIRCULAR MODEL.\n\n"
            "Features and labels are both schedule-derived, so this forest is\n"
            "reproducing schedule_lookup_status() by construction. Its accuracy\n"
            "cannot be evidence that ML outperforms rule-based lookup — it IS\n"
            "the rule-based lookup (audit F-18/F-20, open decision C4).\n\n"
            "Either:\n"
            "  --label-source attendance_derived --attendance-features   (real)\n"
            "  --plumbing-run                                            (dev)\n"
        )

    print(f"building samples for {args.semester} ({args.start} .. {args.end}) ...")
    samples = build_samples(args.semester, args.start, args.end, args.label_source)
    if not samples:
        raise SystemExit("no training samples produced; check schedule and roster data")

    encoder = FacultyEncoder().fit(s.pseudonym_id for s in samples)
    names = feature_names(args.attendance_features)

    X = np.array([build_vector(s.context, encoder, args.attendance_features)
                  for s in samples])
    y = np.array([s.label for s in samples])

    labels, counts = np.unique(y, return_counts=True)
    print(f"\n{len(samples):,} samples, {len(names)} features")
    print("class support:")
    for lab, c in zip(labels, counts):
        print(f"  {lab:<28} {c:>7,}  ({c / len(y):.1%})")
    if len(labels) < 2:
        raise SystemExit("only one class present; the sampling window is degenerate")

    tr_idx, te_idx = split_indices(args, samples)
    X_tr, X_te, y_tr, y_te = X[tr_idx], X[te_idx], y[tr_idx], y[te_idx]
    print(f"\nsplit={args.split}  train={len(tr_idx):,}  test={len(te_idx):,}")

    clf = RandomForestClassifier(
        n_estimators=args.n_estimators,
        max_depth=args.max_depth,
        min_samples_leaf=args.min_samples_leaf,
        criterion="gini",              # thesis §3.5.2 specifies Gini Impurity
        class_weight="balanced",       # audit F-21: classes are imbalanced
        random_state=42,
        n_jobs=-1,
    )

    print("\ncross-validating ...")
    if args.split == "grouped_faculty":
        cv = GroupKFold(n_splits=args.cv_folds)
        groups = np.array([s.faculty_id for s in samples])[tr_idx]
        cv_scores = cross_val_score(clf, X_tr, y_tr, cv=cv, groups=groups,
                                    scoring="f1_macro")
    else:
        cv = TimeSeriesSplit(n_splits=args.cv_folds)
        cv_scores = cross_val_score(clf, X_tr, y_tr, cv=cv, scoring="f1_macro")
    print(f"  f1_macro {cv_scores.mean():.4f} (+/- {cv_scores.std():.4f})")

    clf.fit(X_tr, y_tr)
    y_pred = clf.predict(X_te)

    order = list(clf.classes_)
    prec, rec, f1, support = precision_recall_fscore_support(
        y_te, y_pred, labels=order, zero_division=0
    )
    cm = confusion_matrix(y_te, y_pred, labels=order)
    accuracy = float((y_pred == y_te).mean())

    print("\n" + classification_report(y_te, y_pred, zero_division=0))
    print("confusion matrix (rows=actual, cols=predicted)")
    print("  " + "  ".join(f"{c[:12]:>12}" for c in order))
    for name, row in zip(order, cm):
        print(f"  {name[:12]:>12}  " + "  ".join(f"{v:>12,}" for v in row))

    importance = sorted(
        zip(names, clf.feature_importances_), key=lambda kv: -kv[1]
    )
    print("\nfeature importance:")
    for n, v in importance:
        print(f"  {n:<28} {v:.4f}")
    print(
        "\nNOTE (audit F-20): feature importance is an INTRA-model diagnostic.\n"
        "It does not show that ML beats a rule-based lookup. Run baseline_rule.py\n"
        "on this same split for that comparison.\n"
    )

    metrics = {
        "accuracy": accuracy,
        "f1_macro": float(f1_score(y_te, y_pred, average="macro", zero_division=0)),
        "cv_f1_macro_mean": float(cv_scores.mean()),
        "cv_f1_macro_std": float(cv_scores.std()),
        "per_class": {
            cls: {"precision": float(p), "recall": float(r),
                  "f1": float(f), "support": int(s)}
            for cls, p, r, f, s in zip(order, prec, rec, f1, support)
        },
        "confusion_matrix": {"labels": order, "matrix": cm.tolist()},
        "test_rows": int(len(te_idx)),
    }

    version = datetime.now(timezone.utc).strftime("rf-%Y%m%d-%H%M%S")
    bundle = {
        "version": version,
        "model": clf,
        "encoder": encoder,
        "class_order": order,
        "feature_list": names,
        "include_attendance": args.attendance_features,
        "label_source": args.label_source,
        "split_strategy": args.split,
        "training_row_count": int(len(tr_idx)),
        "sklearn_version": sklearn.__version__,
        "python_version": platform.python_version(),
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "is_plumbing_run": bool(args.plumbing_run),
    }

    artifact = MODEL_DIR / (
        f"{version}{'-SYNTHETIC-PLUMBING' if args.plumbing_run else ''}.joblib"
    )
    joblib.dump(bundle, artifact)
    joblib.dump(bundle, MODEL_DIR / "rf_current.joblib")
    print(f"artifact: {artifact}")

    if args.plumbing_run:
        print(
            "\nplumbing run -> metrics NOT persisted to rf_model_version.\n"
            "Audit R6: reportable metrics come only from a real, non-circular run.\n"
        )
        return

    db.assert_research_ready()
    with db.cursor() as cur:
        cur.execute(
            """
            insert into geobot.rf_model_version
              (version, sklearn_version, training_row_count, class_order,
               feature_list, split_strategy, label_source, cv_folds,
               metrics, feature_importance, artifact_path, data_origin)
            values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'real')
            returning id
            """,
            (version, sklearn.__version__, int(len(tr_idx)), order, names,
             args.split, args.label_source, args.cv_folds,
             json.dumps(metrics), json.dumps(dict(importance)), str(artifact)),
        )
        print(f"registered rf_model_version id={cur.fetchone()['id']}")


if __name__ == "__main__":
    main()
