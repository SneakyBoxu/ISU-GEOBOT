import { useEffect, useState } from 'react';
import { DEMO_AUTH, demoAccountFor, demoAuthMode, signIn } from '../../frontend-utilities/supabaseClient.js';
import TopNavigationBar from './TopNavigationBar.jsx';
import DemoModeNotificationBanner from './DemoModeNotificationBanner.jsx';
import { Alert, Button, Field, Input, PasswordInput } from '../ui-primitives/index.js';

/**
 * One sign-in surface, three contexts.
 *
 * The portals share a frame and differ by a single line: what this room is
 * for, and who is expected in it. That is enough identity — three visual
 * languages would say "three products" when the point is one product with
 * three doors.
 *
 * Audit §7.2: NO self-registration anywhere. Accounts are provisioned by the
 * researchers, and the portals display that plainly.
 */
export default function PortalLogin({
  role,
  title,
  description,
  icon: Icon,
  onSession,
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // Seeded from the synchronous guess so the panel does not flash, then
  // corrected by the server's answer. DEMO_AUTH is a boolean — whether demo
  // credentials are in force — not a map of them; `demoAccountFor` is the map.
  const [demoAuth, setDemoAuth] = useState(DEMO_AUTH);

  useEffect(() => {
    let alive = true;
    demoAuthMode().then((on) => {
      if (!alive) return;
      setDemoAuth(on);
      if (!on) return;
      const account = demoAccountFor(role);
      if (!account) return;
      setEmail(account.email);
      setPassword(account.password);
    });
    return () => { alive = false; };
  }, [role]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSession(await signIn(email, password));
    } catch (err) {
      setError(err.message ?? 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <TopNavigationBar />
      <DemoModeNotificationBanner />

      <main className="container-x grid min-h-[calc(100vh-8rem)] items-center py-12">
        <div className="mx-auto w-full max-w-[26rem]">
          <div className="flex items-center gap-2 text-fg-muted">
            {Icon && <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
            <span className="eyebrow">Portal sign-in</span>
          </div>
          <h1 className="mt-3 font-serif text-h2 text-fg">{title}</h1>
          <p className="mt-3 text-meta leading-relaxed text-fg-muted">{description}</p>

          <form onSubmit={submit} className="mt-9 space-y-5 border-t border-line pt-8" noValidate>
            <Field label="Email" required>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id} type="email" required autoComplete="username"
                  aria-describedby={describedBy} invalid={invalid || Boolean(error)}
                  value={email} onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </Field>

            <Field label="Password" required>
              {({ id, describedBy, invalid }) => (
                <PasswordInput
                  id={id} required autoComplete="current-password"
                  aria-describedby={describedBy} invalid={invalid || Boolean(error)}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                />
              )}
            </Field>

            {error && <Alert tone="error" title="Could not sign in">{error}</Alert>}

            <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
              Sign in
            </Button>
          </form>

          {demoAuth ? (
            <div className="mt-7 border border-warning/35 bg-warning-subtle px-4 py-3.5">
              <p className="text-label font-semibold uppercase tracking-[0.08em] text-warning">
                Demonstration accounts
              </p>
              <dl className="mt-2.5 space-y-1 font-mono text-data text-warning">
                {[
                  ['student@demo.local', 'ask about availability'],
                  ['faculty@demo.local', 'validation + privacy controls'],
                  ['guard@demo.local', 'presence logging'],
                  ['admin@demo.local', 'campus locations'],
                ].map(([addr, role]) => (
                  <div key={addr} className="flex flex-wrap gap-x-2">
                    <dt>{addr}</dt>
                    <dd className="opacity-70">· demo · {role}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-label leading-relaxed text-warning opacity-90">
                These exist only while the server runs in demonstration mode.
                Real accounts are provisioned by the researchers through Supabase.
              </p>
            </div>
          ) : (
            <p className="mt-7 border-t border-line pt-5 text-label leading-relaxed text-fg-subtle">
              Accounts are issued by the researchers. There is no self-registration
              for this portal.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
