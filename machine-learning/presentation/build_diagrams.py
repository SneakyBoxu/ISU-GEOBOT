"""Generate the two architecture diagrams as real node-and-edge SVG.

WHY THIS REPLACED THE CSS VERSION
---------------------------------
The previous diagrams were five bands of equal-width boxes with arrows only
between the bands. That is a swimlane table: no arrow connected any two
components, so the drawing showed where things live and nothing about how a
request moves. The reference diagrams a panel expects are flow graphs --
arrows run between individual boxes, every arrow is labelled with what it
carries, data stores are cylinders sitting inline with the flow, and control
paths cross layers as dashed lines.

Graphviz would be the obvious tool and is not installed here, so the geometry
is explicit: each node is placed by coordinate and each edge is routed between
two named ports. That is more verbose than `dot`, and in exchange the arrows go
exactly where the argument needs them rather than where a layout engine puts
them.

Output is a standalone HTML wrapper per diagram, which render_diagrams.py then
screenshots at 2x -- the same pipeline as before.
"""
from __future__ import annotations

import html
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

# Live figures. A diagram that states a count has to get it from the same place
# the system does, or it is wrong the first time anyone uses the admin portal.
sys.path.insert(0, str(HERE.parent))
import database_connector as _db  # noqa: E402


def _n(sql):
    try:
        return _db.fetch_all(sql)[0]["n"]
    except Exception:
        return None


FACTS = {
    "poi_pub": _n("select count(*) n from geobot.poi where is_published"),
    "poi_all": _n("select count(*) n from geobot.poi"),
    "chunks": _n("select count(*) n from geobot.document_chunk"),
    "docs": _n("select count(*) n from geobot.document"),
    "blocks": _n("select count(*) n from geobot.faculty_schedule where data_origin='real'"),
    "aliases": _n("select count(*) n from geobot.faculty_alias"),
    "chats": _n("select count(*) n from geobot.chat_log"),
}

W, H = 1900, 830

INK = "#16202B"
MID = "#52626F"
LINE = "#2C4A63"
COMP = "#C3D7E7"
STORE = "#EFE3C8"
STORELINE = "#9A7B33"
EXT = "#E2D6EA"
EXTLINE = "#6B5580"
DOC = "#D3E6D8"
DOCLINE = "#3E6B4C"
PERSON = "#F2DCBE"
PERSONLINE = "#9A6B24"
BAND = "#EEF2F6"
HAIR = "#C6D2DC"


# --------------------------------------------------------------- primitives
def esc(t: str) -> str:
    return html.escape(t, quote=False)


def band(x, y, w, h, label, sub="", cap_x=None):
    """A captioned layer band, caption bottom-left as the references place it."""
    s = (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" '
         f'fill="{BAND}" stroke="{HAIR}" stroke-width="1.5"/>')
    cx = cap_x if cap_x is not None else x + 16
    s += (f'<text x="{cx}" y="{y+21}" font-size="13.5" font-weight="700" '
          f'fill="{MID}" letter-spacing="1.4">{esc(label.upper())}</text>')
    if sub:
        s += (f'<text x="{cx+len(label)*9.6+34}" y="{y+21}" font-size="11.5" '
              f'fill="#93A2AE" letter-spacing="0.6">{esc(sub)}</text>')
    return s


def box(x, y, w, h, title, sub="", fill=COMP, stroke=LINE, ts=15, ss=11.5):
    """A component. Title bold, one line of detail under it."""
    s = (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{fill}" '
         f'stroke="{stroke}" stroke-width="2"/>')
    if sub:
        s += (f'<text x="{x+w/2}" y="{y+h/2-4}" text-anchor="middle" '
              f'font-size="{ts}" font-weight="800" fill="{INK}">{esc(title)}</text>')
        s += (f'<text x="{x+w/2}" y="{y+h/2+14}" text-anchor="middle" '
              f'font-size="{ss}" fill="#3B5266">{esc(sub)}</text>')
    else:
        s += (f'<text x="{x+w/2}" y="{y+h/2+5}" text-anchor="middle" '
              f'font-size="{ts}" font-weight="800" fill="{INK}">{esc(title)}</text>')
    return s


def cyl(x, y, w, h, title, sub=""):
    """A data store, drawn as a cylinder the way the references draw them."""
    ry = 11
    s = (f'<path d="M{x},{y+ry} v{h-2*ry} a{w/2},{ry} 0 0 0 {w},0 v{-(h-2*ry)}" '
         f'fill="{STORE}" stroke="{STORELINE}" stroke-width="2"/>')
    s += (f'<ellipse cx="{x+w/2}" cy="{y+ry}" rx="{w/2}" ry="{ry}" '
          f'fill="#F8F1DF" stroke="{STORELINE}" stroke-width="2"/>')
    s += (f'<text x="{x+w/2}" y="{y+h/2+4}" text-anchor="middle" font-size="13" '
          f'font-weight="800" fill="#3E3213">{esc(title)}</text>')
    if sub:
        s += (f'<text x="{x+w/2}" y="{y+h/2+20}" text-anchor="middle" '
              f'font-size="10.5" fill="#6B5A2C">{esc(sub)}</text>')
    return s


def edge(pts, label="", dash=False, color=LINE, lx=None, ly=None, both=False,
         anchor="middle", fs=11.5):
    """A routed arrow. `pts` is a list of (x, y); corners are drawn square."""
    d = f'M{pts[0][0]},{pts[0][1]}'
    for p in pts[1:]:
        d += f' L{p[0]},{p[1]}'
    # Built outside the f-string: this interpreter rejects a backslash
    # inside an f-string expression, and these attributes carry quotes.
    dashattr = ' stroke-dasharray="7 5"' if dash else ""
    startattr = ' marker-start="url(#ahr)"' if both else ""
    s = (f'<path d="{d}" fill="none" stroke="{color}" stroke-width="2.2"'
         f'{dashattr} marker-end="url(#ah)"{startattr}/>')
    if label:
        mx = lx if lx is not None else (pts[0][0] + pts[-1][0]) / 2
        my = ly if ly is not None else (pts[0][1] + pts[-1][1]) / 2 - 7
        w = len(label) * fs * 0.52 + 10
        ax = {"middle": mx - w / 2, "start": mx - 5, "end": mx - w + 5}[anchor]
        s += (f'<rect x="{ax}" y="{my-12}" width="{w}" height="17" rx="3" '
              f'fill="#F7F7F4" opacity="0.94"/>')
        s += (f'<text x="{mx}" y="{my}" text-anchor="{anchor}" font-size="{fs}" '
              f'font-weight="700" fill="{MID}">{esc(label)}</text>')
    return s


def actor(x, y, label, sub, kind="person"):
    """An actor, icon plus caption, as the references put people on the edge."""
    if kind == "person":
        icon = (f'<circle cx="{x}" cy="{y-13}" r="8" fill="none" stroke="{LINE}" '
                f'stroke-width="2.2"/>'
                f'<path d="M{x-14},{y+12} a14,14 0 0 1 28,0" fill="none" '
                f'stroke="{LINE}" stroke-width="2.2"/>')
    else:
        icon = (f'<rect x="{x-15}" y="{y-18}" width="30" height="22" rx="2.5" '
                f'fill="none" stroke="{LINE}" stroke-width="2.2"/>'
                f'<path d="M{x-8},{y+11} h16 M{x},{y+4} v7" stroke="{LINE}" '
                f'stroke-width="2.2" fill="none"/>')
    s = icon
    s += (f'<text x="{x}" y="{y+32}" text-anchor="middle" font-size="14" '
          f'font-weight="800" fill="{INK}">{esc(label)}</text>')
    s += (f'<text x="{x}" y="{y+48}" text-anchor="middle" font-size="11" '
          f'fill="{MID}">{esc(sub)}</text>')
    return s


def wrap(title, body):
    return f"""<!doctype html>
<meta charset="utf-8">
<style>
  html,body{{margin:0;padding:0;background:#F7F7F4}}
  svg{{display:block;font-family:"Aptos","Segoe UI",Arial,sans-serif}}
</style>
<!-- generated by build_diagrams.py -- edit that, not this file -->
<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="ah" markerWidth="11" markerHeight="11" refX="9" refY="5"
            orient="auto"><path d="M0,0.5 L10,5 L0,9.5 z" fill="{LINE}"/></marker>
    <marker id="ahr" markerWidth="11" markerHeight="11" refX="1" refY="5"
            orient="auto"><path d="M10,0.5 L0,5 L10,9.5 z" fill="{LINE}"/></marker>
  </defs>
  <rect width="{W}" height="{H}" fill="#F7F7F4"/>
{body}
</svg>
"""


# ========================================================== ARCHITECTURE
def architecture() -> str:
    """One request's path through the system, with every arrow labelled.

    Geometry is explicit and the clearances are deliberate: labels sit in the
    gaps between rows, never over a box, because the first attempt put "about a
    person" on top of the Consent Gate and made both unreadable.
    """
    b = []

    # bands: caption occupies the top 26px, content starts below it
    b.append(band(24, 100, 1852, 112, "Presentation Layer", "React 18 - port 5173", cap_x=1300))
    b.append(band(24, 232, 1852, 268, "Application and Security Layer", "Node / Express - port 4000"))
    b.append(band(24, 520, 1852, 120, "Intelligence Layer", "Flask - port 5001, plus one external model"))
    b.append(band(24, 660, 1852, 132, "Data Layer", "Supabase PostgreSQL with pgvector"))

    # ---- actors ----------------------------------------------------------
    b.append(actor(200, 30, "Student / Visitor", "campus questions, no account"))
    b.append(actor(640, 30, "Signed-in Campus User", "required for availability"))
    b.append(actor(1080, 30, "Administrator", "locations, schedules, OCR", kind="screen"))

    # ---- presentation ----------------------------------------------------
    b.append(box(80, 134, 260, 58, "Interactive Campus Map", f"Leaflet - {FACTS['poi_pub']} published pins"))
    b.append(box(390, 134, 260, 58, "Assistant Chat Dock", "question, answer, sources"))
    b.append(box(700, 134, 260, 58, "Admin Dashboard", "4 management tabs"))
    b.append(box(1010, 134, 230, 58, "Auth Session", "token held in the browser"))
    b.append(edge([(200, 84), (200, 134)]))
    b.append(edge([(640, 84), (640, 134)]))
    b.append(edge([(1080, 84), (1080, 134)]))

    # ---- server: document path (top row) ---------------------------------
    b.append(box(80, 288, 160, 60, "Auth Middleware", "verifies the token"))
    b.append(box(270, 288, 170, 60, "Intent Router", "person? a 2 ms lookup"))
    b.append(box(500, 288, 200, 60, "Knowledge Search", "cosine top-5, floor 0.25", fill=DOC, stroke=DOCLINE))
    # ---- server: availability path (lower row) ---------------------------
    b.append(box(500, 396, 200, 60, "Consent Gate", "refuses before estimating", fill=PERSON, stroke=PERSONLINE))
    b.append(box(730, 396, 180, 60, "Masking Protocol", "reduce to 3 coarse states", fill=PERSON, stroke=PERSONLINE))
    # ---- converge --------------------------------------------------------
    b.append(box(960, 342, 180, 60, "Context Fusion", "passages + coarse state"))
    b.append(box(1180, 342, 170, 60, "Prompt to model", "facts already decided"))
    b.append(box(1390, 342, 160, 60, "Egress Filter", "room / building / floor"))
    b.append(box(1590, 342, 190, 60, "Response", f"0 stopped in {FACTS['chats']} logged"))

    # browser <-> server
    b.append(edge([(430, 192), (430, 240), (160, 240), (160, 288)],
                  "HTTPS  question + session token", lx=470, ly=234, anchor="start"))
    b.append(edge([(1685, 342), (1685, 216), (520, 216), (520, 192)],
                  "masked answer only", lx=1140, ly=210))

    # the pipeline
    b.append(edge([(240, 318), (270, 318)]))
    b.append(edge([(440, 318), (500, 318)], "no person named", lx=470, ly=278, fs=11))
    b.append(edge([(355, 348), (355, 426), (500, 426)], "a person is named", lx=420, ly=418, fs=11))
    b.append(edge([(700, 426), (730, 426)]))
    b.append(edge([(700, 318), (830, 318), (830, 360), (960, 360)], "5 passages", lx=880, ly=312, fs=11))
    b.append(edge([(910, 426), (935, 426), (935, 384), (960, 384)], "1 of 3 states", lx=862, ly=486, fs=11))
    b.append(edge([(1140, 372), (1180, 372)]))
    b.append(edge([(1350, 372), (1390, 372)]))
    b.append(edge([(1550, 372), (1590, 372)]))

    # ---- intelligence ----------------------------------------------------
    b.append(box(500, 554, 200, 60, "Sentence Embedder", "MiniLM-L6-v2, 384-dim", fill=DOC, stroke=DOCLINE))
    b.append(box(730, 554, 180, 60, "Random Forest", "300 trees, 11 features", fill=PERSON, stroke=PERSONLINE))
    b.append(box(1180, 554, 400, 60, "Language Model (external)",
                 "openai/gpt-oss-120b via Groq - temperature 0", fill=EXT, stroke=EXTLINE))

    b.append(edge([(600, 348), (600, 554)], "embed", lx=600, ly=520, fs=11, both=True))
    b.append(edge([(820, 456), (820, 554)], "predict", lx=820, ly=520, fs=11, both=True))
    b.append(edge([(1265, 402), (1265, 554)], "writes the sentence", lx=1265, ly=520, fs=11, both=True))

    # ---- data ------------------------------------------------------------
    b.append(cyl(80, 700, 230, 76, "document_chunk", f"{FACTS['chunks']} chunks - 384-dim"))
    b.append(cyl(350, 700, 210, 76, "poi", f"{FACTS['poi_all']} locations, {FACTS['poi_pub']} published"))
    b.append(cyl(600, 700, 230, 76, "faculty_schedule", f"{FACTS['blocks']} real teaching blocks"))
    b.append(cyl(870, 700, 240, 76, "attendance_record", "keyed by pseudonym only"))
    b.append(cyl(1150, 700, 220, 76, "faculty (consent)", "who may be answered about"))
    b.append(cyl(1410, 700, 220, 76, "chat_log", f"{FACTS['chats']} conversations"))

    b.append(edge([(560, 614), (560, 662), (195, 662), (195, 700)], "vector search", lx=330, ly=656, fs=11))
    b.append(edge([(640, 614), (640, 662), (455, 662), (455, 700)], "place cards", lx=545, ly=656, fs=11))
    b.append(edge([(790, 614), (790, 662), (715, 662), (715, 700)], "timetable", lx=770, ly=656, fs=11))
    b.append(edge([(860, 614), (860, 662), (990, 662), (990, 700)], "history", lx=940, ly=656, fs=11))
    b.append(edge([(540, 456), (430, 456), (430, 648), (1260, 648), (1260, 700)],
                  "consent check, before any estimate", dash=True, lx=700, ly=642, fs=11,
                  color=PERSONLINE))
    b.append(edge([(1685, 402), (1685, 648), (1520, 648), (1520, 700)], "logged", lx=1600, ly=642, fs=11))

    return wrap("System Architecture", chr(10).join(b))


# =============================================================== PIPELINE
def pipeline() -> str:
    """The path of one question, with the fork drawn as two real branches.

    Laid out as a flow graph rather than a stack of rows: the two branches run
    side by side so it is visible that a query takes one or the other and never
    both, and they converge on a single tail.
    """
    b = []

    b.append(band(24, 268, 916, 300, "Document path", "any question not about a person"))
    b.append(band(960, 268, 916, 300, "Availability path", "a question that names a lecturer"))
    b.append(band(24, 596, 1852, 132, "Shared tail", "one prompt, one answer, one boundary"))

    # ---- 1. the question --------------------------------------------------
    b.append(actor(120, 56, "Student", "asks in plain language"))
    b.append(box(280, 40, 380, 56, '"Where is the College of Computing?"', "a place question", fill=DOC, stroke=DOCLINE, ts=13.5))
    b.append(box(690, 40, 380, 56, '"When does the second semester start?"', "an institutional question", fill=DOC, stroke=DOCLINE, ts=13.5))
    b.append(box(1100, 40, 340, 56, '"Is SIM-33 free right now?"', "a person question", fill=PERSON, stroke=PERSONLINE, ts=13.5))
    b.append(edge([(160, 40), (280, 40)]))

    # ---- 2. routing -------------------------------------------------------
    b.append(box(700, 150, 480, 66, "Intent Router", f"{FACTS['aliases']} registered name forms + a fixed availability word list - a lookup, not a model"))
    b.append(cyl(1260, 146, 200, 74, "faculty_alias", f"{FACTS['aliases']} name forms"))
    b.append(edge([(470, 96), (470, 126), (820, 126), (820, 150)], "raw text", lx=640, ly=120, fs=11))
    b.append(edge([(1270, 96), (1270, 126), (1000, 126), (1000, 150)], "raw text", lx=1130, ly=120, fs=11))
    b.append(edge([(1180, 183), (1260, 183)], both=True))

    # ---- 3a. document branch ---------------------------------------------
    b.append(box(70, 316, 390, 62, "Embed the query", "all-MiniLM-L6-v2 - 384 dimensions, L2-normalised", fill=DOC, stroke=DOCLINE))
    b.append(box(500, 316, 400, 62, "Exact cosine search", "no ANN index - top 5 - similarity floor 0.25", fill=DOC, stroke=DOCLINE))
    b.append(cyl(330, 440, 300, 80, "document_chunk", f"{FACTS['chunks']} chunks, each 220 tokens or fewer"))
    b.append(edge([(820, 216), (820, 246), (265, 246), (265, 316)], "no lecturer named", lx=500, ly=240, fs=11.5))
    b.append(edge([(460, 347), (500, 347)]))
    b.append(edge([(700, 378), (700, 410), (480, 410), (480, 440)], "compare against", lx=600, ly=404, fs=11))

    # ---- 3b. availability branch -----------------------------------------
    b.append(box(1000, 316, 250, 62, "Consent gate", "refuses here if not consented", fill=PERSON, stroke=PERSONLINE, ts=14))
    b.append(box(1290, 316, 250, 62, "Resolve timetable", "is a class running now?", fill=PERSON, stroke=PERSONLINE, ts=14))
    b.append(box(1580, 316, 250, 62, "Random Forest", "300 trees, 11 features", fill=PERSON, stroke=PERSONLINE, ts=14))
    b.append(cyl(1130, 440, 250, 80, "faculty_schedule", f"{FACTS['blocks']} real teaching blocks"))
    b.append(cyl(1450, 440, 270, 80, "attendance_record", "behaviour, by pseudonym"))
    b.append(edge([(1060, 216), (1060, 246), (1125, 246), (1125, 316)], "a lecturer is named", lx=1240, ly=240, fs=11.5))
    b.append(edge([(1250, 347), (1290, 347)]))
    b.append(edge([(1540, 347), (1580, 347)]))
    b.append(edge([(1350, 378), (1350, 410), (1255, 410), (1255, 440)], "blocks", lx=1330, ly=404, fs=11, both=True))
    b.append(edge([(1660, 378), (1660, 410), (1585, 410), (1585, 440)], "history", lx=1640, ly=404, fs=11, both=True))

    # ---- 4. the tail ------------------------------------------------------
    b.append(box(80, 636, 330, 66, "Mask to three states", "available / in class / unavailable", fill=PERSON, stroke=PERSONLINE, ts=14, ss=11))
    b.append(box(450, 636, 300, 66, "Context Fusion", "five passages, or one coarse state, into a single prompt", ts=14, ss=11))
    b.append(box(790, 636, 380, 66, "Language model writes the sentence", "openai/gpt-oss-120b - temperature 0 - it is told the state, never asked for it", fill=EXT, stroke=EXTLINE, ts=14, ss=11))
    b.append(box(1210, 636, 300, 66, "Egress filter", "scans the written text for room, building, floor, raw score", ts=14, ss=11))
    b.append(box(1550, 636, 280, 66, "Answer to the student", f"0 stopped in {FACTS['chats']} conversations", ts=14, ss=11))

    b.append(edge([(1830, 347), (1862, 347), (1862, 578), (245, 578), (245, 636)], "the estimate", lx=1000, ly=570, fs=11.5, color=PERSONLINE))
    b.append(edge([(900, 347), (930, 347), (930, 560), (600, 560), (600, 636)], "5 passages", lx=770, ly=554, fs=11.5, color=DOCLINE))
    b.append(edge([(410, 669), (450, 669)]))
    b.append(edge([(750, 669), (790, 669)]))
    b.append(edge([(1170, 669), (1210, 669)]))
    b.append(edge([(1510, 669), (1550, 669)]))

    b.append(f'<rect x="24" y="752" width="1852" height="58" rx="5" fill="#E7EEF3" stroke="{LINE}" stroke-width="0"/>')
    b.append(f'<rect x="24" y="752" width="6" height="58" fill="{LINE}"/>')
    b.append(f'<text x="50" y="779" font-size="17.5" font-weight="800" fill="{INK}">'
             'Availability comes from the timetable and the classifier. The language model only writes the sentence.</text>')
    b.append(f'<text x="50" y="800" font-size="12.5" fill="{MID}">'
             'A model asked to guess where a lecturer is would answer fluently and unfalsifiably, so it is never asked. It is handed the state and told to phrase it.</text>')

    return wrap("AI Pipeline", chr(10).join(b))


if __name__ == "__main__":
    (HERE / "diagram_architecture.html").write_text(architecture(), encoding="utf-8")
    (HERE / "diagram_pipeline.html").write_text(pipeline(), encoding="utf-8")
    print("wrote both diagrams")
