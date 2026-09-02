"""
Box-and-arrow drawing helper for the ISU-GeoBot study guide.

WHY THIS EXISTS. The figures have to be embeddable in Word and legible on
paper. Mermaid renders neither: there is no Mermaid CLI and no graphviz on this
machine, and Word will not render Mermaid source. matplotlib is installed, so
the diagrams are drawn as real vector shapes and exported at 200 DPI.

Everything is laid out on a unit grid so a diagram reads as a script rather
than as coordinates: `c.box(col, row, ...)` places a box, `c.arrow(a, b)`
connects two boxes edge-to-edge and picks the sensible sides itself.
"""

from __future__ import annotations

import textwrap
from dataclasses import dataclass

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt                      # noqa: E402
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Polygon  # noqa: E402

# A4 portrait usable width with 2 cm margins is about 7.3 in.
A4_TEXT_WIDTH_IN = 7.3
DPI = 200

PALETTE = {
    "user":     ("#E8EEF7", "#33507A", "#1B2C47"),
    "frontend": ("#E4F0FB", "#2E6DA4", "#16354F"),
    "backend":  ("#E7F2E8", "#3B7A45", "#1E3F24"),
    "data":     ("#FBF0DC", "#A9762A", "#54390F"),
    "ml":       ("#F2E9F7", "#7A4E9E", "#3B2550"),
    "external": ("#ECECEC", "#6B6B6B", "#2E2E2E"),
    "privacy":  ("#FBE4E4", "#B03A3A", "#5B1A1A"),
    "decision": ("#FFF6D8", "#B08900", "#4E3D00"),
    "note":     ("#FFFFFF", "#9AA0A6", "#3C4043"),
}


@dataclass
class Node:
    x: float
    y: float
    w: float
    h: float

    @property
    def cx(self): return self.x + self.w / 2

    @property
    def cy(self): return self.y + self.h / 2

    def port(self, side):
        return {
            "n": (self.cx, self.y + self.h),
            "s": (self.cx, self.y),
            "e": (self.x + self.w, self.cy),
            "w": (self.x, self.cy),
        }[side]


class Canvas:
    TITLE_BAND = 0.62          # reserved strip so the title never overlaps a box

    def __init__(self, width=12.0, height=8.0, title=None, scale=1.0):
        band = self.TITLE_BAND if title else 0.0
        self.W, self.H = width, height + band
        fig_w = A4_TEXT_WIDTH_IN * scale
        fig_h = fig_w * (self.H / width)
        self.fig, self.ax = plt.subplots(figsize=(fig_w, fig_h))
        self.ax.set_xlim(0, width)
        self.ax.set_ylim(0, self.H)
        self.ax.axis("off")
        self.title = title
        if title:
            self.ax.text(width / 2, self.H - 0.16, title, ha="center", va="top",
                         fontsize=11, fontweight="bold", color="#1B2C47")

    # -- shapes ----------------------------------------------------------
    def box(self, x, y, w, h, text, kind="backend", sub=None, fontsize=8.0,
            wrap=None, bold=False):
        face, edge, textc = PALETTE[kind]
        self.ax.add_patch(FancyBboxPatch(
            (x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.10",
            linewidth=1.1, edgecolor=edge, facecolor=face, zorder=2))
        chars = wrap or max(10, int(w * 9.5 / max(fontsize / 8.0, 0.6)))
        label = "\n".join(textwrap.wrap(text, chars)) if len(text) > chars else text
        ty = y + h / 2 + (0.12 if sub else 0)
        self.ax.text(x + w / 2, ty, label, ha="center", va="center",
                     fontsize=fontsize, color=textc, zorder=3,
                     fontweight="bold" if bold else "normal")
        if sub:
            self.ax.text(x + w / 2, y + h / 2 - 0.20, sub, ha="center", va="center",
                         fontsize=fontsize - 1.6, color=textc, zorder=3,
                         family="monospace", alpha=0.95)
        return Node(x, y, w, h)

    def panel(self, x, y, w, title, lines, kind="backend", fontsize=8.4,
              line_size=7.4):
        """Title bar on top, monospace lines underneath. Nothing overlaps."""
        h = 0.50 + 0.24 * len(lines)
        face, edge, textc = PALETTE[kind]
        self.ax.add_patch(FancyBboxPatch(
            (x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.10",
            linewidth=1.1, edgecolor=edge, facecolor=face, zorder=2))
        self.ax.text(x + w / 2, y + h - 0.22, title, ha="center", va="center",
                     fontsize=fontsize, fontweight="bold", color=textc, zorder=3)
        self.ax.plot([x + 0.10, x + w - 0.10], [y + h - 0.40, y + h - 0.40],
                     color=edge, linewidth=0.8, zorder=3)
        for i, ln in enumerate(lines):
            self.ax.text(x + 0.16, y + h - 0.60 - i * 0.24, ln, ha="left",
                         va="center", fontsize=line_size, family="monospace",
                         color=textc, zorder=3)
        return Node(x, y, w, h)

    def diamond(self, x, y, w, h, text, fontsize=7.4):
        face, edge, textc = PALETTE["decision"]
        pts = [(x + w / 2, y + h), (x + w, y + h / 2), (x + w / 2, y), (x, y + h / 2)]
        self.ax.add_patch(Polygon(pts, closed=True, linewidth=1.1,
                                  edgecolor=edge, facecolor=face, zorder=2))
        label = "\n".join(textwrap.wrap(text, max(12, int(w * 8))))
        self.ax.text(x + w / 2, y + h / 2, label, ha="center", va="center",
                     fontsize=fontsize, color=textc, zorder=3)
        return Node(x, y, w, h)

    def lane(self, x, y, w, h, label, color="#F7F8FA", edge="#C6CBD1"):
        self.ax.add_patch(FancyBboxPatch(
            (x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.06",
            linewidth=1.0, edgecolor=edge, facecolor=color, zorder=1,
            linestyle=(0, (4, 3))))
        self.ax.text(x + 0.10, y + h - 0.16, label, ha="left", va="top",
                     fontsize=8.2, color="#5F6368", fontweight="bold", zorder=1)

    # -- connections -----------------------------------------------------
    def arrow(self, a, b, label=None, style="-", color="#41525F",
              a_side=None, b_side=None, rad=0.0, fontsize=6.6, offset=(0, 0)):
        if a_side is None or b_side is None:
            dx, dy = b.cx - a.cx, b.cy - a.cy
            if abs(dy) >= abs(dx):
                a_side = a_side or ("n" if dy > 0 else "s")
                b_side = b_side or ("s" if dy > 0 else "n")
            else:
                a_side = a_side or ("e" if dx > 0 else "w")
                b_side = b_side or ("w" if dx > 0 else "e")
        p1, p2 = a.port(a_side), b.port(b_side)
        self.ax.add_patch(FancyArrowPatch(
            p1, p2, arrowstyle="-|>", mutation_scale=11, linewidth=1.05,
            color=color, zorder=4, linestyle=style,
            connectionstyle=f"arc3,rad={rad}", shrinkA=1.5, shrinkB=2.5))
        if label:
            mx, my = (p1[0] + p2[0]) / 2 + offset[0], (p1[1] + p2[1]) / 2 + offset[1]
            self.ax.text(mx, my, label, ha="center", va="center", fontsize=fontsize,
                         color=color, zorder=5, family="monospace",
                         bbox=dict(boxstyle="round,pad=0.16", fc="white",
                                   ec="none", alpha=0.92))

    def note(self, x, y, text, fontsize=6.9, color="#5F6368", ha="left", width=48):
        self.ax.text(x, y, "\n".join(textwrap.wrap(text, width)), ha=ha, va="top",
                     fontsize=fontsize, color=color, zorder=5, style="italic")

    def save(self, path):
        self.fig.tight_layout(pad=0.35)
        self.fig.savefig(path, dpi=DPI, bbox_inches="tight",
                         facecolor="white", edgecolor="none")
        plt.close(self.fig)
        return path
