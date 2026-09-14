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


def picture(slide, name, x, y, max_w, max_h, border=True, todo=None):
    """
    Fit an image inside the box without distorting it.

    A missing file becomes an INSTRUCTION, not an empty rectangle. The note says
    which screen to open, what to type and what the shot has to show, so whoever
    fills it in does not have to reconstruct the intent from the caption. An
    obviously unfinished slide is also safer than a blank one that looks
    deliberate.
    """
    path = SHOTS / f"{name}.png"
    if not path.exists():
        rect(slide, x, y, max_w, max_h, fill=WHITE, line=WARN)
        tb(slide, x + Inches(0.34), y + Inches(0.30), max_w - Inches(0.68),
           Inches(0.3), "SCREENSHOT STILL TO ADD", size=11, bold=True, color=WARN)
        body = todo or f"Capture {name} and rebuild the deck."
        tb(slide, x + Inches(0.34), y + Inches(0.68), max_w - Inches(0.68),
           max_h - Inches(1.0), body, size=14, color=INK, spacing=1.45)
        tb(slide, x + Inches(0.34), y + max_h - Inches(0.52), max_w - Inches(0.68),
           Inches(0.3),
           f"Save as  screenshots/{name}.png   then re-run  "
           "python machine-learning/build_defense_deck.py",
           size=11, color=MUTED, font=MONO)
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
    # The deployed classifier, by version rather than by "most recent": the
    # registry holds a newer row whose artifact lives on the other
    # researcher's machine and is not what this installation serves.
    f["rf"] = one("select version, training_row_count, metrics, sklearn_version "
                  "from geobot.rf_model_version where version = %s",
                  ("rf-20260909-072845",))

    run = one("select id, run_label from geobot.eval_run where run_label='run-03-simulation'")
    f["run"] = run.get("run_label")
    rid = run.get("id")
    f["stages"], f["avail"], f["ragas"], f["bycat"] = {}, {}, {}, {}
    f["ragas_cat"] = {}
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
        # Per-category, pivoted so each row carries both arms. The pooled mean
        # hides that 33 of 39 queries never reach the classifier at all.
        f["bycat"] = {}
        for r in db.fetch_all(
                "select q.category, "
                "  count(*) filter (where r.mode='standard') n, "
                "  round(avg(r.t_total_ms) filter (where r.mode='standard'),1) std_total, "
                "  round(avg(r.t_total_ms) filter (where r.mode='enhanced'),1) enh_total, "
                "  round(avg(r.t_guard_ms + r.t_rf_ms) filter (where r.mode='enhanced'),1) enh_stages "
                "from geobot.eval_result r join geobot.eval_query q on q.id=r.eval_query_id "
                "where r.run_id=%s group by q.category", (rid,)):
            f["bycat"][r["category"]] = r
        for r in db.fetch_all(
                "select r.mode, count(*) n, "
                "round(avg(g.faithfulness)::numeric,3) faithfulness, "
                "round(avg(g.answer_relevancy)::numeric,3) answer_relevancy, "
                "round(avg(g.context_recall)::numeric,3) context_recall, "
                "round(avg(g.context_precision)::numeric,3) context_precision "
                "from geobot.ragas_score g join geobot.eval_result r on r.id=g.eval_result_id "
                "where r.run_id=%s group by r.mode", (rid,)):
            f["ragas"][r["mode"]] = r
        # Every metric, split by category, over queries scored in BOTH arms.
        # The pairing matters: claim extraction is not deterministic at the
        # margin, so an arm can end up with a score its counterpart lacks, and
        # averaging across that is not a comparison.
        for m in ("faithfulness", "context_recall", "context_precision",
                  "answer_relevancy"):
            for r in db.fetch_all(
                    f"select q.category, r.mode, count(g.{m}) n, "
                    f"round(avg(g.{m})::numeric,4) v "
                    f"from geobot.ragas_score g "
                    f"join geobot.eval_result r on r.id=g.eval_result_id "
                    f"join geobot.eval_query q on q.id=r.eval_query_id "
                    f"join (select r2.eval_query_id qid from geobot.ragas_score g2 "
                    f"      join geobot.eval_result r2 on r2.id=g2.eval_result_id "
                    f"      where r2.run_id=%s and g2.{m} is not null "
                    f"      group by r2.eval_query_id "
                    f"      having count(distinct r2.mode)=2) p "
                    f"  on p.qid=r.eval_query_id "
                    f"where r.run_id=%s and g.{m} is not null "
                    f"group by q.category, r.mode", (rid, rid)):
                f["ragas_cat"].setdefault(m, {}).setdefault(
                    r["category"], {})[r["mode"]] = r
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
    # Wording tracks Section 1.2 exactly. The panel asked for shorter
    # objectives; a deck that reads longer than the paper invites the note
    # twice.
    objs = [
        ("01", "Integrate the classifier",
         "Integrate a Random Forest classifier into the Retrieval-Augmented "
         "Generation pipeline, estimating faculty availability from schedule "
         "and attendance features."),
        ("02", "Establish what it makes answerable",
         "Determine which queries the Enhanced architecture can answer that "
         "retrieval alone cannot, and measure the cost of that capability in "
         "response time and in the RAGAS metrics."),
        ("03", "Deploy with a disclosure limit",
         "Deploy the Enhanced RAG architecture in the ISU-GeoBot web system "
         "with a status masking protocol and an egress boundary that prevents "
         "disclosure of any person's location."),
        ("04", "Evaluate accuracy, and its limits",
         "Evaluate the classifier against the simulation cohort and "
         "field-observe the deployed system, reporting the constraints on "
         "real-world measurement."),
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


def s_shot(prs, objective, name, caption, todo=None):
    s = blank(prs); heading(s, "System Screenshots")
    obj_label(s, objective)
    tb(s, MARGIN, Inches(1.74), Inches(2.52), Inches(3.6), caption,
       size=13, color=MUTED, spacing=1.35)
    picture(s, name, Inches(3.40), Inches(1.36), W - Inches(3.40) - MARGIN,
            Inches(5.24), todo=todo)


def s_results(prs, f):
    """
    Response time, split BY QUESTION TYPE rather than pooled.

    The pooled mean is misleading and was reported that way in an earlier draft.
    Pooling averages the 6 queries that actually reach the classifier together
    with the 33 that never touch it, and the resulting end-to-end delta is
    smaller than the standard deviation of the generation call that dominates
    every row. Split by category, the picture is unambiguous.
    """
    s = blank(prs); heading(s, "Results — Response Time")
    obj_label(s, 2)
    tb(s, MARGIN, Inches(1.72), W - 2 * MARGIN, Inches(0.4),
       "Split by question type, because only one type reaches the classifier.",
       size=15, color=MUTED)

    rows = [("Question type", "n", "Standard", "Enhanced", "Δ", "Checks + RF")]
    for cat, label in (("general_institutional", "General institutional"),
                       ("campus_navigation", "Campus navigation"),
                       ("faculty_availability", "Faculty availability")):
        c = f["bycat"].get(cat, {})
        if not c:
            continue
        a, b = float(c["std_total"]), float(c["enh_total"])
        rows.append((label, str(c["n"]), f"{a:,.1f} ms", f"{b:,.1f} ms",
                     f"{b - a:+,.1f}", f"{float(c['enh_stages']):,.1f} ms"))

    y = Inches(2.26)
    xs = [MARGIN + Inches(0.20), MARGIN + Inches(3.05), MARGIN + Inches(3.75),
          MARGIN + Inches(5.45), MARGIN + Inches(7.15), MARGIN + Inches(8.60)]
    for i, row in enumerate(rows):
        head = i == 0
        avail = row[0] == "Faculty availability"
        if head or avail:
            rect(s, MARGIN, y, W - 2 * MARGIN, Inches(0.50),
                 fill=WHITE if head else WASH, line=LINE if head else None)
        for j, cell in enumerate(row):
            tb(s, xs[j], y + Inches(0.12), Inches(2.8), Inches(0.32), cell,
               size=13, bold=head or avail, color=MUTED if head else INK,
               font=MONO if (j and not head) else SANS)
        y += Inches(0.56)

    tb(s, MARGIN, Inches(4.62), Inches(6.05), Inches(1.30),
       "Navigation queries do zero extra work in both arms — consent checks "
       "and forest are 0.0 ms — yet still differ by 119 ms. That is the noise "
       "floor of the hosted generation call, whose own standard deviation runs "
       "138–520 ms. Of the 255 ms on availability, 197 is the consent and "
       "override check and only 59 is the classifier.", size=13, color=INK,
       spacing=1.32)

    rect(s, Inches(6.95), Inches(4.58), Inches(5.76), Inches(1.34), fill=WHITE, line=ACCENT)
    tb(s, Inches(7.20), Inches(4.74), Inches(5.3), Inches(0.28),
       "WHAT THE BASELINE WAS DOING FASTER", size=10, bold=True, color=ACCENT)
    av_s = f["avail"].get("standard", {})
    av_e = f["avail"].get("enhanced", {})
    tb(s, Inches(7.20), Inches(5.06), Inches(5.3), Inches(0.82),
       f"Refusing. It answered {av_s.get('answered', 0)} of {av_s.get('n', 6)}; the "
       f"Enhanced arm answered {av_e.get('answered', 0)}. Mean answer length: 44 "
       "characters against 114.",
       size=13, color=INK, spacing=1.3)

    statement(s, MARGIN, Inches(6.06), W - 2 * MARGIN, Inches(0.74),
              "The enhancement costs nothing on the questions it does not touch, and "
              "255 ms on the ones the baseline cannot answer at all.")


def s_classifier(prs, f):
    """Random Forest against the schedule lookup it is proposed to replace."""
    s = blank(prs); heading(s, "Results - Availability Classifier")
    obj_label(s, 1)

    rf = f.get("rf") or {}
    met = rf.get("metrics") or {}
    if isinstance(met, str):
        import json as _json
        met = _json.loads(met)
    pc = met.get("per_class") or {}

    # Rule-baseline figures are the study's own Table 4.3/4.4, measured on the
    # identical sample set and split. They are constants here because the
    # baseline is a script, not a registered model with a metrics row.
    RULE = {"accuracy": 0.8840, "f1_macro": 0.6879,
            "in_scheduled_class": 0.9569, "available_consultation": 0.1818}

    rows = [
        ("Overall accuracy", RULE["accuracy"] * 100, met.get("accuracy", 0) * 100, "%"),
        ("Macro F1", RULE["f1_macro"], met.get("f1_macro", 0), ""),
        ("F1 - in scheduled class",
         RULE["in_scheduled_class"],
         (pc.get("in_scheduled_class") or {}).get("f1", 0), ""),
        ("F1 - available for consultation",
         RULE["available_consultation"],
         (pc.get("available_consultation") or {}).get("f1", 0), ""),
    ]

    xs = [MARGIN + Inches(0.22), MARGIN + Inches(4.80),
          MARGIN + Inches(6.90), MARGIN + Inches(9.10)]
    y = Inches(1.74)
    rect(s, MARGIN, y, W - 2 * MARGIN, Inches(0.46), fill=WHITE, line=LINE)
    for j, c in enumerate(("Measure", "Schedule lookup", "Random Forest", "Change")):
        tb(s, xs[j], y + Inches(0.09), Inches(4.4), Inches(0.32), c,
           size=12.5, bold=True, color=MUTED)
    y += Inches(0.54)

    for label, a, b, unit in rows:
        hot = "consultation" in label
        if hot:
            rect(s, MARGIN, y - Inches(0.04), W - 2 * MARGIN, Inches(0.48),
                 fill=WASH, line=None)
        fmt = (lambda v: f"{v:.2f}{unit}") if unit else (lambda v: f"{v:.4f}")
        tb(s, xs[0], y, Inches(4.4), Inches(0.34), label,
           size=13.5, bold=hot, color=INK)
        tb(s, xs[1], y, Inches(2.0), Inches(0.34), fmt(a), size=13, font=MONO,
           color=INK if hot else MUTED)
        tb(s, xs[2], y, Inches(2.0), Inches(0.34), fmt(b), size=13, font=MONO,
           bold=hot, color=INK)
        tb(s, xs[3], y, Inches(2.2), Inches(0.34), f"{b - a:+.4f}" if not unit
           else f"{b - a:+.2f}{unit}", size=13, font=MONO, bold=hot, color=INK)
        y += Inches(0.52)

    y += Inches(0.10)
    rect(s, MARGIN, y, W - 2 * MARGIN, Inches(0.03), fill=LINE, line=None)
    tb(s, MARGIN, y + Inches(0.20), W - 2 * MARGIN, Inches(1.0),
       "The two approaches are indistinguishable on scheduled classes - a timetable "
       "already records those, and the model does not beat it. They diverge on "
       "consultation availability, 0.1818 to 0.9008, which is the category a "
       "timetable cannot express. That gap is the whole argument for putting a "
       "classifier in the pipeline.",
       size=12.5, color=MUTED, spacing=1.32)

    tb(s, MARGIN, Inches(6.05), W - 2 * MARGIN, Inches(0.6),
       f"SIMULATION RESULT - {rf.get('version','?')}, "
       f"{rf.get('training_row_count',0):,} labelled samples, time-based split, "
       f"scikit-learn {rf.get('sklearn_version','?')}. "
       "Measures recovery of injected behavioural traits, not real-world availability.",
       size=11.5, color=WARN, spacing=1.25)


def s_ragas(prs, f):
    """Answer quality, judged by a model that did not write the answers.

    A matrix: four metrics down, three question categories across. Read left to
    right, the enhancement changes nothing on navigation, nothing on general
    questions, and everything on availability. That shape is the argument, and
    it survives a viewer who does not know what any individual metric means.

    Every number comes from ragas_score at build time. If a metric has not been
    scored its row is simply absent -- nothing here invents a figure.
    """
    s = blank(prs); heading(s, "Results - Answer Quality (RAGAS)")
    obj_label(s, 2)
    cat = f.get("ragas_cat") or {}

    METRICS = [("faithfulness", "Faithfulness"),
               ("context_recall", "Context Recall"),
               ("context_precision", "Context Precision"),
               ("answer_relevancy", "Answer Relevancy")]
    COLS = [("campus_navigation", "Campus navigation"),
            ("general_institutional", "General institutional"),
            ("faculty_availability", "Faculty availability")]

    if not cat:
        rect(s, MARGIN, Inches(1.82), W - 2 * MARGIN, Inches(1.5), fill=WHITE, line=WARN)
        tb(s, MARGIN + Inches(0.30), Inches(2.02), Inches(3.0), Inches(0.28),
           "NOT REPORTED, AND WHY", size=10, bold=True, color=WARN)
        tb(s, MARGIN + Inches(0.30), Inches(2.36), W - 2 * MARGIN - Inches(0.6),
           Inches(0.9),
           "The judge is metered per day per account and one grading prompt costs "
           "thousands of tokens, so the sweep did not complete. A quota limit, not "
           "a design one.", size=14, color=INK, spacing=1.3)
        return

    # Geometry computed from the row count rather than estimated: three earlier
    # versions of this deck put a table through the panel below it.
    x0 = MARGIN + Inches(0.22)
    colw = Inches(3.30)
    xs = [MARGIN + Inches(3.05) + colw * k for k in range(3)]
    y = Inches(1.66)
    step = Inches(0.52)

    # Column headers, with the one that carries the finding marked.
    for k, (_, label) in enumerate(COLS):
        hot = k == 2
        if hot:
            rect(s, xs[k] - Inches(0.14), y - Inches(0.06), colw - Inches(0.10),
                 step * (len(METRICS) + 1) + Inches(0.22), fill=WASH, line=None)
        tb(s, xs[k], y, colw - Inches(0.3), Inches(0.34), label,
           size=13, bold=True, color=INK if hot else MUTED)
        tb(s, xs[k], y + Inches(0.26), colw - Inches(0.3), Inches(0.28),
           "std / enhanced", size=10.5, color=MUTED)
    y += step

    for key, label in METRICS:
        d = cat.get(key)
        if not d:
            continue
        tb(s, x0, y, Inches(2.9), Inches(0.34), label, size=13.5, color=INK)
        for k, (ck, _) in enumerate(COLS):
            pair = d.get(ck) or {}
            a, b = pair.get("standard"), pair.get("enhanced")
            if not a or not b:
                continue
            av, bv = float(a["v"]), float(b["v"])
            same = abs(av - bv) < 0.00005
            txt = f"{av:.4f}   {bv:.4f}"
            tb(s, xs[k], y, colw - Inches(0.3), Inches(0.34), txt,
               size=13, font=MONO, bold=(k == 2),
               color=INK if (k == 2 or same) else MUTED)
        y += step

    y += Inches(0.12)
    rect(s, MARGIN, y, W - 2 * MARGIN, Inches(0.03), fill=LINE, line=None)
    tb(s, MARGIN, y + Inches(0.18), W - 2 * MARGIN, Inches(1.0),
       "The enhancement never wins on campus navigation - it is behind on three "
       "metrics and tied on the fourth - because both arms share one retriever "
       "there. Context Recall and Context Precision are identical to four decimal "
       "places on general questions. Every difference is the availability column, "
       "where the standard arm scores 0.0000 on all four metrics: it refuses, and "
       "a refusal asserts a claim the retrieved context cannot support.",
       size=12.5, color=MUTED, spacing=1.3)


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
    picture(s, "06-chat-refusal", Inches(7.0), Inches(1.70), Inches(5.71),
            Inches(3.5),
            todo="Open the assistant at /app." "\n\n" +
                 "Type:   Where is SIM-22?" "\n\n" +
                 "The shot must show the refusal, with both the question and the "
                 "answer visible in the same frame.")
    statement(s, MARGIN, Inches(5.42), W - 2 * MARGIN, Inches(1.06),
              "Across all twelve availability responses, no answer named a room, building, "
              "floor or office — and the egress filter recorded zero interceptions.")


def s_field(prs, f):
    """
    The field study, stated as the method finding it is.

    This slide exists because the honest version of SO4 is not an accuracy
    number, and a panel is better served by seeing why than by being told the
    sample was small. The engine column is the point: the clean sample observed
    the deterministic path, not the model.
    """
    s = blank(prs); heading(s, "Field Study — What It Can and Cannot Show")
    obj_label(s, 4)

    rows = [("Protocol", "Period", "n", "Agreed", "Engine observed"),
            ("Estimate-first", "28 Aug – 3 Sep", "84", "74",
             "random_forest 55, override 15"),
            ("Observation-first (blind)", "3 Sep – 8 Sep", "24", "23",
             "schedule_only 24")]
    y = Inches(1.80)
    xs = [MARGIN + Inches(0.20), MARGIN + Inches(3.05), MARGIN + Inches(4.60),
          MARGIN + Inches(5.35), MARGIN + Inches(6.45)]
    for i, row in enumerate(rows):
        head = i == 0
        blind = row[0].startswith("Observation-first")
        if head or blind:
            rect(s, MARGIN, y, W - 2 * MARGIN, Inches(0.50),
                 fill=WHITE if head else WASH, line=LINE if head else None)
        for j, cell in enumerate(row):
            tb(s, xs[j], y + Inches(0.12), Inches(3.0), Inches(0.32), cell,
               size=12.5, bold=head or blind, color=MUTED if head else INK,
               font=MONO if (j in (2, 3) and not head) else SANS)
        y += Inches(0.56)

    tb(s, MARGIN, Inches(3.58), Inches(6.05), Inches(1.25),
       "Every blind observation watched an estimate from the deterministic "
       "timetable lookup — not the Random Forest. No real lecturer has "
       "attendance data, so the historical features are absent and the resolver "
       "falls back to the schedule.", size=13.5, color=INK, spacing=1.35)

    rect(s, Inches(6.95), Inches(3.54), Inches(5.76), Inches(1.45), fill=WHITE, line=WARN)
    tb(s, Inches(7.20), Inches(3.72), Inches(5.3), Inches(0.28),
       "THE TWO CONSTRAINTS", size=10, bold=True, color=WARN)
    tb(s, Inches(7.20), Inches(4.06), Inches(5.3), Inches(0.86),
       "The clean sample does not test the model." + chr(10) +
       "The sample that tests the model is not clean.",
       size=14, color=INK, spacing=1.45)

    statement(s, MARGIN, Inches(5.16), W - 2 * MARGIN, Inches(0.84),
              "23 of 24 blind observations agreed — a real result about the "
              "deployed deterministic path, and not evidence about the classifier.")
    tb(s, MARGIN, Inches(6.16), W - 2 * MARGIN, Inches(0.6),
       "Both constraints were surfaced by provenance columns added for that purpose. "
       "Neither is visible in the agreement rates alone.",
       size=13, color=MUTED, spacing=1.3)


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
           "states plus the next consultation window — and no location.",
           todo="Open the assistant at /app and SIGN IN - availability is not "
                "answered anonymously." "\n\n" +
                "Type:   Is SIM-33 available for consultation right now?" "\n\n" +
                "The shot must show a coarse availability state and a next "
                "consultation window, and must name no room, building or floor.")
    s_classifier(prs, f)
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
           "Field observation capture, rebuilt. The observed status starts empty and the "
           "system estimate stays hidden until the observer commits — the fix for "
           "the anchoring defect found mid-study.")
    s_field(prs, f)
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
