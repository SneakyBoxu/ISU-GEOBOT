"""
Apply the schema, functions, policies and migrations to a live database.

    python database/apply-database-migrations.py            # dry run
    python database/apply-database-migrations.py --initial --run  # first install
    python database/apply-database-migrations.py --run          # migrations only

WHY THIS EXISTS. Supabase's SQL editor works fine for one file. Six files that
must run in a fixed order, where the third depends on the first and a mistake
is discovered three screens later, is not a copy-and-paste job — and the order
is not guessable from the filenames alone.

WHAT IT WILL NOT DO. `database/tables-and-structure.sql` opens with `drop schema if exists geobot
cascade`, which destroys every table this system owns. That is correct for a
first install and catastrophic for the second, so schema.sql is skipped unless
you pass --initial, and --initial refuses to run if the schema already holds
data. Nothing here touches any schema other than `geobot`.

Reads DATABASE_URL from machine-learning/.env.
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
    ("database/tables-and-structure.sql", "tables, types, constraints", True),
    ("database/database-functions.sql", "presence resolution, retrieval, gazetteer", False),
    ("database/security-and-permissions.sql", "row-level security, deny by default", False),
    ("database/migrations/002_user_roles_and_locations.sql", "roles, POI audit, visibility", False),
    ("database/migrations/003_campus_places_and_departments.sql", "the 28 real campus locations", False),
    ("database/migrations/004_map_pin_icons.sql", "per-location icon override", False),
]


def database_url() -> str:
    env = ROOT / "machine-learning" / ".env"
    if env.exists():
        for line in io.open(env, encoding="utf-8"):
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip()
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("DATABASE_URL not found in machine-learning/.env or the environment.")
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
        print("\n  database/tables-and-structure.sql skipped. Pass --initial for a first install.")
    print("")

    if not args.run:
        print("Dry run. Re-run with --run to apply.\n")
        return

    conn = psycopg2.connect(url)
    try:
        with conn.cursor() as cur:
            if args.initial and schema_has_data(cur):
                sys.exit(
                    "REFUSING: geobot.poi already holds rows, and tables-and-structure.sql would drop it.\n"
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
                  "(0 is expected until document-knowledge-importer.py runs)")
    finally:
        conn.close()

    print("\nDone. Next: npm run preflight --prefix backend\n")


if __name__ == "__main__":
    main()
