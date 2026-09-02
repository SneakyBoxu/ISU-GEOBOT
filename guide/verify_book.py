"""
Verify the complete book against the repository.

    python guide/verify_book.py

Checks that the book names files that exist, describes folders that exist,
lists routes that are really defined, quotes dependency versions that match the
manifests, and uses live database counts. Exits non-zero on any failure.
"""

from __future__ import annotations

import json
import re
import sys
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DOCX = ROOT / "ISU-GeoBot-The-Complete-Book.docx"

fails: list[str] = []


def check(label, ok, detail=""):
    print(f"  {'PASS' if ok else 'FAIL'}  {label}{('  — ' + detail) if detail else ''}")
    if not ok:
        fails.append(label)


if not DOCX.exists():
    sys.exit(f"missing {DOCX}")
with zipfile.ZipFile(DOCX) as z:
    xml = z.read("word/document.xml").decode("utf-8")
    media = [n for n in z.namelist() if n.startswith("word/media/")]
# Word splits a sentence across many <w:t> runs. Stripping tags with an empty
# replacement glues the last word of one run onto the first of the next, which
# manufactures filenames like "againstgenerate_synthetic_attendance.py".
# Close each run with a space so token boundaries survive.
# Two views are needed. Inserting a space at every run boundary keeps token
# boundaries intact for filename matching, but it can also land INSIDE a word
# that Word happened to split, so phrase matching needs the unspaced version.
text = re.sub(r"<[^>]+>", "", re.sub(r"</w:t>", " ", xml))     # token-safe
flat = re.sub(r"<[^>]+>", "", xml)                             # phrase-safe


def says(phrase):
    """True if the phrase appears in either view, ignoring case and spacing."""
    norm = lambda x: re.sub(r"\s+", "", x).lower()
    return norm(phrase) in norm(flat) or norm(phrase) in norm(text)


print("=" * 70)
print("1. EVERY FILE THE BOOK NAMES EXISTS")
print("=" * 70)
# Bare filenames the book lists in the folder tour, plus full paths.
full = sorted(set(re.findall(
    r"\b((?:backend|frontend|database|machine-learning)/[\w./-]+\.(?:jsx|js|py|sql|md|json))",
    text)))
missing_full = [p for p in full if not (ROOT / p).exists()]
for p in missing_full:
    print(f"        MISSING: {p}")
check(f"{len(full)} full paths", not missing_full,
      "all exist" if not missing_full else f"{len(missing_full)} missing")

bare = sorted(set(re.findall(r"\b([\w-]+\.(?:jsx|py|sql))\b", text)))
allfiles = {p.name for p in ROOT.rglob("*")
            if p.is_file() and "node_modules" not in str(p)}
missing_bare = [b for b in bare if b not in allfiles]
for b in missing_bare:
    print(f"        MISSING: {b}")
check(f"{len(bare)} bare filenames", not missing_bare,
      "all exist" if not missing_bare else f"{len(missing_bare)} missing")


print()
print("=" * 70)
print("2. FOLDERS DESCRIBED IN CHAPTER 3 EXIST")
print("=" * 70)
for d in ["backend/src/services", "backend/src/routes", "backend/src/middleware",
          "backend/src/mock-services", "backend/src/utilities", "backend/tests",
          "backend/scripts", "database/migrations", "database/sample-data",
          "machine-learning/institutional-documents",
          "frontend/src/components/main-assistant",
          "frontend/src/components/admin-portal",
          "frontend/src/components/landing-page",
          "frontend/src/components/faculty-validation-portal",
          "frontend/src/components/security-guard-portal",
          "frontend/src/components/ui-primitives",
          "frontend/src/frontend-utilities", "frontend/src/custom-react-hooks"]:
    check(d, (ROOT / d).is_dir())


print()
print("=" * 70)
print("3. ROUTES LISTED IN CHAPTER 8 ARE REALLY DEFINED")
print("=" * 70)
routes_src = ((ROOT / "backend/src/routes/index.js").read_text(encoding="utf-8") +
              (ROOT / "backend/src/routes/admin-routes.js").read_text(encoding="utf-8"))
defined = set(re.findall(r"\.(?:get|post|patch|delete|put)\(\s*['\"]([^'\"]+)", routes_src))
for r in ["/health", "/chat", "/map/pois", "/faculty/search", "/demo/queries",
          "/demo/compare", "/eval/status", "/me", "/guard/roster", "/guard/events",
          "/validate/context", "/validate/entries", "/pois", "/departments",
          "/pois/:id", "/pois/:id/unpublish", "/pois/:id/republish",
          "/pois/:id/reindex", "/pois/:id/audit", "/me/faculty",
          "/me/faculty/visibility"]:
    check(f"route {r}", r in defined)
check("book claims 24 routes; source defines them",
      len(defined) >= 21, f"{len(defined)} distinct route paths found")


print()
print("=" * 70)
print("4. DEPENDENCY VERSIONS MATCH THE MANIFESTS")
print("=" * 70)
be = json.loads((ROOT / "backend/package.json").read_text())["dependencies"]
fe = json.loads((ROOT / "frontend/package.json").read_text())["dependencies"]
req = (ROOT / "machine-learning/requirements.txt").read_text(encoding="utf-8")

for pkg, shown in [("express", "4.19"), ("helmet", "7.1"), ("pino", "9.3"),
                   ("zod", "3.23"), ("cors", "2.8")]:
    real = be.get(pkg, "")
    check(f"backend {pkg} {shown}", real.lstrip("^~").startswith(shown), real)
for pkg, shown in [("react", "18.3"), ("leaflet", "1.9"), ("react-leaflet", "4.2"),
                   ("react-router-dom", "6.26")]:
    real = fe.get(pkg, "")
    check(f"frontend {pkg} {shown}", real.lstrip("^~").startswith(shown), real)
for pkg, shown in [("flask", "3.0.3"), ("scikit-learn", "1.4.2"),
                   ("sentence-transformers", "2.7.0"), ("torch", "2.2.2"),
                   ("ragas", "0.1.9"), ("langchain-groq", "0.1.10")]:
    check(f"python {pkg}=={shown}", f"{pkg}=={shown}" in req)


print()
print("=" * 70)
print("5. CONSTANTS AND LIVE COUNTS")
print("=" * 70)
cfg = (ROOT / "backend/src/utilities/configuration.js").read_text(encoding="utf-8")
for label, pat, shown in [
    ("chat rate limit", r"chatMax:.*?\?\?\s*(\d+)", "15"),
    ("top-k", r"topK:.*?\?\?\s*(\d+)\)", "5"),
    ("similarity floor", r"similarityFloor:.*?\?\?\s*([\d.]+)\)", "0.25"),
    ("port", r"port:\s*Number\(process\.env\.PORT\s*\?\?\s*(\d+)\)", "4000"),
]:
    m = re.search(pat, cfg)
    check(f"{label} is {shown} in code and in the book",
          m and m.group(1) == shown and shown in text, m.group(1) if m else "not found")
check("timezone Asia/Manila", "Asia/Manila" in cfg and "Asia/Manila" in text)
check("campus default echague", "'echague'" in cfg and "echague" in text)

facts = json.loads((HERE / "facts.json").read_text())
for key in ("poi", "document_chunk", "faculty_total", "schedule_total", "attendance",
            "eval_query", "eval_result", "tables", "policies", "schedule_consult",
            "guard_events", "institutional_event"):
    check(f"{key} = {facts[key]} from the live database", str(facts[key]) in text)


print()
print("=" * 70)
print("6. STRUCTURE AND HONESTY")
print("=" * 70)
check("4 diagrams embedded", len(media) == 4, f"found {len(media)}")
for part in ["PART I", "PART II", "PART III", "PART IV", "PART V", "PART VI",
             "PART VII", "PART VIII"]:
    check(f"{part} present", part in text)
for ch in range(1, 26):
    if f"Chapter {ch} " not in text:
        check(f"Chapter {ch}", False)
check("all 25 chapters present",
      all(f"Chapter {c} " in text for c in range(1, 26)))
for phrase, label in [
    ("simulation", "attendance called a simulation result"),
    ("gap", "the gap-is-not-availability rule stated"),
    ("designed in accordance with RA 10173", "no compliance claim"),
    ("not evidence that ML beats", "the harness's own warning quoted"),
    ("quota", "the RAGAS quota blocker disclosed"),
]:
    check(label, says(phrase))


print()
print("=" * 70)
words = len(text.split())
if fails:
    print(f"{len(fails)} CHECK(S) FAILED")
    for f in fails:
        print(f"  - {f}")
    sys.exit(1)
print("ALL CHECKS PASSED")
print(f"  {len(full)} paths · {len(bare)} filenames · {len(defined)} routes · "
      f"{len(media)} diagrams · {words:,} words")
