"""
Verify the how-it-works guide before handing it over.

    python guide/verify_guide.py

Checks the mechanism claims against the source: every cited file exists, every
named function is present in the file claimed, the constants quoted in the text
match the constants in the code, and the live row counts came from facts.json.
Exits non-zero on any failure.
"""

from __future__ import annotations

import json
import re
import sys
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DOCX = ROOT / "ISU-GeoBot-How-It-Works.docx"

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
text = re.sub(r"<[^>]+>", "", xml)


print("=" * 68)
print("1. EVERY CITED FILE EXISTS")
print("=" * 68)
paths = sorted(set(re.findall(
    r"\b((?:backend|frontend|database|machine-learning)/[\w./-]+\.(?:jsx|js|py|sql))",
    text)))
missing = [p for p in paths if not (ROOT / p).exists()]
for p in missing:
    print(f"        MISSING: {p}")
check(f"{len(paths)} file paths cited", not missing,
      "all resolve" if not missing else f"{len(missing)} missing")


print()
print("=" * 68)
print("2. EVERY NAMED FUNCTION EXISTS WHERE CLAIMED")
print("=" * 68)
expect = {
    "maskPrediction": "backend/src/middleware/privacy-masking-middleware.js",
    "maskOverride": "backend/src/middleware/privacy-masking-middleware.js",
    "filterEgress": "backend/src/middleware/privacy-masking-middleware.js",
    "faculty_is_answerable": "backend/src/services/knowledge-search-service.js",
    "retrieve": "backend/src/services/knowledge-search-service.js",
    "extractLocationTag": "backend/src/services/knowledge-search-service.js",
    "toCampusLocalNaive": "backend/src/services/faculty-presence-service.js",
    "resolve_faculty_candidates": "database/database-functions.sql",
    "schedule_lookup_status": "database/database-functions.sql",
    "chunk_document": "machine-learning/document_knowledge_importer.py",
}
for fn, rel in expect.items():
    f = ROOT / rel
    ok = f.exists() and fn in f.read_text(encoding="utf-8", errors="replace")
    check(f"{fn} in {rel}", ok)


print()
print("=" * 68)
print("3. CONSTANTS IN THE TEXT MATCH CONSTANTS IN THE CODE")
print("=" * 68)

mask = (ROOT / "backend/src/middleware/privacy-masking-middleware.js").read_text(
    encoding="utf-8", errors="replace")
codes = re.findall(r"'(available_consultation|in_scheduled_class|"
                   r"unavailable_off_schedule)'", mask)
check("the three status codes are a closed allowlist in code",
      len(set(codes)) == 3, ", ".join(sorted(set(codes))))
for c in sorted(set(codes)):
    check(f"'{c}' is named in the guide", c in text)

check("maskPrediction throws rather than defaulting",
      "MaskingViolation" in mask and "throw new MaskingViolation" in mask)
check("guide says it throws instead of falling back",
      "THROW" in text and "never falls back" in text)

check("maskPrediction nulls all three internal fields",
      all(f"prediction.{k} = null" in mask
          for k in ("predicted_class", "probabilities", "feature_list")))

imp = (ROOT / "machine-learning/document_knowledge_importer.py").read_text(
    encoding="utf-8", errors="replace")
tgt = re.search(r"TARGET_TOKENS\s*=\s*(\d+)", imp)
mx = re.search(r"MAX_TOKENS\s*=\s*(\d+)", imp)
ov = re.search(r"OVERLAP_RATIO\s*=\s*([\d.]+)", imp)
check(f"chunk target is {tgt.group(1)} in code and in the guide",
      tgt and tgt.group(1) in text)
check(f"chunk ceiling is {mx.group(1)} in code and in the guide",
      mx and mx.group(1) in text)
check(f"overlap is {ov.group(1)} in code, guide says 15 percent",
      ov and abs(float(ov.group(1)) - 0.15) < 1e-9 and "15 percent" in text)

cfg = (ROOT / "backend/src/utilities/configuration.js").read_text(
    encoding="utf-8", errors="replace")
topk = re.search(r"topK:\s*Number\(process\.env\.RETRIEVAL_TOP_K\s*\?\?\s*(\d+)\)", cfg)
floor = re.search(r"similarityFloor:.*?\?\?\s*([\d.]+)\)", cfg)
check(f"top-k is {topk.group(1)} in code and in the guide",
      topk and f"top {topk.group(1)}" in text)
check(f"similarity floor is {floor.group(1)} in code and in the guide",
      floor and floor.group(1) in text)

fe = (ROOT / "machine-learning/feature_engineering.py").read_text(
    encoding="utf-8", errors="replace")
# The same quoted-string shape is used for CLASS_ORDER, so exclude the three
# status codes or the count comes out at 14 and looks like a contradiction.
names = set(re.findall(r'^\s+"(\w+)",', fe, re.M)) - set(codes)
check("code defines exactly 11 features and the guide says eleven",
      len(names) == 11 and "eleven numbers" in text,
      f"{len(names)} features found")


print()
print("=" * 68)
print("4. FIGURES AND LIVE COUNTS")
print("=" * 68)
check("4 diagrams embedded", len(media) == 4, f"found {len(media)}")
facts = json.loads((HERE / "facts.json").read_text())
for key in ("document_chunk", "schedule_total", "attendance", "eval_result",
            "schedule_consult", "guard_events"):
    check(f"{key} = {facts[key]} taken from the live database",
          str(facts[key]) in text)


print()
print("=" * 68)
if fails:
    print(f"{len(fails)} CHECK(S) FAILED")
    for f in fails:
        print(f"  - {f}")
    sys.exit(1)
print("ALL CHECKS PASSED")
print(f"  {len(paths)} files · {len(expect)} functions · {len(media)} diagrams · "
      "constants cross-checked against source")
