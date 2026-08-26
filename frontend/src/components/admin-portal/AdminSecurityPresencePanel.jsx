/**
 * Security Presence panel for the unified Admin Dashboard.
 * Admin has full access — can view the roster AND log arrival/departure events.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LogIn, LogOut, RefreshCw, Search, Users } from 'lucide-react';
import { api } from '../../frontend-utilities/backendApiClient.js';
import { Alert, Button, EmptyState, Input, SkeletonRows } from '../ui-primitives/index.js';

const STATE_UI = {
  confirmed_on_campus: { label: 'On campus', cls: 'text-success', dot: 'bg-success' },
  confirmed_off_campus: { label: 'Departed', cls: 'text-fg-muted', dot: 'bg-fg-subtle' },
  unknown: { label: 'No log today', cls: 'text-warning', dot: 'bg-warning' },
};

export default function AdminSecurityPresencePanel({ session }) {
  const [roster, setRoster] = useState([]);
  const [query, setQuery] = useState('');
  const [dept, setDept] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [justLogged, setJustLogged] = useState(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true); setError(null);
    try {
      const d = await api.guardRoster(session.access_token);
      setRoster(d.roster ?? []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  async function logEvent(facultyId, eventType, name) {
    setBusyId(facultyId); setError(null); setConfirming(null);
    try {
      await api.guardLog(session.access_token, { facultyId, eventType });
      setToast(`${name} recorded as ${eventType === 'arrival' ? 'on campus' : 'departed'}.`);
      setTimeout(() => setToast(null), 4000);
      await load();
      setJustLogged(facultyId);
      setTimeout(() => setJustLogged(null), 1000);
    } catch (err) { setError(err.message); }
    finally { setBusyId(null); }
  }

  const departments = useMemo(
    () => ['all', ...new Set(roster.map((r) => r.department).filter(Boolean))],
    [roster],
  );

  const shown = useMemo(() => roster.filter(
    (r) => (dept === 'all' || r.department === dept)
      && r.name.toLowerCase().includes(query.trim().toLowerCase()),
  ), [roster, query, dept]);

  const stats = useMemo(() => ({
    total: roster.length,
    logged: roster.filter((r) => r.presenceState !== 'unknown').length,
    onCampus: roster.filter((r) => r.presenceState === 'confirmed_on_campus').length,
  }), [roster]);

  return (
    <div>
      {/* Stats */}
      <dl className="mb-8 grid gap-px border-y border-line sm:grid-cols-3">
        {[
          ['Consented faculty', stats.total],
          ['Logged today', `${stats.logged} of ${stats.total}`],
          ['Currently on campus', stats.onCampus],
        ].map(([label, value]) => (
          <div key={label} className="py-5 sm:pr-8">
            <dt className="eyebrow">{label}</dt>
            <dd className="mt-1.5 font-serif text-h2 text-fg" data-numeric>{value}</dd>
          </div>
        ))}
      </dl>

      {/* Search, filters and refresh */}
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <Input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search faculty" aria-label="Search faculty" className="pl-8"
          />
        </div>
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={load} disabled={loading}>
          Refresh
        </Button>
        {departments.length > 2 && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <span className="eyebrow">Department</span>
            {departments.map((d) => (
              <button
                key={d} type="button" onClick={() => setDept(d)} aria-pressed={dept === d}
                className={`text-meta underline-offset-[6px] transition-colors duration-state ${dept === d ? 'text-fg underline decoration-accent decoration-2' : 'text-fg-muted hover:text-fg'}`}
              >
                {d === 'all' ? 'All' : d}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <Alert tone="error" title="Could not complete that action" className="mt-6">{error}</Alert>}
      {toast && <Alert tone="success" className="mt-6">{toast}</Alert>}

      {loading && roster.length === 0 && (
        <div className="mt-6 border-t border-line"><SkeletonRows rows={5} /></div>
      )}

      {shown.length > 0 && (
        <ul className="mt-6 border-t border-line">
          {shown.map((r) => {
            const ui = STATE_UI[r.presenceState] ?? STATE_UI.unknown;
            const busy = busyId === r.facultyId;
            const isConfirming = confirming === r.facultyId;
            return (
              <li
                key={r.facultyId}
                className={`border-b border-line py-3.5 ${justLogged === r.facultyId ? 'row-enter' : ''}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                  <div className="min-w-0">
                    <p className="text-body font-medium text-fg">{r.name}</p>
                    <p className="mt-0.5 text-label text-fg-subtle">{r.department ?? '—'}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <span
                      className={`inline-flex items-center gap-2 text-meta ${ui.cls}`}
                      style={{ transition: 'color var(--dur-menu) var(--ease-in)' }}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-pill ${ui.dot}`}
                        style={{ transition: 'background-color var(--dur-menu) var(--ease-in)' }}
                        aria-hidden
                      />
                      {ui.label}
                      {r.lastEventAt && (
                        <time className="font-mono text-data opacity-70" data-numeric>
                          {new Date(r.lastEventAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </time>
                      )}
                    </span>

                    {isConfirming ? (
                      <span className="flex items-center gap-2">
                        <span className="text-label text-fg-muted">Record departure?</span>
                        <Button variant="destructive" size="sm" loading={busy}
                                onClick={() => logEvent(r.facultyId, 'departure', r.name)}>
                          Confirm
                        </Button>
                        <Button variant="text" size="sm" onClick={() => setConfirming(null)}>
                          Cancel
                        </Button>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Button variant="secondary" size="sm" icon={LogIn} disabled={busy}
                                loading={busy && !isConfirming}
                                onClick={() => logEvent(r.facultyId, 'arrival', r.name)}>
                          Arrival
                        </Button>
                        <Button variant="text" size="sm" icon={LogOut} disabled={busy}
                                onClick={() => setConfirming(r.facultyId)}>
                          Departure
                        </Button>
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && shown.length === 0 && (
        <EmptyState icon={Users} title={roster.length === 0 ? 'No consented faculty on the roster' : 'No faculty match that search'} className="mt-6">
          {roster.length === 0
            ? 'Only faculty who have given written informed consent appear here.'
            : 'Try a different name, or clear the department filter.'}
        </EmptyState>
      )}

      <div className="mt-10 border-t border-line pt-5">
        <h2 className="text-meta font-semibold text-fg">Why &ldquo;No log today&rdquo; is its own state</h2>
        <p className="mt-2 max-w-measure text-meta leading-relaxed text-fg-muted">
          A faculty member with no entry has not been observed either way &mdash;
          that is different from having been observed leaving. Only a recorded
          <em> departure</em> makes the assistant report Unavailable directly.
          Without a log, the estimate comes from the classifier, as designed.
        </p>
      </div>
    </div>
  );
}
