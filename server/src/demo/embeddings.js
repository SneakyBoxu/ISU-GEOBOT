/**
 * Local deterministic embeddings for DEMO_MODE only.
 *
 * ####################################################################
 * ##  THIS IS NOT all-MiniLM-L6-v2 AND IT IS NOT A SEMANTIC MODEL.  ##
 * ####################################################################
 *
 * It is hashed lexical overlap projected into 384 dimensions so that cosine
 * retrieval demonstrably works over the ~40 fixture chunks without requiring
 * Python, torch, or a 90 MB model download.
 *
 * What it CAN do: retrieve the right place-card for "where is the library".
 * What it CANNOT do: match paraphrases, synonyms, or anything requiring actual
 * semantics — which is the entire point of using a sentence transformer.
 *
 * Consequences that must never be forgotten:
 *
 *   1. No retrieval quality observed in demo mode says anything about the real
 *      system. Context Precision and Context Recall measured here would be
 *      meaningless (audit R7).
 *   2. Nothing embedded by this function may ever be written to
 *      document_chunk in a real database. Mixing these vectors with
 *      all-MiniLM-L6-v2 vectors would silently destroy retrieval, and the
 *      failure would look like "our Context Recall came out low" with no
 *      obvious cause (audit F-14).
 *
 * When DEMO_MODE is off, this file is not loaded at all: /embed on the Flask
 * service is the only embedding path (audit F-14).
 */

const DIM = 384;

const STOP = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'of', 'to', 'in',
  'on', 'at', 'for', 'and', 'or', 'it', 'its', 'this', 'that', 'with', 'as',
  'by', 'from', 'i', 'you', 'do', 'does', 'can', 'will', 'what', 'which',
]);

function tokens(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

/** FNV-1a. Stable across runs and platforms — determinism matters here. */
function hash(str, seed = 2166136261) {
  let h = seed;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Light stemming so "laboratories" and "laboratory" land together. */
function stem(t) {
  return t
    .replace(/(ies)$/, 'y')
    .replace(/(sses|shes|ches|xes)$/, '')
    .replace(/(ing|ed|es|s)$/, '');
}

export function embed(text) {
  const vec = new Float64Array(DIM);
  const toks = tokens(text).map(stem);

  for (const t of toks) {
    // Two hashes per token reduces collision damage in a small vocabulary.
    vec[hash(t) % DIM] += 1;
    vec[hash(t, 0x811c9dc5) % DIM] += 0.5;
  }
  // Adjacent-pair features give a little word-order sensitivity.
  for (let i = 0; i < toks.length - 1; i++) {
    vec[hash(`${toks[i]}_${toks[i + 1]}`) % DIM] += 0.75;
  }

  // L2 normalise — the real pipeline stores normalised vectors and ranks by
  // cosine, and the demo must not diverge on that detail.
  let norm = 0;
  for (let i = 0; i < DIM; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  const out = new Array(DIM);
  for (let i = 0; i < DIM; i++) out[i] = vec[i] / norm;
  return out;
}

export function cosine(a, b) {
  let dot = 0;
  for (let i = 0; i < DIM; i++) dot += a[i] * b[i];
  return dot;   // both operands are unit vectors
}

export const EMBED_DIM = DIM;
