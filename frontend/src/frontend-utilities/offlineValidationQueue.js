/**
 * Offline Validation Queue Utility.
 *
 * Manages locally queued spot-check validation entries in localStorage
 * when conducting research validation without an internet connection.
 */

const STORAGE_KEY = 'geobot_offline_validation_queue_v1';
const PRELOAD_KEY = 'geobot_offline_snapshot_meta_v1';

export function getPendingEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Could not read offline validation queue from localStorage:', err);
    return [];
  }
}

export function savePendingEntry(entry) {
  try {
    const queue = getPendingEntries();
    const newEntry = {
      ...entry,
      clientTempId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      queriedAt: entry.queriedAt || new Date().toISOString(),
      status: 'pending_sync',
    };
    queue.unshift(newEntry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent('geobot-offline-queue-changed', { detail: queue }));
    return newEntry;
  } catch (err) {
    console.error('Could not save entry to offline validation queue:', err);
    throw new Error('Failed to save to local offline queue: ' + err.message);
  }
}

export function removePendingEntries(idsToRemove) {
  try {
    const idSet = new Set(idsToRemove);
    const queue = getPendingEntries().filter((e) => !idSet.has(e.clientTempId) && !idSet.has(e.id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent('geobot-offline-queue-changed', { detail: queue }));
    return queue;
  } catch (err) {
    console.error('Could not update offline validation queue:', err);
    return getPendingEntries();
  }
}

export function clearPendingEntries() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('geobot-offline-queue-changed', { detail: [] }));
  } catch (err) {
    console.error('Could not clear offline validation queue:', err);
  }
}

export function getOfflineSnapshotMeta() {
  try {
    const raw = localStorage.getItem(PRELOAD_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveOfflineSnapshotMeta(meta) {
  try {
    localStorage.setItem(PRELOAD_KEY, JSON.stringify(meta));
  } catch {
    // ignore
  }
}

export function exportPendingEntriesAsJson() {
  const entries = getPendingEntries();
  if (entries.length === 0) return false;
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `geobot_offline_validations_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

export function exportPendingEntriesAsCsv() {
  const entries = getPendingEntries();
  if (entries.length === 0) return false;

  const headers = ['Queried At', 'Faculty Name', 'Faculty ID', 'System Estimate', 'Actual Observed', 'Correctness', 'Override Applied', 'Notes'];
  const rows = entries.map((e) => [
    `"${e.queriedAt || ''}"`,
    `"${(e.facultyName || '').replace(/"/g, '""')}"`,
    `"${e.facultyId || ''}"`,
    `"${e.systemStatus || ''}"`,
    `"${e.actualStatus || ''}"`,
    `"${e.correctness || ''}"`,
    `"${e.overrideApplied ? 'Yes' : 'No'}"`,
    `"${(e.notes || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `geobot_offline_validations_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}
