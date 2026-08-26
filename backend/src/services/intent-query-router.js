/**
 * Deterministic query router (audit B5 / §5.3).
 *
 * The thesis names three query categories (§3.5.4 step 2) but never specifies
 * the mechanism. The previous implementation report recommended an LLM
 * classification call. This is a deliberate departure, for three reasons:
 *
 *   1. An LLM routing call spends 150-300ms of the Response Time budget that
 *      §1.2 Objective 2 requires you to REPORT, on a decision a database
 *      lookup answers in ~2ms.
 *   2. It is non-deterministic. The same query can route differently on two
 *      runs, so a RAGAS run is not reproducible — and "would I get the same
 *      numbers if I re-ran this?" deserves "yes".
 *   3. The faculty roster is a known, closed, small list already in the
 *      database. Detecting "does this query name a faculty member?" is a
 *      gazetteer lookup, not an open-ended NLU problem.
 *
 * KEY SIMPLIFICATION. §3.5.4 step 4 says retrieval happens "simultaneously",
 * so retrieval is NOT conditional on the route. Routing therefore reduces to
 * one binary question: does this query need a faculty availability status?
 * Everything else is retrieved regardless. Much smaller, much more testable.
 *
 * MEASURE IT. Hand-label 100 representative queries, compute router accuracy,
 * and report it. Above ~90% you have a defensible sub-millisecond router and a
 * number to quote. Below that, add an LLM fallback for the ambiguous band and
 * you will have the evidence justifying the extra latency.
 *
 * INVARIANT (audit F-23): the router behaves IDENTICALLY in both arms. If
 * routing differed between standard and enhanced, retrieval would differ, and
 * Context Precision/Recall deltas would be routing artifacts rather than
 * architecture effects.
 */

import { db, log } from '../utilities/service-clients.js';
import { ROUTER_VERSION } from '../utilities/configuration.js';

const AVAILABILITY_INTENT = [
  'available', 'availability', 'free', 'busy', 'in office', 'in her office',
  'in his office', 'around', 'consultation', 'consult', 'office hours',
  'can i see', 'can i talk', 'is there', 'present', 'reachable', 'accepting',
  // Taglish is common on a Philippine campus. Audit F-35: retrieval quality on
  // non-English queries is degraded by the English-only embedder, but INTENT
  // detection is cheap to make bilingual and there is no reason not to.
  'pwede ba', 'nandiyan', 'nandyan', 'nasa opisina', 'available ba', 'libre ba',
];

const NAVIGATION_INTENT = [
  'where is', 'where can i find', 'how do i get', 'directions', 'located',
  'location of', 'find the', 'take me to', 'nasaan', 'saan',
];

const TITLES = /\b(prof(?:essor)?|dr|doc|engr|atty|sir|ma'?am|mr|mrs|ms)\.?\s+/gi;

/** Roster cache. Small, closed, and changes only when researchers edit it. */
let rosterCache = { at: 0, entries: [] };
const ROSTER_TTL_MS = 60_000;

async function loadRoster() {
  if (Date.now() - rosterCache.at < ROSTER_TTL_MS) return rosterCache.entries;

  // Audit F-32 / C11: CONSENTED roster only. Faculty whose schedules were
  // ingested but who never gave written consent are data subjects; the system
  // must not answer questions about them.
  const { data: faculty, error } = await db
    .from('faculty')
    .select('id, full_name, availability_visible, department:department_id (name)')
    .eq('is_active', true)
    .eq('is_consented', true);
  if (error) throw error;

  const { data: aliases } = await db
    .from('faculty_alias')
    .select('faculty_id, alias');

  const byId = new Map(
    (faculty ?? []).map((f) => {
      const needles = new Set([f.full_name.toLowerCase()]);
      const parts = f.full_name.split(/[,.]+/).map((s) => s.trim());
      if (parts.length >= 2) {
        const surname = parts[0];
        const givenParts = parts[1].split(/\s+/).filter(Boolean);
        const given = givenParts.join(' ');
        const firstName = givenParts[0];

        if (surname && surname.length >= 3) needles.add(surname.toLowerCase());
        if (given) {
          needles.add(`${given} ${surname}`.toLowerCase());
          needles.add(`${surname} ${given}`.toLowerCase());
        }
        if (firstName && firstName.length >= 3) {
          needles.add(firstName.toLowerCase());
          needles.add(`${firstName} ${surname}`.toLowerCase());
        }
      }

      return [
        f.id,
        {
          facultyId: f.id,
          fullName: f.full_name,
          department: f.department?.name ?? null,
          needles,
        },
      ];
    }),
  );
  for (const a of aliases ?? []) {
    byId.get(a.faculty_id)?.needles.add(a.alias.toLowerCase());
  }

  rosterCache = { at: Date.now(), entries: [...byId.values()] };
  return rosterCache.entries;
}

export function clearRosterCache() {
  rosterCache = { at: 0, entries: [] };
}

function normalise(q) {
  return q.toLowerCase().replace(TITLES, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Faculty matching: EXACT-OR-CLARIFY (audit F-31).
 *
 * Never auto-selects a nearest match. Resolving "Prof. Santoso" to
 * "Prof. Santos" would disclose one person's status in answer to a query about
 * another — a privacy incident, not a UX rough edge. Multiple candidates
 * produce a clarifying question; zero produce an honest "I don't have that".
 */
function matchFaculty(normalised, roster) {
  const hits = [];
  for (const entry of roster) {
    for (const needle of entry.needles) {
      if (needle.length < 3) continue;
      const re = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (re.test(normalised)) {
        hits.push(entry);
        break;
      }
    }
  }
  // De-dupe by id, keeping the longest match per person.
  return [...new Map(hits.map((h) => [h.facultyId, h])).values()];
}

function hasAny(text, phrases) {
  return phrases.some((p) => text.includes(p));
}

/**
 * @returns {{
 *   category: 'general_institutional'|'campus_navigation'|'faculty_availability'|'combined',
 *   needsAvailability: boolean,
 *   facultyCandidates: Array,
 *   ambiguous: boolean,
 *   routerVersion: string
 * }}
 */
export async function routeQuery(query) {
  const normalised = normalise(query);
  const roster = await loadRoster();

  const candidates = matchFaculty(normalised, roster);
  const availabilityIntent = hasAny(normalised, AVAILABILITY_INTENT);
  const navigationIntent = hasAny(normalised, NAVIGATION_INTENT);

  // A bare name ("Prof. Santos?") reads as an availability question in
  // practice. A named query with an explicit navigation intent and no
  // availability words does not — "where is Prof. Santos's office" is asking
  // about a place, and audit C6 says static office location is directory
  // information, not live whereabouts.
  const bareName = candidates.length > 0 && !availabilityIntent && !navigationIntent;
  const needsAvailability =
    candidates.length === 1 && (availabilityIntent || bareName);

  let category = 'general_institutional';
  if (candidates.length && availabilityIntent && navigationIntent) category = 'combined';
  else if (candidates.length && (availabilityIntent || bareName)) category = 'faculty_availability';
  else if (navigationIntent) category = 'campus_navigation';

  const decision = {
    category,
    needsAvailability,
    facultyCandidates: candidates.map((c) => ({
      facultyId: c.facultyId,
      fullName: c.fullName,
      department: c.department,
    })),
    ambiguous: candidates.length > 1,
    hasAvailabilityIntent: availabilityIntent,
    hasNavigationIntent: navigationIntent,
    routerVersion: ROUTER_VERSION,
  };

  log.debug({ query, decision }, 'route');
  return decision;
}
