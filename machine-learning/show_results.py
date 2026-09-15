"""
Print every reported result straight from the database. Read-only.

    python machine-learning/show_results.py

FOR THE DEFENSE. A panelist asking "where did these numbers come from?" is
better answered by running this than by a screenshot of a table. Nothing here
computes anything new -- it reads the same rows the thesis figures were built
from, so if this printed something different from the paper, the paper would be
wrong. That is the point of running it in front of them.

READ-ONLY BY CONSTRUCTION. Every statement below is a SELECT. There is no
write path in this file, so it cannot alter the evidence it is displaying.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import database_connector as db  # noqa: E402

RUN = "b0011d70-68b1-4f81-8d80-ef3f9e0d4acc"      # run-03-simulation
MODEL = "rf-20260909-072845"                       # the served classifier

METRICS = ("faithfulness", "context_recall", "context_precision", "answer_relevancy")
NICE = {"faithfulness": "Faithfulness", "context_recall": "Context Recall",
        "context_precision": "Context Precision", "answer_relevancy": "Answer Relevancy"}
CATS = [("campus_navigation", "Campus navigation"),
        ("general_institutional", "General institutional"),
        ("faculty_availability", "Faculty availability")]


def rule(title: str) -> None:
    print()
    print("=" * 78)
    print("  " + title)
    print("=" * 78)


def paired(metric: str) -> dict:
    """
    Means over queries BOTH arms scored.

    PAIRED, NOT POOLED. A query counts only where both architectures produced a
    score, so the two columns describe the same set of questions. An unpaired
    average would compare different question sets and flatter whichever arm
    happened to answer the easier ones.
    """
    pair = f"""join (select r2.eval_query_id qid
        from geobot.ragas_score g2
        join geobot.eval_result r2 on r2.id = g2.eval_result_id
        where r2.run_id = %s and g2.{metric} is not null
        group by r2.eval_query_id having count(distinct r2.mode) = 2) p
        on p.qid = r.eval_query_id"""
    rows = db.fetch_all(f"""select q.category, r.mode,
            round(avg(g.{metric})::numeric, 4) v, count(*) n
        from geobot.ragas_score g
        join geobot.eval_result r on r.id = g.eval_result_id
        join geobot.eval_query q on q.id = r.eval_query_id {pair}
        where r.run_id = %s and g.{metric} is not null
        group by q.category, r.mode""", (RUN, RUN))
    return {(x["category"], x["mode"]): x for x in rows}


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    # ---------------------------------------------------------- provenance
    rule("WHERE THESE NUMBERS COME FROM")
    run = db.fetch_all("""select run_label, started_at, prompt_template_version,
        groq_model_id, llm_temperature, judge_model, status_as_context,
        top_k, similarity_floor, embedding_model
        from geobot.eval_run where id = %s""", (RUN,))
    if run:
        r = run[0]
        print(f"  run            {r['run_label']}")
        print(f"  started        {r['started_at']}")
        print(f"  prompt         {r['prompt_template_version']}")
        print(f"  generator      {r['groq_model_id']}  @ temperature "
              f"{r['llm_temperature']}")
        print(f"  embedder       {r['embedding_model']}   "
              f"top-{r['top_k']}, floor {r['similarity_floor']}")
        print(f"  judge          {r['judge_model']}"
              "        <- a DIFFERENT model from the generator")
        print(f"  masked status passed to RAGAS as context: {r['status_as_context']}")
    n_q = db.fetch_all("select count(*) n from geobot.eval_query")[0]["n"]
    n_r = db.fetch_all("select count(*) n from geobot.eval_result where run_id=%s",
                       (RUN,))[0]["n"]
    print(f"  {n_q} registered queries, each put to both arms -> {n_r} stored results")

    # ---------------------------------------------------------- capability
    rule("SO2 (a) CAPABILITY  -- which queries retrieval alone cannot answer")
    cap = db.fetch_all("""select r.mode, count(*) n,
        count(*) filter (where r.answer not ilike '%%sorry%%') answered
        from geobot.eval_result r join geobot.eval_query q on q.id = r.eval_query_id
        where r.run_id = %s and q.category = 'faculty_availability'
        group by r.mode order by r.mode""", (RUN,))
    for x in cap:
        print(f"  {x['mode']:<10} answered {x['answered']} of {x['n']} availability questions")
    print("\n  The sixth is 'Where is SIM-22?' -- refused by both, and by design:")
    six = db.fetch_all("""select r.mode, r.t_rf_ms
        from geobot.eval_result r join geobot.eval_query q on q.id = r.eval_query_id
        where r.run_id = %s and q.query_text ilike 'Where is SIM-22%%'
        order by r.mode""", (RUN,))
    for x in six:
        # Only the enhanced row carries the argument. Standard has no classifier
        # at all, so 0.0 ms there is trivially true and proves nothing; saying
        # otherwise would claim evidence the row cannot give.
        note = ("   <- the classifier was never invoked, not invoked-then-hidden"
                if x["mode"] == "enhanced" else "   (no classifier in this arm)")
        print(f"    {x['mode']:<10} classifier time "
              f"{float(x['t_rf_ms'] or 0):.1f} ms{note}")

    # ---------------------------------------------------------- cost: time
    rule("SO2 (b) COST IN RESPONSE TIME  -- by category, not pooled")
    t = db.fetch_all("""select q.category, r.mode,
            round(avg(r.t_total_ms)::numeric, 1) total,
            round(avg(r.t_rf_ms)::numeric, 1) rf
        from geobot.eval_result r join geobot.eval_query q on q.id = r.eval_query_id
        where r.run_id = %s group by q.category, r.mode""", (RUN,))
    got = {(x["category"], x["mode"]): x for x in t}
    print(f"  {'category':<24}{'standard':>11}{'enhanced':>11}{'diff':>10}{'classifier':>12}")
    for key, label in CATS:
        s, e = got.get((key, "standard")), got.get((key, "enhanced"))
        if not (s and e):
            continue
        d = float(e["total"]) - float(s["total"])
        print(f"  {label:<24}{float(s['total']):>10.1f}{float(e['total']):>11.1f}"
              f"{d:>+10.1f}{float(e['rf'] or 0):>11.1f}")
    print("\n  Navigation is the noise floor: the classifier records 0.0 ms there,")
    print("  so any end-to-end difference of that size carries no information.")

    # ---------------------------------------------------------- cost: ragas
    rule("SO2 (c) COST IN RAGAS  -- paired means, judged by a separate model")
    for m in METRICS:
        got = paired(m)
        print(f"\n  {NICE[m]}")
        print(f"    {'question type':<26}{'standard':>11}{'enhanced':>11}{'n':>6}")
        for key, label in CATS:
            s, e = got.get((key, "standard")), got.get((key, "enhanced"))
            if not (s and e):
                continue
            print(f"    {label:<26}{float(s['v']):>11.4f}{float(e['v']):>11.4f}"
                  f"{s['n']:>6}")
    print("\n  Context Precision is flat by construction -- it is a retriever metric")
    print("  and both arms share a retriever. This was predicted before it was")
    print("  measured. Four metrics all rising would have been the suspicious result.")

    # ---------------------------------------------------------- classifier
    rule("SO1 CLASSIFIER  -- held-out partition of the simulation cohort")
    m = db.fetch_all("""select metrics, training_row_count, feature_list, algorithm
        from geobot.rf_model_version where version = %s""", (MODEL,))[0]
    met = m["metrics"] if isinstance(m["metrics"], dict) else json.loads(m["metrics"])
    fl = m["feature_list"] if isinstance(m["feature_list"], list) else json.loads(m["feature_list"])
    print(f"  model        {MODEL}   ({m['algorithm']})")
    print(f"  accuracy     {met['accuracy'] * 100:.2f}%")
    print(f"  macro F1     {met['f1_macro']:.4f}")
    print(f"  CV           {met['cv_f1_macro_mean']:.4f} +/- {met['cv_f1_macro_std']:.4f}")
    print(f"  rows         {int(m['training_row_count']):,} train / {int(met['test_rows']):,} test")
    print(f"  features     {len(fl)}: {', '.join(fl)}")
    print("\n  SIMULATION RESULT. Measured against generated attendance for the")
    print("  SIM-01..37 cohort -- no real lecturer has any attendance record.")

    print()


if __name__ == "__main__":
    main()
