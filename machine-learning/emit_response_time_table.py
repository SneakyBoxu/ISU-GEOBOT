"""
Emit the Response Time half of SO2 from measurements already collected.

    python machine-learning/emit_response_time_table.py
    python machine-learning/emit_response_time_table.py --run-label run-03-simulation

WHERE THE DATA COMES FROM
-------------------------
knowledge-search-service.js times every stage of a query (route, guard, rf,
embed, retrieve, llm, total) and eval_result stores all seven per run. Nothing
new has to be executed: 132 runs are already recorded, 66 standard and 66
enhanced, over the same 33 pre-registered queries.

WHY IT REPORTS ONE RUN AND NOT ALL OF THEM
------------------------------------------
eval_result accumulates across every run ever executed. Averaging over all of
them pools runs that used different prompt template versions and different
query sets -- run-01 and run-02 predate the faculty_availability queries
entirely -- so the mean describes no experiment that was actually performed.

The table therefore reports a SINGLE run, the most recent by default, and
names it in the caption. Pass --run-label to pin a specific one.

THE CHECK THIS SCRIPT ENFORCES
------------------------------
The Random Forest is invoked only by a faculty-availability question. If the
selected run recorded t_rf_ms = 0.0 on every enhanced row, the "enhanced" arm
never engaged the enhancement, both arms ran the same retrieval-and-generate
path, and any difference between them is run-to-run variance rather than the
architecture. That was true of run-01 and run-02, whose query set held 20
campus_navigation and 13 general_institutional rows and no availability rows
at all. The script fails loudly rather than emitting a latency win the design
cannot produce.

"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

import database_connector as db

TABLES = Path(__file__).resolve().parent.parent / "thesis" / "tables"

STAGES = [("route", "Router"), ("guard", "Presence guard"), ("rf", "Random Forest"),
          ("embed", "Query embedding"), ("retrieve", "Vector retrieval"),
          ("llm", "LLM generation"), ("total", "End-to-end")]


def main():
    # The table uses a delta sign; a cp1252 console cannot encode it.
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--run-label", help="pin a specific eval_run (default: the most recent)")
    args = ap.parse_args()

    # Pick the run to report. Pooling runs would average across prompt template
    # versions and query sets, describing an experiment nobody performed.
    if args.run_label:
        run = db.fetch_all(
            "select id, run_label, prompt_template_version, data_origin, finished_at "
            "from geobot.eval_run where run_label = %s", (args.run_label,))
        if not run:
            raise SystemExit(f"no eval_run with run_label {args.run_label!r}")
    else:
        run = db.fetch_all(
            "select id, run_label, prompt_template_version, data_origin, finished_at "
            "from geobot.eval_run order by started_at desc limit 1")
        if not run:
            raise SystemExit("no eval_run rows; run the evaluation harness first")
    run = run[0]
    if not run["finished_at"]:
        raise SystemExit(
            f"run {run['run_label']} has not finished; its arms are incomplete "
            "and a table built from them would be wrong")

    rows = db.fetch_all("""
        select mode, count(*) n,
               round(avg(t_route_ms), 1)    route,
               round(avg(t_guard_ms), 1)    guard,
               round(avg(t_rf_ms), 1)       rf,
               round(avg(t_embed_ms), 1)    embed,
               round(avg(t_retrieve_ms), 1) retrieve,
               round(avg(t_llm_ms), 1)      llm,
               round(avg(t_total_ms), 1)    total,
               percentile_cont(0.5)  within group (order by t_total_ms) p50,
               percentile_cont(0.95) within group (order by t_total_ms) p95
          from geobot.eval_result
         where run_id = %s
         group by mode order by mode
    """, (run["id"],))
    if not rows:
        raise SystemExit("no eval_result rows; run the evaluation harness first")

    by_mode = {r["mode"]: r for r in rows}
    std, enh = by_mode.get("standard"), by_mode.get("enhanced")
    if not (std and enh):
        raise SystemExit("need both a standard and an enhanced arm to compare")

    categories = db.fetch_all(
        "select category, count(*) n from geobot.eval_query group by 1 order by 1")
    cat_line = ", ".join(f"{c['category']} {c['n']}" for c in categories)
    availability_queries = sum(c["n"] for c in categories
                               if c["category"] == "faculty_availability")

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    out = [
        "### Table 4.5: Response time, standard vs Enhanced RAG",
        "",
        f"*run `{run['run_label']}` · prompt template {run['prompt_template_version']} "
        f"· data_origin **{run['data_origin']}** · n = {std['n']} standard and "
        f"{enh['n']} enhanced over the same pre-registered query set ({cat_line}) "
        f"· measured in "
        f"`knowledge-search-service.js`, stored per stage in `eval_result` · "
        f"generated {stamp} by `machine-learning/emit_response_time_table.py`*",
        "",
    ]

    # The query set holding availability rows is necessary but not sufficient:
    # what matters is whether the classifier actually ran in THIS run.
    if availability_queries == 0 or float(enh["rf"]) == 0.0:
        out += [
            "> **THIS COMPARISON MEASURES NOTHING ABOUT THE ARCHITECTURE.**",
            ">",
            "> `t_rf_ms` is **0.0 ms across the enhanced arm of this run**. The",
            "> Random Forest is reached only by a faculty-availability question, so",
            "> either the evaluation set carries no such query or none reached the",
            "> classifier. Both arms therefore executed the same",
            "> retrieval-and-generate path, and the gap below is",
            "> run-to-run variance in the router and the LLM call.",
            ">",
            "> To answer SO2 the query set needs availability questions in it. Until",
            "> then this table is a latency baseline for the deployed pipeline, and",
            "> nothing more.",
            "",
        ]

    out += ["| Stage | Standard (mean ms) | Enhanced (mean ms) | Δ |",
            "| :--- | ---: | ---: | ---: |"]
    for key, label in STAGES:
        s_v, e_v = float(std[key]), float(enh[key])
        bold = "**" if key == "total" else ""
        out.append(f"| {bold}{label}{bold} | {bold}{s_v:,.1f}{bold} | "
                   f"{bold}{e_v:,.1f}{bold} | {bold}{e_v - s_v:+,.1f}{bold} |")
    out += [
        f"| Median (p50) | {float(std['p50']):,.1f} | {float(enh['p50']):,.1f} | "
        f"{float(enh['p50']) - float(std['p50']):+,.1f} |",
        f"| 95th percentile | {float(std['p95']):,.1f} | {float(enh['p95']):,.1f} | "
        f"{float(enh['p95']) - float(std['p95']):+,.1f} |",
        "",
    ]

    text = "\n".join(out)
    TABLES.mkdir(parents=True, exist_ok=True)
    (TABLES / "table5_response_time.md").write_text(text, encoding="utf-8")

    print(text)
    print()
    print(f"wrote {TABLES / 'table5_response_time.md'}")
    if availability_queries == 0 or float(enh["rf"]) == 0.0:
        print()
        print("  !! SO2 IS NOT ANSWERABLE FROM THIS RUN.")
        print("  !! t_rf_ms is 0.0 across the enhanced arm, so the classifier never")
        print("  !! ran. Check the query set holds availability rows, then re-run")
        print("  !! the harness with --simulation.")


if __name__ == "__main__":
    main()
