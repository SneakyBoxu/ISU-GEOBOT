"""
Generate a publication-grade, high-resolution System Architecture & AI Pipeline
diagram for ISU-GeoBot thesis defense and documentation.
"""

import matplotlib.pyplot as plt
import matplotlib.patches as patches
from pathlib import Path

# Setup canvas
fig = plt.figure(figsize=(16, 18), dpi=300)
ax = fig.add_axes([0, 0, 1, 1])
ax.set_xlim(0, 100)
ax.set_ylim(0, 100)
ax.axis('off')

# Styling Palette (Modern High-Contrast Technical)
BG_COLOR = "#FFFFFF"
BOX_BG = "#FAFAFA"
BOX_BORDER = "#1E293B"
ACCENT_BLUE = "#0F766E"      # Teal Accent
ACCENT_GREEN = "#16A34A"     # Success
ACCENT_AMBER = "#D97706"     # Warning/Masking
TEXT_MAIN = "#0F172A"
TEXT_MUTED = "#475569"
LINE_COLOR = "#1E293B"

fig.patch.set_facecolor(BG_COLOR)

def draw_box(x, y, w, h, title, subtitle="", badge="", bg_color=BOX_BG, border_color=BOX_BORDER, border_width=2.0, radius=2.5, is_dashed=False):
    style = patches.BoxStyle("Round", pad=0.3, rounding_size=radius)
    rect = patches.FancyBboxPatch(
        (x, y), w, h,
        boxstyle=style,
        facecolor=bg_color,
        edgecolor=border_color,
        linewidth=border_width,
        linestyle='--' if is_dashed else '-',
        zorder=2
    )
    ax.add_patch(rect)
    
    # Title
    ax.text(x + w/2, y + h - (3.2 if subtitle else h/2), title, 
            ha='center', va='center', fontsize=12, fontweight='bold', color=TEXT_MAIN, zorder=3)
    
    # Subtitle / Details
    if subtitle:
        ax.text(x + w/2, y + (h/2) - 1.2, subtitle, 
                ha='center', va='center', fontsize=9, color=TEXT_MUTED, multialignment='center', zorder=3)
        
    # Badge
    if badge:
        b_box = patches.FancyBboxPatch(
            (x + w/2 - 7, y + h - 1.2), 14, 2.2,
            boxstyle=patches.BoxStyle("Round", pad=0.2, rounding_size=1.0),
            facecolor=ACCENT_BLUE, edgecolor='none', zorder=4
        )
        ax.add_patch(b_box)
        ax.text(x + w/2, y + h - 0.1, badge, ha='center', va='center', fontsize=7.5, fontweight='bold', color='#FFFFFF', zorder=5)

def draw_arrow(x1, y1, x2, y2, label="", is_dashed=False, color=LINE_COLOR, width=1.8, head_size=12, rad=0.0):
    connectionstyle = f"arc3,rad={rad}" if rad != 0.0 else "arc3,rad=0"
    arrow = patches.FancyArrowPatch(
        (x1, y1), (x2, y2),
        connectionstyle=connectionstyle,
        arrowstyle=f"-|>,head_length={head_size/2},head_width={head_size/3}",
        linestyle='--' if is_dashed else '-',
        linewidth=width,
        color=color,
        zorder=1
    )
    ax.add_patch(arrow)
    if label:
        mx, my = (x1 + x2)/2, (y1 + y2)/2
        ax.text(mx, my + 1.0, label, ha='center', va='center', fontsize=8.5, fontweight='bold', color=TEXT_MAIN, 
                bbox=dict(boxstyle="round,pad=0.2", fc="#FFFFFF", ec="#CBD5E1", lw=0.8), zorder=4)

# ==========================================
# 1. TOP TIER: USER & WEB INTERFACES
# ==========================================
# User
user_circle = plt.Circle((50, 96), 2.2, color=TEXT_MAIN, zorder=3)
ax.add_patch(user_circle)
user_body = patches.Ellipse((50, 92.5), 6.5, 3.5, color=TEXT_MAIN, zorder=3)
ax.add_patch(user_body)
ax.text(50, 90, "Student / University Stakeholder", ha='center', va='top', fontsize=10, fontweight='bold', color=TEXT_MAIN)

# Main Web App
draw_box(16, 76, 38, 11, "Web Interface (React 18 SPA)", 
         "• Conversational Campus Assistant\n• Interactive Leaflet Campus Map\n• In-Browser Dijkstra Pathfinding", badge="Client Layer (Port 5173)")

# Admin / Validation Dashboard
draw_box(60, 76, 30, 11, "Admin & Validation Portal", 
         "• Landmark & POI Photo Manager\n• Timetable & Calendar Ingestion\n• Faculty Availability Ground-Truth", badge="Admin / Research")

# ==========================================
# 2. ROUTING & GATEWAY
# ==========================================
draw_box(34, 60, 32, 10, "Deterministic Query Router", 
         "• Intent Classifier: Navigation, Policies, Faculty, Combined\n• Taglish keyword parsing & Consented Roster lookup\n• Exact-or-Clarify disambiguation (No LLM hallucinations)", 
         badge="Node.js / Express (Port 4000)", border_color=ACCENT_BLUE)

# ==========================================
# 3. PROCESSING FORK (RAG vs AVAILABILITY)
# ==========================================
# Left Branch: RAG
draw_box(6, 44, 30, 11, "Semantic Search & RAG", 
         "• 384-d dense embeddings (all-MiniLM-L6-v2)\n• pgvector exact cosine search (<=>)\n• 64 POI place-cards, Handbook, Calendar", badge="Retrieval Engine")

# Right Branch: Random Forest
draw_box(64, 44, 30, 11, "Faculty Availability Estimator", 
         "• Random Forest Classifier (11 Features)\n• Timetable Features (Class / Consultation hours)\n• Causal Behavioral History (Presence & Punctuality)", badge="ML Service (Port 5001)")

# Privacy Masking Boundary
draw_box(64, 30, 30, 9, "Status Masking Boundary", 
         "• Strict 3-Value Allowlist (Available, In-Class, Off-Schedule)\n• Purges probabilities, room # & GPS coordinates\n• Deterministic override for official events / schedule-only", 
         border_color=ACCENT_AMBER, badge="Privacy Protocol (RA 10173)")

# ==========================================
# 4. CONTEXT FUSION & GENERATION
# ==========================================
draw_box(6, 30, 30, 9, "Context Fusion Engine", 
         "• Dynamic fusion of retrieved handbook passages\n• Privacy-masked faculty availability estimate\n• Authoritative campus gazetteer identifiers", badge="Context Assembler")

draw_box(6, 16, 30, 9, "Generative LLM (Groq API)", 
         "• Model: openai/gpt-oss-120b\n• Temperature: 0.0 (Strictly factual, reproducible)\n• Emits answer + verified [LOCATION: id] tag", badge="Generation Engine")

# Egress Filter
draw_box(6, 2, 30, 9, "Egress Privacy Filter & Map Protocol", 
         "• Regex scanning blocks room/floor/building leaks\n• Validates location tags & attaches landmark photos\n• Dispatches map navigation coordinates to client", badge="Egress Boundary", border_color=ACCENT_GREEN)

# ==========================================
# 5. DATABASE (CENTRAL REPOSITORY)
# ==========================================
draw_box(40, 30, 20, 20, "PostgreSQL Database\n(Supabase pgvector)", 
         "• geobot.document_chunk\n• geobot.poi (64 locations)\n• geobot.faculty_schedule\n• geobot.attendance_record\n• geobot.availability_event\n• geobot.chat_log", 
         badge="Central Hub", border_width=2.5)

# ==========================================
# 6. DATA SOURCES & INGESTION (BOTTOM)
# ==========================================
# Documents Ingestion
draw_box(40, 16, 26, 9, "Document & Place-Card Ingestion", 
         "• PyMuPDF text conversion & cleanup\n• Header-propagated chunking (target: 200 tokens)\n• MiniLM batch vectorization", badge="Knowledge Pipeline")

draw_box(40, 2, 26, 9, "Institutional Sources", 
         "• ISU Student Handbook & Regulations\n• Academic Calendars (2026-2027)\n• 64 Surveyed Campus POI Place-Cards", badge="Official Documents")

# Schedule & Attendance Ingestion
draw_box(70, 16, 26, 9, "Schedule & Synthetic Attendance", 
         "• CCSICT Timetable Excel Parser\n• Synthetic Attendance Generator (SIM cohort)\n• Causal behavioral feature engineering", badge="ML Training Pipeline")

draw_box(70, 2, 26, 9, "Operational Sources", 
         "• Faculty Teaching Schedules (Echague/Santiago)\n• Institutional Events & Academic Calendar\n• 4,962 Intraday attendance punches", badge="Data Records")

# ==========================================
# CONNECTING ARROWS & FLOWS
# ==========================================
# User to Web
draw_arrow(50, 89, 35, 87)
draw_arrow(50, 89, 75, 87)

# Web to Router
draw_arrow(35, 76, 46, 70, label="Raw User Query")

# Admin to DB
draw_arrow(75, 76, 75, 55, rad=-0.2)
draw_arrow(75, 55, 60, 42, label="POI / Schedule Updates")

# Router Fork
draw_arrow(42, 60, 21, 55, label="Navigation & Docs", is_dashed=True)
draw_arrow(58, 60, 79, 55, label="Faculty Query", is_dashed=True)

# Database to RAG & RF
draw_arrow(40, 42, 36, 47, label="Vector Search (<=>)")
draw_arrow(60, 42, 64, 47, label="Schedule & History")

# RF to Masking
draw_arrow(79, 44, 79, 39, label="Raw Prediction")

# Masking & RAG to Context Fusion
draw_arrow(64, 34.5, 36, 34.5, label="Masked Status")
draw_arrow(21, 44, 21, 39, label="Retrieved Chunks")

# Fusion to LLM
draw_arrow(21, 30, 21, 25, label="Fused Prompt")

# LLM to Egress Filter
draw_arrow(21, 16, 21, 11, label="Raw Answer + Tag")

# Egress Filter back to Web Interface
draw_arrow(12, 11, 12, 74, label="Validated Response + Map Coordinates + Photo", rad=0.25, color=ACCENT_BLUE, width=2.2)

# Bottom Ingestions to DB
draw_arrow(53, 11, 53, 16)
draw_arrow(53, 25, 50, 30, label="Vectors")

draw_arrow(83, 11, 83, 16)
draw_arrow(83, 25, 80, 44, label="Training Set")

# Output save
output_path_png = Path("thesis/figures/system_architecture_diagram.png")
output_path_pdf = Path("thesis/figures/system_architecture_diagram.pdf")
output_path_png.parent.mkdir(parents=True, exist_ok=True)

plt.savefig(output_path_png, format="png", bbox_inches='tight', dpi=300, facecolor=BG_COLOR)
plt.savefig(output_path_pdf, format="pdf", bbox_inches='tight', facecolor=BG_COLOR)
plt.close()

print(f"[OK] High-resolution diagram generated successfully:")
print(f"   - PNG: {output_path_png}")
print(f"   - PDF: {output_path_pdf}")
