/**
 * Faculty Validation panel for the unified Admin Dashboard.
 *
 * Enables administrators and researchers to select any faculty member,
 * view the system's live real-time estimate for them, and record observed
 * ground-truth validation entries.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, RefreshCw, UserCheck, Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { api } from '../../frontend-utilities/backendApiClient.js';
import { Alert, Button, EmptyState, Field, Select, SkeletonRows, StatusIndicator, Textarea } from '../ui-primitives/index.js';

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
  const [facultyList, setFacultyList] = useState([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [facultyLoading, setFacultyLoading] = useState(false);
  const [estimateCtx, setEstimateCtx] = useState(null);
  const [ctxLoading, setCtxLoading] = useState(false);

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

  // 1. Load Faculty Roster
  const loadRoster = useCallback(async () => {
    if (!session) return;
    setFacultyLoading(true);
    try {
      const res = await api.guardRoster(session.access_token);
      const list = res.roster ?? [];
      setFacultyList(list);
      if (list.length > 0 && !selectedFacultyId) {
        setSelectedFacultyId(list[0].facultyId);
      }
    } catch {
      // ignore
    } finally {
      setFacultyLoading(false);
    }
  }, [session, selectedFacultyId]);

  // 2. Load Validation Entries
  const loadEntries = useCallback(async () => {
    if (!session) return;
    setLoading(true); setError(null);
    try {
      const e = await api.validateEntries(session.access_token);
      setEntries(e.entries ?? []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [session]);

  // 3. Load Real-Time Estimate for Selected Faculty
  const loadEstimate = useCallback(async (fId) => {
    if (!session || !fId) return;
    setCtxLoading(true);
    try {
      const ctx = await api.validateContext(session.access_token, fId);
      setEstimateCtx(ctx);
      if (ctx?.systemStatus) {
        setSystemStatus(ctx.systemStatus);
        setActualStatus(ctx.systemStatus);
      }
    } catch {
      setEstimateCtx(null);
    } finally {
      setCtxLoading(false);
    }
  }, [session]);

  useEffect(() => {
    loadRoster();
    loadEntries();
  }, [loadRoster, loadEntries]);

  useEffect(() => {
    if (selectedFacultyId) {
      loadEstimate(selectedFacultyId);
    }
  }, [selectedFacultyId, loadEstimate]);

  async function submit(e) {
    e.preventDefault();
    if (!selectedFacultyId) return;
    setBusy(true); setMsg(null);
    try {
      await api.validateSubmit(session.access_token, {
        facultyId: selectedFacultyId,
        systemStatus,
        actualStatus,
        correctness,
        overrideApplied: estimateCtx?.overrideApplied ?? false,
        notes: notes || undefined,
      });
      setMsg({ kind: 'ok', text: 'Validation entry recorded successfully.' });
      setNotes('');
      await loadEntries();
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

  const selectedFacultyObj = facultyList.find((f) => f.facultyId === selectedFacultyId);

  return (
    <div>
      {/* Submit form */}
      <form onSubmit={submit} className="mb-10 rounded-lg border border-line bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-line pb-4">
          <div>
            <h2 className="font-serif text-h3 text-fg">Record a validation spot-check</h2>
            <p className="text-meta text-fg-muted mt-1">
              Select a faculty member to auto-fetch the AI&rsquo;s real-time estimate, then record what was observed in reality.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() => {
              if (selectedFacultyId) loadEstimate(selectedFacultyId);
            }}
            disabled={ctxLoading}
          >
            {ctxLoading ? 'Checking…' : 'Refresh estimate'}
          </Button>
        </div>

        {/* 1. Select Faculty Member */}
        <div className="mb-6 max-w-xl">
          <Field label="Faculty Member to Validate" required>
            {({ id }) => (
              <Select
                id={id}
                value={selectedFacultyId}
                onChange={(e) => setSelectedFacultyId(e.target.value)}
                disabled={facultyLoading || facultyList.length === 0}
              >
                {facultyList.map((f) => (
                  <option key={f.facultyId} value={f.facultyId}>
                    {f.name} {f.department ? `(${f.department})` : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        {/* 2. Side-by-side comparison */}
        <div className="grid gap-6 items-start rounded-lg border border-line-strong bg-bg-sunken p-5 sm:grid-cols-2">
          {/* System Estimate side */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-accent" aria-hidden />
              <p className="eyebrow !mb-0">What GeoBot estimated in real time</p>
            </div>

            {ctxLoading ? (
              <div className="flex items-center gap-2 py-4 text-meta text-fg-muted">
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
                <span>Querying availability classifier & presence logs…</span>
              </div>
            ) : estimateCtx?.systemStatus ? (
              <div className="mt-2 space-y-2">
                <StatusIndicator
                  code={estimateCtx.systemStatus}
                  label={estimateCtx.systemStatusLabel}
                  asOf={estimateCtx.estimatedAt}
                />
                {estimateCtx.overrideApplied && (
                  <p className="text-label text-accent font-medium">
                    🛡️ Sourced from security gate presence log
                  </p>
                )}
                <div className="pt-2">
                  <Field label="Recorded system code">
                    {({ id }) => (
                      <Select id={id} value={systemStatus} onChange={(e) => setSystemStatus(e.target.value)}>
                        {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </Select>
                    )}
                  </Field>
                </div>
              </div>
            ) : (
              <div className="mt-2">
                <Field label="System estimate">
                  {({ id }) => (
                    <Select id={id} value={systemStatus} onChange={(e) => setSystemStatus(e.target.value)}>
                      {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </Select>
                  )}
                </Field>
              </div>
            )}
          </div>

          {/* Actual Observed side */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="h-4 w-4 text-emerald-500" aria-hidden />
              <p className="eyebrow !mb-0">What actually happened (Observed)</p>
            </div>

            <div className="mt-2">
              <Field label="Physically observed ground-truth" required>
                {({ id }) => (
                  <Select id={id} value={actualStatus} onChange={(e) => setActualStatus(e.target.value)}>
                    {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                )}
              </Field>
            </div>
          </div>
        </div>

        {/* 3. Correctness rating */}
        <fieldset className="mt-6">
          <legend className="eyebrow mb-3">Was the estimate correct?</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {CORRECTNESS.map(([v, label, hint]) => (
              <label
                key={v}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors duration-state ${
                  correctness === v ? 'border-accent bg-accent-subtle shadow-sm' : 'border-line hover:border-line-strong'
                }`}
              >
                <input
                  type="radio"
                  name="adm-correctness"
                  value={v}
                  checked={correctness === v}
                  onChange={(e) => setCorrectness(e.target.value)}
                  className="mt-0.5 accent-accent"
                />
                <span>
                  <span className="block text-meta font-medium text-fg">{label}</span>
                  <span className="mt-0.5 block text-label text-fg-subtle leading-relaxed">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* 4. Notes */}
        <div className="mt-6">
          <label htmlFor="adm-notes" className="eyebrow">Spot-check notes (optional)</label>
          <Textarea
            id="adm-notes"
            rows={2}
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Verified in Room 204; class was active. Or: teacher was in consultation office."
            className="mt-2"
          />
        </div>

        {/* Submit action */}
        <div className="mt-6 flex items-center gap-4">
          <Button type="submit" variant="primary" size="lg" loading={busy} disabled={!selectedFacultyId}>
            Record entry
          </Button>
          {msg && (
            <span className={msg.kind === 'ok' ? 'text-success text-meta font-medium' : 'text-error text-meta font-medium'}>
              {msg.text}
            </span>
          )}
        </div>
      </form>

      {/* Entries log */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-serif text-h3 text-fg">All validation entries</h2>
          <p className="text-label text-fg-muted mt-0.5">
            Historical ground-truth evaluation dataset for thesis confusion matrix and accuracy benchmarks.
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={loadEntries} disabled={loading}>
          Refresh
        </Button>
      </div>

      {entries.length > 0 && (
        <dl className="mb-6 grid gap-px border-y border-line sm:grid-cols-4">
          {[['Total Entries', entries.length], ['Correct', correct], ['Partially Correct', partial], ['Incorrect', incorrect]].map(([label, value]) => (
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
          Record your first spot-check entry using the form above.
        </EmptyState>
      )}

      {entries.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[42rem] text-left">
              <thead>
                <tr className="table-head bg-bg-sunken">
                  <th scope="col" className="py-2.5 px-4 font-medium">Time</th>
                  <th scope="col" className="py-2.5 px-4 font-medium">Faculty Member</th>
                  <th scope="col" className="py-2.5 px-4 font-medium">System estimated</th>
                  <th scope="col" className="py-2.5 px-4 font-medium">Actual observed</th>
                  <th scope="col" className="py-2.5 px-4 font-medium">Result</th>
                  <th scope="col" className="py-2.5 px-4 font-medium">Matrix</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((e) => {
                  const teacherName = e.faculty?.full_name
                    ?? facultyList.find((f) => f.facultyId === e.faculty_id)?.name
                    ?? (e.faculty_id ? `Faculty ${e.faculty_id}` : 'General Faculty');
                  return (
                    <tr key={e.id} className="table-row border-b border-line last:border-0 hover:bg-bg-sunken/50">
                      <td className="py-3 px-4 font-mono text-data text-fg-subtle" data-numeric>
                        {new Date(e.queried_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 text-meta font-medium text-fg">
                        {teacherName}
                      </td>
                      <td className="py-3 px-4 text-meta text-fg-muted">
                        <span className="inline-block rounded bg-surface px-2 py-0.5 border border-line">
                          {statusLabel(e.system_status)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-meta text-fg-muted">
                        <span className="inline-block rounded bg-surface px-2 py-0.5 border border-line">
                          {statusLabel(e.actual_status)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-meta">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            e.correctness === 'correct'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : e.correctness === 'incorrect'
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {e.correctness === 'correct' ? '✓ Correct' : e.correctness === 'incorrect' ? '✗ Incorrect' : '≈ Partial'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-label text-fg-subtle">
                        {e.include_in_matrix === false ? (
                          <span className="text-fg-subtle opacity-70">Excluded</span>
                        ) : (
                          <span className="text-accent font-medium">Included</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <Button variant="text" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-label text-fg-subtle" data-numeric>
                Page {page + 1} of {pages}
              </span>
              <Button variant="text" size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
