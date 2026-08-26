import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, ClipboardCheck, RefreshCw } from 'lucide-react';
import { api } from '../../frontend-utilities/backendApiClient.js';
import { currentSession, signOut } from '../../frontend-utilities/supabaseClient.js';
import PortalShell, { SignOutButton } from '../layout-patterns/PortalLayoutFrame.jsx';
import PortalLogin from '../shared-components/UserRoleLoginModal.jsx';
import FacultyPrivacyToggleCard from './FacultyPrivacyToggleCard.jsx';
import { Alert, Button, EmptyState, StatusIndicator, Textarea } from '../ui-primitives/index.js';

/**
 * Faculty functional validation (thesis §3.8.2, §3.9).
 *
 * THE ONE THING THIS SCREEN MUST MAKE OBVIOUS is the opposition between
 * WHAT THE SYSTEM ESTIMATED and WHAT ACTUALLY HAPPENED. They sit side by side,
 * joined by an arrow, in that reading order. Everything else is subordinate.
 *
 * "PARTIALLY CORRECT" (audit C15/F-08). §3.8.2 defines a three-level scale but
 * §3.9 asks for a confusion matrix, which needs (predicted, actual) pairs —
 * "partially correct" has no cell. It is captured, excluded from the matrix by
 * a generated column, and reported separately. Decided before validators
 * start, not after seeing the data.
 */
const CORRECTNESS = [
  ['correct', 'Correct', 'The estimate matched what was actually happening.'],
  ['partially_correct', 'Partially correct', 'Close, but not quite — recorded separately and excluded from the confusion matrix.'],
  ['incorrect', 'Incorrect', 'The estimate did not match.'],
];

const PAGE = 10;

export default function ValidationChecklist() {
  const [session, setSession] = useState(undefined);
  const [ctx, setCtx] = useState(null);
  const [entries, setEntries] = useState([]);
  const [actual, setActual] = useState('');
  const [correctness, setCorrectness] = useState('correct');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [page, setPage] = useState(0);
  const [priorIds, setPriorIds] = useState(null);

  useEffect(() => { currentSession().then((s) => setSession(s ?? null)); }, []);

  const refresh = useCallback(async () => {
    if (!session) return;
    setBusy(true); setMsg(null);
    try {
      const [c, e] = await Promise.all([
        api.validateContext(session.access_token),
        api.validateEntries(session.access_token),
      ]);
      setCtx(c); setEntries(e.entries ?? []); setActual('');
    } catch (err) { setMsg({ kind: 'error', text: err.message }); }
    finally { setBusy(false); }
  }, [session]);

  useEffect(() => { refresh(); }, [refresh]);

  async function submit(e) {
    e.preventDefault();
    if (!ctx?.systemStatus || !actual) return;
    setBusy(true);
    try {
      await api.validateSubmit(session.access_token, {
        systemStatus: ctx.systemStatus, actualStatus: actual, correctness,
        overrideApplied: ctx.overrideApplied, notes: notes || undefined,
      });
      setNotes('');
      setMsg({ kind: 'ok', text: 'Entry recorded. Thank you.' });
      // Capture the ids that existed before the refresh; whatever is not in
      // that set is the row just added, and it highlights once. Without this
      // the table silently grows by one and the submission has no visible
      // consequence.
      const before = new Set(entries.map((e) => e.id));
      await refresh();
      setPage(0);
      setPriorIds(before);
      setTimeout(() => setPriorIds(null), 1200);
    } catch (err) { setMsg({ kind: 'error', text: err.message }); }
    finally { setBusy(false); }
  }

  if (session === undefined) return null;
  if (!session) {
    return (
      <PortalLogin
        role="faculty"
        icon={ClipboardCheck}
        title="Faculty Portal"
        description="For faculty members taking part in the functional validation of ISU-GeoBot. Record whether the system's estimate matched your actual status, and control your own availability disclosure."
        onSession={setSession}
      />
    );
  }

  const correct = entries.filter((e) => e.correctness === 'correct').length;
  const partial = entries.filter((e) => e.correctness === 'partially_correct').length;
  const pages = Math.ceil(entries.length / PAGE);
  const visible = entries.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <PortalShell
      icon={ClipboardCheck}
      title="Faculty Portal"
      subtitle={ctx?.faculty?.name
        ? `Signed in as ${ctx.faculty.name}. Record an entry at different times of day and across different scenarios.`
        : 'Loading your record…'}
      actions={
        <>
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={refresh} disabled={busy}>
            Refresh
          </Button>
          <SignOutButton onSignOut={async () => { await signOut(); setSession(null); }} />
        </>
      }
    >
      {/* The opposition, stated structurally. */}
      <form onSubmit={submit}>
        <div className="grid items-start gap-6 border-y border-line py-8 lg:grid-cols-[1fr_auto_1fr] lg:gap-8">
          <section>
            <h2 className="eyebrow">What the system estimated</h2>
            {ctx?.systemStatus ? (
              <div className="mt-4">
                <StatusIndicator code={ctx.systemStatus} label={ctx.systemStatusLabel} asOf={ctx.estimatedAt} />

                {/* WHICH OF THE THREE OPTIONS THAT WORDING IS.
                    The label may be phrasing the canonical status rather than
                    naming it — "Teaching this period; not scheduled on this
                    campus" is how `unavailable_off_schedule` reads when the
                    class is on another campus. A validator choosing from the
                    three canonical options on the right could otherwise rate it
                    incorrect for not matching any of them, which would record a
                    disagreement about wording as a disagreement about fact.
                    Shown only when the two differ. */}
                {(() => {
                  const canonical = (ctx.statusOptions ?? [])
                    .find((o) => o.code === ctx.systemStatus)?.display_label;
                  if (!canonical || canonical === ctx.systemStatusLabel) return null;
                  return (
                    <p className="mt-3 text-label leading-relaxed text-fg-subtle">
                      Recorded as <strong className="font-medium text-fg-muted">{canonical}</strong>
                      {' '}&mdash; the wording above explains that status, it is not a
                      separate one.
                    </p>
                  );
                })()}

                {ctx.overrideApplied && (
                  <p className="mt-3 text-label leading-relaxed text-fg-subtle">
                    This came from a security presence log rather than the
                    classifier. It is recorded separately so it does not distort
                    the classifier&rsquo;s accuracy figures.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-4 border border-dashed border-line-strong px-4 py-6 text-center text-meta text-fg-subtle">
                No estimate available. The classifier may not be trained yet.
              </p>
            )}
          </section>

          <div className="hidden self-center text-fg-subtle lg:block" aria-hidden>
            <ArrowRight className="h-5 w-5" strokeWidth={1.5} />
          </div>

          <section>
            <h2 className="eyebrow">What actually happened</h2>
            <fieldset className="mt-4">
              <legend className="sr-only">Your actual status</legend>
              <div className="space-y-1.5">
                {(ctx?.statusOptions ?? []).map((o) => (
                  <label
                    key={o.code}
                    className={`flex cursor-pointer items-center gap-3 border px-3.5 py-2.5 text-meta transition-colors duration-state ${
                      actual === o.code
                        ? 'border-accent bg-accent-subtle text-fg'
                        : 'border-line text-fg-muted hover:border-line-strong'
                    }`}
                  >
                    <input
                      type="radio" name="actual" value={o.code}
                      checked={actual === o.code}
                      onChange={(e) => setActual(e.target.value)}
                      className="accent-accent"
                    />
                    {o.display_label}
                  </label>
                ))}
              </div>
            </fieldset>
          </section>
        </div>

        <div className="grid gap-8 py-8 lg:grid-cols-2">
          <fieldset>
            <legend className="eyebrow">Was the estimate correct?</legend>
            <div className="mt-3 space-y-1.5">
              {CORRECTNESS.map(([v, label, hint]) => (
                <label
                  key={v}
                  className={`flex cursor-pointer items-start gap-3 border px-3.5 py-2.5 transition-colors duration-state ${
                    correctness === v ? 'border-accent bg-accent-subtle' : 'border-line hover:border-line-strong'
                  }`}
                >
                  <input
                    type="radio" name="correctness" value={v}
                    checked={correctness === v}
                    onChange={(e) => setCorrectness(e.target.value)}
                    className="mt-0.5 accent-accent"
                  />
                  <span>
                    <span className="block text-meta font-medium text-fg">{label}</span>
                    <span className="mt-0.5 block text-label leading-relaxed text-fg-subtle">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col">
            <label htmlFor="v-notes" className="eyebrow">Notes (optional)</label>
            <Textarea
              id="v-notes" rows={4} maxLength={500} value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. meeting ran over, class was moved"
              className="mt-3"
            />
            <Button
              type="submit" variant="primary" size="lg" loading={busy}
              disabled={!actual || !ctx?.systemStatus} className="mt-4"
            >
              Record entry
            </Button>
            {msg && (
              <Alert tone={msg.kind === 'ok' ? 'success' : 'error'} className="mt-4">
                {msg.text}
              </Alert>
            )}
          </div>
        </div>
      </form>

      <FacultyPrivacyToggleCard token={session.access_token} />

      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-3">
          <h2 className="font-serif text-h3 text-fg">Your entries</h2>
          <p className="text-label text-fg-subtle" data-numeric>
            {entries.length} recorded · {correct} correct · {partial} partial
          </p>
        </div>

        {entries.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="No entries yet" className="mt-6">
            Record your first entry above. Accuracy, per-category precision and
            recall, and the confusion matrix are computed from the complete
            validation dataset once the evaluation period ends.
          </EmptyState>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left">
                <thead>
                  <tr className="table-head">
                    <th scope="col" className="py-2.5 pr-4 font-medium">Time</th>
                    <th scope="col" className="py-2.5 pr-4 font-medium">Estimated</th>
                    <th scope="col" className="py-2.5 pr-4 font-medium">Actual</th>
                    <th scope="col" className="py-2.5 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((e) => (
                    <tr
                      key={e.id}
                      className={`table-row ${
                        priorIds && !priorIds.has(e.id) ? 'row-enter' : ''
                      }`}
                    >
                      <td className="py-3 pr-4 font-mono text-data text-fg-subtle" data-numeric>
                        {new Date(e.queried_at).toLocaleString([], {
                          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusIndicator code={e.system_status} variant="inline" />
                      </td>
                      <td className="py-3 pr-4">
                        <StatusIndicator code={e.actual_status} variant="inline" />
                      </td>
                      <td className="py-3 text-meta">
                        <span className={
                          e.correctness === 'correct' ? 'text-success'
                          : e.correctness === 'incorrect' ? 'text-error' : 'text-warning'
                        }>
                          {e.correctness.replace('_', ' ')}
                        </span>
                        {!e.include_in_matrix && (
                          <span
                            className="ml-2 text-label text-fg-subtle"
                            title="Excluded from the confusion matrix: a three-level scale has no cell for a partial match."
                          >
                            excl. matrix
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <Button variant="text" size="sm" disabled={page === 0}
                        onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <span className="text-label text-fg-subtle" data-numeric>
                  Page {page + 1} of {pages}
                </span>
                <Button variant="text" size="sm" disabled={page >= pages - 1}
                        onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            )}
          </>
        )}

        <p className="mt-6 max-w-measure text-label leading-relaxed text-fg-subtle">
          No accuracy figure is shown here, because a partial count is not a
          result. Accuracy, per-category precision and recall, and the confusion
          matrix are computed from the complete validation dataset once the
          evaluation period ends.
        </p>
      </section>
    </PortalShell>
  );
}
