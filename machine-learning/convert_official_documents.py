"""
Convert official ISU sources into the .txt/.md the RAG importer accepts.

    python machine-learning/convert_official_documents.py --pdf <path-to-Student-Manual.pdf>

This is a CONVERTER, not an ingester. It writes files into
machine-learning/institutional-documents/ and stops; ingestion stays the job of
document_knowledge_importer.py, unchanged. Two steps rather than one, because
the conversion is the part a human should read before it becomes a corpus:

    python machine-learning/convert_official_documents.py --pdf ...
    python machine-learning/document_knowledge_importer.py \\
        --path machine-learning/institutional-documents --origin real

WHY A SCRIPT AND NOT A ONE-OFF PASTE. The corpus has to be rebuildable. A
document nobody can regenerate is a document nobody can check, and "where did
this chunk come from" is the first question anyone will ask about a retrieved
answer.

FILENAMES ARE LOAD-BEARING. document_knowledge_importer.infer_doc_type() reads
the filename: 'calendar' -> academic_calendar, 'handbook' -> handbook. The
outputs are named accordingly, so the doc_type is correct without touching the
importer.

PROVENANCE. Each file opens with a header naming the official URL and the date
retrieved. That header is part of the text, so it is chunked and embedded with
everything else and a retrieved passage carries its own source. The `document`
row's source_origin and official_date are set separately -- see the SQL printed
at the end of a run.

NO INTERPRETATION. Dates, policies and section text are copied as the source
states them. Where the source is ambiguous the ambiguity is preserved rather
than resolved: this is an institutional record, and a tidier paraphrase is a
different document.
"""

from __future__ import annotations

import argparse
import pathlib
import re
from datetime import date

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "machine-learning" / "institutional-documents"

CALENDAR_URL = "https://isu.edu.ph/school-calendar/"
MANUAL_URL = "https://isu.edu.ph/wp-content/uploads/2023/11/Student-Manual.pdf"


def header(title: str, url: str, official: str, note: str = "") -> str:
    """Provenance block, carried into the chunks themselves."""
    return (
        f"# {title}\n\n"
        f"Source: Isabela State University — official publication\n"
        f"URL: {url}\n"
        f"Retrieved: {date.today().isoformat()}\n"
        f"Official date: {official}\n"
        + (f"\n{note}\n" if note else "")
        + "\n---\n\n"
    )


# --------------------------------------------------------------------- PDF
def clean_manual_text(raw: str) -> str:
    """
    Tidy the extracted layer without editing the content.

    Three artefacts of the PDF's typography, none of them meaning:

      'S T U D E N T   M A N U A L'  letter-spaced running header on every page
      '12 | S T U D E N T ...'       page numbers fused to that header
      hard-wrapped lines             a sentence broken across three lines is one
                                     sentence, and the chunker splits on blank
                                     lines, so leaving the wraps in produces
                                     chunks cut mid-clause
    """
    # The running header, spaced or not, with or without a page number.
    raw = re.sub(r"^\s*\d*\s*\|?\s*S\s*T\s*U\s*D\s*E\s*N\s*T\s+M\s*A\s*N\s*U\s*A\s*L\s*$",
                 "", raw, flags=re.MULTILINE | re.IGNORECASE)

    lines = [ln.rstrip() for ln in raw.splitlines()]
    out: list[str] = []
    buf: list[str] = []

    def flush():
        if buf:
            out.append(" ".join(buf).strip())
            buf.clear()

    # WHY LENGTH DECIDES, AND NOT "IS IT A TABLE".
    #
    # In hard-wrapped text every line of a paragraph except the last runs close
    # to the column width. Table cells do not: PyMuPDF extracts the manual's
    # grading table one cell per line — '98 - 100', '1.00', 'Excellent'.
    #
    # An earlier version joined every non-heading line into a paragraph, which
    # turned that table into a run-on sentence. The chunk still retrieved, and
    # the model then answered "the minimum passing grade is 2.00" when the
    # table says 3.00 (75-76%, "Passed"). A destroyed table does not fail
    # loudly; it produces a confident wrong answer about policy.
    #
    # So a line continues the previous one only when the previous line was long
    # enough to have been wrapped. Short lines keep their own line, which
    # preserves every table in the document without needing to recognise any of
    # them.
    WRAP_WIDTH = 55

    for ln in lines:
        s = ln.strip()
        if not s:
            flush()
            out.append("")
            continue
        # A heading, a numbered section, or an article starts its own block --
        # these are what the structure-aware chunker splits on.
        is_heading = (
            (s.isupper() and 4 < len(s) < 70)
            or re.match(r"^(Chapter|Article|Section)\b", s)
            or re.match(r"^\d+\.\d*\s", s)
        )
        if is_heading:
            flush()
            out.append(s)
            out.append("")
        elif buf and len(buf[-1]) >= WRAP_WIDTH:
            buf.append(s)                 # continuation of a wrapped line
        else:
            flush()                       # previous line was short: it ended
            buf.append(s)
    flush()

    text = "\n".join(out)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def convert_manual(pdf_path: pathlib.Path) -> pathlib.Path:
    import fitz

    doc = fitz.open(pdf_path)
    pages = [doc[i].get_text() for i in range(doc.page_count)]
    body = clean_manual_text("\n".join(pages))

    out = OUT_DIR / "isu-student-handbook.md"
    out.write_text(
        header(
            "ISU Student Manual",
            MANUAL_URL,
            "2023-11 (as published)",
            f"Extracted from the official PDF, {doc.page_count} pages. Text is "
            "reproduced as published; only the repeated page header and the "
            "PDF's hard line wrapping were removed.",
        ) + body,
        encoding="utf-8",
    )
    return out


# ---------------------------------------------------------------- calendar
# S.Y. 2026-2027, FIRST SEMESTER, transcribed from the official page. Only this
# semester is included: the page also carries 2023-2024 through 2025-2026, and
# ingesting four years of near-identical date tables would flood retrieval with
# rows that differ by a single digit. Add another year here when it is needed.
CALENDAR_2026_27_FIRST = """\
## S.Y. 2026-2027 — First Semester

### Admission (New Entrants)
- Foreign Students: February 9, 2026 to May 15, 2026
- College of Law: February 9, 2026 to May 15, 2026
- College of Medicine: February 9, 2026 to May 15, 2026
- Undergraduate Students: February 9, 2026 to May 15, 2026
- Graduate Students: February 9, 2026 to May 15, 2026

### Enrollment (New Entrants)
- Foreign Students: May 25 to June 11, 2026
- College of Law: May 25 to June 11, 2026
- College of Medicine: May 25 to June 11, 2026
- Undergraduate Students: May 25 to June 11, 2026
- Graduate Students: May 25 to June 14, 2026

### Enrolment for Old / Returning Students
- Undergraduate: June 15 to July 9, 2026
- College of Law: June 15 to July 9, 2026
- College of Medicine: June 15 to July 9, 2026
- Graduate School: June 15 to July 12, 2026

### Start of Classes
- College of Law: July 20, 2026
- College of Medicine: July 20, 2026
- Undergraduate Students: July 20, 2026
- Graduate Students: July 25, 2026

### Orientation
- Undergraduate (New Students): July 16, 2026
- Undergraduate (Old Students, by College): July 28-30, 2026
- Graduate: August 1, 2026
- College of Medicine: July 30, 2026
- College of Law: August 1, 2026

### Enrolment and Subject Changes
- Last Day of Enrolment with Fine: July 13, 2026
- Adding / Changing of subjects: July 13-15, 2026
- Last Day for Dropping of subjects: August 17, 2026

### Graduation Applications
- Last Day for Filing Application for Graduation: August 14, 2026

### Mid-Term Examination
- Undergraduate: September 15-17, 2026
- College of Medicine: September 15-17, 2026
- College of Law: September 19-20, 2026
- Graduate: September 19-20, 2026

### Final Examination for Graduating Students
- Undergraduate: November 10-12, 2026
- College of Medicine: November 10-12, 2026
- College of Law: November 14-15, 2026
- Graduate: November 14-15, 2026

### Final Examination for Non-Graduating Students
- Undergraduate: November 17-19, 2026
- College of Medicine: November 17-19, 2026
- College of Law: November 21-22, 2026
- Graduate: November 21-22, 2026

### Submission of Bound Manuscript
- Undergraduate: November 13, 2026
- Graduate: November 15, 2026

### Deadline for Submission of Grades
- Graduating, Undergraduate: November 20, 2026
- Graduating, College of Medicine: November 20, 2026
- Graduating, College of Law: November 22, 2026
- Graduating, Graduate: November 22, 2026
- Non-Graduating, Undergraduate: November 27, 2026
- Non-Graduating, College of Medicine: November 27, 2026
- Non-Graduating, College of Law: November 29, 2026
- Non-Graduating, Graduate: November 29, 2026

### University Events and Faculty Leave
- Foundation Day: June 10, 2026 (Wednesday)
- Start and end of Vacation for faculty on Teachers Leave: December 19, 2026 to January 2, 2027 (14 days)
- Resumption of Faculty on Teachers' Leave: January 4, 2027

### Official Philippine Holidays and Class Suspensions (2026)
- August 21, 2026 (Friday): Ninoy Aquino Day (Special Non-Working Holiday)
- August 31, 2026 (Monday): National Heroes Day / Araw ng mga Bayani (Regular National Holiday — No Classes and University Offices Closed)
- November 1, 2026 (Sunday): All Saints' Day (Special Non-Working Holiday)
- November 2, 2026 (Monday): All Souls' Day (Special Non-Working Holiday — No Classes)
- November 30, 2026 (Monday): Bonifacio Day (Regular National Holiday — No Classes and University Offices Closed)
- December 8, 2026 (Tuesday): Feast of the Immaculate Conception (Special Non-Working Holiday — No Classes)
- December 24, 2026 (Thursday): Christmas Eve (Special Non-Working Holiday)
- December 25, 2026 (Friday): Christmas Day (Regular National Holiday — No Classes)
- December 30, 2026 (Wednesday): Rizal Day (Regular National Holiday — No Classes)
- December 31, 2026 (Thursday): Last Day of the Year (Special Non-Working Holiday)
Classes and regular university operations are suspended on all national regular and special non-working holidays. Regular classes resume on the next scheduled school day.

### Academic Council Meeting
- College: November 30, December 1-2, 2026
- Campus: December 9, 2026
- University: December 16, 2026
"""


def convert_calendar() -> pathlib.Path:
    out = OUT_DIR / "isu-academic-calendar-2026-2027.md"
    out.write_text(
        header(
            "ISU Academic Calendar, S.Y. 2026-2027 (First Semester)",
            CALENDAR_URL,
            "S.Y. 2026-2027",
            "Transcribed from the official school calendar page. Dates are "
            "reproduced exactly as published.",
        ) + CALENDAR_2026_27_FIRST,
        encoding="utf-8",
    )
    return out


# -------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    ap.add_argument("--pdf", type=pathlib.Path,
                    help="Local copy of the official Student Manual PDF")
    ap.add_argument("--calendar-only", action="store_true")
    args = ap.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    written = [convert_calendar()]

    if not args.calendar_only:
        if not args.pdf or not args.pdf.exists():
            raise SystemExit(
                "--pdf is required (download the Student Manual from\n"
                f"  {MANUAL_URL}\nor pass --calendar-only)"
            )
        written.append(convert_manual(args.pdf))

    for p in written:
        print(f"  wrote {p.name}  ({len(p.read_text(encoding='utf-8')):,} chars)")

    print("\nNext:")
    print("  python machine-learning/document_knowledge_importer.py \\")
    print("      --path machine-learning/institutional-documents --origin real")
    print("\nThen record the official provenance on the document rows:")
    print(f"""
  update geobot.document set source_origin = '{CALENDAR_URL}',
         official_date = date '2026-07-20'
   where title = 'isu-academic-calendar-2026-2027';

  update geobot.document set source_origin = '{MANUAL_URL}',
         official_date = date '2023-11-01'
   where title = 'isu-student-handbook';
""")


if __name__ == "__main__":
    main()
