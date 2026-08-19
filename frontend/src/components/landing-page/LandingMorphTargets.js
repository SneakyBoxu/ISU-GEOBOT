import { CAMPUS_CENTER } from '../../frontend-utilities/appConstants.js';

/**
 * The three shapes the particle field morphs between.
 *
 * Each is a Float32Array of xyz triples, all the same length, so the vertex
 * shader can `mix()` between them on the GPU. Building them here — once, off
 * the render loop — is what lets the morph itself cost nothing per frame.
 *
 *   CAMPUS  particles fill building volumes at the 28 real coordinates
 *   GRAPH   the same particles fly apart into a retrieval constellation
 *   VEIL    they collapse into one flat disc, individually indistinguishable
 *
 * The order of a particle is meaningful and preserved across all three: index
 * i belongs to the same building, the same cluster and the same ring in every
 * shape. That is what makes the morph read as one object changing state rather
 * than three unrelated clouds cross-fading.
 */

/** Metres per degree at 16.7°N. Equirectangular is exact enough over 1km. */
const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LNG = 111_320 * Math.cos((16.72 * Math.PI) / 180);

/** Building height by category — a visual hierarchy, not survey data. */
const HEIGHT = {
  college: 116, administrative: 104, library: 92, laboratory: 78,
  facility: 58, landmark: 40, sports: 22, other: 50,
};

const CATEGORIES = [
  'college', 'administrative', 'library', 'laboratory',
  'facility', 'landmark', 'sports', 'other',
];

/** Deterministic PRNG, so the field is identical on every load and reload. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function buildMorphTargets(pois, count) {
  const rand = rng(20260819);

  const campus = new Float32Array(count * 3);
  const graph = new Float32Array(count * 3);
  const veil = new Float32Array(count * 3);
  const offset = new Float32Array(count);     // staggers the morph
  const tint = new Float32Array(count);       // 0 = accent, 1 = gold
  const scale = new Float32Array(count);

  const places = pois
    .filter((p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)))
    .map((p) => ({
      x: (Number(p.lng) - CAMPUS_CENTER[1]) * M_PER_DEG_LNG,
      z: -(Number(p.lat) - CAMPUS_CENTER[0]) * M_PER_DEG_LAT,
      h: HEIGHT[p.type] ?? HEIGHT.other,
      type: p.type ?? 'other',
      featured: Boolean(p.isFeatured),
    }));

  if (!places.length) return null;

  // Three in five particles build the buildings; the rest are ground haze, so
  // the campus reads as a site rather than as floating blocks.
  const built = Math.floor(count * 0.62);

  // ---- GRAPH: one cluster per category, on a sphere ---------------------
  // Category clusters rather than a uniform sphere: the constellation is a
  // retrieval space, and things that are alike should sit together in it.
  const clusters = CATEGORIES.map((type, i) => {
    // Fibonacci placement — even coverage without the poles bunching.
    const y = 1 - (i / (CATEGORIES.length - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = i * 2.399963229728653;
    return {
      type,
      x: Math.cos(theta) * r * 420,
      y: y * 300 + 120,
      z: Math.sin(theta) * r * 420,
    };
  });
  const clusterOf = Object.fromEntries(clusters.map((c) => [c.type, c]));

  for (let i = 0; i < count; i += 1) {
    const j = i * 3;
    const place = places[i % places.length];

    // ---- CAMPUS --------------------------------------------------------
    if (i < built) {
      const w = 26 + place.h * 0.34;
      campus[j] = place.x + (rand() - 0.5) * w;
      // Cubed distribution biases particles downward, so masses look solid at
      // the base and dissolve at the roofline instead of reading as a slab.
      campus[j + 1] = place.h * (rand() ** 1.6) + 2;
      campus[j + 2] = place.z + (rand() - 0.5) * w * 0.8;
    } else {
      const a = rand() * Math.PI * 2;
      const d = 180 + rand() * 620;
      campus[j] = Math.cos(a) * d;
      campus[j + 1] = rand() * 6;
      campus[j + 2] = Math.sin(a) * d;
    }

    // ---- GRAPH ---------------------------------------------------------
    const c = clusterOf[place.type] ?? clusters[clusters.length - 1];
    // A shell rather than a solid ball: hollow clusters read as distinct
    // objects at distance, where a filled sphere becomes one grey blob.
    const gr = 58 + rand() * 46;
    const gt = rand() * Math.PI * 2;
    const gp = Math.acos(2 * rand() - 1);
    graph[j] = c.x + Math.sin(gp) * Math.cos(gt) * gr;
    graph[j + 1] = c.y + Math.sin(gp) * Math.sin(gt) * gr;
    graph[j + 2] = c.z + Math.cos(gp) * gr;

    // One particle in nine strings out along an edge toward the origin, so the
    // clusters are visibly connected rather than eight islands.
    if (i % 9 === 0) {
      const t = rand();
      graph[j] *= t;
      graph[j + 1] = c.y * t + 60 * (1 - t);
      graph[j + 2] *= t;
    }

    // ---- VEIL ----------------------------------------------------------
    // Even area distribution (sqrt) — a linear radius crowds the centre and
    // the disc stops looking like a surface.
    const va = rand() * Math.PI * 2;
    const vd = Math.sqrt(rand()) * 560;
    veil[j] = Math.cos(va) * vd;
    veil[j + 1] = (rand() - 0.5) * 7;
    veil[j + 2] = Math.sin(va) * vd;

    offset[i] = rand();
    // Gold is rationed. It marks featured places and a thin scatter elsewhere,
    // so it stays an accent instead of becoming a second body colour.
    tint[i] = place.featured && i < built ? 0.85 + rand() * 0.15 : (rand() < 0.06 ? rand() : 0);
    scale[i] = 0.6 + rand() * (i < built ? 0.9 : 0.5);
  }

  return { campus, graph, veil, offset, tint, scale, count, places };
}

/**
 * Particle budget.
 *
 * Scaled off the viewport and pixel ratio rather than fixed: the same field that
 * is comfortable on the machine this was built for would drop frames on the
 * laptop it gets demonstrated from, and a stuttering hero is worse than a
 * sparser one.
 */
export function particleBudget() {
  if (typeof window === 'undefined') return 12_000;
  const area = window.innerWidth * window.innerHeight;
  if (window.innerWidth < 768) return 7_000;
  // Additive blending means every particle fragment is blended with no depth
  // rejection, so cost tracks covered PIXELS rather than point count. A big
  // screen is therefore a reason to draw fewer, not more — the opposite of the
  // instinct, and the mistake in the first version of this.
  if (area > 2_000_000) return 16_000;
  return 20_000;
}
