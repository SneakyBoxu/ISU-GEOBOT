import { createClient } from '@supabase/supabase-js';

/**
 * Auth only.
 *
 * This client holds the ANON key, which ships in the bundle and is readable by
 * anyone. It is used exclusively to sign guard and validator accounts in and to
 * obtain a JWT for the Express API. It must never be used to read data
 * directly: RLS is deny-by-default (audit F-30/W1) precisely so that a leaked
 * anon key is worth nothing.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anon ? createClient(url, anon) : null;

/**
 * Demo sessions.
 *
 * When Supabase is not configured the portals still need to be reachable so
 * the guard and validation flows can be shown. These tokens are recognised
 * only by a server running with DEMO_MODE=true, and the login screen displays
 * them on-screen so they cannot be mistaken for real credentials.
 */
const DEMO_ACCOUNTS = {
  'guard@demo.local': { access_token: 'demo-guard-token', role: 'guard' },
  'faculty@demo.local': { access_token: 'demo-validator-token', role: 'faculty' },
  'student@demo.local': { access_token: 'demo-student-token', role: 'student' },
  'admin@demo.local': { access_token: 'demo-admin-token', role: 'admin' },
};

/**
 * WHICH AUTHENTICATION IS IN FORCE — and why the server decides, not this file.
 *
 * This used to be `!supabase`: demo auth if no Supabase client was configured.
 * That is the client answering a question only the server can answer, and when
 * the two disagreed every portal broke in the same baffling way — a login that
 * appears to succeed, a list that loads nothing, and "invalid demo session" on
 * save. It happened for real: `web/.env` carried a VITE_SUPABASE_URL while the
 * API ran with DEMO_MODE=true, so the browser obtained a Supabase JWT and sent
 * it to a server that only recognises demo tokens.
 *
 * The server already publishes the answer at /api/health. Asking it removes the
 * disagreement entirely: a Supabase client may exist and go unused, which is
 * the correct outcome when the API it would authenticate against is not
 * checking Supabase tokens.
 */
let modePromise = null;

async function usingDemoAuth() {
  if (!supabase) return true;           // nothing else is possible
  if (!modePromise) {
    modePromise = fetch(`${import.meta.env.VITE_API_BASE ?? '/api'}/health`)
      .then((r) => (r.ok ? r.json() : null))
      .then((h) => Boolean(h?.demoMode))
      // If health is unreachable the portals are unusable either way; fall back
      // to the configured client rather than inventing a demo session.
      .catch(() => false);
  }
  return modePromise;
}

/**
 * Synchronous best guess, for first paint only.
 *
 * The login screen uses this to decide whether to show the demonstration
 * accounts. It can be wrong for one frame; `demoAuthMode()` is the authority
 * and the screen corrects itself as soon as it resolves.
 */
export const DEMO_AUTH = !supabase;

/**
 * The demonstration account for a portal role, or null.
 *
 * DEMO_ACCOUNTS is keyed by email because that is what sign-in receives; the
 * login screen needs the inverse. Exported rather than duplicated so the two
 * cannot drift — a prefill that fills in an address sign-in rejects is worse
 * than no prefill at all.
 */
export function demoAccountFor(role) {
  const found = Object.entries(DEMO_ACCOUNTS).find(([, a]) => a.role === role);
  return found ? { email: found[0], password: 'demo' } : null;
}

export async function demoAuthMode() {
  return usingDemoAuth();
}

export async function signIn(email, password) {
  if (await usingDemoAuth()) {
    const account = DEMO_ACCOUNTS[email.trim().toLowerCase()];
    if (!account || password !== 'demo') {
      throw new Error('Use one of the demonstration accounts shown below.');
    }
    const session = { access_token: account.access_token, demo: true };
    sessionStorage.setItem('geobot.demoSession', JSON.stringify(session));
    return session;
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function currentSession() {
  if (await usingDemoAuth()) {
    const raw = sessionStorage.getItem('geobot.demoSession');
    return raw ? JSON.parse(raw) : null;
  }
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

export async function signOut() {
  // Clear both regardless of mode: a stale demo session left behind after a
  // config change is the other half of the bug described above.
  sessionStorage.removeItem('geobot.demoSession');
  if (supabase) await supabase.auth.signOut();
}
