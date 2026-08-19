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


def assert_research_ready() -> None:
    """
    Audit F-38. Hard gate for anything that produces a reportable number.

    A directory convention cannot stop synthetic data reaching a result;
    a query that refuses to run can. Called by train_rf.py (when persisting
    metrics), baseline_rule.py and the evaluation harness.
    """
    rows = fetch_all("select * from geobot.corpus_is_research_ready()")
    offenders = [r for r in rows if not r["ready"]]
    if offenders:
        detail = ", ".join(f"{r['entity']}={r['synthetic_rows']}" for r in offenders)
        raise RuntimeError(
            "REFUSING TO PRODUCE A RESEARCH RESULT: synthetic rows present "
            f"({detail}). Replace placeholder data with real ISU data and set "
            "data_origin='real' before running this. Audit F-38 / R1-R12."
        )
