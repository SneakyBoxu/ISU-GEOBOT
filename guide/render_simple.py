"""
Four simple diagrams for the how-it-works guide.

    python guide/render_simple.py

Deliberately fewer and plainer than the previous set. Each one answers a single
question, so it can be understood without reading the section around it.
"""

from __future__ import annotations

from pathlib import Path

from diagram_kit import Canvas

OUT = Path(__file__).resolve().parent / "figures"
OUT.mkdir(parents=True, exist_ok=True)


# ------------------------------------------------------- 1. status masking
def fig1_masking():
    c = Canvas(12, 7.6, "Diagram 1 — What status masking keeps and what it throws away")

    inbox = c.panel(0.4, 5.05, 3.7, "WHAT COMES IN",
                    ["predicted_class", "probabilities",
                     "feature_list", "model_version"], "ml")

    check = c.diamond(4.75, 5.05, 3.2, 1.45,
                      "Is predicted_class one of the 3 allowed values?")

    err = c.box(8.6, 5.35, 3.0, 0.85, "THROW MaskingViolation", "privacy",
                fontsize=8.4, bold=True, sub="never a default status")

    keep = c.panel(1.6, 2.95, 3.6, "WHAT COMES OUT",
                   ["statusCode", "source", "maskedAt"], "backend")

    purge = c.panel(6.5, 2.95, 4.3, "PURGED — set to null",
                    ["predicted_class = null", "probabilities   = null",
                     "feature_list    = null"], "privacy")

    sep = c.box(1.6, 1.75, 9.2, 0.72,
                "probabilities are handed back SEPARATELY, so a caller must "
                "deliberately choose to store them", "note", fontsize=7.8,
                wrap=86, sub="eval_result.rf_proba")

    three = c.box(1.6, 0.72, 9.2, 0.80,
                  "available_consultation  ·  in_scheduled_class  ·  "
                  "unavailable_off_schedule", "backend", fontsize=8.4, bold=True,
                  sub="the only three values that may cross the boundary", wrap=90)

    c.arrow(inbox, check)
    c.arrow(check, err, "no", a_side="e", b_side="w")
    c.arrow(check, keep, "yes", a_side="s", b_side="n", rad=0.20)
    c.arrow(check, purge, a_side="s", b_side="n", rad=-0.20, color="#B03A3A")
    c.arrow(keep, three, a_side="s", b_side="n", rad=0.08)
    c.arrow(purge, sep, a_side="s", b_side="e", rad=0.25, color="#7A8894")

    c.note(0.4, 0.55, "backend/src/middleware/privacy-masking-middleware.js  —  "
                      "maskPrediction()", width=110)
    return c.save(OUT / "d1_masking.png")


# --------------------------------------------------- 2. availability decision
def fig2_availability():
    c = Canvas(12, 8.6, "Diagram 2 — Deciding whether a lecturer is available")

    q = c.box(4.2, 7.85, 3.6, 0.6, "Someone asks about a lecturer", "user", bold=True)
    g1 = c.diamond(4.2, 6.70, 3.6, 0.95, "Is the person asking signed in?")
    d1 = c.box(8.4, 6.85, 3.2, 0.62, "Ask them to sign in", "privacy")
    g2 = c.diamond(4.2, 5.55, 3.6, 0.95, "Has the lecturer consented, and not paused?")
    d2 = c.box(8.4, 5.70, 3.2, 0.62, "Say the information is unavailable", "privacy",
               sub="never says 'opted out'", fontsize=7.6)

    g3 = c.diamond(4.2, 4.35, 3.6, 0.95, "Did a guard log them LEAVING campus?")
    ov = c.box(8.4, 4.50, 3.2, 0.62, "unavailable_off_schedule", "privacy",
               sub="model is never called", fontsize=7.6)

    gather = c.box(3.3, 3.35, 5.4, 0.72,
                   "Gather: timetable · calendar · attendance history", "data",
                   fontsize=8.2)

    camp = c.diamond(3.3, 2.05, 5.4, 1.05,
                     "Teaching right now — on the campus that was asked about?")

    yes = c.box(0.4, 1.05, 2.6, 0.72, "in_scheduled_class", "backend", fontsize=8.0)
    no = c.box(8.9, 1.00, 2.8, 0.82, "unavailable_off_schedule", "privacy",
               sub="'not scheduled on this campus'", fontsize=7.6)
    rf = c.box(4.3, 1.05, 3.4, 0.72, "Random Forest decides", "ml", fontsize=8.2,
               bold=True)

    out = c.box(3.3, 0.20, 5.4, 0.62, "One of three status codes", "backend", bold=True)

    c.arrow(q, g1)
    c.arrow(g1, d1, "no", a_side="e", b_side="w")
    c.arrow(g1, g2, "yes")
    c.arrow(g2, d2, "no", a_side="e", b_side="w")
    c.arrow(g2, g3, "yes")
    c.arrow(g3, ov, "yes", a_side="e", b_side="w")
    c.arrow(g3, gather, "no")
    c.arrow(gather, camp)
    c.arrow(camp, yes, "YES", a_side="w", b_side="n", rad=0.18)
    c.arrow(camp, no, "NO", a_side="e", b_side="n", rad=-0.18)
    c.arrow(camp, rf, a_side="s", b_side="n")
    c.arrow(rf, out); c.arrow(yes, out, a_side="s", b_side="w", rad=-0.2)
    c.arrow(no, out, a_side="s", b_side="e", rad=0.2)

    c.note(0.4, 0.85, "An empty slot in the\ntimetable is NOT\navailability.", width=22)
    return c.save(OUT / "d2_availability.png")


# ------------------------------------------------- 3. three question types
def fig3_three_questions():
    c = Canvas(12.4, 7.4, "Diagram 3 — What runs for each kind of question")

    cols = [
        (0.35, "\"Where is the library?\"", "campus_navigation", "frontend"),
        (4.35, "\"What is the passing grade?\"", "general_institutional", "data"),
        (8.35, "\"Is Professor X available?\"", "faculty_availability", "ml"),
    ]
    steps = [
        "Route the question",
        "Embed the question",
        "Search the document chunks",
        "Load the campus location list",
        "Check consent + compute status",
        "Build one prompt",
        "Ask the language model",
        "Filter the answer for locations",
        "Move the map",
    ]
    runs = {
        0: [1, 1, 1, 1, 0, 1, 1, 0, 1],
        1: [1, 1, 1, 1, 0, 1, 1, 0, 0],
        2: [1, 1, 1, 1, 1, 1, 1, 1, 0],
    }

    for i, (x, title, cat, kind) in enumerate(cols):
        c.box(x, 6.30, 3.7, 0.72, title, kind, sub=cat, fontsize=8.2, bold=True)
        y = 5.55
        for j, s in enumerate(steps):
            on = runs[i][j]
            c.box(x, y, 3.7, 0.50, s if on else "— skipped —",
                  "backend" if on else "note",
                  fontsize=7.4 if on else 7.0)
            y -= 0.58

    c.note(0.35, 0.42,
           "Read this across, not down. All three questions run retrieval — routing does "
           "NOT choose between the document search and the database. Only the third adds "
           "the availability step, and only the third is filtered on the way out. The map "
           "moves only when the question was about a place.", width=118)
    return c.save(OUT / "d3_three_questions.png")


# ------------------------------------------------------------ 4. whole system
def fig4_whole():
    c = Canvas(12, 6.4, "Diagram 4 — The whole system on one page")

    u = c.box(4.6, 5.60, 2.8, 0.62, "User", "user", bold=True)
    fe = c.box(3.6, 4.55, 4.8, 0.70, "Website (React)", "frontend",
               sub="chat + campus map", bold=True)
    be = c.box(3.6, 3.35, 4.8, 0.80, "Server (Express)", "backend",
               sub="decides what to do, then assembles the answer", bold=True)

    db = c.box(0.35, 1.70, 3.2, 0.95, "Database\n(PostgreSQL)", "data",
               sub="people · places · documents", fontsize=8.2, bold=True)
    ml = c.box(4.05, 1.70, 3.9, 0.95, "ML service\n(Python)", "ml",
               sub="embeddings + Random Forest", fontsize=8.2, bold=True)
    gq = c.box(8.45, 1.70, 3.2, 0.95, "Language model\n(Groq)", "external",
               sub="writes the sentence", fontsize=8.2, bold=True)

    note = c.box(0.35, 0.45, 11.3, 0.80,
                 "The website only ever talks to the server. It never touches the "
                 "database, the ML service or the language model directly — which is why "
                 "no key or table name ever reaches the browser.",
                 "note", fontsize=8.0, wrap=100)

    c.arrow(u, fe); c.arrow(fe, be, "asks")
    c.arrow(be, db, "looks up", a_side="s", b_side="n", rad=0.12)
    c.arrow(be, ml, "predicts", a_side="s", b_side="n")
    c.arrow(be, gq, "generates", a_side="s", b_side="n", rad=-0.12)
    c.arrow(be, fe, "answers", a_side="e", b_side="e", rad=-0.8, color="#7A8894")
    return c.save(OUT / "d4_whole.png")


def main():
    for f in (fig1_masking, fig2_availability, fig3_three_questions, fig4_whole):
        print("  rendered", Path(f()).name)
    print(f"\n4 diagrams written to {OUT}")


if __name__ == "__main__":
    main()
