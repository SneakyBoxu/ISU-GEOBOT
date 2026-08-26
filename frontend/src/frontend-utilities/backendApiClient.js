/**
 * API client.
 *
 * The browser talks ONLY to the Express API. It never calls Groq (audit W6),
 * never calls the Flask ML service (W7), and never holds the Supabase
 * service_role key (W2). Those boundaries are why this file is thin.
 */

const BASE = import.meta.env.VITE_API_BASE ?? '/api';

async function request(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.message || json.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = json.error;
    throw err;
  }
  return json;
}

export const api = {
  health: () => request('/health'),

  // Note: no `mode` parameter. Audit F-16 — the standard/enhanced switch is a
  // server-side evaluation concern and is deliberately not reachable from here.
  //
  // The token IS sent when a session exists: /api/chat uses optionalAuth, and
  // availability is withheld from anonymous callers (audit F-29). Omitting it
  // would silently downgrade every signed-in user to anonymous.
  // `history` lets a follow-up mean something — "how do I get there from the
  // Oval" needs a "there". The server caps and sanitises it; the client's job
  // is only to send the recent turns, not to decide what is safe to replay.
  chat: (query, token, history) =>
    request('/chat', { method: 'POST', body: { query, history }, token }),

  demoQueries: () => request('/demo/queries'),
  demoCompare: (demoQueryId) =>
    request('/demo/compare', { method: 'POST', body: { demoQueryId } }),

  pois: () => request('/map/pois'),
  facultySearch: (q) => request(`/faculty/search?q=${encodeURIComponent(q)}`),
  evalStatus: () => request('/eval/status'),

  guardRoster: (token) => request('/guard/roster', { token }),
  guardLog: (token, body) => request('/guard/events', { method: 'POST', body, token }),

  me: (token) => request('/me', { token }),

  // Campus location management (admin / researcher only — enforced server-side
  // and by RLS, never by hiding the button).
  adminPois: (token) => request('/admin/pois', { token }),
  adminDepartments: (token) => request('/admin/departments', { token }),
  adminCreatePoi: (token, body) =>
    request('/admin/pois', { method: 'POST', body, token }),
  adminUpdatePoi: (token, id, body) =>
    request(`/admin/pois/${id}`, { method: 'PATCH', body, token }),
  adminUnpublishPoi: (token, id, note) =>
    request(`/admin/pois/${id}/unpublish`, { method: 'POST', body: { note }, token }),

  // Faculty self-service (RA 10173 right to object)
  myFaculty: (token) => request('/admin/me/faculty', { token }),
  setMyVisibility: (token, body) =>
    request('/admin/me/faculty/visibility', { method: 'POST', body, token }),

  validateContext: (token) => request('/validate/context', { token }),
  validateSubmit: (token, body) =>
    request('/validate/entries', { method: 'POST', body, token }),
  validateEntries: (token) => request('/validate/entries', { token }),
};
