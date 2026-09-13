"""
Capture defense screenshots from the running system with Playwright.

    python capture_screens.py [--with-chat]

--with-chat also captures the assistant answering, which costs Groq quota and
must NOT run while the RAGAS scorer is working -- they share the same rate
limit and the symptom is a 429 that looks like a broken chatbot.

Shots are written to thesis-website/screenshots/ and named for the objective
they support, so the deck builder can pick them up by filename.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
OUT = Path(r"C:/Users/Admin/Desktop/thesis-website/screenshots")
VIEWPORT = {"width": 1600, "height": 950}


def shot(page, name: str, note: str = "") -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{name}.png"
    page.screenshot(path=str(path))
    kb = path.stat().st_size // 1024
    print(f"  {name:34} {kb:>5} KB  {note}")


def settle(page, ms: int = 1400) -> None:
    """Let tiles, fonts and entry animations finish before the shutter."""
    try:
        page.wait_for_load_state("networkidle", timeout=8000)
    except Exception:
        pass
    page.wait_for_timeout(ms)


def capture(with_chat: bool) -> None:
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(viewport=VIEWPORT, device_scale_factor=2)
        page = ctx.new_page()

        # ---------------------------------------------------- landing page
        page.goto(BASE, wait_until="domcontentloaded")
        settle(page, 2200)
        shot(page, "01-landing", "the public entry point")

        # ------------------------------------------------- map / workspace
        page.goto(f"{BASE}/app", wait_until="domcontentloaded")
        settle(page, 3200)          # Leaflet tiles are slow on a cold cache
        shot(page, "02-map-overview", "SO3 - deployed system, 34 locations")

        # Open a place card by clicking a marker. Leaflet renders markers as
        # .leaflet-marker-icon; clicking the first visible one is enough.
        try:
            page.wait_for_selector(".leaflet-marker-icon", timeout=12000)
            markers = page.locator(".leaflet-marker-icon")
            n = markers.count()
            print(f"  (markers on map: {n})")
            for i in range(min(n, 6)):
                markers.nth(i).click(force=True)
                page.wait_for_timeout(1100)
                if page.locator(".leaflet-popup").count():
                    break
            settle(page, 900)
            shot(page, "03-place-card", "SO3 - place card with photo banner")
        except Exception as e:
            print(f"  !! place card: {type(e).__name__}: {str(e)[:90]}")

        # ------------------------------------------------------ admin sign-in
        page.goto(f"{BASE}/admin-dashboard", wait_until="domcontentloaded")
        settle(page, 1800)
        shot(page, "04-admin-signin", "role-gated write surface")

        # ------------------------------------------------------------- chat
        if with_chat:
            page.goto(f"{BASE}/app", wait_until="domcontentloaded")
            settle(page, 2600)
            queries = [
                ("05-chat-campus", "Where is the College of Computing?"),
                ("06-chat-refusal", "Where is SIM-22?"),
            ]
            for name, q in queries:
                try:
                    box = page.get_by_role("textbox").last
                    box.click()
                    box.fill(q)
                    box.press("Enter")
                    # Generation is a hosted call; give it room.
                    page.wait_for_timeout(14000)
                    settle(page, 800)
                    shot(page, name, q)
                except Exception as e:
                    print(f"  !! {name}: {type(e).__name__}: {str(e)[:90]}")

        ctx.close()
        browser.close()


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--with-chat", action="store_true",
                    help="also capture the assistant answering (uses Groq quota)")
    args = ap.parse_args()
    print(f"capturing to {OUT}")
    capture(args.with_chat)
    print("\ndone")


if __name__ == "__main__":
    main()
