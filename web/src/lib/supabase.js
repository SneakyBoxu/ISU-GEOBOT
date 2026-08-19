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

export const DEMO_AUTH = !supabase;

export async function signIn(email, password) {
  if (!supabase) {
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
  if (!supabase) {
    const raw = sessionStorage.getItem('geobot.demoSession');
    return raw ? JSON.parse(raw) : null;
  }
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

export async function signOut() {
  if (!supabase) {
    sessionStorage.removeItem('geobot.demoSession');
    return;
  }
  await supabase.auth.signOut();
}
