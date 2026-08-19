"""
ISU-GeoBot — Python ML & Embedding microservice (thesis §3.7).

Exposes the Random Forest classifier and the all-MiniLM-L6-v2 embedder to the
Node backend over internal HTTP.

TWO HARD RULES:

1. NEVER INTERNET-REACHABLE (audit W7). Bind to localhost or a private
   network. /predict must not be publicly callable.

2. This process is the ONLY place embeddings are produced (audit F-14).
   Document vectors (ingest.py), query vectors (/embed) and evaluation vectors
   (score_ragas.py) all come from this one code path. If Node ever grows its
   own embedder, query and document vectors silently diverge and retrieval
   degrades invisibly.

The service returns the raw class AND predict_proba. Both are internal.
Node's masking middleware is what decides which single allowlisted string is
permitted to continue into Context Fusion (audit F-26).
"""

from __future__ import annotations

import logging
import os
import time as _time
from pathlib import Path

import joblib
import numpy as np
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from sentence_transformers import SentenceTransformer

from features import CLASS_ORDER, ContextRow, build_vector, feature_names

load_dotenv()

MODEL_DIR = Path(os.getenv("MODEL_DIR", Path(__file__).parent / "models"))
RF_ARTIFACT = MODEL_DIR / os.getenv("RF_ARTIFACT", "rf_current.joblib")
EMBED_MODEL_NAME = os.getenv("EMBED_MODEL", "all-MiniLM-L6-v2")
EMBED_DIM = 384
HOST = os.getenv("ML_HOST", "127.0.0.1")
PORT = int(os.getenv("ML_PORT", "5001"))

logging.basicConfig(level=logging.INFO, format="[ml] %(levelname)s %(message)s")
log = logging.getLogger("isu-geobot-ml")

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Warm start. Both models load once and stay resident.
#
# Audit F-14: the embedding hop sits on the request hot path and inflates the
# Response Time metric the thesis requires you to report (§1.2 Objective 2).
# Keeping the model warm is the mitigation; reporting the component latency
# honestly rather than hiding it is the other half.
# ---------------------------------------------------------------------------

log.info("loading sentence-transformer %s ...", EMBED_MODEL_NAME)
_embedder = SentenceTransformer(EMBED_MODEL_NAME)
_max_seq = getattr(_embedder, "max_seq_length", 256)
log.info("embedder ready (dim=%d, max_seq_length=%d)", EMBED_DIM, _max_seq)

_rf_bundle: dict | None = None
if RF_ARTIFACT.exists():
    _rf_bundle = joblib.load(RF_ARTIFACT)
    log.info("random forest loaded: version=%s", _rf_bundle.get("version"))
else:
    log.warning(
        "no Random Forest artifact at %s. /predict will return 503 until "
        "train_rf.py has been run. This is the correct state before training "
        "— do NOT ship a placeholder model.",
        RF_ARTIFACT,
    )


def _embed(texts: list[str]) -> np.ndarray:
    """
    L2-normalised embeddings.

    normalize_embeddings=True must stay on: document_chunk.embedding_norm
    records 'l2' and match_document_chunks() ranks with the cosine operator.
    Mixing normalised and unnormalised vectors is a silent-degradation bug.
    """
    return _embedder.encode(
        texts,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )


# ---------------------------------------------------------------------------
# Health & provenance
# ---------------------------------------------------------------------------


@app.get("/healthz")
def healthz():
    return jsonify(
        status="ok",
        embedder=EMBED_MODEL_NAME,
        embedder_ready=True,
        rf_ready=_rf_bundle is not None,
    )


@app.get("/model/info")
def model_info():
    """
    Reproducibility endpoint (audit F-15).

    When a number is reported in Chapter 4 you must be able to say which
    artifact produced it. eval_run.rf_model_version_id is populated from here.
    """
    if _rf_bundle is None:
        return (
            jsonify(
                rf_ready=False,
                message="No trained model. Run train_rf.py against real data.",
                embed_model=EMBED_MODEL_NAME,
                embed_dim=EMBED_DIM,
                max_seq_length=_max_seq,
            ),
            200,
        )
    return jsonify(
        rf_ready=True,
        version=_rf_bundle["version"],
        trained_at=_rf_bundle["trained_at"],
        sklearn_version=_rf_bundle["sklearn_version"],
        class_order=_rf_bundle["class_order"],
        feature_list=_rf_bundle["feature_list"],
        split_strategy=_rf_bundle["split_strategy"],
        label_source=_rf_bundle["label_source"],
        include_attendance=_rf_bundle["include_attendance"],
        training_row_count=_rf_bundle["training_row_count"],
        embed_model=EMBED_MODEL_NAME,
        embed_dim=EMBED_DIM,
        max_seq_length=_max_seq,
    )


# ---------------------------------------------------------------------------
# Embeddings
# ---------------------------------------------------------------------------


@app.post("/embed")
def embed_one():
    payload = request.get_json(silent=True) or {}
    text = payload.get("text")
    if not isinstance(text, str) or not text.strip():
        return jsonify(error="`text` is required"), 400

    t0 = _time.perf_counter()
    vec = _embed([text])[0]
    return jsonify(
        embedding=vec.tolist(),
        dim=int(vec.shape[0]),
        model=EMBED_MODEL_NAME,
        took_ms=round((_time.perf_counter() - t0) * 1000, 2),
    )


@app.post("/embed/batch")
def embed_batch():
    """Ingestion path. One HTTP call per document rather than per chunk."""
    payload = request.get_json(silent=True) or {}
    texts = payload.get("texts")
    if not isinstance(texts, list) or not texts:
        return jsonify(error="`texts` must be a non-empty array"), 400
    if len(texts) > 512:
        return jsonify(error="batch limit is 512"), 400

    t0 = _time.perf_counter()
    vecs = _embed([str(t) for t in texts])
    return jsonify(
        embeddings=[v.tolist() for v in vecs],
        dim=EMBED_DIM,
        count=len(vecs),
        model=EMBED_MODEL_NAME,
        took_ms=round((_time.perf_counter() - t0) * 1000, 2),
    )


@app.post("/tokenize/count")
def token_count():
    """
    Audit F-34. Ingestion uses THIS endpoint — the model's own tokenizer — to
    enforce the chunk ceiling. Character counts and word estimates are not a
    substitute: all-MiniLM-L6-v2 truncates at 256 word-pieces SILENTLY, so an
    oversized chunk loses its tail from the embedding with no error raised.
    """
    payload = request.get_json(silent=True) or {}
    texts = payload.get("texts") or ([payload["text"]] if payload.get("text") else None)
    if not texts:
        return jsonify(error="`text` or `texts` is required"), 400

    tok = _embedder.tokenizer
    counts = [len(tok.encode(str(t), add_special_tokens=True)) for t in texts]
    return jsonify(counts=counts, max_seq_length=_max_seq)


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------


@app.post("/predict")
def predict():
    """
    Returns the argmax class and the full probability vector.

    BOTH ARE INTERNAL. Audit §4.2 / F-22: predict_proba is retained
    server-side for research logging (eval_result.rf_proba) only. It must never
    reach an /api/chat response DTO and must never be interpolated into an LLM
    prompt. Enforcement lives in Node's masking middleware, not here — but this
    service must not make the mistake easy either, which is why the response is
    explicitly labelled internal.
    """
    if _rf_bundle is None:
        return (
            jsonify(
                error="model_unavailable",
                message=(
                    "No trained Random Forest. Run train_rf.py against real "
                    "ISU data. Audit R6: a placeholder model must never be "
                    "shipped, and its accuracy must never be fabricated."
                ),
            ),
            503,
        )

    payload = request.get_json(silent=True) or {}
    ctx = payload.get("context")
    if not isinstance(ctx, dict):
        return jsonify(error="`context` object is required"), 400

    from datetime import datetime

    try:
        when = datetime.fromisoformat(ctx["when"].replace("Z", "+00:00"))
    except (KeyError, ValueError):
        return jsonify(error="`context.when` must be an ISO-8601 timestamp"), 400

    row = ContextRow(
        pseudonym_id=ctx.get("pseudonym_id"),
        when=when,
        is_consultation_hour=int(ctx.get("is_consultation_hour", 0)),
        is_scheduled_class=int(ctx.get("is_scheduled_class", 0)),
        exam_period_flag=int(ctx.get("exam_period_flag", 0)),
        campus_event_flag=int(ctx.get("campus_event_flag", 0)),
        semester_phase=int(ctx.get("semester_phase", 1)),
        hist_presence_rate=float(ctx.get("hist_presence_rate", 0.0)),
        hist_punctuality_rate=float(ctx.get("hist_punctuality_rate", 0.0)),
        hist_early_departure_rate=float(ctx.get("hist_early_departure_rate", 0.0)),
    )

    include_attendance = _rf_bundle["include_attendance"]
    vec = build_vector(row, _rf_bundle["encoder"], include_attendance)

    t0 = _time.perf_counter()
    clf = _rf_bundle["model"]
    proba = clf.predict_proba(np.array([vec]))[0]
    order = list(clf.classes_)
    idx = int(np.argmax(proba))

    return jsonify(
        predicted_class=order[idx],
        probabilities={cls: float(p) for cls, p in zip(order, proba)},
        model_version=_rf_bundle["version"],
        label_source=_rf_bundle["label_source"],
        feature_list=feature_names(include_attendance),
        internal_only=True,
        took_ms=round((_time.perf_counter() - t0) * 1000, 2),
    )


@app.errorhandler(Exception)
def on_error(err):  # pragma: no cover
    log.exception("unhandled error")
    return jsonify(error="internal_error", message=str(err)), 500


if __name__ == "__main__":
    from waitress import serve

    log.info("ISU-GeoBot ML service on http://%s:%d (internal only)", HOST, PORT)
    serve(app, host=HOST, port=PORT, threads=4)
