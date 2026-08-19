"""
RAGAS scoring for a completed evaluation run (thesis §3.8.1).

    python score_ragas.py --run <eval_run_id>

Reads eval_result rows produced by server/src/services/evalRunner.js and writes
ragas_score. Kept separate from generation so that changing the judge does not
require re-running the pipeline.

THE THING TO UNDERSTAND BEFORE READING THE OUTPUT (audit F-04).

Context Precision and Context Recall are RETRIEVER metrics, and both arms share
a retriever. Injecting an availability status downstream does not change which
chunks pgvector returns. So under the naive reading those two metrics are
IDENTICAL between arms by construction, and Faithfulness can actively favour
the standard arm: asked about availability with no availability context, a
well-behaved model says "I don't have that information", which is perfectly
faithful and scores 1.0, while the enhanced arm's substantive claim scores as
unsupported.

The resolution — decided by the researchers, recorded on
eval_run.status_as_context — is that the masked status is passed to RAGAS as a
distinct item in the `contexts` array for the enhanced arm. It IS retrieved
context; it is simply retrieved from the classifier rather than from pgvector,
and §3.5.4 describes Context Fusion as merging "three distinct information
sources". evalRunner already persists it that way.

Expected movement under that framing:
    Context Recall     rises on availability queries      (the point)
    Answer Relevancy   rises clearly                      (the strongest win)
    Faithfulness       now scored fairly
    Context Precision  roughly flat                       (still weak)

Report all four honestly, including the flat one, and explain why it is flat.
A panelist who understands RAGAS will respect that far more than a chart with
four bars that all happen to go up.
"""

from __future__ import annotations

import argparse
import json

import db


def parse_args():
    p = argparse.ArgumentParser(description="Score an ISU-GeoBot evaluation run")
    p.add_argument("--run", required=True, help="eval_run id")
    p.add_argument("--dry-run", action="store_true",
                   help="Compute and print without writing ragas_score")
    return p.parse_args()


def load_run(run_id: str) -> dict:
    run = db.fetch_one("select * from geobot.eval_run where id = %s", (run_id,))
    if not run:
        raise SystemExit(f"no eval_run {run_id}")
    if run["judge_model"] == run["groq_model_id"]:
        raise SystemExit(
            "judge_model equals the generator. Self-evaluation invalidates the "
            "scores (audit F-05)."
        )
    if not run["status_as_context"]:
        print(
            "\n!! eval_run.status_as_context is FALSE.\n"
            "!! Context Precision and Context Recall cannot differ between arms\n"
            "!! and Faithfulness may favour the STANDARD arm. See audit F-04.\n"
        )
    return run


def load_results(run_id: str) -> list[dict]:
    rows = db.fetch_all(
        """
        select r.id, r.mode, r.retrieved_contexts, r.answer,
               q.query_text, q.ground_truth_answer, q.category
        from geobot.eval_result r
        join geobot.eval_query q on q.id = r.eval_query_id
        where r.run_id = %s
        order by q.registered_at, r.mode
        """,
        (run_id,),
    )
    if not rows:
        raise SystemExit("no eval_result rows for that run")
    return rows


def score(rows: list[dict], judge_model: str, embed_model: str):
    """
    Runs RAGAS. Imported lazily so the rest of this file stays usable (and this
    docstring stays readable) without the full evaluation stack installed.
    """
    from datasets import Dataset
    from ragas import evaluate
    from ragas.metrics import (answer_relevancy, context_precision,
                               context_recall, faithfulness)

    ds = Dataset.from_dict({
        "question":     [r["query_text"] for r in rows],
        "contexts":     [list(r["retrieved_contexts"]) for r in rows],
        "answer":       [r["answer"] for r in rows],
        "ground_truth": [r["ground_truth_answer"] for r in rows],
    })

    print(f"scoring {len(rows)} results with judge={judge_model} ...")
    print(
        "NOTE: configure the RAGAS judge LLM and embeddings via the ragas "
        "settings for your provider. The judge MUST differ from the generator "
        "and must be identical across both arms (audit F-05)."
    )
    result = evaluate(
        ds,
        metrics=[context_precision, context_recall, faithfulness, answer_relevancy],
    )
    return result.to_pandas()


def main():
    args = parse_args()

    # Audit F-38. Same gate as the generation harness.
    db.assert_research_ready()

    run = load_run(args.run)
    rows = load_results(args.run)

    df = score(rows, run["judge_model"], run["judge_embedding_model"])

    metrics = ["context_precision", "context_recall", "faithfulness", "answer_relevancy"]
    print("\n" + "=" * 74)
    print("RAGAS — Standard RAG vs Enhanced RAG")
    print("=" * 74)
    print(f"{'metric':<22}{'standard':>12}{'enhanced':>12}{'delta':>12}")
    print("-" * 74)

    summary = {}
    for m in metrics:
        vals = {}
        for mode in ("standard", "enhanced"):
            idx = [i for i, r in enumerate(rows) if r["mode"] == mode]
            vals[mode] = float(df.iloc[idx][m].mean()) if idx else float("nan")
        delta = vals["enhanced"] - vals["standard"]
        summary[m] = {**vals, "delta": delta}
        flag = "  <- flat by construction" if abs(delta) < 0.005 else ""
        print(f"{m:<22}{vals['standard']:>12.4f}{vals['enhanced']:>12.4f}"
              f"{delta:>+12.4f}{flag}")

    print("-" * 74)
    print(
        "\nContext Precision is expected to be near-flat: both arms share a\n"
        "retriever, so it measures the same retrieval step twice. Say so in\n"
        "Chapter 4 rather than leaving the reader to notice it.\n"
    )

    if args.dry_run:
        print("dry run — nothing written")
        return

    with db.cursor() as cur:
        for i, r in enumerate(rows):
            row = df.iloc[i]
            cur.execute(
                """
                insert into geobot.ragas_score
                  (eval_result_id, context_precision, context_recall,
                   faithfulness, answer_relevancy, ragas_version)
                values (%s,%s,%s,%s,%s,%s)
                on conflict (eval_result_id) do update set
                  context_precision = excluded.context_precision,
                  context_recall    = excluded.context_recall,
                  faithfulness      = excluded.faithfulness,
                  answer_relevancy  = excluded.answer_relevancy,
                  scored_at         = now()
                """,
                (r["id"], float(row["context_precision"]), float(row["context_recall"]),
                 float(row["faithfulness"]), float(row["answer_relevancy"]),
                 _ragas_version()),
            )
    print(f"wrote {len(rows)} ragas_score rows")
    print(json.dumps(summary, indent=2))


def _ragas_version() -> str:
    try:
        import ragas
        return getattr(ragas, "__version__", "unknown")
    except Exception:
        return "unknown"


if __name__ == "__main__":
    main()
