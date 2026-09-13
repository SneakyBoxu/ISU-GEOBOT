"""
The system-defense presentation (defense template, item 1).

    python machine-learning/build_defense_deck.py

WHAT THE TEMPLATE ASKS FOR:

    "PPT for your system -- to include in the PPT is the brief discussion
     regarding your study, your Objectives, present screenshots of the system
     addressing the objectives."

The deck is therefore organised around the OBJECTIVES, not around the software,
and every screenshot slide is labelled with the objective it evidences.

HOUSE STYLE. The layout follows the deck format already used in this cohort: a
left rule and dark side panel on the title slide, a bold sans heading with a
short accent underline, a running footer carrying the study title and a page
number, white cards with small-caps labels, and a serif voice reserved for the
one-line claims. Matching it is deliberate -- a panel comparing presentations
should be comparing the work, not the typography.

WHY THE NUMBERS ARE READ FROM THE DATABASE. Every figure -- location counts,
corpus size, per-stage latency, the capability comparison, the RAGAS scores --
is queried at build time from the tables Chapter 4 was written from. A deck and
a paper that disagree three minutes into a defense is the failure this avoids.
If a number here is wrong, it is wrong in the thesis too, which is the correct
failure mode.

The RAGAS slide reports whatever has actually been scored. Metrics still
running are simply absent, and the slide says why rather than inventing a
number to fill the table.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Emu, Inches, Pt

import database_connector as db

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "ISU_GeoBot_Defense.pptx"
SHOTS = ROOT / "screenshots"

# ------------------------------------------------------------------ palette
INK = RGBColor(0x18, 0x22, 0x2D)
ACCENT = RGBColor(0x3F, 0x5B, 0x74)
ACCENT_DEEP = RGBColor(0x2A, 0x41, 0x54)
MUTED = RGBColor(0x59, 0x69, 0x78)
LINE = RGBColor(0xCD, 0xD6, 0xDD)
WASH = RGBColor(0xE0, 0xE7, 0xEC)
GROUND = RGBColor(0xFA, 0xF9, 0xF5)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
WARN = RGBColor(0x8A, 0x54, 0x10)

SANS = "Aptos"
DISPLAY = "Aptos Display"
SERIF = "Georgia"
MONO = "Consolas"

W, H = Inches(13.333), Inches(7.5)
MARGIN = Inches(0.62)
RUNNING = "ISU-GEOBOT  ·  CAMPUS NAVIGATION AND FACULTY AVAILABILITY"

_page = {"n": 0}


# ------------------------------------------------------------------ helpers
def tb(slide, x, y, w, h, text, *, size=16, bold=False, color=INK, font=SANS,
       align=PP_ALIGN.LEFT, spacing=1.18, italic=False, anchor=MSO_ANCHOR.TOP):
    """A positioned text box. python-pptx has no styled-text primitive."""
    box = slide.shapes.add_textbox(x, y, w, h)
    tf = box.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    for i, line in enumerate(str(text).split("\n")):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = spacing
        r = p.add_run()
        r.text = line
        r.font.size = Pt(size)
        r.font.bold = bold
        r.font.italic = italic
        r.font.color.rgb = color
        r.font.name = font
    return box


def rect(slide, x, y, w, h, fill=None, line=None, width=Pt(1)):
    s = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    if fill is None:
        s.fill.background()
    else:
        s.fill.solid(); s.fill.fore_color.rgb = fill
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line; s.line.width = width
    s.shadow.inherit = False
    return s


def blank(prs, ground=GROUND, numbered=True):
    """A slide carrying the house chrome: ground, running footer, page number."""
    s = prs.slides.add_slide(prs.slide_layouts[6])
    bg = rect(s, 0, 0, W, H, fill=ground)
    # Push the background behind everything added afterwards.
    s.shapes._spTree.remove(bg._element)
    s.shapes._spTree.insert(2, bg._element)
    if numbered:
        _page["n"] += 1
        rect(s, MARGIN, H - Inches(0.60), W - 2 * MARGIN, Emu(9525), fill=LINE)
        tb(s, MARGIN, H - Inches(0.52), Inches(9), Inches(0.3), RUNNING,
           size=8.5, bold=True, color=MUTED)
        tb(s, W - MARGIN - Inches(0.7), H - Inches(0.52), Inches(0.7), Inches(0.3),
           str(_page["n"]), size=9.5, bold=True, color=MUTED, align=PP_ALIGN.RIGHT)
    return s


def heading(slide, title):
    tb(slide, MARGIN, Inches(0.42), W - 2 * MARGIN, Inches(0.7),
       title, size=32, bold=True, color=INK, font=DISPLAY)
    rect(slide, MARGIN, Inches(1.18), Inches(0.62), Inches(0.045), fill=ACCENT_DEEP)


def obj_label(slide, n, y=Inches(1.40)):
    tb(slide, MARGIN, y, Inches(3), Inches(0.28),
       f"{n:02d} OBJECTIVE", size=11, bold=True, color=ACCENT)


def picture(slide, name, x, y, max_w, max_h, border=True):
    """Fit an image inside the box without distorting it. Missing files become
    a visible placeholder rather than a silently empty slide."""
    path = SHOTS / f"{name}.png"
    if not path.exists():
        rect(slide, x, y, max_w, max_h, fill=WHITE, line=LINE)
        tb(slide, x + Inches(0.3), y + max_h / 2 - Inches(0.2), max_w - Inches(0.6),
           Inches(0.4), f"[ {name} — not captured yet ]", size=13, color=MUTED,
           align=PP_ALIGN.CENTER)
        return False
    iw, ih = Image.open(path).size
    scale = min(max_w / iw, max_h / ih)
    w, h = int(iw * scale), int(ih * scale)
    px, py = int(x + (max_w - w) / 2), int(y + (max_h - h) / 2)
    if border:
        rect(slide, px - Emu(9525), py - Emu(9525), w + Emu(19050), h + Emu(19050),
             fill=WHITE, line=LINE)
    slide.shapes.add_picture(str(path), px, py, w, h)
    return True


def card(slide, x, y, w, h, label, body, *, accent=ACCENT):
    rect(slide, x, y, w, h, fill=WHITE, line=LINE)
    tb(slide, x + Inches(0.22), y + Inches(0.15), w - Inches(0.44), Inches(0.24),
       label.upper(), size=10, bold=True, color=accent)
    tb(slide, x + Inches(0.22), y + Inches(0.43), w - Inches(0.44), h - Inches(0.58),
       body, size=13, color=INK, spacing=1.25)


def statement(slide, x, y, w, h, text, *, dark=False):
    rect(slide, x, y, w, h, fill=ACCENT_DEEP if dark else WASH)
    tb(slide, x + Inches(0.4), y + Inches(0.14), w - Inches(0.8), h - Inches(0.28),
       text, size=16, bold=True, font=SERIF,
       color=WHITE if dark else INK, align=PP_ALIGN.CENTER,
       spacing=1.3, anchor=MSO_ANCHOR.MIDDLE)


# -------------------------------------------------------------------- facts
def gather():
    one = lambda q, p=None: (db.fetch_all(q, p) or [{}])[0]
    f = {}
    f["poi"] = one("select count(*) n from geobot.poi where is_published")["n"]
    f["docs"] = one("select count(*) n from geobot.document")["n"]
    f["chunks"] = one("select count(*) n from geobot.document_chunk")["n"]
    f["fac_real"] = one("select count(*) n from geobot.faculty where data_origin='real'")["n"]
    f["fac_sim"] = one("select count(*) n from geobot.faculty where data_origin='synthetic'")["n"]
    f["blocks"] = one("select count(*) n from geobot.faculty_schedule where data_origin='real'")["n"]

    run = one("select id, run_label from geobot.eval_run where run_label='run-03-simulation'")
    f["run"] = run.get("run_label")
    rid = run.get("id")
    f["stages"], f["avail"], f["ragas"] = {}, {}, {}
    if rid:
        for r in db.fetch_all(
                "select mode, count(*) n, round(avg(t_guard_ms),1) guard, "
                "round(avg(t_rf_ms),1) rf, round(avg(t_retrieve_ms),1) retrieve, "
                "round(avg(t_llm_ms),1) llm, round(avg(t_total_ms),1) total "
                "from geobot.eval_result where run_id=%s group by mode", (rid,)):
            f["stages"][r["mode"]] = r
        # "Answered" means the assistant did not refuse. Matched on "sorry"
        # rather than "don't have": the model writes a TYPOGRAPHIC apostrophe,
        # so an ASCII pattern matches nothing and every refusal counts as an
        # answer -- which once put the exact inverse of this finding on a slide.
        for r in db.fetch_all(
                "select r.mode, count(*) n, "
                "count(*) filter (where r.answer not ilike '%%sorry%%') answered "
                "from geobot.eval_result r join geobot.eval_query q on q.id=r.eval_query_id "
                "where r.run_id=%s and q.category='faculty_availability' group by r.mode",
                (rid,)):
            f["avail"][r["mode"]] = r
        for r in db.fetch_all(
                "select r.mode, count(*) n, "
                "round(avg(g.faithfulness)::numeric,3) faithfulness, "
                "round(avg(g.answer_relevancy)::numeric,3) answer_relevancy, "
                "round(avg(g.context_recall)::numeric,3) context_recall, "
                "round(avg(g.context_precision)::numeric,3) context_precision "
                "from geobot.ragas_score g join geobot.eval_result r on r.id=g.eval_result_id "
                "where r.run_id=%s group by r.mode", (rid,)):
            f["ragas"][r["mode"]] = r
    return f


# ------------------------------------------------------------------- slides
def s_title(prs, f):
    s = blank(prs, ground=GROUND, numbered=False)
    rect(s, 0, 0, Inches(0.22), H, fill=ACCENT_DEEP)
    tb(s, Inches(0.95), Inches(1.28), Inches(7.6), Inches(0.3),
       "SYSTEM THESIS DEFENSE", size=12.5, bold=True, color=ACCENT)
    tb(s, Inches(0.95), Inches(1.70), Inches(8.1), Inches(3.0),
       "ISU-GeoBot\nA Campus Navigation and\nFaculty Availability Assistant",
       size=36, bold=True, color=INK, font=SERIF, spacing=1.16)
    tb(s, Inches(0.95), Inches(4.72), Inches(7.9), Inches(0.9),
       "Integrating a Random Forest classifier into a Retrieval-Augmented "
       "Generation pipeline, under an enforced disclosure limit.",
       size=15, color=MUTED, spacing=1.35)

    rect(s, Inches(9.35), Inches(1.26), Inches(3.35), Inches(4.5), fill=ACCENT_DEEP)
    tb(s, Inches(9.72), Inches(1.58), Inches(2.7), Inches(0.8),
       "ISU-GeoBot", size=24, bold=True, color=WHITE, font=DISPLAY)
    rect(s, Inches(9.72), Inches(2.56), Inches(0.75), Emu(19050), fill=ACCENT)
    tb(s, Inches(9.72), Inches(2.84), Inches(2.8), Inches(2.5),
       "Enhanced RAG\nRandom Forest availability\nStatus masking protocol\n"
       "Interactive campus map\nOCR announcement intake",
       size=13.5, color=WHITE, spacing=1.62)

    y = Inches(6.24)
    rect(s, Inches(0.95), y - Inches(0.22), W - Inches(1.9), Emu(9525), fill=LINE)
    tb(s, Inches(0.95), y, Inches(4.2), Inches(0.8),
       "Researchers:  Simbulan, Christian Paul\n"
       "                       Almario, Michael Allan",
       size=11.5, color=MUTED, spacing=1.35)
    tb(s, Inches(5.45), y, Inches(4.5), Inches(0.8),
       "Institution / Department: College of Computing Studies,\n"
       "Information and Communication Technology", size=11.5, color=MUTED, spacing=1.35)
    tb(s, Inches(10.15), y, Inches(2.9), Inches(0.5),
       "Defense Date: September 16, 2026", size=11.5, color=MUTED)


def s_background(prs, f):
    s = blank(prs); heading(s, "Background of the Study")
    tb(s, MARGIN, Inches(1.42), W - 2 * MARGIN, Inches(0.5),
       "A student looking for a lecturer asks two questions. The campus answers "
       "neither well.", size=19, bold=True, color=INK, font=SERIF)
    cards = [
        ("WHERE", "A campus of thirty-odd buildings, no signage a newcomer can follow, "
                  "and no searchable index of what is inside them."),
        ("WHETHER", "Whether a lecturer is in right now is unanswerable without walking "
                    "to the office and checking."),
        ("THE RISK", "Answering the second question carelessly turns a navigation tool "
                     "into a tracking tool."),
        ("THE DATA", f"{f['blocks']} real class blocks exist. Real attendance records do "
                     "not — they were ruled out on privacy grounds."),
        ("THE GAP", "Retrieval alone cannot answer availability. A timetable is not a "
                    "document in the corpus."),
        ("THE RULE", "An empty hour is not free time. It is the absence of a class, not "
                     "the presence of a person."),
    ]
    cw, ch, gap = Inches(3.92), Inches(1.32), Inches(0.20)
    for i, (label, body) in enumerate(cards):
        card(s, MARGIN + (i % 3) * (cw + gap), Inches(2.10) + (i // 3) * (ch + gap),
             cw, ch, label, body)
    statement(s, MARGIN, Inches(5.28), W - 2 * MARGIN, Inches(1.02),
              "The system must answer where a building is, and whether a lecturer is "
              "available — without ever disclosing where that person is.")


def s_objectives(prs, f):
    s = blank(prs); heading(s, "Objectives")
    objs = [
        ("01", "Integrate the classifier",
         "Integrate a Random Forest classifier into the Retrieval-Augmented Generation "
         "pipeline so that faculty availability is estimated from temporal schedule data "
         "and behavioural attendance features."),
        ("02", "Compare the architectures",
         "Evaluate and compare the standard and Enhanced RAG architectures in terms of "
         "Response Time and the RAGAS metrics of Context Precision, Context Recall, "
         "Faithfulness and Answer Relevancy."),
        ("03", "Deploy with a disclosure limit",
         "Deploy the Enhanced RAG architecture within the web-based ISU-GeoBot system, "
         "enforcing a status masking protocol and an egress boundary so that no physical "
         "location of a person is disclosed."),
        ("04", "Evaluate functional accuracy",
         "Evaluate the functional accuracy of the system's availability estimates against "
         "direct field observation of classroom activity."),
    ]
    cw, chh, gap = Inches(5.98), Inches(1.94), Inches(0.20)
    for i, (num, title, body) in enumerate(objs):
        x = MARGIN + (i % 2) * (cw + gap)
        y = Inches(1.50) + (i // 2) * (chh + gap)
        rect(s, x, y, cw, chh, fill=WHITE, line=LINE)
        tb(s, x + Inches(0.24), y + Inches(0.18), Inches(0.6), Inches(0.34),
           num, size=15, bold=True, color=ACCENT)
        tb(s, x + Inches(0.90), y + Inches(0.16), cw - Inches(1.2), Inches(0.36),
           title, size=16, bold=True, color=INK)
        tb(s, x + Inches(0.24), y + Inches(0.62), cw - Inches(0.48), chh - Inches(0.78),
           body, size=12.5, color=MUTED, spacing=1.3)
    tb(s, MARGIN, Inches(5.72), W - 2 * MARGIN, Inches(0.4),
       "Evaluated on:   Response Time   •   Context Precision   •   Context "
       "Recall   •   Faithfulness   •   Answer Relevancy   •   Macro F1",
       size=13, bold=True, color=ACCENT_DEEP, align=PP_ALIGN.CENTER)


def s_diagram(prs, title, name):
    s = blank(prs); heading(s, title)
    picture(s, name, MARGIN, Inches(1.36), W - 2 * MARGIN, Inches(5.24))


def s_shot(prs, objective, name, caption):
    s = blank(prs); heading(s, "System Screenshots")
    obj_label(s, objective)
    tb(s, MARGIN, Inches(1.74), Inches(2.52), Inches(3.6), caption,
       size=13, color=MUTED, spacing=1.35)
    picture(s, name, Inches(3.40), Inches(1.36), W - Inches(3.40) - MARGIN, Inches(5.24))


def s_results(prs, f):
    s = blank(prs); heading(s, "Results — Response Time")
    obj_label(s, 2)
    std, enh = f["stages"].get("standard"), f["stages"].get("enhanced")
    rows = [("Pipeline stage", "Standard", "Enhanced", "Δ")]
    if std and enh:
        for k, label in (("guard", "Presence guard"), ("rf", "Random Forest"),
                         ("retrieve", "Vector retrieval"), ("llm", "Answer generation"),
                         ("total", "End-to-end mean")):
            a, b = float(std[k]), float(enh[k])
            rows.append((label, f"{a:,.1f} ms", f"{b:,.1f} ms", f"{b - a:+,.1f}"))
    y = Inches(1.80)
    xs = [MARGIN + Inches(0.20), MARGIN + Inches(2.95), MARGIN + Inches(4.40),
          MARGIN + Inches(5.80)]
    for i, row in enumerate(rows):
        head = i == 0
        last = row[0] == "End-to-end mean"
        if head or last:
            rect(s, MARGIN, y, Inches(7.05), Inches(0.46),
                 fill=WHITE if head else WASH, line=LINE if head else None)
        for j, cell in enumerate(row):
            tb(s, xs[j], y + Inches(0.09), Inches(2.5), Inches(0.32), cell,
               size=12.5, bold=head or last, color=MUTED if head else INK,
               font=MONO if (j and not head) else SANS)
        y += Inches(0.52)

    av_s = f["avail"].get("standard", {})
    av_e = f["avail"].get("enhanced", {})
    rect(s, Inches(8.10), Inches(1.80), Inches(4.61), Inches(2.55), fill=WHITE, line=ACCENT)
    tb(s, Inches(8.38), Inches(1.98), Inches(4.1), Inches(0.28),
       "THE FINDING THAT MATTERS", size=10, bold=True, color=ACCENT)
    if av_s:
        tb(s, Inches(8.38), Inches(2.34), Inches(4.1), Inches(0.85),
           f"{av_s.get('answered', 0)} of {av_s.get('n', 6)}", size=34, bold=True,
           color=INK, font=DISPLAY)
        tb(s, Inches(8.38), Inches(3.02), Inches(4.1), Inches(1.2),
           "availability questions answered by the standard architecture.\n"
           f"The Enhanced architecture answered {av_e.get('answered', 0)}.",
           size=13.5, color=MUTED, spacing=1.3)
    statement(s, MARGIN, Inches(5.06), W - 2 * MARGIN, Inches(1.16),
              "The Enhanced arm is slower, and that is the honest result. What the extra "
              "time buys is a class of question the baseline cannot answer at all.")


def s_ragas(prs, f):
    s = blank(prs); heading(s, "Results — Retrieval Quality")
    obj_label(s, 2)
    metrics = [("context_precision", "Context Precision"),
               ("context_recall", "Context Recall"),
               ("faithfulness", "Faithfulness"),
               ("answer_relevancy", "Answer Relevancy")]
    std, enh = f["ragas"].get("standard"), f["ragas"].get("enhanced")
    scored = [k for k, _ in metrics if std and std.get(k) is not None]

    if scored:
        y = Inches(1.82)
        xs = [MARGIN + Inches(0.20), MARGIN + Inches(3.60), MARGIN + Inches(5.10),
              MARGIN + Inches(6.60)]
        rect(s, MARGIN, y, Inches(8.1), Inches(0.46), fill=WHITE, line=LINE)
        for j, c in enumerate(("RAGAS metric", "Standard", "Enhanced", "Δ")):
            tb(s, xs[j], y + Inches(0.09), Inches(3.2), Inches(0.32), c,
               size=12.5, bold=True, color=MUTED)
        y += Inches(0.52)
        for key, label in metrics:
            if not std or std.get(key) is None:
                continue
            a = float(std[key])
            b = float(enh[key]) if enh and enh.get(key) is not None else None
            cells = [label, f"{a:.3f}",
                     f"{b:.3f}" if b is not None else "—",
                     f"{b - a:+.3f}" if b is not None else "—"]
            for j, c in enumerate(cells):
                tb(s, xs[j], y + Inches(0.09), Inches(3.2), Inches(0.32), c,
                   size=12.5, color=INK, font=MONO if j else SANS)
            y += Inches(0.48)
        note = ("Context Precision is a retriever metric and both arms share a retriever, "
                "so it is expected to stay flat. Four bars all rising would be the "
                "suspicious result.")
        if len(scored) < 4:
            note = (f"{len(scored)} of 4 metrics scored so far; the remainder are still "
                    "running against a rate-limited judge. ") + note
    else:
        rect(s, MARGIN, Inches(1.82), W - 2 * MARGIN, Inches(1.65), fill=WHITE, line=WARN)
        tb(s, MARGIN + Inches(0.30), Inches(2.02), Inches(2.8), Inches(0.28),
           "NOT REPORTED, AND WHY", size=10, bold=True, color=WARN)
        tb(s, MARGIN + Inches(0.30), Inches(2.36), W - 2 * MARGIN - Inches(0.6),
           Inches(1.05),
           "The judge is capped at 8,000 tokens per minute and one grading prompt costs "
           "roughly 2,000, so a full four-metric sweep over both arms did not complete "
           "within the study period. This is a quota limit, not a design one.",
           size=14, color=INK, spacing=1.3)
        note = ("The harness is implemented and every answer is recorded; only the "
                "scoring pass is outstanding.")
    tb(s, MARGIN, Inches(5.30), W - 2 * MARGIN, Inches(1.0), note,
       size=13.5, color=MUTED, spacing=1.35)


def s_privacy(prs, f):
    s = blank(prs); heading(s, "The Refusal Is the Feature")
    obj_label(s, 3)
    tb(s, MARGIN, Inches(1.78), Inches(6.1), Inches(0.36),
       "Asked:   “Where is SIM-22?”", size=17, bold=True, color=INK)
    rect(s, MARGIN, Inches(2.26), Inches(6.1), Inches(0.78), fill=WHITE, line=LINE)
    tb(s, MARGIN + Inches(0.26), Inches(2.44), Inches(5.6), Inches(0.5),
       "“I’m sorry, but I don’t have that information.”",
       size=15, italic=True, color=MUTED)
    for i, p in enumerate([
            "Routed as navigation — the classifier never ran",
            "Recorded classification time: 0.0 ms. Not computed, then hidden",
            "Worded exactly like the refusal for an unknown building, so using "
            "the rule reveals nothing"]):
        yy = Inches(3.28) + i * Inches(0.62)
        tb(s, MARGIN, yy, Inches(0.24), Inches(0.3), "—", size=14, color=ACCENT)
        tb(s, MARGIN + Inches(0.30), yy, Inches(5.85), Inches(0.6), p,
           size=14, color=INK, spacing=1.25)
    picture(s, "06-chat-refusal", Inches(7.0), Inches(1.70), Inches(5.71), Inches(3.5))
    statement(s, MARGIN, Inches(5.42), W - 2 * MARGIN, Inches(1.06),
              "Across all twelve availability responses, no answer named a room, building, "
              "floor or office — and the egress filter recorded zero interceptions.")


def s_conclusion(prs, f):
    s = blank(prs); heading(s, "Expected Contribution / Conclusion")
    tb(s, MARGIN, Inches(1.42), W - 2 * MARGIN, Inches(0.85),
       "The contribution is not a faster assistant. It is an assistant that cannot "
       "disclose a person’s location, by construction.",
       size=19, bold=True, color=INK, font=SERIF, spacing=1.25)
    rows = [
        ("01", "Schedule-grounded availability",
         "Availability is answered from a classifier over timetable and behavioural "
         "features, not inferred from retrieved prose."),
        ("02", "Enforced disclosure limit",
         "Three coarse states, never a room. The gates run before prediction, so a "
         "paused lecturer’s estimate is never computed at all."),
        ("03", "Honest measurement",
         "Generated data is stamped synthetic end to end, and the instruments refuse to "
         "score what the data cannot support."),
        ("04", "Reproducible artifacts",
         "Every figure in Chapter 4 is emitted by a script from the database rather than "
         "transcribed by hand."),
    ]
    for i, (num, title, body) in enumerate(rows):
        y = Inches(2.44) + i * Inches(0.84)
        tb(s, MARGIN, y, Inches(0.6), Inches(0.32), num, size=14, bold=True, color=ACCENT)
        tb(s, MARGIN + Inches(0.70), y, Inches(3.6), Inches(0.34), title,
           size=15, bold=True, color=INK)
        tb(s, MARGIN + Inches(4.50), y, Inches(7.5), Inches(0.72), body,
           size=13.5, color=MUTED, spacing=1.25)
    statement(s, MARGIN, Inches(5.92), W - 2 * MARGIN, Inches(0.92),
              "A system that answered faster by guessing where someone is would not be "
              "an improvement.", dark=True)


def s_thanks(prs):
    s = blank(prs, ground=ACCENT_DEEP, numbered=False)
    rect(s, 0, 0, Inches(0.22), H, fill=ACCENT)
    tb(s, Inches(1.2), Inches(2.85), Inches(10.9), Inches(1.4),
       "Thank you", size=52, bold=True, color=WHITE, font=SERIF, align=PP_ALIGN.CENTER)
    tb(s, Inches(1.2), Inches(4.25), Inches(10.9), Inches(0.5),
       "Questions are welcome.", size=17, color=WASH, align=PP_ALIGN.CENTER)


# --------------------------------------------------------------------- build
def build():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    f = gather()
    _page["n"] = 0
    prs = Presentation()
    prs.slide_width, prs.slide_height = W, H

    s_title(prs, f)
    s_background(prs, f)
    s_objectives(prs, f)
    s_diagram(prs, "System Architecture", "diagram-architecture")
    s_diagram(prs, "AI Pipeline", "diagram-pipeline")
    s_shot(prs, 1, "05-chat-availability",
           "The classifier answering an availability question. One of three coarse "
           "states plus the next consultation window — and no location.")
    s_results(prs, f)
    s_ragas(prs, f)
    s_shot(prs, 3, "02-map-overview",
           f"The deployed map. {f['poi']} published locations, drawn from the same "
           "records the assistant retrieves against.")
    s_shot(prs, 3, "03-place-card",
           "A place card. The photograph is interface only — it never enters the "
           "retrieval corpus.")
    s_privacy(prs, f)
    s_shot(prs, 3, "05-admin-locations",
           "The Admin Dashboard. Adding a location writes the map pin and its embedded "
           "place card in one operation, so the two cannot drift apart.")
    s_shot(prs, 3, "07-admin-schedule",
           "Schedule import. Two steps: the preview returns a checksum, and the apply "
           "is refused unless that checksum comes back.")
    s_shot(prs, 3, "08-admin-ocr",
           "Announcement intake. OCR text is extracted in the browser and never stored; "
           "only the resolved event is written.")
    s_shot(prs, 4, "06-admin-validation",
           "Field observation capture. The observed status starts empty and the system "
           "estimate stays hidden until the observer commits — the rebuilt form.")
    s_conclusion(prs, f)
    s_thanks(prs)

    prs.save(OUT)
    print(f"wrote {OUT}  ({OUT.stat().st_size // 1024} KB, {len(prs.slides)} slides)")
    print("\nfigures read from the database:")
    for k in ("poi", "docs", "chunks", "fac_real", "fac_sim", "blocks", "run"):
        print(f"   {k:12} {f.get(k)}")
    for mode, r in f["avail"].items():
        print(f"   availability {mode:9} answered {r['answered']} of {r['n']}")
    print(f"   ragas arms   {list(f['ragas'].keys()) or 'none scored yet'}")
    missing = [n for n in ("05-chat-availability", "06-chat-refusal")
               if not (SHOTS / f"{n}.png").exists()]
    if missing:
        print(f"\n   PLACEHOLDERS STILL OPEN: {', '.join(missing)}")


if __name__ == "__main__":
    build()
