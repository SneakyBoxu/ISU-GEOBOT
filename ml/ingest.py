"""
Document ingestion for the RAG corpus (thesis §3.5.4, §3.4.1c).

    python ingest.py --path ./data/documents --origin real
    python ingest.py --place-cards --origin synthetic
    python ingest.py --reingest        # rebuild everything from scratch

Audit A10 / §8.1: this is a batch script, not an admin UI. An authenticated
file-upload surface is unmentioned in the thesis, adds attack surface, and
competes for time with the evaluation harness. Re-ingestion is one command.

THE CHUNKING CEILING (audit F-34) is the reason this file is careful.

all-MiniLM-L6-v2 has a maximum sequence length of 256 word-pieces and
truncates beyond it SILENTLY — no error, no warning. Chunk at the conventional
512 or 1000 tokens and roughly half of every chunk is never represented in its
own embedding. Retrieval then fails for anything in the tail of a chunk, and it
fails invisibly. The symptom is "our Context Recall came out lower than
expected" in Chapter 4 with no obvious cause.

So: chunks are measured with THE MODEL'S OWN TOKENIZER via /tokenize/count,
never by character count or word estimate, and document_chunk.token_count has a
CHECK constraint at 220 that turns any mistake into a loud failure.

Splitting is structure-aware: headings and paragraphs first, then packed to the
token budget. Memoranda and academic calendars have strong structure, and blind
fixed-window splitting across a table of dates destroys it.
"""

from __future__ import annotations

import argparse
import hashlib
import re
from pathlib import Path

import requests

import db

ML_URL = "http://127.0.0.1:5001"
TARGET_TOKENS = 200      # aim
MAX_TOKENS = 220         # DB CHECK constraint ceiling
OVERLAP_RATIO = 0.15     # ~15%, per the build brief

HEADING = re.compile(r"^\s{0,3}(#{1,6}\s+\S|[A-Z][A-Z0-9 ,.\-/&()]{6,}\s*$)")


# ---------------------------------------------------------------------------
# Tokenizer access — the model's own, always
# ---------------------------------------------------------------------------

def count_tokens(texts: list[str]) -> list[int]:
    r = requests.post(f"{ML_URL}/tokenize/count", json={"texts": texts}, timeout=60)
    r.raise_for_status()
    return r.json()["counts"]


def embed_batch(texts: list[str]) -> list[list[float]]:
    out: list[list[float]] = []
    for i in range(0, len(texts), 256):
        r = requests.post(f"{ML_URL}/embed/batch",
                          json={"texts": texts[i:i + 256]}, timeout=300)
        r.raise_for_status()
        out.extend(r.json()["embeddings"])
    return out


# ---------------------------------------------------------------------------
# Structure-aware chunking
# ---------------------------------------------------------------------------

def split_blocks(text: str) -> list[str]:
    """Paragraphs, with headings kept attached to the text they introduce."""
    lines = text.replace("\r\n", "\n").split("\n")
    blocks, cur = [], []
    for line in lines:
        if HEADING.match(line) and cur:
            blocks.append("\n".join(cur).strip())
            cur = [line]
        elif not line.strip():
            if cur:
                blocks.append("\n".join(cur).strip())
                cur = []
        else:
            cur.append(line)
    if cur:
        blocks.append("\n".join(cur).strip())
    return [b for b in blocks if b]


def split_oversized(block: str) -> list[str]:
    """Sentence-split a block that alone exceeds the budget."""
    sentences = re.split(r"(?<=[.!?])\s+", block)
    out, cur = [], []
    for s in sentences:
        cur.append(s)
        if count_tokens(["  ".join(cur)])[0] > TARGET_TOKENS:
            if len(cur) > 1:
                out.append(" ".join(cur[:-1]))
                cur = [cur[-1]]
            else:
                # A single sentence over budget: hard-wrap on words.
                words, part = s.split(), []
                for w in words:
                    part.append(w)
                    if count_tokens([" ".join(part)])[0] >= TARGET_TOKENS:
                        out.append(" ".join(part))
                        part = []
                if part:
                    out.append(" ".join(part))
                cur = []
    if cur:
        out.append(" ".join(cur))
    return [c for c in out if c.strip()]


def chunk_document(text: str) -> list[tuple[str, int]]:
    """Return [(chunk_text, token_count)], every count guaranteed <= MAX_TOKENS."""
    blocks = split_blocks(text)
    if not blocks:
        return []

    sized: list[str] = []
    counts = count_tokens(blocks)
    for block, n in zip(blocks, counts):
        sized.extend(split_oversized(block) if n > TARGET_TOKENS else [block])

    chunks: list[str] = []
    cur: list[str] = []
    for piece in sized:
        candidate = cur + [piece]
        if count_tokens(["\n\n".join(candidate)])[0] > TARGET_TOKENS and cur:
            chunks.append("\n\n".join(cur))
            # Overlap: carry the tail of the previous chunk forward.
            keep = max(1, int(len(cur) * OVERLAP_RATIO)) if len(cur) > 1 else 0
            cur = (cur[-keep:] if keep else []) + [piece]
        else:
            cur = candidate
    if cur:
        chunks.append("\n\n".join(cur))

    final = count_tokens(chunks)
    result = []
    for c, n in zip(chunks, final):
        if n > MAX_TOKENS:
            # Should be unreachable. Fail loudly rather than let the DB reject
            # it later, or worse, let a silently-truncated vector through.
            raise RuntimeError(
                f"chunk of {n} tokens exceeds the {MAX_TOKENS} ceiling. "
                "all-MiniLM-L6-v2 would truncate it silently (audit F-34)."
            )
        result.append((c, n))
    return result


# ---------------------------------------------------------------------------
# POI place-cards — the dual-representation bridge (audit F-37)
# ---------------------------------------------------------------------------

def build_place_card(poi: dict) -> str:
    """
    Natural-language card for one campus location.

    Coordinates stay relational and drive Leaflet; this text gets embedded so
    navigation queries flow through the SAME retriever that RAGAS measures.
    §2.2 Phase 2: "the RAG pipeline processes the unstructured institutional
    and geospatial data".

    Note what is NOT here: no faculty names, no office assignments. Audit C6 —
    a place-card describes a place, and combining a location with a person is
    exactly the inference the masking protocol exists to prevent.
    """
    parts = [f"{poi['name']} is a {poi['poi_type'].replace('_', ' ')} "
             f"located on the Isabela State University Echague Main Campus."]
    if poi.get("department_name"):
        parts.append(f"It houses the {poi['department_name']}.")
    if poi.get("building_function"):
        parts.append(f"Its primary function is {poi['building_function']}.")
    if poi.get("description"):
        parts.append(poi["description"])
    parts.append(
        f"Users looking for {poi['name']} can find it marked on the ISU-GeoBot "
        "interactive campus map."
    )
    return " ".join(parts)


def ingest_place_cards(origin: str) -> int:
    pois = db.fetch_all(
        """
        select p.id::text, p.name, p.poi_type, p.building_function,
               p.description, p.data_origin, d.name as department_name
        from geobot.poi p
        left join geobot.department d on d.id = p.department_id
        """
    )
    if not pois:
        print("no POIs; nothing to do")
        return 0

    written = 0
    for poi in pois:
        text = build_place_card(poi)
        row_origin = poi["data_origin"] or origin
        with db.cursor() as cur:
            cur.execute(
                """
                insert into geobot.poi_document (poi_id, generated_text, data_origin)
                values (%s,%s,%s)
                on conflict (poi_id) do update
                  set generated_text = excluded.generated_text,
                      generated_at   = now()
                """,
                (poi["id"], text, row_origin),
            )
            cur.execute(
                """
                insert into geobot.document
                  (title, doc_type, source_origin, provided_by,
                   source_checksum, data_origin)
                values (%s,'poi_place_card','generated:poi','ingest.py',%s,%s)
                returning id
                """,
                (f"Place card — {poi['name']}",
                 hashlib.sha256(text.encode()).hexdigest(), row_origin),
            )
            doc_id = cur.fetchone()["id"]

        _write_chunks(doc_id, text, row_origin, poi_id=poi["id"])
        written += 1
    return written


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

def _write_chunks(document_id, text: str, origin: str, poi_id=None) -> int:
    chunks = chunk_document(text)
    if not chunks:
        return 0
    vectors = embed_batch([c for c, _ in chunks])
    with db.cursor() as cur:
        for i, ((content, n_tok), vec) in enumerate(zip(chunks, vectors)):
            cur.execute(
                """
                insert into geobot.document_chunk
                  (document_id, chunk_index, content, token_count, embedding,
                   embedding_model, embedding_norm, poi_id, data_origin)
                values (%s,%s,%s,%s,%s,'all-MiniLM-L6-v2','l2',%s,%s)
                """,
                (document_id, i, content, n_tok, vec, poi_id, origin),
            )
    return len(chunks)


DOC_TYPE_HINTS = {
    "memo": "memorandum", "memorandum": "memorandum",
    "calendar": "academic_calendar", "handbook": "handbook",
    "announcement": "announcement", "directory": "faculty_directory",
}


def infer_doc_type(name: str) -> str:
    low = name.lower()
    for k, v in DOC_TYPE_HINTS.items():
        if k in low:
            return v
    return "other"


def ingest_path(root: Path, origin: str) -> tuple[int, int]:
    files = [p for p in root.rglob("*") if p.suffix.lower() in (".txt", ".md")]
    if not files:
        print(f"no .txt/.md files under {root}")
        return 0, 0

    docs = chunks = 0
    for path in sorted(files):
        text = path.read_text(encoding="utf-8", errors="replace").strip()
        if not text:
            continue
        checksum = hashlib.sha256(text.encode()).hexdigest()
        doc_type = infer_doc_type(path.name)

        if doc_type == "faculty_directory":
            print(
                f"  ! {path.name}: faculty_directory. Audit C6/F-28 — curate to "
                "office assignment only (no contact details), and note that "
                "office location must never be combined with a live status in "
                "the same response."
            )

        existing = db.fetch_one(
            "select id from geobot.document where source_checksum = %s", (checksum,)
        )
        if existing:
            print(f"  = {path.name} unchanged, skipping")
            continue

        with db.cursor() as cur:
            cur.execute(
                """
                insert into geobot.document
                  (title, doc_type, source_origin, provided_by,
                   source_checksum, data_origin)
                values (%s,%s,%s,%s,%s,%s) returning id
                """,
                (path.stem, doc_type, str(path), "ingest.py", checksum, origin),
            )
            doc_id = cur.fetchone()["id"]

        n = _write_chunks(doc_id, text, origin)
        print(f"  + {path.name}: {n} chunks")
        docs += 1
        chunks += n
    return docs, chunks


def main():
    p = argparse.ArgumentParser(description="ISU-GeoBot RAG corpus ingestion")
    p.add_argument("--path", type=Path)
    p.add_argument("--place-cards", action="store_true")
    p.add_argument("--origin", required=True, choices=["synthetic", "real"],
                   help="Provenance. No default on purpose (audit F-38).")
    p.add_argument("--reingest", action="store_true",
                   help="Delete the existing corpus first")
    args = p.parse_args()

    try:
        requests.get(f"{ML_URL}/healthz", timeout=5).raise_for_status()
    except Exception:
        raise SystemExit(f"ML service unreachable at {ML_URL}. Start ml/app.py first.")

    if args.reingest:
        with db.cursor() as cur:
            cur.execute("delete from geobot.document")   # cascades to chunks
        print("existing corpus deleted")

    if args.place_cards:
        n = ingest_place_cards(args.origin)
        print(f"place cards: {n} POIs")

    if args.path:
        docs, chunks = ingest_path(args.path, args.origin)
        print(f"documents: {docs}, chunks: {chunks}")

    stats = db.fetch_one(
        """
        select count(*) as chunks, max(token_count) as max_tokens,
               count(*) filter (where data_origin='synthetic') as synthetic
        from geobot.document_chunk
        """
    )
    print(f"\ncorpus: {stats['chunks']} chunks, max {stats['max_tokens']} tokens "
          f"(ceiling {MAX_TOKENS}), {stats['synthetic']} synthetic")
    if stats["synthetic"]:
        print("NOTE: synthetic chunks present. The evaluation harness will refuse "
              "to run until they are replaced (audit F-38).")


if __name__ == "__main__":
    main()
