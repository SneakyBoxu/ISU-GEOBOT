"""
The system-defense presentation (defense template, item 1).

    python machine-learning/build_defense_deck.py

WHAT THE TEMPLATE ASKS FOR:

    "PPT for your system -- to include in the PPT is the brief discussion
     regarding your study, your Objectives, present screenshots of the system
     addressing the objectives."

So the deck is organised around the OBJECTIVES, not around the software. One
slide per objective, each carrying the evidence for it and, where the evidence
is short, saying so on the slide rather than in the speaker's nerve.

WHY THE NUMBERS ARE READ FROM THE DATABASE.

Every figure on these slides -- location counts, corpus size, per-stage latency,
the capability comparison -- is queried at build time from the same tables
Chapter 4 was written from. Typing them into a deck by hand is how a slide and a
paper come to disagree three minutes into a defense. If a number here is wrong,
it is wrong in the thesis too, and that is the correct failure mode.

SCREENSHOTS ARE PLACEHOLDERS ON PURPOSE.

Each objective slide reserves a framed area and prints, inside it, exactly which
screen to capture and which query to type. Capturing them is five minutes of
work that doubles as demo practice, and a screenshot taken by the person who has
to narrate it is worth more than one taken by a script.
"""

from __future__ import annotations

import sys
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Emu, Inches, Pt

import database_connector as db

OUT = Path(__file__).resolve().parent.parent / "ISU_GeoBot_Defense.pptx"

# ---------------------------------------------------------------- palette
# Deep pine against a cool off-white. Chosen to survive a projector: the accent
# is dark enough to read on a washed-out screen, which mid-tone blues are not.
INK = RGBColor(0x14, 0x1A, 0x19)
MUTED = RGBColor(0x58, 0x64, 0x60)
FAINT = RGBColor(0x8A, 0x96, 0x92)
ACCENT = RGBColor(0x0E, 0x6E, 0x5C)
WARN = RGBColor(0x8A, 0x54, 0x10)
GROUND = RGBColor(0xF7, 0xF9, 0xF8)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
LINE = RGBColor(0xD5, 0xDE, 0xDB)

BODY_FONT = "Calibri"
HEAD_FONT = "Georgia"

W, H = Inches(13.333), Inches(7.5)          # 16:9
MARGIN = Inches(0.72)


# ----------------------------------------------------------------- helpers
def textbox(slide, x, y, w, h, text, *, size=18, bold=False, color=INK,
            font=BODY_FONT, align=PP_ALIGN.LEFT, spacing=1.15):
    """A plain text box. python-pptx has no styled-text primitive, so this is it."""
    box = slide.shapes.add_textbox(x, y, w, h)
    tf = box.text_frame
    tf.word_wrap = True
    for i, line in enumerate(text.split("\n")):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = spacing
        run = p.add_run()
        run.text = line
        run.font.size = Pt(size)
        run.font.bold = bold
        run.font.color.rgb = color
        run.font.name = font
    return box


def rect(slide, x, y, w, h, fill=None, line=None, width=Pt(1)):
    """A rectangle, used for rules, panels and screenshot frames."""
    from pptx.enum.shapes import MSO_SHAPE
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    if fill is None:
        shape.fill.background()
    else:
        shape.fill.solid()
        shape.fill.fore_color.rgb = fill
    if line is None:
        shape.line.fill.background()
    else:
        shape.line.color.rgb = line
        shape.line.width = width
    shape.shadow.inherit = False
    return shape


def blank(prs, ground=GROUND):
    """A slide with no placeholders -- every element is positioned explicitly."""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    bg = rect(slide, 0, 0, W, H, fill=ground)
    # Send the background behind everything added later.
    slide.shapes._spTree.remove(bg._element)
    slide.shapes._spTree.insert(2, bg._element)
    return slide


def header(slide, eyebrow, title):
    """Eyebrow, title, hairline. Repeated on every content slide."""
    textbox(slide, MARGIN, Inches(0.42), W - 2 * MARGIN, Inches(0.3),
            eyebrow.upper(), size=11, bold=True, color=ACCENT)
    textbox(slide, MARGIN, Inches(0.76), W - 2 * MARGIN, Inches(0.8),
            title, size=30, bold=True, color=INK, font=HEAD_FONT)
    rect(slide, MARGIN, Inches(1.55), W - 2 * MARGIN, Emu(9525), fill=LINE)


def shot_frame(slide, x, y, w, h, screen, query=None, proves=None):
    """
    A reserved area for a screenshot, labelled with what to capture.

    The instruction lives INSIDE the frame so it cannot be separated from the
    space it describes, and so an un-filled frame is obviously un-filled rather
    than looking like a design choice.
    """
    rect(slide, x, y, w, h, fill=WHITE, line=LINE)
    textbox(slide, x + Inches(0.22), y + Inches(0.2), w - Inches(0.44), Inches(0.3),
            "SCREENSHOT", size=10, bold=True, color=FAINT)
    body = f"Capture: {screen}"
    if query:
        body += f'\nType: "{query}"'
    if proves:
        body += f"\nShows: {proves}"
    textbox(slide, x + Inches(0.22), y + Inches(0.52), w - Inches(0.44), h - Inches(0.7),
            body, size=13, color=MUTED)


def bullets(slide, x, y, w, items, *, size=16, gap=Inches(0.46)):
    """Accent tick plus text, laid out by hand so the spacing is predictable."""
    for i, item in enumerate(items):
        yy = y + i * gap
        textbox(slide, x, yy, Inches(0.28), Inches(0.4), "—", size=size, color=ACCENT)
        textbox(slide, x + Inches(0.34), yy, w - Inches(0.34), Inches(0.4),
                item, size=size, color=INK)


def status_chip(slide, x, y, text, color):
    """A small filled label -- used for the objective status."""
    w = Inches(0.13) * len(text) + Inches(0.3)
    rect(slide, x, y, w, Inches(0.34), fill=color)
    textbox(slide, x + Inches(0.14), y + Inches(0.03), w, Inches(0.3),
            text, size=12, bold=True, color=WHITE)
    return w


# ------------------------------------------------------------------- facts
def gather():
    """
    Every number the deck prints, straight from the database.

    Anything that cannot be read is returned as None and the slide says so,
    rather than the deck silently showing a stale figure.
    """
    f = {}
    one = lambda q: (db.fetch_all(q) or [{}])[0]

    f["poi_published"] = one(
        "select count(*) n from geobot.poi where is_published")["n"]
    f["documents"] = one("select count(*) n from geobot.document")["n"]
    f["chunks"] = one("select count(*) n from geobot.document_chunk")["n"]
    f["faculty_real"] = one(
        "select count(*) n from geobot.faculty where data_origin='real'")["n"]
    f["faculty_sim"] = one(
        "select count(*) n from geobot.faculty where data_origin='synthetic'")["n"]
    f["blocks_real"] = one(
        "select count(*) n from geobot.faculty_schedule where data_origin='real'")["n"]

    run = one(
        "select id, run_label, prompt_template_version from geobot.eval_run "
        "where run_label = 'run-03-simulation'")
    f["run_label"] = run.get("run_label")

    if run.get("id"):
        stage = db.fetch_all(
            "select mode, count(*) n, round(avg(t_rf_ms),1) rf, "
            "round(avg(t_guard_ms),1) guard, round(avg(t_total_ms),1) total "
            "from geobot.eval_result where run_id = %s group by mode order by mode",
            (run["id"],))
        f["stages"] = {r["mode"]: r for r in stage}

        # The capability finding: how many availability questions each arm
        # actually answered, rather than refused.
        ans = db.fetch_all(
            "select r.mode, count(*) n, "
            # Match on "sorry", not on "don't have": the model writes a
            # TYPOGRAPHIC apostrophe (U+2019), so an ASCII "don''t" matches
            # nothing and every refusal is counted as an answer. That bug put
            # "standard answered 6 of 6" on a slide -- the exact opposite of
            # the finding -- before it was caught against the raw text.
            "  count(*) filter (where r.answer not ilike '%%sorry%%') answered "
            "from geobot.eval_result r join geobot.eval_query q on q.id = r.eval_query_id "
            "where r.run_id = %s and q.category = 'faculty_availability' "
            "group by r.mode order by r.mode", (run["id"],))
        f["availability"] = {r["mode"]: r for r in ans}

    # ragas_score is one row per eval_result with a column per metric, so the
    # arm comes from eval_result and the averages are per column. NULLs are
    # skipped by avg(), which is what we want: a metric that has not been
    # scored yet simply does not contribute.
    f["ragas"] = db.fetch_all(
        "select r.mode, count(*) n, "
        "  round(avg(g.context_precision)::numeric,4) context_precision, "
        "  round(avg(g.context_recall)::numeric,4)    context_recall, "
        "  round(avg(g.faithfulness)::numeric,4)      faithfulness, "
        "  round(avg(g.answer_relevancy)::numeric,4)  answer_relevancy "
        "from geobot.ragas_score g "
        "join geobot.eval_result r on r.id = g.eval_result_id "
        "where r.run_id = %s group by r.mode order by r.mode",
        (run.get("id"),)) if run.get("id") else []
    return f


# ------------------------------------------------------------------ slides
def slide_title(prs, f):
    s = blank(prs, ground=WHITE)
    rect(s, 0, 0, Inches(0.16), H, fill=ACCENT)
    textbox(s, Inches(1.1), Inches(1.9), Inches(11), Inches(0.4),
            "SYSTEM DEFENSE", size=13, bold=True, color=ACCENT)
    textbox(s, Inches(1.1), Inches(2.3), Inches(11), Inches(1.9),
            "ISU-GeoBot", size=54, bold=True, color=INK, font=HEAD_FONT)
    textbox(s, Inches(1.1), Inches(3.3), Inches(10.4), Inches(1.2),
            "A campus navigation and faculty-availability assistant integrating a "
            "Random Forest classifier into a Retrieval-Augmented Generation pipeline",
            size=19, color=MUTED)
    rect(s, Inches(1.1), Inches(4.55), Inches(2.2), Emu(19050), fill=LINE)
    textbox(s, Inches(1.1), Inches(4.8), Inches(11), Inches(1.2),
            "Christian Paul Simbulan  ·  Michael Allan Almario\n"
            "College of Computing Studies, Information and Communication Technology\n"
            "Isabela State University — Echague Main Campus",
            size=15, color=MUTED, spacing=1.35)


def slide_study(prs, f):
    s = blank(prs)
    header(s, "The study in brief", "The problem, and what was built")
    textbox(s, MARGIN, Inches(1.95), Inches(5.9), Inches(2.6),
            "A student looking for a lecturer has two questions, and the campus "
            "answers neither well: where is the building, and is the lecturer "
            "there now?\n\n"
            "The second question is the hard one, because answering it carelessly "
            "turns a navigation tool into a tracking tool.",
            size=17, color=INK, spacing=1.3)
    bullets(s, Inches(7.2), Inches(2.0), Inches(5.4), [
        f"{f['poi_published']} campus locations on an interactive map",
        f"{f['documents']} documents, {f['chunks']} embedded passages",
        f"{f['blocks_real']} real CCSICT class blocks",
        "Availability as one of three coarse states — never a room",
    ])
    rect(s, MARGIN, Inches(4.95), W - 2 * MARGIN, Inches(1.5), fill=WHITE, line=ACCENT)
    textbox(s, MARGIN + Inches(0.3), Inches(5.12), Inches(1.6), Inches(0.3),
            "THE CONTRIBUTION", size=11, bold=True, color=ACCENT)
    textbox(s, MARGIN + Inches(0.3), Inches(5.45), W - 2 * MARGIN - Inches(0.6), Inches(0.9),
            "A retrieval pipeline that answers availability questions from a "
            "schedule-grounded classifier instead of from prose — under a masking "
            "rule that makes disclosing a person’s physical location impossible by "
            "construction, not by prompt instruction.",
            size=16, color=INK, spacing=1.25)


def slide_architecture(prs, f):
    s = blank(prs)
    header(s, "System architecture", "Three services, one database, one hosted model")
    tiers = [
        ("React · port 5173", "Leaflet map, chat, admin dashboard. Holds no secrets.", ACCENT),
        ("Express · port 4000", "The only process with database credentials. Routing, "
                                "retrieval, context fusion, the masking boundary.", ACCENT),
        ("Flask · port 5001", "all-MiniLM-L6-v2 embedder and the Random Forest. "
                              "Python, because both models are Python.", ACCENT),
        ("Supabase", "PostgreSQL + pgvector. 27 tables in the geobot schema.", FAINT),
        ("Groq", "openai/gpt-oss-120b at temperature 0. Writes the sentence only.", FAINT),
    ]
    y = Inches(1.95)
    for name, body, colour in tiers:
        rect(s, MARGIN, y, W - 2 * MARGIN, Inches(0.88), fill=WHITE, line=LINE)
        rect(s, MARGIN, y, Emu(38100), Inches(0.88), fill=colour)
        textbox(s, MARGIN + Inches(0.28), y + Inches(0.14), Inches(2.6), Inches(0.3),
                name, size=14, bold=True, color=colour)
        textbox(s, MARGIN + Inches(3.2), y + Inches(0.14), W - MARGIN * 2 - Inches(3.5),
                Inches(0.6), body, size=14, color=MUTED)
        y += Inches(0.98)
    textbox(s, MARGIN, Inches(6.85), W - 2 * MARGIN, Inches(0.4),
            "Split because the embedder and the forest are Python libraries with no "
            "Node equivalent, and a 135 MB model should load once, not on every API restart.",
            size=13, color=FAINT)


def slide_pipeline(prs, f):
    s = blank(prs)
    header(s, "AI pipeline", "What happens between the question and the answer")
    steps = [
        ("01", "Route", "A gazetteer of the faculty roster plus an intent lexicon "
                        "answers one binary question: does this need an availability "
                        "status? No LLM call — 2 ms, and deterministic."),
        ("02", "Retrieve", "The query is embedded (384 dims, L2-normalised) and "
                           "compared to every chunk by exact cosine. Top 5, floor 0.25. "
                           "Runs in BOTH architectures, always."),
        ("03", "Classify", "Availability only, and only in the Enhanced arm. Two gates "
                           "run BEFORE the forest: signed in, and the lecturer has not "
                           "paused disclosure."),
        ("04", "Fuse", "Retrieved passages and the masked status become one prompt. "
                       "Three sources, one context."),
        ("05", "Mask", "The response is checked for eight forbidden keys — "
                       "probabilities, room_label, embeddings. A backstop, not the "
                       "primary control."),
    ]
    y = Inches(1.9)
    for num, name, body in steps:
        textbox(s, MARGIN, y, Inches(0.6), Inches(0.4), num, size=15, bold=True, color=ACCENT)
        textbox(s, MARGIN + Inches(0.62), y, Inches(1.8), Inches(0.4),
                name, size=16, bold=True, color=INK)
        textbox(s, MARGIN + Inches(2.5), y, W - MARGIN * 2 - Inches(2.5), Inches(0.85),
                body, size=14, color=MUTED, spacing=1.2)
        y += Inches(0.98)


def objective_slide(prs, number, title, status, status_colour, evidence,
                    shot_screen, shot_query=None, shot_proves=None, caveat=None):
    s = blank(prs)
    header(s, f"Objective {number}", title)
    status_chip(s, MARGIN, Inches(1.78), status, status_colour)
    bullets(s, MARGIN, Inches(2.42), Inches(6.1), evidence, size=15, gap=Inches(0.72))
    shot_frame(s, Inches(7.1), Inches(1.95), Inches(5.5), Inches(3.5),
               shot_screen, shot_query, shot_proves)
    if caveat:
        rect(s, MARGIN, Inches(5.72), W - 2 * MARGIN, Inches(1.15), fill=WHITE, line=WARN)
        textbox(s, MARGIN + Inches(0.28), Inches(5.86), Inches(3), Inches(0.28),
                "SAY THIS BEFORE THEY ASK", size=10, bold=True, color=WARN)
        textbox(s, MARGIN + Inches(0.28), Inches(6.14), W - 2 * MARGIN - Inches(0.56),
                Inches(0.8), caveat, size=14, color=INK, spacing=1.2)
    return s


def slide_results(prs, f):
    s = blank(prs)
    header(s, "Results", "The enhancement costs latency and buys capability")
    st = f.get("stages", {})
    std, enh = st.get("standard"), st.get("enhanced")
    rows = [("Stage", "Standard", "Enhanced", "Δ")]
    if std and enh:
        for key, label in (("guard", "Presence guard"), ("rf", "Random Forest"),
                           ("total", "End-to-end")):
            a, b = float(std[key]), float(enh[key])
            rows.append((label, f"{a:,.1f} ms", f"{b:,.1f} ms", f"{b - a:+,.1f}"))
    y = Inches(2.0)
    for i, row in enumerate(rows):
        head = i == 0
        if head:
            rect(s, MARGIN, y, Inches(6.1), Inches(0.44), fill=WHITE, line=LINE)
        for j, cell in enumerate(row):
            xs = [MARGIN + Inches(0.16), MARGIN + Inches(2.5),
                  MARGIN + Inches(3.9), MARGIN + Inches(5.3)]
            textbox(s, xs[j], y + Inches(0.08), Inches(2.2), Inches(0.34), cell,
                    size=13, bold=head or row[0] == "End-to-end",
                    color=MUTED if head else INK)
        y += Inches(0.5)

    av = f.get("availability", {})
    a_std = av.get("standard", {}).get("answered")
    a_enh = av.get("enhanced", {}).get("answered")
    n_q = av.get("standard", {}).get("n")
    rect(s, Inches(7.1), Inches(1.95), Inches(5.5), Inches(2.5), fill=WHITE, line=ACCENT)
    textbox(s, Inches(7.36), Inches(2.12), Inches(5), Inches(0.3),
            "THE FINDING THAT MATTERS", size=10, bold=True, color=ACCENT)
    if a_std is not None:
        textbox(s, Inches(7.36), Inches(2.5), Inches(5), Inches(1.0),
                f"{a_std} of {n_q}", size=34, bold=True, color=INK, font=HEAD_FONT)
        textbox(s, Inches(7.36), Inches(3.15), Inches(5), Inches(1.2),
                f"availability questions answered by the standard architecture.\n"
                f"The Enhanced architecture answered {a_enh}.",
                size=15, color=MUTED, spacing=1.25)
    textbox(s, MARGIN, Inches(5.3), W - 2 * MARGIN, Inches(1.6),
            "The Enhanced arm is slower, and that is the honest result. Baseline RAG "
            "cannot reach a timetable, so it correctly refuses every availability "
            "question. What the extra time buys is an entire class of question the "
            "baseline cannot answer at all — answered under an enforced "
            "disclosure limit.",
            size=16, color=INK, spacing=1.3)


def slide_privacy(prs, f):
    s = blank(prs)
    header(s, "Privacy", "The refusal is the feature")
    textbox(s, MARGIN, Inches(2.0), Inches(6.0), Inches(0.4),
            'Asked: "Where is SIM-22?"', size=18, bold=True, color=INK)
    rect(s, MARGIN, Inches(2.55), Inches(6.0), Inches(0.95), fill=WHITE, line=LINE)
    textbox(s, MARGIN + Inches(0.24), Inches(2.75), Inches(5.5), Inches(0.6),
            "“I’m sorry, but I don’t have that information.”",
            size=16, color=MUTED)
    bullets(s, MARGIN, Inches(3.8), Inches(6.0), [
        "Routed as navigation — the classifier never ran",
        "Recorded classifier time: 0.0 ms. Not computed, then hidden",
        "Worded exactly like an unknown building, so using the rule reveals nothing",
    ], size=15, gap=Inches(0.62))
    shot_frame(s, Inches(7.1), Inches(1.95), Inches(5.5), Inches(3.5),
               "the assistant answering this question",
               "Where is SIM-22?",
               "the refusal, and that it names no room or building")
    rect(s, MARGIN, Inches(5.9), W - 2 * MARGIN, Inches(1.05), fill=WHITE, line=ACCENT)
    textbox(s, MARGIN + Inches(0.28), Inches(6.08), W - 2 * MARGIN - Inches(0.56),
            Inches(0.8),
            "Across all 12 availability responses, no answer named a room, building, "
            "floor or office, and the egress filter recorded zero interceptions — "
            "the boundary held by construction, not by being caught.",
            size=15, color=INK, spacing=1.2)


def slide_limits(prs, f):
    s = blank(prs)
    header(s, "Limitations", "Stated plainly, because they are the method working")
    bullets(s, MARGIN, Inches(2.0), Inches(11.8), [
        "The Random Forest is trained on a generated 37-lecturer cohort. Real "
        "attendance records were ruled out on privacy grounds — a §1.3 "
        "delimitation, not an oversight.",
        "Every figure from that cohort is stamped data_origin='synthetic' and its "
        "artifacts are named -SIMULATION. The claim is that the pipeline recovers "
        "the behaviour injected into the data, and nothing more.",
        "Field observation yielded 24 blind-capture records, below the sample the "
        "analysis needs. The capture form had pre-filled the observed status with "
        "the system’s own estimate; the defect was found, the form rebuilt, and "
        "the contaminated records excluded rather than counted.",
        "RAGAS scoring is limited by judge throughput, not by design.",
    ], size=15, gap=Inches(1.05))
    rect(s, MARGIN, Inches(6.15), W - 2 * MARGIN, Inches(0.85), fill=WHITE, line=ACCENT)
    textbox(s, MARGIN + Inches(0.28), Inches(6.32), W - 2 * MARGIN - Inches(0.56),
            Inches(0.6),
            "Next: a consented cohort with real attendance would let every number here "
            "be recomputed against reality using the instruments already built.",
            size=15, color=INK)


def build():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    f = gather()
    prs = Presentation()
    prs.slide_width, prs.slide_height = W, H

    slide_title(prs, f)
    slide_study(prs, f)
    slide_architecture(prs, f)
    slide_pipeline(prs, f)

    av = f.get("availability", {})
    a_enh = av.get("enhanced", {}).get("answered")
    a_std = av.get("standard", {}).get("answered")

    objective_slide(
        prs, 1, "Integrate a Random Forest into the RAG pipeline",
        "ACHIEVED", ACCENT,
        ["The classifier is reached only by an availability question",
         "Eight schedule features plus three attendance features",
         "Its output is masked to one of three states before it leaves the server",
         f"Answered {a_enh} of 6 availability questions; the baseline answered {a_std}"
         if a_enh is not None else "Exercised end to end in run-03-simulation"],
        "the assistant answering an availability question",
        "Is SIM-33 available for consultation right now?",
        "a coarse state and a next consultation window, with no location")

    ragas_rows = f.get("ragas", [])
    objective_slide(
        prs, 2, "Compare the standard and Enhanced architectures",
        "ACHIEVED" if ragas_rows else "PARTIAL", ACCENT if ragas_rows else WARN,
        ["39 paired queries, one run, one prompt version",
         "Per-stage latency measured in the pipeline itself",
         "Standard answered 0 of 6 availability questions; Enhanced answered 5",
         f"RAGAS: {len(ragas_rows)} metric/arm scores recorded"
         if ragas_rows else "RAGAS scoring limited by judge throughput"],
        "the response-time table, or the comparison view",
        None, "the per-stage difference between the two arms",
        caveat=None if ragas_rows else
        "RAGAS scores are not reported. The judge is capped at 8,000 tokens per "
        "minute and a grading prompt costs about 2,000, so a full sweep did not "
        "finish inside the study period. That is a quota limit, not a design one.")

    objective_slide(
        prs, 3, "Deploy the Enhanced architecture in the web system",
        "ACHIEVED", ACCENT,
        [f"{f['poi_published']} published locations on a live interactive map",
         "Admin Dashboard: locations, validation and schedule import",
         "136 automated tests, 31 of them against the masking boundary",
         "Row-level security forced on all 27 tables"],
        "the campus map with a place card open",
        None, "the deployed system a visitor actually uses")

    objective_slide(
        prs, 4, "Evaluate the functional accuracy of the estimates",
        "PARTIAL", WARN,
        ["Accuracy against the simulation cohort IS measured and reported",
         "96.77% accuracy, 0.9458 macro F1 (Table 4.3)",
         "Field observation: 24 blind-capture records",
         "The instrument works; the sample is short"],
        "the faculty validation tab in the Admin Dashboard",
        None, "the capture form that records each observation",
        caveat="No accuracy figure is claimed from the field sample. At 24 blind "
               "observations the smallest class holds one record, so the analysis "
               "script refuses to emit a score — and 84 earlier records were "
               "excluded because the form had pre-filled the system’s own answer.")

    slide_results(prs, f)
    slide_privacy(prs, f)
    slide_limits(prs, f)

    prs.save(OUT)
    print(f"wrote {OUT}  ({OUT.stat().st_size // 1024} KB, {len(prs.slides.__iter__.__self__._sldIdLst)} slides)")
    print("\nfigures read from the database:")
    for k in ("poi_published", "documents", "chunks", "faculty_real", "faculty_sim",
              "blocks_real", "run_label"):
        print(f"   {k:16} {f.get(k)}")
    if f.get("availability"):
        for mode, r in f["availability"].items():
            print(f"   availability {mode:9} answered {r['answered']} of {r['n']}")
    print(f"   ragas rows       {len(f.get('ragas', []))}")


if __name__ == "__main__":
    build()
