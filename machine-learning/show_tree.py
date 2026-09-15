"""
Print one tree out of the trained forest.

"Where is the Random Forest? Can I see a tree?" is a fair question and most
answers to it are a diagram. This prints the real thing: the decision rules of
one estimator inside saved-models/rf_current.joblib, the same artifact the
Flask service loads and serves.

    python show_tree.py              # tree 0, three levels deep
    python show_tree.py --tree 7     # a different estimator
    python show_tree.py --depth 5    # further down

WHAT TO POINT AT. The first splits are mostly attendance features --
hist_early_departure_rate, hist_presence_rate -- not schedule features. A
timetable lookup has no access to those. That is the argument for using a model
here at all, shown rather than asserted (thesis 3.5.2(b), audit F-18/F-20).

The artifact is ~135 MB, so the load takes a few seconds. Say so while it runs.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import joblib
from sklearn.tree import export_text

MODEL = Path(__file__).resolve().parent / "saved-models" / "rf_current.joblib"


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--tree", type=int, default=0, help="which estimator (0-299)")
    p.add_argument("--depth", type=int, default=3, help="levels to print")
    args = p.parse_args()

    if not MODEL.exists():
        raise SystemExit(
            f"{MODEL} is missing.\n"
            "It is not in git -- 135 MB. See saved-models/MODEL-README.txt for\n"
            "where to download it and the SHA-256 to verify it against."
        )

    print(f"loading {MODEL.name} ... (~135 MB, a few seconds)")
    bundle = joblib.load(MODEL)
    forest = bundle["model"]
    features = list(bundle["feature_list"])

    if not 0 <= args.tree < len(forest.estimators_):
        raise SystemExit(f"--tree must be 0..{len(forest.estimators_) - 1}")

    print()
    print(f"  version       {bundle['version']}")
    print(f"  trees         {len(forest.estimators_)}")
    print(f"  criterion     {forest.criterion}")
    print(f"  class_weight  {forest.class_weight}")
    print(f"  classes       {', '.join(forest.classes_)}")
    print(f"  split         {bundle['split_strategy']}")
    print(f"  trained       {bundle['trained_at']}")
    print(f"  sklearn       {bundle['sklearn_version']}")

    t = forest.estimators_[args.tree]
    print()
    print(f"Tree {args.tree} of {len(forest.estimators_)}: depth {t.get_depth()}, "
          f"{t.get_n_leaves():,} leaves, {t.tree_.node_count:,} nodes.")
    print(f"First {args.depth} levels of its decision rules:")
    print()
    print(export_text(t, feature_names=features, max_depth=args.depth,
                      decimals=2, show_weights=False))

    used = [f for f in features if f in export_text(
        t, feature_names=features, max_depth=args.depth)]
    attendance = [f for f in used if f.startswith("hist_")]
    print(f"Features appearing in these {args.depth} levels: {', '.join(used)}")
    if attendance:
        print(f"Of those, {len(attendance)} are attendance history: "
              f"{', '.join(attendance)}.")
        print("A timetable lookup has no access to those.")


if __name__ == "__main__":
    main()
