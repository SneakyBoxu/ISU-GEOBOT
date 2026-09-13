/**
 * Authentication and role gating for every write surface in the system.
 *
 * Four roles are recognised, and each one is checked at the route:
 *
 *   admin, researcher   the Admin Dashboard -- campus locations, schedule and
 *                       document import, POI photographs (/admin/*)
 *   validator           faculty availability validation entries (/validate/*)
 *   faculty             a lecturer acting on their OWN record only
 *                       (/admin/me/faculty), which is how the RA 10173 right
 *                       to object is exercised
 *
 * Roles are provisioned manually by the researchers (audit §7.2). There is NO
 * self-registration: the population is small, known and fixed for the
 * evaluation period, and letting anyone enrol themselves into a role that
 * writes to faculty data would be an open door to the most sensitive tables in
 * the system.
 *
 * A shared PIN was explicitly rejected: it destroys per-actor accountability,
 * which is the only thing making an audit row defensible as research evidence.
 */

import { authClient, db } from '../utilities/service-clients.js';
import { DEMO_MODE } from '../utilities/configuration.js';

// Used only to check that an offline token was issued by THIS project.
// Read from the environment rather than config so that an unset value is
// an empty string and the offline branch simply refuses, instead of the
// service failing to boot.
const SUPABASE_URL = process.env.SUPABASE_URL ?? '';

/**
 * Demo credentials. Present ONLY when DEMO_MODE is on, and the portals display
 * them on screen so nobody mistakes them for real accounts. In a real
 * deployment authClient exists and this branch is unreachable.
 */
const DEMO_USERS = {
  'demo-guard-token': { id: 'demo-guard', email: 'guard@demo.local' },
  'demo-validator-token': { id: 'demo-validator', email: 'faculty@demo.local' },
  'demo-student-token': { id: 'demo-student', email: 'student@demo.local' },
  'demo-admin-token': { id: 'demo-admin', email: 'admin@demo.local' },
};

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'authentication required' });

  if (DEMO_MODE) {
    const user = DEMO_USERS[token];
    if (!user) return res.status(401).json({ error: 'invalid demo session' });
    try {
      const { data: roles } = await db
        .from('app_user_role')
        .select('role, faculty_id')
        .eq('auth_user_id', user.id)
        .eq('is_active', true);
      req.user = {
        id: user.id,
        email: user.email,
        roles: (roles ?? []).map((r) => r.role),
        facultyId: roles?.find((r) => r.role === 'validator')?.faculty_id ?? null,
      };
    } catch {
      // Fail closed here too. A demo session with no role rows is a demo
      // session with no roles, not an administrator.
      req.user = { id: user.id, email: user.email, roles: [], facultyId: null };
    }
    return next();
  }

  // 1. Attempt live online verification via Supabase authClient
  try {
    const { data, error } = await authClient.auth.getUser(token);
    if (!error && data?.user) {
      let roles = [];
      try {
        const { data: rolesData } = await db
          .from('app_user_role')
          .select('role, faculty_id')
          .eq('auth_user_id', data.user.id)
          .eq('is_active', true);
        roles = rolesData ?? [];
      } catch {
        // FAIL CLOSED. This used to grant admin+researcher+validator when the
        // role lookup threw, so a transient database error was an instant
        // privilege escalation for whoever happened to be signed in.
        roles = [];
      }

      req.user = {
        id: data.user.id,
        email: data.user.email,
        roles: (roles ?? []).map((r) => r.role),
        facultyId: roles?.find((r) => r.role === 'validator')?.faculty_id ?? null,
      };
      return next();
    }
  } catch (netErr) {
    // Network offline / unreachable: continue to offline JWT fallback below
  }

  // 2. Offline fallback, for field validation with no connectivity.
  //
  //     WHAT THIS IS NOT. The signature is NOT verified -- there is no JWT
  //     secret on this service and adding one is a deployment change, not a
  //     code change. So this branch cannot establish WHO the caller is; it can
  //     only establish that the caller presents a well-formed, unexpired token
  //     issued by this project. Treat it as "probably our validator, offline"
  //     and nothing stronger.
  //
  //     It used to hand out ['admin','researcher','validator'] to anything with
  //     a decodable `sub`, which meant a hand-written token was a full
  //     administrator the moment Supabase was unreachable. The offline workflow
  //     only ever needed to record validations, so it now gets exactly the one
  //     role that does that, and the admin surfaces stay unreachable offline.
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      const now = Math.floor(Date.now() / 1000);
      const unexpired = typeof payload?.exp === 'number' && payload.exp > now;
      const ours = typeof payload?.iss === 'string' &&
                   SUPABASE_URL.length > 0 &&
                   payload.iss.startsWith(SUPABASE_URL);
      if (payload?.sub && unexpired && ours) {
        req.user = {
          id: payload.sub,
          email: payload.email || 'offline-validator@geobot.local',
          roles: ['validator'],
          facultyId: payload.user_metadata?.faculty_id ?? null,
          offline: true,
        };
        return next();
      }
    }
  } catch {
    // Malformed token. Fall through to 401.
  }

  return res.status(401).json({ error: 'invalid or expired session' });
}

export function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'authentication required' });
    if (!req.user.roles.some((r) => allowed.includes(r))) {
      return res.status(403).json({ error: 'insufficient permissions' });
    }
    next();
  };
}


/**
 * Attaches req.user when a valid session is present, and does nothing when one
 * is not. Never rejects.
 *
 * The public assistant uses this rather than requireAuth because the map and
 * institutional Q&A stay open to everyone — only faculty availability needs an
 * account (audit F-29). Gating the whole chatbot would close off the
 * navigation half of the thesis for no privacy gain.
 */
export async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) return next();
  try {
    await new Promise((resolve, reject) => {
      requireAuth(req, { status: () => ({ json: () => reject(new Error('unauth')) }) }, resolve);
    });
  } catch {
    req.user = undefined;
  }
  next();
}
