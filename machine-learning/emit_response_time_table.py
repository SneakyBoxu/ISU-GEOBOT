"""
Emit the Response Time half of SO2 from measurements already collected.

    python machine-learning/emit_response_time_table.py

WHERE THE DATA COMES FROM
-------------------------
knowledge-search-service.js times every stage of a query (route, guard, rf,
embed, retrieve, llm, total) and eval_result stores all seven per run. Nothing
new has to be executed: 132 runs are already recorded, 66 standard and 66
enhanced, over the same 33 pre-registered queries.

WHAT THIS SCRIPT FOUND, AND WHY IT MATTERS MORE THAN THE LATENCY
----------------------------------------------------------------
t_rf_ms is 0.0 on EVERY enhanced run. The Random Forest is invoked only for
faculty-availability questions, and eval_query holds 20 campus_navigation and
13 general_institutional rows and ZERO faculty_availability rows. So the
"enhanced" arm of the recorded comparison never actually engaged the
enhancement: both arms ran the same retrieval-and-generate path.

Any difference between the two arms therefore measures run-to-run variance,
not the architecture. The script prints this as a hard check rather than
leaving it for a reader to notice, because the alternative is a Chapter 4 that
reports a latency win the design cannot produce.
"""

from __future__ import annotations

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
         group by mode order by mode
    """)
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
        f"*n = {std['n']} standard and {enh['n']} enhanced runs over the same "
        f"pre-registered query set ({cat_line}) · measured in "
        f"`knowledge-search-service.js`, stored per stage in `eval_result` · "
        f"generated {stamp} by `machine-learning/emit_response_time_table.py`*",
        "",
    ]

    if availability_queries == 0:
        out += [
            "> **THIS COMPARISON MEASURES NOTHING ABOUT THE ARCHITECTURE.**",
            ">",
            "> `t_rf_ms` is **0.0 ms on every enhanced run**. The Random Forest is",
            "> reached only by a faculty-availability question, and the evaluation set",
            "> contains **no faculty_availability queries at all**. Both arms therefore",
            "> executed the same retrieval-and-generate path, and the gap below is",
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
    if availability_queries == 0:
        print()
        print("  !! SO2 IS NOT ANSWERABLE FROM THIS DATA.")
        print("  !! eval_query has no faculty_availability rows, so the enhancement")
        print("  !! never ran. Add availability queries and re-run the harness.")


if __name__ == "__main__":
    main()
