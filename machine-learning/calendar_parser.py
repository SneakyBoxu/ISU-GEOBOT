"""
Read the ISU academic calendar workbook into institutional events.

The workbook is a PARTICULARS x SEMESTER grid: column 0 names the item, and the
remaining columns hold the dates for the first semester, the second semester and
the midyear term. Dates are written by a human, so the parser has to survive
every shape the file actually contains:

    July 20,2026                  a single day
    September 15-17,2026          a day range inside one month
    February 9,2026-May 15,2026   a range spanning two months
    April17-18,2027               no space after the month
    November  20, 2026            a double space
    June 10, 2026 (WEDNESDAY)     a trailing annotation
    datetime(2027, 5, 10)         Excel already parsed it as a date

WHAT IS EXTRACTED, AND WHY ONLY THIS
------------------------------------
The system consumes exactly three things from a calendar:

    the academic window        so semester_phase can be computed
    examination days           so exam_period_flag is set
    disrupting holidays        so campus_event_flag is set

The workbook holds sixty other rows -- enrolment windows, council meetings,
manuscript deadlines. They are real, but nothing reads them, and writing rows
nothing reads makes institutional_event a place where a reader cannot tell
which rows matter. So the parser reports everything it recognises and marks
only the three kinds above as significant.
"""

from __future__ import annotations

import re
from datetime import date, datetime

MONTHS = {m.lower(): i for i, m in enumerate(
    ["January", "February", "March", "April", "May", "June", "July",
     "August", "September", "October", "November", "December"], start=1)}
MONTH_RE = "|".join(MONTHS)

# The particulars the system actually consumes, in the order they are searched.
# The undergraduate row is the one that governs the campus timetable.
WINDOW_START = "start of classes"
WINDOW_END = "final examination for non-graduating"
EXAM_ROWS = ("mid-term examination",
             "final examination for graduating",
             "final examination for non-graduating")
UNDERGRAD = "undergraduate"


def _clean(text) -> str:
    if text is None:
        return ""
    if isinstance(text, datetime):
        return text.date().isoformat()
    if isinstance(text, date):
        return text.isoformat()
    s = str(text).replace("–", "-").replace("—", "-")
    s = re.sub(r"\(.*?\)", " ", s)          # drop "(WEDNESDAY)", "(14 days)"
    s = re.sub(r"\s+", " ", s)
    return s.strip(" .*")


def parse_dates(cell) -> list[date]:
    """Every calendar day a cell refers to, expanded and de-duplicated."""
    text = _clean(cell)
    if not text:
        return []

    iso = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", text)
    if iso:
        return [date(int(iso.group(1)), int(iso.group(2)), int(iso.group(3)))]

    # "February 9,2026 - May 15,2026": two full dates around a dash.
    full = re.match(
        rf"({MONTH_RE})\s*(\d{{1,2}})\s*,?\s*(\d{{4}})\s*(?:to|-)\s*"
        rf"({MONTH_RE})\s*(\d{{1,2}})\s*,?\s*(\d{{4}})", text, re.I)
    if full:
        a = date(int(full.group(3)), MONTHS[full.group(1).lower()], int(full.group(2)))
        b = date(int(full.group(6)), MONTHS[full.group(4).lower()], int(full.group(5)))
        if b < a:
            a, b = b, a
        return [date.fromordinal(o) for o in range(a.toordinal(), b.toordinal() + 1)]

    # "September 15-17,2026": one month, a span of days.
    span = re.match(
        rf"({MONTH_RE})\s*(\d{{1,2}})\s*-\s*(\d{{1,2}})\s*,?\s*(\d{{4}})", text, re.I)
    if span:
        month, year = MONTHS[span.group(1).lower()], int(span.group(4))
        lo, hi = int(span.group(2)), int(span.group(3))
        if hi < lo:
            lo, hi = hi, lo
        return [date(year, month, d) for d in range(lo, hi + 1)]

    # "July 20,2026" or "July 25. 2026"
    one = re.match(rf"({MONTH_RE})\s*(\d{{1,2}})\s*[.,]?\s*(\d{{4}})", text, re.I)
    if one:
        return [date(int(one.group(3)), MONTHS[one.group(1).lower()], int(one.group(2)))]

    return []


def _semester_columns(rows) -> dict[int, str]:
    """Map column index to semester label, from the PARTICULARS header row."""
    for row in rows[:20]:
        cells = [_clean(c).lower() for c in row]
        if any(c.startswith("particulars") for c in cells):
            out = {}
            for i, c in enumerate(cells):
                if "first" in c and "sem" in c:
                    out[i] = "first"
                elif "second" in c and "sem" in c:
                    out[i] = "second"
                elif "midyear" in c or "mid year" in c:
                    out[i] = "midyear"
            return out
    return {}


def parse_calendar_sheet(ws) -> dict:
    """Return every recognised row, plus the three things the system consumes."""
    rows = list(ws.iter_rows(values_only=True))
    columns = _semester_columns(rows)
    if not columns:
        return {"entries": [], "columns": {}}

    entries = []
    heading = ""
    for row in rows:
        label = _clean(row[0] if row else "")
        is_sub = bool(row and row[0] and str(row[0]).strip().startswith("*"))
        # Any top-level particular opens a heading, whether or not it also
        # carries a date of its own. "Start of Classes" does carry one -- the
        # second-semester date sits on the heading row -- and treating that as
        # disqualifying left its four sub-rows attached to the previous heading,
        # which is how the academic window went missing.
        if label and not is_sub:
            heading = label
        particular = f"{heading} — {label}" if (is_sub and heading) else label
        if not particular:
            continue
        for col, semester in columns.items():
            if col >= len(row):
                continue
            days = parse_dates(row[col])
            if not days:
                continue
            entries.append({
                "particular": particular,
                "heading": heading.lower(),
                "detail": label.lower(),
                "semester": semester,
                "start": days[0].isoformat(),
                "end": days[-1].isoformat(),
                "days": len(days),
                "dates": [d.isoformat() for d in days],
            })
    return {"entries": entries, "columns": list(columns.values())}


SEMESTER_TITLES = {"first": "First Semester", "second": "Second Semester",
                   "midyear": "Midyear Term"}


def render_markdown(parsed: dict, school_year: str = "2026-2027") -> str:
    """
    Render the whole calendar as prose for the retrieval corpus.

    A calendar has to exist in two forms. institutional_event holds the dates
    the classifier compares against; this holds the same dates as sentences a
    person can ask about. Writing only the first means the exam flags are
    correct while "when does the second semester start" returns nothing, which
    is exactly the gap this function closes.

    EVERY semester column is rendered, not just the one being applied. The
    workbook publishes all three, a student can ask about any of them, and the
    previously ingested document covered only the first -- which is why the
    second semester was unanswerable.
    """
    lines = [f"# ISU Academic Calendar, S.Y. {school_year}", "",
             "Source: Isabela State University, official academic calendar "
             "(as adjusted). Covers the first semester, the second semester and "
             "the midyear term.", ""]

    for column in ("first", "second", "midyear"):
        rows = [e for e in parsed["entries"] if e["semester"] == column]
        if not rows:
            continue
        lines.append(f"## {SEMESTER_TITLES[column]}, S.Y. {school_year}")
        lines.append("")
        heading = None
        for e in rows:
            if e["heading"] and e["heading"] != heading:
                heading = e["heading"]
                lines.append(f"### {heading.title()}")
            when = (e["start"] if e["start"] == e["end"]
                    else f"{e['start']} to {e['end']}")
            label = e["particular"].split("—")[-1].strip() or e["particular"]
            # EVERY LINE NAMES ITS SEMESTER. A markdown heading only labels the
            # lines under it while they stay together, and the chunker splits a
            # long section across several chunks. The chunk holding "Start of
            # Classes: 2026-12-07" then carries no semester at all, so a reader
            # -- human or model -- cannot tell which term it belongs to and
            # correctly declines to answer. Repeating the context per line costs
            # a few tokens and makes each chunk self-describing.
            context = f"{SEMESTER_TITLES[column]} S.Y. {school_year}"
            # A top-level row repeats its own heading; do not say it twice.
            head = (f"{heading.title()}, "
                    if heading and heading.lower() != label.lower() else "")
            lines.append(f"- {context} — {head}{label}: {when}")
        lines.append("")
    return chr(10).join(lines)


def significant(parsed: dict, semester: str = "first") -> dict:
    """The academic window and examination days, for one semester column."""
    rows = [e for e in parsed["entries"] if e["semester"] == semester]

    def pick(headings, prefer_undergrad=True):
        hits = [e for e in rows if any(h in e["heading"] for h in headings)]
        if prefer_undergrad:
            under = [e for e in hits if UNDERGRAD in e["detail"]]
            if under:
                return under[0]
        return hits[0] if hits else None

    start = pick([WINDOW_START])
    end = pick([WINDOW_END])

    exam_dates: list[str] = []
    exams = []
    for heading in EXAM_ROWS:
        hit = pick([heading])
        if hit:
            exams.append({"particular": hit["particular"],
                          "start": hit["start"], "end": hit["end"]})
            exam_dates.extend(hit["dates"])

    return {
        "window_start": start["start"] if start else None,
        "window_end": end["end"] if end else None,
        "exams": exams,
        "exam_dates": sorted(set(exam_dates)),
    }
