"""
Render the two deck diagrams from their HTML sources.

    python machine-learning/presentation/render_diagrams.py

WHY HTML AND NOT A DRAWING TOOL. The diagrams state facts that change --
location counts, model names, the retrieval cut-offs -- and a binary drawn in
an editor goes stale silently. These are text files in the repo, diffed and
reviewed like anything else, rendered to PNG at 2x by headless Chromium.

The canvas heights are pinned per diagram because each one is sized to its
content; a shared height would reintroduce the dead band at the bottom that
the first draft had.
"""
from __future__ import annotations

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / "screenshots"

# 1900x830 is 2.29:1, which is the aspect of the slot the deck gives a diagram
# (12.09in by 5.24in). Matching it means the drawing fills the slide instead of
# being letterboxed, and the extra pixels buy room for the layer captions.
WIDTH = 1900

DIAGRAMS = [
    ("diagram_architecture.html", "diagram-architecture", 830),
    ("diagram_pipeline.html", "diagram-pipeline", 830),
]


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for src, name, height in DIAGRAMS:
            ctx = browser.new_context(viewport={"width": WIDTH, "height": height},
                                      device_scale_factor=2)
            page = ctx.new_page()
            page.goto((HERE / src).as_uri(), wait_until="networkidle")
            page.wait_for_timeout(500)
            path = OUT / f"{name}.png"
            page.screenshot(path=str(path))
            print(f"  {name:24} {path.stat().st_size // 1024:>5} KB  {WIDTH}x{height}")
            ctx.close()
        browser.close()


if __name__ == "__main__":
    main()
