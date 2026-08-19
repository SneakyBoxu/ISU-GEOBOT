/**
 * Go-live preflight.
 *
 *   npm run preflight --prefix server
 *
 * Answers one question: if DEMO_MODE were switched off right now, what would
 * break? It contacts nothing it does not have to and writes nothing at all.
 *
 * The alternative is flipping the flag and reading a stack trace, which tells
 * you about the first missing thing and nothing about the other six. This
 * reports all of them, in the order they have to be fixed, and separates what
 * blocks the MAP from what blocks the ASSISTANT — the map needs only a
 * database, and there is no reason to wait for a language model to see it.
 *
 * Exit code is 0 when the map would work, 1 when it would not. The assistant's
 * dependencies are reported but never fail the run: a campus map with real
 * locations and no chatbot is a legitimate state to deploy in, and Phase 10 of
 * setup-guide.md says so.
 */

import 'dotenv/config';

/**
 * fetch with a deadline that cleans up after itself.
 *
 * `AbortSignal.timeout()` leaves a live timer behind after the request settles.
 * A handful of those still pending when a one-shot script ends is enough to
 * trip a libuv teardown assertion on Windows — printed after all the output,
 * attached to nothing, and far more alarming than anything this script has to
 * say. Clearing the timer removes it.
 */
async function get(resource, init = {}, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(resource, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

const OK = '  ok  ';
const WARN = ' warn ';
const FAIL = ' FAIL ';

let mapBlocked = false;
const lines = [];

function report(state, label, detail) {
  lines.push(`[${state}] ${label}${detail ? `\n         ${detail}` : ''}`);
  if (state === FAIL) mapBlocked = true;
}

function soft(state, label, detail) {
  lines.push(`[${state}] ${label}${detail ? `\n         ${detail}` : ''}`);
}

// ---------------------------------------------------------------- environment
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const schema = process.env.DB_SCHEMA ?? 'geobot';

if (String(process.env.DEMO_MODE).toLowerCase() === 'true') {
  soft(WARN, 'DEMO_MODE is still true',
    'This check reads your .env as if it were false. Nothing below is live yet.');
}

if (!url) report(FAIL, 'SUPABASE_URL is not set', 'backend/.env — Settings > API in your Supabase project.');
else report(OK, `SUPABASE_URL → ${url.replace(/^https?:\/\//, '').split('.')[0]}`);

if (!serviceKey) {
  report(FAIL, 'SUPABASE_SERVICE_ROLE_KEY is not set',
    'Settings > API > service_role. Server-side only — never in a VITE_ variable.');
} else if (serviceKey.length < 40) {
  report(FAIL, 'SUPABASE_SERVICE_ROLE_KEY looks truncated');
} else {
  report(OK, 'SUPABASE_SERVICE_ROLE_KEY is set');
}

// The one check that is about safety rather than function.
const anonInServer = process.env.SUPABASE_ANON_KEY;
if (anonInServer && anonInServer === serviceKey) {
  report(FAIL, 'SUPABASE_ANON_KEY and SERVICE_ROLE_KEY are the same value',
    'One of them is wrong. The service_role key bypasses row-level security.');
}

if (!url || !serviceKey) {
  finish();
} else {
  await checkDatabase();
  await checkAssistant();
  finish();
}

// ---------------------------------------------------------------- database
async function checkDatabase() {
  // Plain PostgREST rather than supabase-js. The client keeps sockets and a
  // refresh timer alive, and a one-shot script that exits under them trips a
  // libuv assertion on Windows — a scary-looking message attached to "you have
  // not created your database yet". Four GETs and an RPC do not need a library.
  const rest = async (path, init = {}) => {
    return get(`${url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        'accept-profile': schema,
        'content-profile': schema,
        ...init.headers,
      },
    });
  };
  const select = async (path) => {
    const res = await rest(path);
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.message ?? `HTTP ${res.status}`);
    return body;
  };

  try {
    await select('availability_status?select=code&limit=1');
    report(OK, `schema "${schema}" is reachable`);
  } catch (err) {
    report(FAIL, `cannot read schema "${schema}"`,
      `${err.message}. Run database/tables-and-structure.sql, database-functions.sql and security-and-permissions.sql in the SQL editor.`);
    return;
  }

  // Locations — the thing this whole exercise is about.
  try {
    let data;
    try {
      data = await select('poi?select=id,slug,icon,survey_method,data_origin,is_published');
    } catch (e) {
      if (!/icon/.test(e.message)) throw e;
      // Migration 004 has not run; ask for everything else and say so.
      data = await select('poi?select=id,slug,survey_method,data_origin,is_published');
      soft(WARN, 'poi.icon column missing', 'Run database/migrations/004_map_pin_icons.sql (optional).');
    }

    const published = data.filter((p) => p.is_published !== false);
    if (published.length === 0) {
      report(FAIL, 'no published campus locations',
        'Run database/migrations/003_campus_places_and_departments.sql — the map will be empty without it.');
    } else {
      report(OK, `${published.length} published campus locations`);
    }

    const noSlug = published.filter((p) => !p.slug).length;
    if (noSlug) {
      soft(WARN, `${noSlug} locations have no slug`,
        'The assistant cannot name these on the map. Migration 003 assigns them.');
    }

    const synthetic = published.filter((p) => p.data_origin === 'synthetic').length;
    if (synthetic) {
      soft(WARN, `${synthetic} published locations are still marked synthetic`,
        'Placeholder data will appear on the public map, marked [DEMO].');
    }

    const unsurveyed = published.filter((p) => p.survey_method !== 'gps_survey').length;
    if (unsurveyed) {
      soft(WARN, `${unsurveyed} locations are not from an on-site GPS survey`,
        'Thesis §3.4.1(a) is not yet satisfied. Fine to run; not yet writable up.');
    }
  } catch (err) {
    report(FAIL, 'cannot read the poi table', err.message);
  }

  // Retrieval corpus — a map pin the assistant has never heard of.
  try {
    const res = await rest('document_chunk?select=id', {
      method: 'HEAD',
      headers: { prefer: 'count=exact' },
    });
    const count = Number((res.headers.get('content-range') ?? '/0').split('/')[1]) || 0;
    if (!count) {
      soft(WARN, 'the retrieval corpus is empty',
        'Run: cd machine-learning && python document_knowledge_importer.py --place-cards --origin real');
    } else {
      soft(OK, `${count} embedded chunks in the retrieval corpus`);
    }
  } catch (err) {
    soft(WARN, 'cannot read document_chunk', err.message);
  }

  // Security posture. Not optional, and not something to discover later.
  try {
    const res = await rest('rpc/rls_audit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message ?? `HTTP ${res.status}`);
    const unprotected = (data ?? []).filter((r) => !r.rls_enabled || !r.rls_forced);
    if (unprotected.length) {
      report(FAIL, `${unprotected.length} tables without forced row-level security`,
        `${unprotected.map((r) => r.table_name).join(', ')} — re-run database/security-and-permissions.sql.`);
    } else {
      report(OK, `row-level security forced on all ${data.length} tables`);
    }

    const readable = (data ?? []).filter((r) => r.anon_readable).map((r) => r.table_name);
    if (readable.length > 1 || (readable[0] && readable[0] !== 'availability_status')) {
      report(FAIL, `anon can read: ${readable.join(', ')}`,
        'Only availability_status should be anon-readable.');
    }
  } catch (err) {
    soft(WARN, 'could not run rls_audit()', `${err.message}. Run database/security-and-permissions.sql.`);
  }
}

// ---------------------------------------------------------------- assistant
async function checkAssistant() {
  const mlBase = process.env.ML_BASE_URL ?? 'http://127.0.0.1:5001';
  try {
    const res = await get(`${mlBase}/healthz`, {}, 3000);
    const h = await res.json();
    soft(OK, `ML service up at ${mlBase}`, `embedder: ${h.embedder ?? 'unknown'}`);
    if (!h.rf_ready) {
      soft(WARN, 'no trained Random Forest',
        'Availability questions return 503 until train_availability_model.py runs. Correct before Phase 10.');
    }
  } catch {
    soft(WARN, `ML service unreachable at ${mlBase}`,
      'Start it with: cd machine-learning && python ai_api_service.py. The MAP works without it; chat does not.');
  }

  if (!process.env.GROQ_API_KEY) {
    soft(WARN, 'GROQ_API_KEY is not set', 'Answer generation will fail. The map is unaffected.');
  } else if (process.env.GROQ_API_KEY.startsWith('gsk_wTgX')) {
    // Named explicitly because this exact key is published in a public
    // repository, and a warning that does not say which key is useless.
    report(FAIL, 'GROQ_API_KEY is the key published in the reference repository',
      'Revoke it at console.groq.com/keys and issue a new one before going live.');
  } else {
    soft(OK, 'GROQ_API_KEY is set');
  }
}

// ---------------------------------------------------------------- output
function finish() {
  console.log('\nISU-GeoBot — go-live preflight\n');
  for (const l of lines) console.log(l);
  console.log('');
  if (mapBlocked) {
    console.log('BLOCKED. Fix the FAIL lines above, then set DEMO_MODE=false.\n');
    process.exit(1);
  }
  console.log('The campus map is ready to run live. Set DEMO_MODE=false in backend/.env.');
  console.log('Warnings above affect the assistant, not the map.\n');
  process.exit(0);
}
