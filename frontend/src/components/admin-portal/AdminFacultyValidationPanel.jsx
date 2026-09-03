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
  AlertCircle, FileDown, ShieldCheck, Trash2
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
  getOfflineFacultyRoster,
  saveOfflineFacultyRoster,
  getOfflineCachedEntries,
  saveOfflineCachedEntries,
  getOfflineModeState,
  saveOfflineModeState,
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
  const [facultyList, setFacultyList] = useState(() => getOfflineFacultyRoster());
  const [selectedFacultyId, setSelectedFacultyId] = useState(() => {
    const cached = getOfflineFacultyRoster();
    return cached.length > 0 ? cached[0].facultyId : '';
  });
  const [facultyLoading, setFacultyLoading] = useState(false);
  const [estimateCtx, setEstimateCtx] = useState(null);
  const [ctxLoading, setCtxLoading] = useState(false);

  // Offline Mode & Sync states (persisted to localStorage)
  const [offlineMode, setOfflineMode] = useState(() => getOfflineModeState());
  const [pendingEntries, setPendingEntries] = useState(() => getPendingEntries());
  const [syncing, setSyncing] = useState(false);
  const [preloading, setPreloading] = useState(false);
  const [snapshotMeta, setSnapshotMeta] = useState(() => getOfflineSnapshotMeta());
  const [syncMsg, setSyncMsg] = useState(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');

  const [entries, setEntries] = useState(() => getOfflineCachedEntries());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);

  // Deletion state
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  // Submit form state
  const [systemStatus, setSystemStatus] = useState('available_consultation');
  // Deliberately empty. Migration 013: this field used to be seeded with the
  // system's own estimate, so a validator who saved without touching it
  // recorded agreement by default. It must be chosen, never inherited.
  const [actualStatus, setActualStatus] = useState('');
  const [correctness, setCorrectness] = useState('correct');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  // The estimate stays hidden until the validator has committed to what they
  // saw. Once committed, correctness follows from the two values rather than
  // from a third click that could also drift toward agreement -- the radios
  // stay editable because partially_correct is a judgement this cannot derive.
  const revealed = actualStatus !== '';

  const chooseObserved = (value) => {
    setActualStatus(value);
    if (value) setCorrectness(value === systemStatus ? 'correct' : 'incorrect');
  };

  const handleToggleOfflineMode = () => {
    setOfflineMode((prev) => {
      const nextMode = !prev;
      saveOfflineModeState(nextMode);
      return nextMode;
    });
  };

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

  // 1. Load Faculty Roster (with persistent offline fallback)
  const loadRoster = useCallback(async () => {
    if (!session) {
      const cached = getOfflineFacultyRoster();
      if (cached.length > 0) {
        setFacultyList(cached);
        if (!selectedFacultyId) setSelectedFacultyId(cached[0].facultyId);
      }
      return;
    }
    setFacultyLoading(true);
    try {
      const res = await api.guardRoster(session.access_token);
      const list = res.roster ?? [];
      if (list.length > 0) {
        setFacultyList(list);
        saveOfflineFacultyRoster(list);
        if (!selectedFacultyId) {
          setSelectedFacultyId(list[0].facultyId);
        }
      } else {
        const cached = getOfflineFacultyRoster();
        if (cached.length > 0) setFacultyList(cached);
      }
    } catch (err) {
      console.warn('Could not fetch online roster; loading cached offline roster', err);
      const cached = getOfflineFacultyRoster();
      if (cached.length > 0) {
        setFacultyList(cached);
        if (!selectedFacultyId) setSelectedFacultyId(cached[0].facultyId);
      }
    } finally {
      setFacultyLoading(false);
    }
  }, [session, selectedFacultyId]);

  // 2. Load Validation Entries (with persistent offline fallback)
  const loadEntries = useCallback(async () => {
    if (!session) {
      const cached = getOfflineCachedEntries();
      if (cached.length > 0) setEntries(cached);
      return;
    }
    setLoading(true); setError(null);
    try {
      const e = await api.validateEntries(session.access_token);
      const loaded = e.entries ?? [];
      setEntries(loaded);
      saveOfflineCachedEntries(loaded);
    } catch (err) {
      const cached = getOfflineCachedEntries();
      if (cached.length > 0) {
        setEntries(cached);
      }
      if (!offlineMode && cached.length === 0) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session, offlineMode]);

  // 3. Load Real-Time Estimate for Selected Faculty
  const loadEstimate = useCallback(async (fId) => {
    if (!fId) return;
    setCtxLoading(true);

    try {
      const ctx = await api.validateContext(session?.access_token, fId);
      setEstimateCtx(ctx);
      if (ctx?.systemStatus) {
        setSystemStatus(ctx.systemStatus);
        // The observed value is NOT seeded from the estimate -- see the
        // actualStatus declaration.
      }
    } catch (err) {
      console.warn('Could not load estimate context from server, using local fallback', err);
      const target = facultyList.find((f) => f.facultyId === fId);
      const offlineEst = {
        faculty: { id: fId, name: target?.name || 'Selected Faculty' },
        systemStatus: 'unavailable_off_schedule',
        systemStatusLabel: 'Unavailable / Off Schedule (Offline Fallback)',
        overrideApplied: false,
        statusSource: 'schedule_only',
        estimatedAt: new Date().toISOString(),
      };
      setEstimateCtx(offlineEst);
      setSystemStatus(offlineEst.systemStatus);
    } finally {
      setCtxLoading(false);
    }
  }, [session, facultyList]);

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

      if (Array.isArray(res.faculty) && res.faculty.length > 0) {
        const formattedRoster = res.faculty.map((f) => ({
          facultyId: f.id,
          name: f.full_name,
          department: f.department || 'General Faculty',
          presenceState: 'unknown',
        }));
        saveOfflineFacultyRoster(formattedRoster);
        setFacultyList(formattedRoster);
        if (!selectedFacultyId) setSelectedFacultyId(formattedRoster[0].facultyId);
      }

      setSyncMsg({ kind: 'ok', text: `Offline snapshot ready (${res.facultyCount} faculty, ${res.scheduleCount} schedules cached permanently in browser).` });
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

  // Delete individual cloud validation entry
  const handleDeleteCloudEntry = async (id) => {
    if (!session || !id) return;
    setDeletingId(id);
    setDeleteError(null);
    try {
      await api.validateDeleteEntry(session.access_token, id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      console.error('Delete validation entry failed:', err);
      setDeleteError(`Could not delete entry: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  // Delete individual pending offline entry
  const handleDeleteOfflineEntry = (clientTempId) => {
    removePendingEntries([clientTempId]);
    setPendingEntries(getPendingEntries());
  };

  async function submit(e) {
    e.preventDefault();
    if (!selectedFacultyId) return;
    // A silent no-op here would read as a broken button and invite a reload,
    // losing the observation the validator just walked across campus for.
    if (!actualStatus) {
      setMsg({ kind: 'error', text: 'Choose what you observed before saving.' });
      return;
    }
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
          statusSource: estimateCtx?.statusSource ?? null,
          collectionProtocol: 'observation_first',
          notes: notes || undefined,
          queriedAt: new Date().toISOString(),
        });
        setPendingEntries(getPendingEntries());
        setMsg({ kind: 'ok', text: '📦 Recorded to local offline queue (Pending sync).' });
        setNotes('');
      // Next entry starts blind: an inherited observation is the same
      // defect as an inherited default.
      setActualStatus('');
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
        statusSource: estimateCtx?.statusSource ?? null,
        collectionProtocol: 'observation_first',
        notes: notes || undefined,
      });
      setMsg({ kind: 'ok', text: 'Validation entry recorded successfully to database.' });
      setNotes('');
      // Next entry starts blind: an inherited observation is the same
      // defect as an inherited default.
      setActualStatus('');
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
          statusSource: estimateCtx?.statusSource ?? null,
          collectionProtocol: 'observation_first',
          notes: notes || undefined,
          queriedAt: new Date().toISOString(),
        });
        setPendingEntries(getPendingEntries());
        setMsg({ kind: 'ok', text: '📦 Server offline: Saved to local queue (Pending sync).' });
        setNotes('');
      // Next entry starts blind: an inherited observation is the same
      // defect as an inherited default.
      setActualStatus('');
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
              onClick={handleToggleOfflineMode}
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
              Select a faculty member to auto-fetch the system&rsquo;s current estimate, then record what was
              observed in reality. The badge below names which engine produced it &mdash; the estimate is not
              always the Random Forest.
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

            {!revealed ? (
              <div className="mt-2 rounded-md border border-dashed border-line-strong px-4 py-6 text-center">
                <p className="text-meta text-fg-muted">
                  Hidden until you record what you observed.
                </p>
                <p className="mt-1 text-label text-fg-subtle">
                  Go and look first, then choose on the right.
                </p>
              </div>
            ) : ctxLoading ? (
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
                {/*
                  Which engine answered is recorded on the row (migration 012).
                  Showing it here is not decoration: a validator judging a
                  timetable lookup while believing they are judging the model
                  produces a number that means neither.
                */}
                {estimateCtx.statusSource && (
                  <p className="text-label text-fg-muted">
                    {estimateCtx.statusSource === 'random_forest'
                      ? '🌲 Random Forest prediction (attendance history available)'
                      : estimateCtx.statusSource === 'schedule_only'
                        ? '📅 Timetable lookup — no attendance history, so the model was not used'
                        : '🛡️ Deterministic override — the model was not used'}
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
                  <Select id={id} value={actualStatus} onChange={(e) => chooseObserved(e.target.value)}>
                    <option value="" disabled>— choose what you observed —</option>
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
                  <th scope="col" className="py-2 px-3 font-medium text-right">Action</th>
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
                    <td className="py-2 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteOfflineEntry(pe.clientTempId)}
                        className="inline-flex items-center rounded p-1 text-fg-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                        title="Remove offline draft"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Remove</span>
                      </button>
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

      {deleteError && (
        <Alert tone="error" title="Could not remove entry" className="mb-4">
          <div className="flex items-center justify-between gap-2">
            <span>{deleteError}</span>
            <button type="button" onClick={() => setDeleteError(null)} className="text-xs underline hover:opacity-80">Dismiss</button>
          </div>
        </Alert>
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
                  <th scope="col" className="py-2.5 px-4 font-medium text-right">Action</th>
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
                      <td className="py-3 px-4 text-right">
                        {confirmDeleteId === e.id ? (
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <span className="text-xs text-rose-500 font-medium mr-0.5">Delete?</span>
                            <button
                              type="button"
                              disabled={deletingId === e.id}
                              onClick={() => handleDeleteCloudEntry(e.id)}
                              className="inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50"
                            >
                              {deletingId === e.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes'}
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === e.id}
                              onClick={() => setConfirmDeleteId(null)}
                              className="inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-medium border border-line bg-surface hover:bg-surface-elevated text-fg transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(e.id)}
                            title="Remove validation entry"
                            className="inline-flex items-center justify-center rounded p-1.5 text-fg-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Remove</span>
                          </button>
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
