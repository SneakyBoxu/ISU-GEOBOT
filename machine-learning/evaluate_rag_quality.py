"""
RAGAS scoring for a completed evaluation run (thesis §3.8.1).

    python score_ragas.py --run <eval_run_id>

Reads eval_result rows produced by backend/src/services/evaluation-runner.js and writes
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
import os

import database_connector as db


def parse_args():
    p = argparse.ArgumentParser(description="Score an ISU-GeoBot evaluation run")
    p.add_argument("--run", required=True, help="eval_run id")
    p.add_argument("--dry-run", action="store_true",
                   help="Compute and print without writing ragas_score")
    p.add_argument("--metrics", default=None,
                   help="Comma-separated subset to score, e.g. "
                        "'faithfulness,answer_relevancy'. Default: all four. "
                        "Each metric is saved as it finishes, so a run stopped "
                        "by a daily token cap can be resumed with the rest.")
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


METRIC_NAMES = ("context_precision", "context_recall",
                "faithfulness", "answer_relevancy")


def persist_metric(rows: list[dict], series, metric: str) -> tuple[int, int]:
    """
    Write ONE metric column for every row, leaving the others untouched.

    Returns (written, skipped). A NaN is written as NULL, not as NaN: the
    table CHECKs each metric is between 0 and 1, and every comparison against
    NaN is false, so a NaN would be rejected by the constraint -- or worse,
    counted as if it were a score. NULL says "not measured", which is true.
    """
    written = skipped = 0
    with db.cursor() as cur:
        for i, r in enumerate(rows):
            v = series.iloc[i]
            try:
                v = float(v)
                if v != v:          # NaN
                    v = None
            except (TypeError, ValueError):
                v = None
            if v is None:
                skipped += 1
            else:
                written += 1
            cur.execute(
                f"""
                insert into geobot.ragas_score (eval_result_id, {metric}, ragas_version)
                values (%s, %s, %s)
                on conflict (eval_result_id) do update set
                  {metric} = excluded.{metric},
                  scored_at = now()
                """,
                (r["id"], v, _ragas_version()),
            )
    return written, skipped


def score_one_metric(rows: list[dict], metric: str, judge, embeddings, run_config):
    """Score a single metric. Kept separate so each one can be persisted the
    moment it finishes -- see the note in main()."""
    from datasets import Dataset
    from ragas import evaluate
    import ragas.metrics as M

    ds = Dataset.from_dict({
        "question":     [r["query_text"] for r in rows],
        "contexts":     [list(r["retrieved_contexts"]) for r in rows],
        "answer":       [r["answer"] for r in rows],
        "ground_truth": [r["ground_truth_answer"] for r in rows],
    })
    result = evaluate(
        ds,
        metrics=[getattr(M, metric)],
        llm=judge,
        embeddings=embeddings,
        run_config=run_config,
        raise_exceptions=False,
    )
    return result.to_pandas()[metric]


def build_judge(judge_model: str, embed_model: str):
    """
    Build the judge, the embedder and the run config. Imported lazily so the
    rest of this file stays usable without the full evaluation stack.
    """
    from ragas.run_config import RunConfig

    # THE JUDGE HAS TO BE PASSED IN, NOT JUST NAMED.
    #
    # This used to call evaluate() with metrics alone and print a note asking
    # someone to "configure the judge for your provider". RAGAS does not read
    # eval_run.judge_model -- with no llm= argument it falls back to
    # llm_factory(), which builds a ChatOpenAI and dies asking for
    # OPENAI_API_KEY. So the run recorded judge_model='llama-3.3-70b-versatile'
    # while the scorer was reaching for GPT, and no score had ever been
    # produced to reveal the difference.
    #
    # The judge is built from the model name stored ON THE RUN, so what is
    # reported in Chapter 4 is what actually did the grading.
    from langchain_groq import ChatGroq
    from langchain_community.embeddings import HuggingFaceEmbeddings

    # Read from the environment only. The key is deliberately NOT added to
    # machine-learning/.env: that file is committed to this repository, and a
    # second copy of a live secret is a second place to leak it from.
    #
    #   Git Bash / Linux:  export GROQ_API_KEY=...   (or source backend/.env)
    #   PowerShell:        $env:GROQ_API_KEY = '...'
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise SystemExit(
            "GROQ_API_KEY is not set in the environment.\n"
            "The RAGAS judge runs on Groq. Without the key RAGAS falls back to "
            "its OpenAI default and fails asking for OPENAI_API_KEY, which "
            "looks like an unrelated problem.\n"
            "Export it for this shell -- do not add it to a committed .env."
        )

    # temperature=0: a judge that scores the same run differently twice cannot
    # support a reported metric.
    judge = ChatGroq(model=judge_model, temperature=0, api_key=api_key)

    # The SAME embedder as retrieval and query time (audit F-14). Answer
    # Relevancy and Context Precision are embedding-sensitive; scoring with a
    # different model than the system retrieves with measures the gap between
    # two embedders as if it were a property of the pipeline.
    embeddings = HuggingFaceEmbeddings(model_name=embed_model)

    print(f"judge      : {judge_model}")
    print(f"embeddings : {embed_model} (same model as retrieval, audit F-14)")
    print("the judge must differ from the generator and be identical across "
          "both arms (audit F-05).")

    # CONCURRENCY HAS TO COME DOWN, NOT UP.
    #
    # RAGAS defaults to max_workers=16. Against a free-tier Groq key that is
    # self-defeating, and the binding limit is not requests but TOKENS:
    #
    #   Rate limit reached for openai/gpt-oss-20b ... tokens per minute
    #   (TPM): Limit 8000, Used 7120, Requested 2043
    #
    # A RAGAS grading prompt carries the question, the retrieved contexts, the
    # answer and the ground truth -- roughly 2,000 tokens. So the ceiling is
    # about four evaluations per minute no matter how many workers ask, and
    # 4 metrics x 66 rows = 264 evaluations takes over an hour. Sixteen
    # parallel workers do not beat that; they just pile up 429s and sit in
    # exponential backoff. One worker settles into the allowed rate with the
    # fewest wasted attempts.
    #
    # max_retries is high on purpose: at this rate a call may legitimately be
    # refused several times before the token bucket refills, and giving up
    # writes NaN into a reported metric.
    #
    # On a paid key, raise RAGAS_MAX_WORKERS. Do not raise it here.
    run_config = RunConfig(
        max_workers=int(os.environ.get("RAGAS_MAX_WORKERS", "4")),
        timeout=180,
        max_retries=15,
        max_wait=30,
    )
    return judge, embeddings, run_config


def main():
    args = parse_args()

    # Audit F-38. Same gate as the generation harness, and it has to be the
    # same SCOPE too: the harness refuses on the corpus entities and consults
    # the registered test set for the rest. Calling this with the default
    # scope refused every run the harness had just spent 66 completions
    # producing.
    db.assert_research_ready(scope="rag")

    run = load_run(args.run)
    rows = load_results(args.run)

    # ONE METRIC AT A TIME, PERSISTED AS SOON AS IT FINISHES.
    #
    # This used to score all four metrics in a single evaluate() call and
    # write at the very end. On a free-tier key that is all-or-nothing, and
    # nothing is what it produced: the run reached 32 of 264 evaluations and
    # then hit the DAILY token ceiling --
    #
    #   tokens per day (TPD): Limit 200000, Used 199429
    #
    # -- so an entire day's quota was spent and no score survived it. Four
    # metrics x 66 rows x ~2,000 tokens is roughly 528,000 tokens, which does
    # not fit in a 200,000-token day at all.
    #
    # Scored per metric, each one lands in the database the moment it
    # completes. A day's quota now buys durable progress, and --metrics lets
    # the rest resume tomorrow without redoing what is already stored.
    wanted = [m.strip() for m in args.metrics.split(",")] if args.metrics \
        else list(METRIC_NAMES)
    unknown = [m for m in wanted if m not in METRIC_NAMES]
    if unknown:
        raise SystemExit(f"unknown metric(s): {unknown}. Known: {list(METRIC_NAMES)}")

    # After validation: build_judge loads a sentence-transformers model,
    # which is slow enough to be worth not doing for a typo.
    judge, embeddings, run_config = build_judge(
        run["judge_model"], run["judge_embedding_model"])

    print(f"\nscoring {len(rows)} results, metrics: {', '.join(wanted)}")
    for m in wanted:
        print(f"\n--- {m} ---", flush=True)
        try:
            series = score_one_metric(rows, m, judge, embeddings, run_config)
        except Exception as exc:                       # noqa: BLE001
            print(f"  {m} FAILED: {type(exc).__name__}: {str(exc)[:220]}")
            print("  earlier metrics are already saved; rerun with "
                  f"--metrics {m} when quota allows.")
            break
        if args.dry_run:
            print(f"  dry run — {m} not written")
            continue
        written, skipped = persist_metric(rows, series, m)
        print(f"  saved: {written} scored, {skipped} unscored (NULL)")

    report(args.run)


def report(run_id: str) -> None:
    """Summarise from the DATABASE, not from this process's results, so a
    metric scored on an earlier day is included."""
    rows = db.fetch_all(
        """
        select r.mode,
               avg(s.context_precision) cp, count(s.context_precision) n_cp,
               avg(s.context_recall)    cr, count(s.context_recall)    n_cr,
               avg(s.faithfulness)      fa, count(s.faithfulness)      n_fa,
               avg(s.answer_relevancy)  ar, count(s.answer_relevancy)  n_ar,
               count(*) n
          from geobot.eval_result r
          join geobot.ragas_score s on s.eval_result_id = r.id
         where r.run_id = %s
         group by r.mode
        """,
        (run_id,),
    )
    if not rows:
        print("\nno ragas_score rows yet for this run")
        return

    by = {r["mode"]: r for r in rows}
    print("\n" + "=" * 78)
    print("RAGAS — Standard RAG vs Enhanced RAG")
    print("=" * 78)
    print(f"{'metric':<22}{'standard':>12}{'enhanced':>12}{'delta':>12}{'scored':>14}")
    print("-" * 78)

    summary = {}
    for key, col, ncol in (("context_precision", "cp", "n_cp"),
                           ("context_recall", "cr", "n_cr"),
                           ("faithfulness", "fa", "n_fa"),
                           ("answer_relevancy", "ar", "n_ar")):
        s = by.get("standard", {}); e = by.get("enhanced", {})
        sv, ev = s.get(col), e.get(col)
        n = (s.get(ncol) or 0) + (e.get(ncol) or 0)
        if sv is None or ev is None:
            print(f"{key:<22}{'—':>12}{'—':>12}{'—':>12}{f'{n}/66':>14}")
            continue
        sv, ev = float(sv), float(ev)
        delta = ev - sv
        summary[key] = {"standard": sv, "enhanced": ev, "delta": delta, "scored": n}
        flag = "  <- flat by construction" if abs(delta) < 0.005 else ""
        print(f"{key:<22}{sv:>12.4f}{ev:>12.4f}{delta:>+12.4f}{f'{n}/66':>14}{flag}")

    print("-" * 78)
    print(
        "\nContext Precision is expected to be near-flat: both arms share a\n"
        "retriever, so it measures the same retrieval step twice. Say so in\n"
        "Chapter 4 rather than leaving the reader to notice it.\n"
    )
    if summary:
        print(json.dumps(summary, indent=2))


def _ragas_version() -> str:
    try:
        import ragas
        return getattr(ragas, "__version__", "unknown")
    except Exception:
        return "unknown"


if __name__ == "__main__":
    main()
