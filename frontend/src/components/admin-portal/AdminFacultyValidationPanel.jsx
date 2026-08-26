/**
 * Faculty Validation panel for the unified Admin Dashboard.
 * Admin has full access — can select any faculty member and submit validation entries on their behalf.
 * The admin picks a faculty member first, then the context (system estimate) is fetched for them.
 *
 * Note: validate/context uses req.user.facultyId to look up the estimate. Since admin has no
 * faculty_id, we show all validation entries by default, and also provide a direct submit form
 * where the admin can manually record a (systemStatus, actualStatus, correctness) triple.
 */
import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, RefreshCw } from 'lucide-react';
import { api } from '../../frontend-utilities/backendApiClient.js';
import { Alert, Button, EmptyState, Field, Select, SkeletonRows, Textarea } from '../ui-primitives/index.js';

const PAGE = 15;

const STATUS_OPTIONS = [
  ['available_consultation', 'Available for Consultation'],
  ['in_scheduled_class', 'In Scheduled Class'],
  ['unavailable_off_schedule', 'Unavailable / Off Schedule'],
];

const CORRECTNESS = [
  ['correct', 'Correct', 'The estimate matched what was actually happening.'],
  ['partially_correct', 'Partially correct', 'Close, but not quite — excluded from the confusion matrix.'],
  ['incorrect', 'Incorrect', 'The estimate did not match.'],
];

export default function AdminFacultyValidationPanel({ session }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);

  // Submit form state
  const [systemStatus, setSystemStatus] = useState('available_consultation');
  const [actualStatus, setActualStatus] = useState('available_consultation');
  const [correctness, setCorrectness] = useState('correct');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true); setError(null);
    try {
      const e = await api.validateEntries(session.access_token);
      setEntries(e.entries ?? []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await api.validateSubmit(session.access_token, {
        systemStatus, actualStatus, correctness,
        overrideApplied: false, notes: notes || undefined,
      });
      setMsg({ kind: 'ok', text: 'Validation entry recorded.' });
      setNotes('');
      await load();
      setPage(0);
    } catch (err) { setMsg({ kind: 'error', text: err.message }); }
    finally { setBusy(false); }
  }

  const pages = Math.ceil(entries.length / PAGE);
  const visible = entries.slice(page * PAGE, page * PAGE + PAGE);
  const correct = entries.filter((e) => e.correctness === 'correct').length;
  const partial = entries.filter((e) => e.correctness === 'partially_correct').length;
  const incorrect = entries.filter((e) => e.correctness === 'incorrect').length;

  const statusLabel = (code) => STATUS_OPTIONS.find(([v]) => v === code)?.[1] ?? code;

  return (
    <div>
      {/* Submit form */}
      <form onSubmit={submit} className="mb-10 rounded-lg border border-line bg-surface p-6">
        <h2 className="mb-5 font-serif text-h3 text-fg">Record a validation entry</h2>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="What the system estimated" required>
            {({ id }) => (
              <Select id={id} value={systemStatus} onChange={(e) => setSystemStatus(e.target.value)}>
                {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            )}
          </Field>
          <Field label="What actually happened" required>
            {({ id }) => (
              <Select id={id} value={actualStatus} onChange={(e) => setActualStatus(e.target.value)}>
                {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            )}
          </Field>
        </div>

        <fieldset className="mt-5">
          <legend className="eyebrow mb-3">Was the estimate correct?</legend>
          <div className="space-y-2">
            {CORRECTNESS.map(([v, label, hint]) => (
              <label
                key={v}
                className={`flex cursor-pointer items-start gap-3 border px-3.5 py-2.5 transition-colors duration-state ${correctness === v ? 'border-accent bg-accent-subtle' : 'border-line hover:border-line-strong'}`}
              >
                <input type="radio" name="adm-correctness" value={v}
                  checked={correctness === v} onChange={(e) => setCorrectness(e.target.value)}
                  className="mt-0.5 accent-accent" />
                <span>
                  <span className="block text-meta font-medium text-fg">{label}</span>
                  <span className="mt-0.5 block text-label text-fg-subtle">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-5">
          <label htmlFor="adm-notes" className="eyebrow">Notes (optional)</label>
          <Textarea id="adm-notes" rows={3} maxLength={500} value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. meeting ran over, class was moved" className="mt-2" />
        </div>

        <div className="mt-5 flex items-center gap-4">
          <Button type="submit" variant="primary" size="lg" loading={busy}>
            Record entry
          </Button>
          {msg && (
            <span className={msg.kind === 'ok' ? 'text-success text-meta' : 'text-error text-meta'}>
              {msg.text}
            </span>
          )}
        </div>
      </form>

      {/* Entries log */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-h3 text-fg">All validation entries</h2>
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

      {entries.length > 0 && (
        <dl className="mb-6 grid gap-px border-y border-line sm:grid-cols-4">
          {[['Total', entries.length], ['Correct', correct], ['Partial', partial], ['Incorrect', incorrect]].map(([label, value]) => (
            <div key={label} className="py-4 sm:pr-6">
              <dt className="eyebrow">{label}</dt>
              <dd className="mt-1 font-serif text-h3 text-fg" data-numeric>{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {error && <Alert tone="error" title="Could not load entries" className="mb-4">{error}</Alert>}
      {loading && entries.length === 0 && <div className="border-t border-line"><SkeletonRows rows={8} /></div>}

      {!loading && entries.length === 0 && !error && (
        <EmptyState icon={ClipboardCheck} title="No validation entries yet" className="mt-6">
          Record your first entry using the form above.
        </EmptyState>
      )}

      {entries.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[38rem] text-left">
              <thead>
                <tr className="table-head">
                  <th scope="col" className="py-2.5 pr-4 font-medium">Time</th>
                  <th scope="col" className="py-2.5 pr-4 font-medium">System estimated</th>
                  <th scope="col" className="py-2.5 pr-4 font-medium">Actual</th>
                  <th scope="col" className="py-2.5 pr-4 font-medium">Result</th>
                  <th scope="col" className="py-2.5 font-medium">Matrix</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((e) => (
                  <tr key={e.id} className="table-row">
                    <td className="py-3 pr-4 font-mono text-data text-fg-subtle" data-numeric>
                      {new Date(e.queried_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </td>
                    <td className="py-3 pr-4 text-meta text-fg-muted">{statusLabel(e.system_status)}</td>
                    <td className="py-3 pr-4 text-meta text-fg-muted">{statusLabel(e.actual_status)}</td>
                    <td className="py-3 pr-4 text-meta">
                      <span className={e.correctness === 'correct' ? 'text-success' : e.correctness === 'incorrect' ? 'text-error' : 'text-warning'}>
                        {e.correctness.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 text-label text-fg-subtle">
                      {e.include_in_matrix === false ? 'excluded' : 'included'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <Button variant="text" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="text-label text-fg-subtle" data-numeric>Page {page + 1} of {pages}</span>
              <Button variant="text" size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
