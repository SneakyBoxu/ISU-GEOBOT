"""
Upload a registrar workbook from the admin portal.

Two endpoints, deliberately separated:

    POST /schedule/preview   parse and report. Writes NOTHING.
    POST /schedule/apply     write, but only the parse that was reviewed.

Two kinds of workbook are accepted, told apart by CONTENT rather than filename,
because both arrive from the registrar as .xlsx and the operator should not have
to pick the right upload box:

    a teaching timetable   ->  faculty_schedule
    an academic calendar   ->  institutional_event

WHY NOT ONE CLICK
-----------------
schedule_importer.py refuses to write to the database on its own, because the
workbook describes 37 real lecturers and a silent mis-parse corrupts the
schedule of record for all of them. The failure is quiet by nature: a merged
cell read wrongly turns a three-hour class into thirty minutes, and a lecturer
whose name fails to match simply vanishes and looks free all week.

So the upload keeps a human in the loop, in the same shape as the OCR
announcement pipeline: extract, show the operator what was found, and write only
after they agree. `apply` will not accept a file whose parse does not match the
checksum returned by `preview`, so what is written is always what was reviewed.

WHAT IT TOUCHES
---------------
A timetable replaces only `faculty_schedule` rows for the named semester with
data_origin='real'. A calendar replaces only the academic-window markers and the
examination days in `institutional_event`. The synthetic cohort, attendance,
documents, national holidays and evaluation tables are never altered.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import io
import json

import openpyxl
from flask import Blueprint, jsonify, request

import calendar_parser as cal
import database_connector as db
import schedule_importer as si

schedule_bp = Blueprint("schedule", __name__)

MAX_UPLOAD_BYTES = 12 * 1024 * 1024


# ------------------------------------------------------------------- shared
def _block_key(b: dict) -> tuple:
    return (b["faculty"], b["dow"], b["start"].strftime("%H:%M"),
            b["end"].strftime("%H:%M"), b.get("course") or "",
            b.get("room") or "", b["campus"])


def _checksum(names: list[str], blocks: list[dict]) -> str:
    payload = json.dumps(
        {"names": sorted(names), "blocks": sorted(_block_key(b) for b in blocks)},
        default=str, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()


def _read_workbook(payload):
    raw_b64 = payload.get("content_b64")
    if not isinstance(raw_b64, str) or not raw_b64.strip():
        raise ValueError("`content_b64` is required")
    try:
        raw = base64.b64decode(raw_b64, validate=True)
    except (binascii.Error, ValueError):
        raise ValueError("`content_b64` is not valid base64")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise ValueError(f"workbook exceeds {MAX_UPLOAD_BYTES // (1024*1024)} MB")

    # read_only=True discards merge geometry, and the merges ARE the durations.
    try:
        return openpyxl.load_workbook(io.BytesIO(raw), data_only=True)
    except Exception as exc:
        raise ValueError(f"not a readable .xlsx workbook: {exc}") from None


def _parse_any_sheet(wb):
    """
    Find the timetable sheet instead of demanding it be called 'Faculty'.

    The importer used to require that exact name, which fails on a workbook
    where the same grid is called 'FACULTY LOADING' or 'Sheet1'. The sheet is
    identifiable by its CONTENT, so every sheet is tried and the one yielding
    the most blocks wins.
    """
    best = ([], [])
    for sheet_name in wb.sheetnames:
        try:
            names, blocks = si.parse_faculty_sheet(wb[sheet_name])
        except Exception:
            names, blocks = [], []
        if len(blocks) > len(best[1]):
            best = (names, blocks)
    return best


def classify(wb):
    """
    Decide what kind of workbook this is, by content rather than by filename.

    Each parser is tried and whichever recognises the file wins. If neither
    does, the error names every sheet that was examined, because "unsupported
    file" without saying what was looked at is not a usable message.
    """
    names, blocks = _parse_any_sheet(wb)
    if blocks:
        return "schedule", (names, blocks)

    for sheet_name in wb.sheetnames:
        parsed = cal.parse_calendar_sheet(wb[sheet_name])
        if parsed["entries"]:
            parsed["sheet"] = sheet_name
            return "calendar", parsed

    raise ValueError(
        "this workbook is neither a teaching timetable nor an academic calendar. "
        "A timetable has a row beginning 'NAME' for each lecturer followed by a "
        "weekly time grid; a calendar has a 'PARTICULARS' header row with a "
        "column per semester. Sheets examined: " + ", ".join(wb.sheetnames))


# ---------------------------------------------------------------- timetable
def _current_rows(semester: str) -> list[dict]:
    return db.fetch_all(
        """
        select f.full_name, fs.day_of_week, fs.start_time, fs.end_time,
               coalesce(fs.course_code,'') course_code,
               coalesce(fs.room_label,'')  room_label, fs.campus
          from geobot.faculty_schedule fs
          join geobot.faculty f on f.id = fs.faculty_id
         where fs.semester = %s and fs.data_origin = 'real'
        """, (semester,))


def _schedule_summary(names, blocks, semester) -> dict:
    current = _current_rows(semester)
    cur_keys = {(r["full_name"], r["day_of_week"],
                 r["start_time"].strftime("%H:%M"), r["end_time"].strftime("%H:%M"),
                 r["course_code"], r["room_label"], r["campus"]) for r in current}
    new_keys = {_block_key(b) for b in blocks}

    known = {r["full_name"] for r in db.fetch_all(
        "select full_name from geobot.faculty where data_origin = 'real'")}

    return {
        "kind": "schedule",
        "semester": semester,
        "checksum": _checksum(names, blocks),
        "parsed": {
            "lecturers": len(names),
            "blocks": len(blocks),
            "echague": sum(1 for b in blocks if b["campus"] == "echague"),
            "santiago": sum(1 for b in blocks if b["campus"] == "santiago"),
        },
        "stored": {"lecturers": len({r["full_name"] for r in current}),
                   "blocks": len(current)},
        "diff": {
            "added": len(new_keys - cur_keys),
            "removed": len(cur_keys - new_keys),
            "unchanged": len(new_keys & cur_keys),
        },
        "new_lecturers": sorted(n for n in names if n not in known),
        "sample": [
            {"faculty": b["faculty"], "day_of_week": b["dow"],
             "start": b["start"].strftime("%H:%M"), "end": b["end"].strftime("%H:%M"),
             "course": b.get("course") or "", "room": b.get("room") or "",
             "campus": b["campus"]}
            for b in blocks[:12]
        ],
    }


def _schedule_apply(names, blocks, semester) -> dict:
    with db.connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into geobot.faculty (full_name, department_id, data_origin)
                select v.full_name, d.id, 'real'
                  from (select unnest(%s::text[]) as full_name) v
                  cross join (select id from geobot.department
                               where short_code = 'CCSICT') d
                 where not exists (select 1 from geobot.faculty f
                                    where f.full_name = v.full_name)
                """, (names,))
            inserted = cur.rowcount

            cur.execute("""delete from geobot.faculty_schedule
                            where semester = %s and data_origin = 'real'""",
                        (semester,))
            removed = cur.rowcount

            cur.executemany(
                """
                insert into geobot.faculty_schedule
                  (faculty_id, day_of_week, start_time, end_time, block_kind,
                   semester, course_code, room_label, campus, data_origin)
                select f.id, %s, %s::time, %s::time, 'class',
                       %s, %s, %s, %s, 'real'
                  from geobot.faculty f
                 where f.full_name = %s
                """,
                [(b["dow"], b["start"].strftime("%H:%M"), b["end"].strftime("%H:%M"),
                  semester, b.get("course") or None, (b.get("room") or None),
                  b["campus"], b["faculty"]) for b in blocks])

            cur.execute("""select count(*) from geobot.faculty_schedule
                            where semester = %s and data_origin = 'real'""",
                        (semester,))
            written = cur.fetchone()[0]

    return {"applied": True, "kind": "schedule", "semester": semester,
            "faculty_inserted": inserted, "blocks_removed": removed,
            "blocks_written": written}


# ----------------------------------------------------------------- calendar
def _calendar_checksum(sig: dict) -> str:
    return hashlib.sha256(json.dumps(
        {"window": [sig["window_start"], sig["window_end"]],
         "exams": sig["exam_dates"]}, sort_keys=True).encode()).hexdigest()


def _calendar_summary(parsed: dict, semester_col: str) -> dict:
    sig = cal.significant(parsed, semester_col)

    stored_exams = {r["event_date"].isoformat() for r in db.fetch_all(
        "select event_date from geobot.institutional_event "
        "where event_type = 'exam_period'")}
    stored_window = [r["event_date"].isoformat() for r in db.fetch_all(
        "select event_date from geobot.institutional_event "
        "where event_type = 'other' and title like %s order by event_date",
        ("Academic window%",))]

    new_exams = set(sig["exam_dates"])
    return {
        "kind": "calendar",
        "sheet": parsed.get("sheet"),
        "semester_column": semester_col,
        "columns": parsed["columns"],
        "checksum": _calendar_checksum(sig),
        "window": {"start": sig["window_start"], "end": sig["window_end"]},
        "stored_window": {
            "start": stored_window[0] if stored_window else None,
            "end": stored_window[-1] if len(stored_window) > 1 else None,
        },
        "exams": sig["exams"],
        "exam_days": len(new_exams),
        "diff": {
            "added": sorted(new_exams - stored_exams),
            "removed": sorted(stored_exams - new_exams),
            "unchanged": len(new_exams & stored_exams),
        },
        "entries_recognised": len(parsed["entries"]),
    }


def _calendar_apply(parsed: dict, semester_col: str) -> dict:
    """
    Replace the academic window and the examination days.

    Holidays are NOT touched. They come from 007_philippine_holidays.sql, they
    are national rather than institutional, and a school calendar that does not
    list them is not evidence that they stopped existing.
    """
    sig = cal.significant(parsed, semester_col)
    if not (sig["window_start"] and sig["window_end"]):
        raise ValueError(
            "this calendar has no 'Start of Classes' and 'Final Examination for "
            f"Non-Graduating' pair for the {semester_col} semester, so the "
            "academic window cannot be determined")

    with db.connect() as conn:
        with conn.cursor() as cur:
            cur.execute("""delete from geobot.institutional_event
                            where event_type = 'exam_period'
                               or (event_type = 'other' and title like %s)""",
                        ("Academic window%",))
            removed = cur.rowcount

            cur.execute(
                """insert into geobot.institutional_event
                     (event_date, event_type, title, disrupts_schedule, data_origin)
                   values (%s, 'other', %s, false, 'real'),
                          (%s, 'other', %s, false, 'real')""",
                (sig["window_start"],
                 "Academic window start: Start of Classes, Undergraduate (official)",
                 sig["window_end"],
                 "Academic window end (interpretation): last published "
                 "undergraduate final examination date"))

            cur.executemany(
                """insert into geobot.institutional_event
                     (event_date, event_type, title, disrupts_schedule, data_origin)
                   values (%s, 'exam_period', %s, true, 'real')""",
                [(day, "Examination period (official academic calendar)")
                 for day in sig["exam_dates"]])

            cur.execute("select count(*) from geobot.institutional_event")
            total = cur.fetchone()[0]

    # A calendar has to land in BOTH stores. institutional_event holds the dates
    # the classifier compares against; the corpus holds the same dates as
    # sentences a student can ask about. Writing only the first is why "when
    # does the second semester start" returned nothing while the exam flags were
    # perfectly correct.
    chunks = _ingest_calendar_text(parsed)

    return {"applied": True, "kind": "calendar",
            "window": {"start": sig["window_start"], "end": sig["window_end"]},
            "rows_removed": removed,
            "exam_days_written": len(sig["exam_dates"]),
            "institutional_events_total": total,
            "corpus_chunks_written": chunks}


def _ingest_calendar_text(parsed: dict, school_year: str = "2026-2027") -> int:
    """Render the whole calendar as prose and put it in the retrieval corpus."""
    import document_upload as du
    import document_knowledge_importer as imp

    du._use_in_process_model()
    text = cal.render_markdown(parsed, school_year)
    title = f"isu-academic-calendar-{school_year}"
    checksum = hashlib.sha256(text.encode()).hexdigest()

    with db.cursor() as cur:
        # Replace by title rather than append: appending is how this document
        # ended up in the corpus twice, with retrieval spending its top-k on two
        # copies of the same passage.
        cur.execute("""delete from geobot.document_chunk
                        where document_id in (select id from geobot.document
                                               where title = %s)""", (title,))
        cur.execute("delete from geobot.document where title = %s", (title,))
        cur.execute(
            """insert into geobot.document
                 (title, doc_type, source_origin, provided_by, source_checksum,
                  data_origin)
               values (%s,'academic_calendar',%s,%s,%s,'real') returning id""",
            (title, "https://isu.edu.ph/school-calendar/",
             "ISU Official Website (uploaded workbook)", checksum))
        document_id = cur.fetchone()["id"]

    return imp._write_chunks(document_id, text, "real")


# ---------------------------------------------------------------- endpoints
@schedule_bp.post("/schedule/preview")
def preview():
    payload = request.get_json(silent=True) or {}
    semester = str(payload.get("semester") or si.SEMESTER).strip()
    semester_col = str(payload.get("semester_column") or "first").strip()
    try:
        kind, data = classify(_read_workbook(payload))
    except ValueError as exc:
        return jsonify(error=str(exc)), 400

    if kind == "calendar":
        return jsonify(**_calendar_summary(data, semester_col))
    names, blocks = data
    return jsonify(**_schedule_summary(names, blocks, semester))


@schedule_bp.post("/schedule/apply")
def apply():
    payload = request.get_json(silent=True) or {}
    semester = str(payload.get("semester") or si.SEMESTER).strip()
    semester_col = str(payload.get("semester_column") or "first").strip()
    expected = str(payload.get("checksum") or "").strip()
    if not expected:
        return jsonify(error="`checksum` from /schedule/preview is required"), 400

    try:
        kind, data = classify(_read_workbook(payload))
    except ValueError as exc:
        return jsonify(error=str(exc)), 400

    mismatch = ("checksum mismatch: this workbook does not match the one that "
                "was previewed. Preview it again.")

    if kind == "calendar":
        summary = _calendar_summary(data, semester_col)
        if summary["checksum"] != expected:
            return jsonify(error=mismatch), 409
        try:
            return jsonify(**_calendar_apply(data, semester_col), summary=summary)
        except ValueError as exc:
            return jsonify(error=str(exc)), 400

    names, blocks = data
    summary = _schedule_summary(names, blocks, semester)
    if summary["checksum"] != expected:
        return jsonify(error=mismatch), 409
    return jsonify(**_schedule_apply(names, blocks, semester), summary=summary)
