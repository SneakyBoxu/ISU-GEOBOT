/**
 * Faculty Validation panel for the unified Admin Dashboard.
 *
 * Enables administrators and researchers to select any faculty member,
 * view the system's live real-time estimate for them, and record observed
 * ground-truth validation entries.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClipboardCheck, RefreshCw, UserCheck, Sparkles, Loader2, ArrowRight,
  Search, X, User, Check, Wifi, WifiOff, UploadCloud, Download, Database,
  AlertCircle, FileDown, ShieldCheck
} from 'lucide-react';
import { api } from '../../frontend-utilities/backendApiClient.js';
import { Alert, Button, EmptyState, Field, Input, Select, SkeletonRows, StatusIndicator, Textarea } from '../ui-primitives/index.js';
import {
  getPendingEntries,
  savePendingEntry,
  removePendingEntries,
  exportPendingEntriesAsJson,
  exportPendingEntriesAsCsv,
  getOfflineSnapshotMeta,
  saveOfflineSnapshotMeta,
} from '../../frontend-utilities/offlineValidationQueue.js';

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

  // Offline Mode & Sync states
  const [offlineMode, setOfflineMode] = useState(false);
  const [pendingEntries, setPendingEntries] = useState(() => getPendingEntries());
  const [syncing, setSyncing] = useState(false);
  const [preloading, setPreloading] = useState(false);
  const [snapshotMeta, setSnapshotMeta] = useState(() => getOfflineSnapshotMeta());
  const [syncMsg, setSyncMsg] = useState(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');

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

  // Listen to queue changes across tabs/components
  useEffect(() => {
    const handleQueueChange = (e) => {
      setPendingEntries(e.detail || getPendingEntries());
    };
    window.addEventListener('geobot-offline-queue-changed', handleQueueChange);
    return () => window.removeEventListener('geobot-offline-queue-changed', handleQueueChange);
  }, []);

  const departments = useMemo(() => {
    return ['all', ...new Set(facultyList.map((f) => f.department).filter(Boolean))];
  }, [facultyList]);

  const filteredFaculty = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return facultyList.filter((f) => {
      const matchDept = deptFilter === 'all' || f.department === deptFilter;
      const matchQuery =
        !q ||
        f.name.toLowerCase().includes(q) ||
        (f.department && f.department.toLowerCase().includes(q));
      return matchDept && matchQuery;
    });
  }, [facultyList, searchQuery, deptFilter]);

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
    } catch (err) {
      console.warn('Could not fetch online roster; checking fallback', err);
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
    } catch (err) {
      if (!offlineMode) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session, offlineMode]);

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
    } catch (err) {
      console.warn('Could not load estimate context', err);
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

  // Preload Snapshot Action
  const handlePreloadSnapshot = async () => {
    if (!session) return;
    setPreloading(true);
    setSyncMsg(null);
    try {
      const res = await api.validatePreload(session.access_token);
      const meta = {
        cachedAt: res.cachedAt || new Date().toISOString(),
        facultyCount: res.facultyCount || 0,
        scheduleCount: res.scheduleCount || 0,
      };
      saveOfflineSnapshotMeta(meta);
      setSnapshotMeta(meta);
      setSyncMsg({ kind: 'ok', text: `Offline snapshot ready (${res.facultyCount} faculty, ${res.scheduleCount} schedules cached).` });
      await loadRoster();
    } catch (err) {
      setSyncMsg({ kind: 'error', text: `Preload failed: ${err.message}` });
    } finally {
      setPreloading(false);
    }
  };

  // Manual Batch Sync Action
  const handleManualSync = async () => {
    if (!session || pendingEntries.length === 0) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await api.validateBatchSync(session.access_token, pendingEntries);
      const syncedIds = pendingEntries.map((e) => e.clientTempId);
      removePendingEntries(syncedIds);
      setPendingEntries(getPendingEntries());
      setSyncMsg({ kind: 'ok', text: `Successfully synced ${res.syncedCount || pendingEntries.length} entries to Supabase!` });
      await loadEntries();
    } catch (err) {
      setSyncMsg({ kind: 'error', text: `Sync failed: ${err.message}. Entries remain safely in local storage.` });
    } finally {
      setSyncing(false);
    }
  };

  async function submit(e) {
    e.preventDefault();
    if (!selectedFacultyId) return;
    setBusy(true); setMsg(null);

    const facultyObj = facultyList.find((f) => f.facultyId === selectedFacultyId);

    // If explicit Offline Mode is enabled
    if (offlineMode) {
      try {
        savePendingEntry({
          facultyId: selectedFacultyId,
          facultyName: facultyObj?.name || 'Selected Faculty',
          systemStatus,
          actualStatus,
          correctness,
          overrideApplied: estimateCtx?.overrideApplied ?? false,
          notes: notes || undefined,
          queriedAt: new Date().toISOString(),
        });
        setPendingEntries(getPendingEntries());
        setMsg({ kind: 'ok', text: '📦 Recorded to local offline queue (Pending sync).' });
        setNotes('');
      } catch (err) {
        setMsg({ kind: 'error', text: err.message });
      } finally {
        setBusy(false);
      }
      return;
    }

    // Otherwise attempt normal online submission with fallback
    try {
      await api.validateSubmit(session.access_token, {
        facultyId: selectedFacultyId,
        systemStatus,
        actualStatus,
        correctness,
        overrideApplied: estimateCtx?.overrideApplied ?? false,
        notes: notes || undefined,
      });
      setMsg({ kind: 'ok', text: 'Validation entry recorded successfully to database.' });
      setNotes('');
      await loadEntries();
      setPage(0);
    } catch (err) {
      // Auto-fallback if network error
      console.warn('Online submit failed, saving to offline queue:', err.message);
      try {
        savePendingEntry({
          facultyId: selectedFacultyId,
          facultyName: facultyObj?.name || 'Selected Faculty',
          systemStatus,
          actualStatus,
          correctness,
          overrideApplied: estimateCtx?.overrideApplied ?? false,
          notes: notes || undefined,
          queriedAt: new Date().toISOString(),
        });
        setPendingEntries(getPendingEntries());
        setMsg({ kind: 'ok', text: '📦 Server offline: Saved to local queue (Pending sync).' });
        setNotes('');
      } catch (saveErr) {
        setMsg({ kind: 'error', text: `Failed: ${err.message}` });
      }
    } finally {
      setBusy(false);
    }
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
      {/* Offline Mode & Sync Control Banner */}
      <div className={`mb-6 rounded-lg border p-4 transition-all duration-300 ${
        offlineMode
          ? 'border-amber-500/40 bg-amber-500/10 text-fg'
          : 'border-line bg-surface'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              offlineMode ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/15 text-emerald-500'
            }`}>
              {offlineMode ? <WifiOff className="h-5 w-5" /> : <Wifi className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-body font-semibold text-fg">
                  {offlineMode ? 'Offline Mode Active' : 'Online Cloud Mode'}
                </span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  offlineMode
                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                    : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${offlineMode ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  {offlineMode ? 'Local ML Model & Queue' : 'Live Supabase Connection'}
                </span>
              </div>
              <p className="text-meta text-fg-muted mt-0.5">
                {offlineMode
                  ? 'Estimates run via local Python Random Forest. Validation entries are stored safely in local storage.'
                  : 'Predictions query live presence & schedule services. Entries sync directly to database.'}
                {snapshotMeta?.cachedAt && (
                  <span className="ml-2 opacity-80">
                    • Snapshot: {new Date(snapshotMeta.cachedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} ({snapshotMeta.facultyCount ?? 37} faculty)
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Mode Switch Button */}
            <Button
              type="button"
              variant={offlineMode ? 'secondary' : 'outline'}
              size="sm"
              icon={offlineMode ? Wifi : WifiOff}
              onClick={() => setOfflineMode((prev) => !prev)}
            >
              {offlineMode ? 'Switch to Online' : 'Force Offline Mode'}
            </Button>

            {/* Preload Snapshot Button */}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={Download}
              loading={preloading}
              onClick={handlePreloadSnapshot}
              title="Cache faculty roster and schedules to disk for offline evaluation"
            >
              Preload for Offline
            </Button>

            {/* Manual Sync Button */}
            <Button
              type="button"
              variant={pendingEntries.length > 0 ? 'primary' : 'secondary'}
              size="sm"
              icon={UploadCloud}
              loading={syncing}
              disabled={pendingEntries.length === 0 || syncing}
              onClick={handleManualSync}
            >
              Sync to Cloud ({pendingEntries.length})
            </Button>

            {/* Export Backup Dropdown / Action */}
            {pendingEntries.length > 0 && (
              <div className="flex items-center gap-1 border-l border-line pl-2">
                <Button
                  type="button"
                  variant="text"
                  size="sm"
                  icon={FileDown}
                  onClick={() => exportPendingEntriesAsJson()}
                  title="Export offline entries as JSON backup"
                >
                  JSON
                </Button>
                <Button
                  type="button"
                  variant="text"
                  size="sm"
                  icon={FileDown}
                  onClick={() => exportPendingEntriesAsCsv()}
                  title="Export offline entries as CSV"
                >
                  CSV
                </Button>
              </div>
            )}
          </div>
        </div>

        {syncMsg && (
          <div className={`mt-3 flex items-center justify-between rounded p-2.5 text-meta ${
            syncMsg.kind === 'ok' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
          }`}>
            <span>{syncMsg.text}</span>
            <button type="button" onClick={() => setSyncMsg(null)} className="opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

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

        {/* 1. Searchable Faculty Selection */}
        <div className="mb-6 max-w-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <label className="text-label font-medium text-fg">
              Faculty Member to Validate <span className="text-accent">*</span>
            </label>
            <span className="text-caption text-fg-muted">
              {facultyList.length > 0 ? (
                <span>
                  Showing {filteredFaculty.length} of {facultyList.length} faculty
                </span>
              ) : facultyLoading ? (
                'Loading roster…'
              ) : null}
            </span>
          </div>

          {/* Search & Filter Row */}
          <div className="grid gap-2 sm:grid-cols-[1fr,auto] mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-muted pointer-events-none" />
              <Input
                type="text"
                placeholder="Search faculty by name or department…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-fg-muted hover:text-fg rounded transition-colors"
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {departments.length > 2 && (
              <div className="sm:w-48">
                <Select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="text-xs"
                >
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d === 'all' ? 'All Departments' : d}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          {/* Quick Match Chips / Filtered List when searching */}
          {searchQuery.trim() && filteredFaculty.length > 0 && (
            <div className="mb-3 max-h-48 overflow-y-auto rounded-lg border border-line-strong bg-bg-sunken p-2 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted px-2 py-1">
                Quick Select Matches ({filteredFaculty.length}):
              </p>
              {filteredFaculty.map((f) => {
                const isSelected = f.facultyId === selectedFacultyId;
                return (
                  <button
                    key={f.facultyId}
                    type="button"
                    onClick={() => {
                      setSelectedFacultyId(f.facultyId);
                    }}
                    className={`w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-md transition-all text-sm ${
                      isSelected
                        ? 'bg-accent/15 border border-accent/40 text-accent font-medium'
                        : 'bg-surface hover:bg-surface-elevated text-fg border border-line'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <User className={`h-4 w-4 shrink-0 ${isSelected ? 'text-accent' : 'text-fg-muted'}`} />
                      <div className="min-w-0">
                        <p className="truncate text-sm">{f.name}</p>
                        {f.department && (
                          <p className="truncate text-caption text-fg-muted">{f.department}</p>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-accent shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Standard Select Dropdown populated with filtered options */}
          <Select
            value={selectedFacultyId}
            onChange={(e) => setSelectedFacultyId(e.target.value)}
            disabled={facultyLoading || facultyList.length === 0}
          >
            {filteredFaculty.length === 0 ? (
              <option disabled value="">
                No faculty matching &ldquo;{searchQuery}&rdquo;
              </option>
            ) : (
              filteredFaculty.map((f) => (
                <option key={f.facultyId} value={f.facultyId}>
                  {f.name} {f.department ? `(${f.department})` : ''}
                </option>
              ))
            )}
          </Select>

          {/* Active selection summary badge */}
          {selectedFacultyObj && (
            <div className="mt-2 flex items-center justify-between text-caption text-fg-muted bg-surface-elevated px-3 py-1.5 rounded border border-line">
              <span className="truncate">
                Selected: <strong className="text-fg">{selectedFacultyObj.name}</strong>
                {selectedFacultyObj.department ? ` • ${selectedFacultyObj.department}` : ''}
              </span>
              {selectedFacultyObj.presenceState && (
                <span className="shrink-0 ml-2 inline-flex items-center gap-1.5 text-xs font-medium">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      selectedFacultyObj.presenceState === 'confirmed_on_campus'
                        ? 'bg-emerald-500'
                        : selectedFacultyObj.presenceState === 'confirmed_off_campus'
                        ? 'bg-fg-muted'
                        : 'bg-amber-500'
                    }`}
                  />
                  {selectedFacultyObj.presenceState === 'confirmed_on_campus'
                    ? 'On Campus'
                    : selectedFacultyObj.presenceState === 'confirmed_off_campus'
                    ? 'Departed'
                    : 'No Log Today'}
                </span>
              )}
            </div>
          )}
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
            {offlineMode ? 'Queue offline entry' : 'Record entry'}
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

      {/* Pending Unsynced Offline Queue Table (if any) */}
      {pendingEntries.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
              <h3 className="text-body font-semibold text-fg">
                Unsynced Offline Queue ({pendingEntries.length})
              </h3>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={UploadCloud}
              loading={syncing}
              onClick={handleManualSync}
            >
              Sync All Now
            </Button>
          </div>

          <div className="overflow-x-auto rounded border border-amber-500/20 bg-surface">
            <table className="w-full min-w-[36rem] text-left">
              <thead>
                <tr className="table-head bg-bg-sunken text-xs">
                  <th scope="col" className="py-2 px-3 font-medium">Captured Time</th>
                  <th scope="col" className="py-2 px-3 font-medium">Faculty</th>
                  <th scope="col" className="py-2 px-3 font-medium">Estimate</th>
                  <th scope="col" className="py-2 px-3 font-medium">Observed</th>
                  <th scope="col" className="py-2 px-3 font-medium">Result</th>
                  <th scope="col" className="py-2 px-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {pendingEntries.map((pe) => (
                  <tr key={pe.clientTempId} className="border-b border-line last:border-0 text-xs">
                    <td className="py-2 px-3 font-mono text-fg-subtle">
                      {new Date(pe.queriedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </td>
                    <td className="py-2 px-3 font-medium text-fg">{pe.facultyName}</td>
                    <td className="py-2 px-3 text-fg-muted">{statusLabel(pe.systemStatus)}</td>
                    <td className="py-2 px-3 text-fg-muted">{statusLabel(pe.actualStatus)}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        pe.correctness === 'correct' ? 'bg-emerald-500/10 text-emerald-600' : pe.correctness === 'incorrect' ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600'
                      }`}>
                        {pe.correctness === 'correct' ? '✓ Correct' : pe.correctness === 'incorrect' ? '✗ Incorrect' : '≈ Partial'}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                        📦 Pending Sync
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {entries.length > 0 && (
        <dl className="mb-6 grid gap-px border-y border-line sm:grid-cols-4">
          {[['Total Cloud Entries', entries.length], ['Correct', correct], ['Partially Correct', partial], ['Incorrect', incorrect]].map(([label, value]) => (
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
