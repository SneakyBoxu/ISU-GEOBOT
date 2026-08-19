"""
Apply the schema, functions, policies and migrations to a live database.

    python db/apply.py            # show what would run, change nothing
    python db/apply.py --run      # execute, in order, each file in one transaction

WHY THIS EXISTS. Supabase's SQL editor works fine for one file. Six files that
must run in a fixed order, where the third depends on the first and a mistake
is discovered three screens later, is not a copy-and-paste job — and the order
is not guessable from the filenames alone.

WHAT IT WILL NOT DO. `db/schema.sql` opens with `drop schema if exists geobot
cascade`, which destroys every table this system owns. That is correct for a
first install and catastrophic for the second, so schema.sql is skipped unless
you pass --initial, and --initial refuses to run if the schema already holds
data. Nothing here touches any schema other than `geobot`.

Reads DATABASE_URL from ml/.env.
"""

from __future__ import annotations

import argparse
import io
import os
import pathlib
import sys

import psycopg2

ROOT = pathlib.Path(__file__).resolve().parent.parent

# The order is the point. Functions reference tables; policies reference
# functions; migrations assume all three.
FILES = [
    ("db/schema.sql", "tables, types, constraints", True),
    ("db/functions.sql", "presence resolution, retrieval, gazetteer", False),
    ("db/policies.sql", "row-level security, deny by default", False),
    ("db/migrations/002_roles_and_locations.sql", "roles, POI audit, visibility", False),
    ("db/migrations/003_campus_locations.sql", "the 28 real campus locations", False),
    ("db/migrations/004_poi_icon.sql", "per-location icon override", False),
]


def database_url() -> str:
    env = ROOT / "ml" / ".env"
    if env.exists():
        for line in io.open(env, encoding="utf-8"):
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip()
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("DATABASE_URL not found in ml/.env or the environment.")
    return url


def schema_has_data(cur) -> bool:
    cur.execute("select to_regclass('geobot.poi')")
    if cur.fetchone()[0] is None:
        return False
    cur.execute("select count(*) from geobot.poi")
    return cur.fetchone()[0] > 0


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", action="store_true", help="execute (default is a dry run)")
    ap.add_argument("--initial", action="store_true",
                    help="include schema.sql, which DROPS the geobot schema first")
    args = ap.parse_args()

    url = database_url()
    host = url.split("@")[-1].split(":")[0]
    print(f"\ntarget: {host}")
    print(f"mode:   {'EXECUTE' if args.run else 'dry run (nothing will change)'}\n")

    planned = [f for f in FILES if args.initial or not f[2]]
    for path, why, destructive in planned:
        mark = "  DROPS geobot FIRST" if destructive else ""
        print(f"  {path:<48} {why}{mark}")
    if not args.initial:
        print("\n  db/schema.sql skipped. Pass --initial for a first install.")
    print("")

    if not args.run:
        print("Dry run. Re-run with --run to apply.\n")
        return

    conn = psycopg2.connect(url)
    try:
        with conn.cursor() as cur:
            if args.initial and schema_has_data(cur):
                sys.exit(
                    "REFUSING: geobot.poi already holds rows, and schema.sql would drop it.\n"
                    "Re-run without --initial to apply only the migrations."
                )

        for path, why, _ in planned:
            sql = io.open(ROOT / path, encoding="utf-8").read()
            print(f"applying {path} ...", end=" ", flush=True)
            # One transaction per file: a file either lands whole or not at all,
            # and a failure leaves the previous files applied so the fix is to
            # correct one file and re-run rather than to start over.
            with conn:
                with conn.cursor() as cur:
                    cur.execute(sql)
            print("ok")

        with conn.cursor() as cur:
            cur.execute("select count(*) from geobot.poi where is_published")
            print(f"\npublished locations: {cur.fetchone()[0]}")
            cur.execute("select count(*) from geobot.document_chunk")
            print(f"embedded chunks:     {cur.fetchone()[0]}  "
                  "(0 is expected until ingest.py runs)")
    finally:
        conn.close()

    print("\nDone. Next: npm run preflight --prefix server\n")


if __name__ == "__main__":
    main()
