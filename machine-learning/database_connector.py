"""
Database access for the Python side (ML service, ingestion, training, eval).

Uses a direct PostgreSQL connection rather than the Supabase REST client:
the offline scripts do bulk vector writes and analytical reads that PostgREST
is a poor fit for, and a direct connection keeps the pgvector adapter simple.

The connection string is a service-level credential. It lives in machine-learning/.env and
never leaves the server. Audit W2.
"""

from __future__ import annotations

import os
from contextlib import contextmanager

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from pgvector.psycopg2 import register_vector

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
SCHEMA = os.getenv("DB_SCHEMA", "geobot")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Copy machine-learning/.env.example to machine-learning/.env and fill it in."
    )


@contextmanager
def connect(readonly: bool = False):
    """Yield a connection with pgvector registered and search_path set."""
    conn = psycopg2.connect(DATABASE_URL)
    try:
        if readonly:
            conn.set_session(readonly=True)
        register_vector(conn)
        with conn.cursor() as cur:
            cur.execute(f"set search_path = {SCHEMA}, public, extensions")
        yield conn
        if not readonly:
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@contextmanager
def cursor(readonly: bool = False):
    """Yield a dict cursor."""
    with connect(readonly=readonly) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            yield cur


def fetch_all(sql: str, params: tuple = ()) -> list[dict]:
    with cursor(readonly=True) as cur:
        cur.execute(sql, params)
        return [dict(r) for r in cur.fetchall()]


def fetch_one(sql: str, params: tuple = ()) -> dict | None:
    with cursor(readonly=True) as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
        return dict(row) if row else None


CORPUS_ENTITIES = ("poi", "document", "document_chunk")
PEOPLE_ENTITIES = ("faculty", "faculty_schedule", "attendance_record",
                   "guard_presence_event")


def assert_research_ready(scope: str = "all") -> None:
    """
    Audit F-38. Hard gate for anything that produces a reportable number.

    A directory convention cannot stop synthetic data reaching a result;
    a query that refuses to run can. Called by train_availability_model.py
    (when persisting metrics) and evaluate_rag_quality.py.

    TWO SCOPES, BECAUSE THIS GATE EXISTS TWICE.

    The identical rule lives in backend/src/services/evaluation-runner.js
    (assertResearchReady). That copy was refined to block only what would
    actually be contaminated; this one was not, and the two silently
    disagreed: the Node harness generated all 66 eval_result rows and then
    this function refused to score them. Nothing was wrong with the data --
    the two gates simply had different opinions about it. That is the same
    one-rule-implemented-twice failure this project has hit before, so the
    wording below is deliberately kept close to the JavaScript.

        scope="all"  (default)  every entity must be real. Correct for model
                                metrics, which are computed FROM attendance.
        scope="rag"             corpus entities must be real, because every
                                query retrieves against them. Faculty and
                                attendance are required only when the
                                REGISTERED test set actually contains a
                                question whose answer depends on them.

    Keying "rag" on the registered set rather than a flag means adding one
    faculty_availability query re-arms the gate automatically. Nothing here
    lets a synthetic number out: an availability query scored against
    invented attendance still refuses.
    """
    if scope not in ("all", "rag"):
        raise ValueError(f"unknown scope {scope!r}")

    rows = fetch_all("select * from geobot.corpus_is_research_ready()")

    if scope == "all":
        required = {r["entity"] for r in rows}
    else:
        categories = {
            r["category"] for r in fetch_all("select category from geobot.eval_query")
        }
        needs_people = bool(categories & {"faculty_availability", "combined"})
        required = set(CORPUS_ENTITIES) | (set(PEOPLE_ENTITIES) if needs_people else set())

    offenders = [r for r in rows if not r["ready"] and r["entity"] in required]
    if offenders:
        detail = ", ".join(f"{r['entity']}={r['synthetic_rows']}" for r in offenders)
        raise RuntimeError(
            "REFUSING TO PRODUCE A RESEARCH RESULT: synthetic rows present "
            f"({detail}). Replace placeholder data with real ISU data and set "
            "data_origin='real' before running this. Audit F-38 / R1-R12."
        )

    ignored = [r for r in rows if not r["ready"] and r["entity"] not in required]
    if ignored:
        print(
            "\nNOTE: synthetic rows exist in "
            + ", ".join(r["entity"] for r in ignored)
            + ".\nThe registered test set does not ask anything that depends on "
            "them, so\nthis run proceeds. Chapter 4 must still say which arms "
            "were measured.\n"
        )
