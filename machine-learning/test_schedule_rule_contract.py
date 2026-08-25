"""
The schedule rule exists twice. This proves the two copies agree.

    python machine-learning/test_schedule_rule_contract.py

    geobot.schedule_lookup_status()      SQL      -> production availability
    dataset_loader._block_at()           Python   -> training features

WHY THIS EXISTS. These two already drifted once. Migration 008 taught the SQL
function about `faculty_schedule.campus`; `_block_at` was not updated, so for
several days the live service said a lecturer teaching in Santiago was in a
class here while the training data said the opposite. The symptom was a rule
baseline that barely moved after a fix that should have moved it — nothing
crashed, and nothing in the logs said anything was wrong.

The duplication itself is not the defect and is not removed here: production is
SQL on the availability hot path, training is Python over an in-memory sample
set, and merging them would mean a per-row round trip for millions of rows. What
the duplication needs is a test that fails the moment the two disagree.

Written in Python because only Python can reach both: psycopg2 for the SQL
function, a direct import for `_block_at`. Exits non-zero on disagreement.

READ-ONLY. Any fixture it needs is created inside a transaction that is rolled
back, so production data is untouched.
"""

from __future__ import annotations

import os
import sys
from datetime import date, datetime, time
from pathlib import Path

import psycopg2
import psycopg2.extras

sys.path.insert(0, str(Path(__file__).resolve().parent))

for line in (Path(__file__).resolve().parent / ".env").read_text().splitlines():
    if line.strip() and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())

import dataset_loader as dl                                      # noqa: E402

SEMESTER = "2026-2027-1"
TZ = "Asia/Manila"


def sql_status(cur, faculty_id, when: datetime, campus: str = "echague"):
    cur.execute(
        "select * from geobot.schedule_lookup_status(%s, %s::timestamptz, %s, %s, %s)",
        (faculty_id, when.strftime("%Y-%m-%d %H:%M:%S+08"), SEMESTER, TZ, campus),
    )
    r = cur.fetchone()
    return r["status_code"], r["matched_block"]


def python_block(blocks, when: datetime):
    """`_block_at` returns the block kind, or None. Map it the way
    `_schedule_label` does so the two sides are comparable."""
    return dl._block_at(blocks, when)


def expected_status(block_kind, is_event_day):
    """The mapping schedule_lookup_status applies, restated from its own body."""
    if is_event_day:
        return "unavailable_off_schedule"
    if block_kind == "class":
        return "in_scheduled_class"
    if block_kind in ("consultation", "admin"):
        return "available_consultation"
    return "unavailable_off_schedule"


def main() -> int:
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute("select id from geobot.faculty where full_name = 'SIM-02'")
    row = cur.fetchone()
    if not row:
        print("SIM-02 not loaded; run 003_synthetic_attendance.sql first")
        return 1
    fid = str(row["id"])

    schedule = dl.load_schedule(SEMESTER)
    blocks = schedule.get(fid, [])
    events = dl.load_events()

    # SIM-02's Tuesday: 07:00-10:00 on the Santiago campus.
    tue = date(2026, 11, 3)
    exam = date(2026, 9, 16)          # corrected midterm, a disrupting event
    plain = date(2026, 10, 14)        # the removed placeholder, no longer an event

    cases = [
        ("no block at all",                datetime.combine(tue,   time(21, 0)), "echague"),
        ("boundary: one minute before",    datetime.combine(tue,   time(6, 59)),  "echague"),
        ("boundary: exact start",          datetime.combine(tue,   time(7, 0)),   "echague"),
        ("during the block, other campus", datetime.combine(tue,   time(8, 0)),   "echague"),
        ("during the block, own campus",   datetime.combine(tue,   time(8, 0)),   "santiago"),
        ("boundary: exact end (exclusive)", datetime.combine(tue,  time(10, 0)),  "echague"),
        ("boundary: one minute after",     datetime.combine(tue,   time(10, 1)),  "echague"),
        ("event day (corrected exam)",     datetime.combine(exam,  time(9, 0)),   "echague"),
        ("former placeholder exam day",    datetime.combine(plain, time(9, 0)),   "echague"),
        # 19 November carries TWO rows: the non-graduating final examination
        # (disrupts) and the academic-window end marker (does not). Keying
        # events by date alone let the marker hide the examination on the
        # Python side while SQL still saw it. Regression case for that.
        ("date with exam AND window marker",
         datetime.combine(date(2026, 11, 19), time(9, 0)), "echague"),
    ]

    failures = []
    print(f"{'case':<34} {'SQL':<26} {'matched':<20} {'Python':<14} ok")
    print("-" * 100)

    for label, when, campus in cases:
        # `_block_at` answers for the campus dataset_loader is configured for.
        # Only compare like with like: when the SQL call asks about a different
        # campus, point the Python side at the same one.
        prev, dl.CAMPUS = dl.CAMPUS, campus
        try:
            py_block = python_block(blocks, when)
        finally:
            dl.CAMPUS = prev

        status, matched = sql_status(cur, fid, when, campus)
        is_event = when.date() in events and events[when.date()]["disrupts_schedule"]
        want = expected_status(py_block, is_event)

        ok = status == want
        if not ok:
            failures.append((label, status, want, py_block))
        print(f"{label:<34} {status:<26} {str(matched):<20} {str(py_block):<14} {'ok' if ok else 'FAIL'}")

    conn.rollback()          # nothing was written, but be explicit
    conn.close()

    print()
    if failures:
        print(f"{len(failures)} disagreement(s) between the SQL and Python schedule rules:")
        for label, got, want, blk in failures:
            print(f"  {label}: SQL said {got!r}, Python implies {want!r} (block={blk!r})")
        return 1

    print(f"all {len(cases)} cases agree: schedule_lookup_status() == _block_at()")
    return 0


if __name__ == "__main__":
    sys.exit(main())
