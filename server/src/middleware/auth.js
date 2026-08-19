/**
 * Authentication and role gating for /guard, /validate and /eval.
 *
 * Roles are provisioned manually by the researchers (audit §7.2). There is NO
 * self-registration on any of these portals: the guard population is small,
 * known and fixed for the evaluation period, and self-registration on the
 * dashboard that writes to the presence log would be an open door to the most
 * sensitive table in the system.
 *
 * A shared PIN was explicitly rejected: it destroys `logged_by`
 * accountability, which is the only thing making the presence log defensible
 * as research evidence.
 */

import { authClient, db } from '../lib/clients.js';
import { DEMO_MODE } from '../lib/config.js';

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
    return next();
  }

  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: 'invalid or expired session' });
  }

  const { data: roles } = await db
    .from('app_user_role')
    .select('role, faculty_id')
    .eq('auth_user_id', data.user.id)
    .eq('is_active', true);

  req.user = {
    id: data.user.id,
    email: data.user.email,
    roles: (roles ?? []).map((r) => r.role),
    facultyId: roles?.find((r) => r.role === 'validator')?.faculty_id ?? null,
  };
  next();
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
