/**
 * Campus Locations panel for the unified Admin Dashboard.
 * Accepts a `session` prop so no additional sign-in is needed.
 * Reuses the same UI logic as the standalone CampusLocationManager.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, EyeOff, List, Map as MapIcon, Plus, RefreshCw, RotateCcw, Save, Search, Trash2 } from 'lucide-react';
import { api } from '../../frontend-utilities/backendApiClient.js';
import EditorMap from './CampusMapEditor.jsx';
import { ICON_CHOICES } from '../main-assistant/mapMarkerGlyphs.js';
import {
  Alert, Button, EmptyState, Field, Input, Select, SkeletonRows, Textarea,
} from '../ui-primitives/index.js';

const POI_TYPES = [
  ['college', 'College / academic building'], ['administrative', 'Administrative office'],
  ['laboratory', 'Laboratory'], ['library', 'Library'],
  ['facility', 'Facility'], ['landmark', 'Landmark'],
  ['sports', 'Sports / recreation'], ['other', 'Other'],
];

const SURVEY_METHODS = [
  ['gps_survey', 'On-site GPS survey'],
  ['satellite_imagery', 'Traced from satellite imagery'],
  ['floor_plan', 'From a floor plan'],
  ['estimated', 'Estimated — not survey data'], ['unknown', 'Not recorded'],
];

const EMPTY = {
  name: '', poiType: 'college', lat: '', lng: '', buildingFunction: '',
  departmentId: '', description: '', icon: '', isFeatured: false,
  surveyMethod: 'gps_survey', dataOrigin: 'real', note: '',
};

export default function AdminCampusLocationsPanel({ session }) {
  const [pois, setPois] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState('map');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [p, d] = await Promise.all([
        api.adminPois(session.access_token),
        api.adminDepartments(session.access_token),
      ]);
      setPois(p.pois ?? []); setDepartments(d.departments ?? []);
    } catch (err) { setMsg({ kind: 'error', text: err.message }); }
    finally { setLoading(false); }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function startEdit(poi) {
    setEditingId(poi.id);
    setForm({
      name: poi.name, poiType: poi.poi_type, lat: String(poi.lat), lng: String(poi.lng),
      buildingFunction: poi.building_function ?? '', departmentId: poi.department_id ?? '',
      description: poi.description ?? '', icon: poi.icon ?? '',
      isFeatured: Boolean(poi.is_featured),
      surveyMethod: poi.survey_method ?? 'unknown', dataOrigin: poi.data_origin, note: '',
    });
  }

  const cancel = () => { setEditingId(null); setForm(EMPTY); setMsg(null); };

  const clearDraftPin = () => {
    setForm((f) => ({ ...f, lat: '', lng: '' }));
  };

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const payload = {
      name: form.name.trim(), poiType: form.poiType,
      lat: Number(form.lat), lng: Number(form.lng),
      buildingFunction: form.buildingFunction.trim() || null,
      departmentId: form.departmentId || null,
      description: form.description.trim() || null,
      icon: form.icon || null,
      isFeatured: form.isFeatured, surveyMethod: form.surveyMethod,
      dataOrigin: form.dataOrigin, note: form.note.trim() || undefined,
    };
    try {
      const res = editingId
        ? await api.adminUpdatePoi(session.access_token, editingId, payload)
        : await api.adminCreatePoi(session.access_token, payload);
      setMsg({ kind: 'ok', text: res.message ?? `Saved.${res.reindexed ? ` Place-card re-embedded (${res.indexed} chunk${res.indexed === 1 ? '' : 's'}).` : ''}` });
      cancel(); await load();
    } catch (err) { setMsg({ kind: 'error', text: err.message }); }
    finally { setBusy(false); }
  }

  async function removePoi(poi) {
    if (!window.confirm(`Unpublish "${poi.name}"?\n\nIt will be hidden from the public campus map and the assistant's answers. The record is kept and can be republished anytime.`)) return;
    setBusy(true); setMsg(null);
    try {
      await api.adminUnpublishPoi(session.access_token, poi.id, 'Unpublished via admin dashboard');
      setMsg({ kind: 'ok', text: `"${poi.name}" is no longer published.` });
      if (editingId === poi.id) cancel();
      await load();
    } catch (err) { setMsg({ kind: 'error', text: err.message }); }
    finally { setBusy(false); }
  }

  async function republishPoi(poi) {
    setBusy(true); setMsg(null);
    try {
      await api.adminRepublishPoi(session.access_token, poi.id, 'Republished via admin dashboard');
      setMsg({ kind: 'ok', text: `"${poi.name}" has been republished and re-embedded into the assistant.` });
      await load();
    } catch (err) { setMsg({ kind: 'error', text: err.message }); }
    finally { setBusy(false); }
  }

  async function deletePoiPermanently(poi) {
    if (!window.confirm(`Permanently delete "${poi.name}"?\n\nWARNING: This will permanently remove the marker, coordinates, and retrieval place card. This action cannot be undone.`)) return;
    setBusy(true); setMsg(null);
    try {
      await api.adminDeletePoi(session.access_token, poi.id, 'Deleted permanently via admin dashboard');
      setMsg({ kind: 'ok', text: `"${poi.name}" has been permanently deleted.` });
      if (editingId === poi.id) cancel();
      await load();
    } catch (err) { setMsg({ kind: 'error', text: err.message }); }
    finally { setBusy(false); }
  }

  const shown = useMemo(() => pois.filter(
    (p) => p.name.toLowerCase().includes(query.trim().toLowerCase()),
  ), [pois, query]);

  const placeholders = pois.filter((p) => p.data_origin === 'synthetic').length;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-meta text-fg-muted">
          {pois.length} location{pois.length !== 1 ? 's' : ''} on campus
        </p>
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

      {placeholders > 0 && (
        <Alert tone="warning" title={`${placeholders} placeholder location${placeholders === 1 ? '' : 's'}`} className="mb-6">
          These are marked <code className="font-mono">[DEMO]</code> wherever they appear,
          and the evaluation harness will refuse to run until every one is replaced.
        </Alert>
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,26rem)_1fr]">
        {/* Form */}
        <form onSubmit={submit}>
          <h2 className="flex items-center gap-2 border-b border-line pb-3 font-serif text-h3 text-fg">
            {editingId ? <><Save className="h-4 w-4 text-accent" aria-hidden /> Edit location</>
                       : <><Plus className="h-4 w-4 text-accent" aria-hidden /> Add a location</>}
          </h2>

          <PanelFieldset legend="Identity">
            <Field label="Building or office name" required>
              {({ id }) => (
                <Input id={id} required minLength={2} maxLength={160} value={form.name}
                       onChange={(e) => set('name', e.target.value)}
                       placeholder="Innovation and Research Center" />
              )}
            </Field>
            <Field label="Icon" hint="Optional. Leave unset to use the category icon.">
              {() => (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button" onClick={() => set('icon', '')} aria-pressed={!form.icon}
                    title="Use the category icon"
                    className={`grid h-9 w-9 place-items-center rounded-md border transition-colors duration-state ${!form.icon ? 'border-accent bg-accent-subtle text-accent' : 'border-line text-fg-subtle hover:border-line-strong hover:text-fg'}`}
                  >
                    <span aria-hidden className="text-label font-semibold">Aa</span>
                    <span className="sr-only">Use the category icon</span>
                  </button>
                  {ICON_CHOICES.map(([value, label, Glyph]) => (
                    <button
                      key={value} type="button" onClick={() => set('icon', value)}
                      aria-pressed={form.icon === value} title={label}
                      className={`grid h-9 w-9 place-items-center rounded-md border transition-colors duration-state ${form.icon === value ? 'border-accent bg-accent-subtle text-accent' : 'border-line text-fg-muted hover:border-line-strong hover:text-fg'}`}
                    >
                      <Glyph className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                      <span className="sr-only">{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Type" required>
                {({ id }) => (
                  <Select id={id} value={form.poiType} onChange={(e) => set('poiType', e.target.value)}>
                    {POI_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="Department">
                {({ id }) => (
                  <Select id={id} value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
                    <option value="">None</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </Select>
                )}
              </Field>
            </div>
          </PanelFieldset>

          <PanelFieldset legend="Location">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Latitude" required>
                {({ id }) => (
                  <Input id={id} type="number" step="0.000001" min={-90} max={90} required
                         value={form.lat} onChange={(e) => set('lat', e.target.value)} placeholder="16.7102" />
                )}
              </Field>
              <Field label="Longitude" required>
                {({ id }) => (
                  <Input id={id} type="number" step="0.000001" min={-180} max={180} required
                         value={form.lng} onChange={(e) => set('lng', e.target.value)} placeholder="121.6751" />
                )}
              </Field>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-label">
              <p className="field-hint mb-0">
                {form.lat && form.lng ? 'Set. Drag the pin on the map to adjust.' : 'Not set yet.'}{' '}
                <button type="button" onClick={() => setView('map')}
                  className="rounded underline decoration-line-strong underline-offset-4 transition-colors hover:text-fg">
                  Place it on the map
                </button>
              </p>
              {form.lat && form.lng && (
                <button
                  type="button"
                  onClick={clearDraftPin}
                  className="flex items-center gap-1 rounded border border-error/30 bg-error/10 px-2.5 py-1 text-label font-medium text-error transition-colors hover:bg-error hover:text-bg"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden /> Clear pin
                </button>
              )}
            </div>
          </PanelFieldset>

          <PanelFieldset legend="Description">
            <Field label="Primary function">
              {({ id }) => (
                <Input id={id} maxLength={200} value={form.buildingFunction}
                       onChange={(e) => set('buildingFunction', e.target.value)}
                       placeholder="Research laboratories and innovation hub" />
              )}
            </Field>
            <Field label="Description" hint="Embedded into the retrieval corpus.">
              {({ id, describedBy }) => (
                <Textarea id={id} rows={3} maxLength={1000} aria-describedby={describedBy}
                          value={form.description}
                          onChange={(e) => set('description', e.target.value)}
                          placeholder="What is inside, who it serves, anything a student would want to know." />
              )}
            </Field>
          </PanelFieldset>

          <PanelFieldset legend="Data provenance">
            <Field label="How was the coordinate obtained?" required>
              {({ id }) => (
                <Select id={id} value={form.surveyMethod} onChange={(e) => set('surveyMethod', e.target.value)}>
                  {SURVEY_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              )}
            </Field>
            <fieldset>
              <legend className="field-label">Data origin <span className="text-accent">*</span></legend>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {[['real', 'Real ISU data', 'Surveyed and verified'], ['synthetic', 'Placeholder', 'Blocks evaluation runs']].map(([v, l, hint]) => (
                  <button key={v} type="button" onClick={() => set('dataOrigin', v)} aria-pressed={form.dataOrigin === v}
                    className={`border px-3 py-2.5 text-left transition-colors duration-state ${form.dataOrigin === v ? (v === 'real' ? 'border-accent bg-accent-subtle' : 'border-warning bg-warning-subtle') : 'border-line hover:border-line-strong'}`}>
                    <span className="block text-meta font-medium text-fg">{l}</span>
                    <span className="mt-0.5 block text-label text-fg-subtle">{hint}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          </PanelFieldset>

          <PanelFieldset legend="Publishing">
            <label className="flex cursor-pointer items-center gap-2.5 text-meta text-fg">
              <input type="checkbox" checked={form.isFeatured}
                     onChange={(e) => set('isFeatured', e.target.checked)} className="accent-accent" />
              Feature on the public homepage
            </label>
            <Field label="Change note" hint="Recorded in the audit trail.">
              {({ id, describedBy }) => (
                <Input id={id} maxLength={280} value={form.note} aria-describedby={describedBy}
                       onChange={(e) => set('note', e.target.value)} placeholder="Building completed August 2026" />
              )}
            </Field>
          </PanelFieldset>

          <div className="mt-7 flex gap-2">
            <Button type="submit" variant="primary" size="lg" loading={busy} className="flex-1">
              {editingId ? 'Save changes' : 'Add location'}
            </Button>
            {editingId && <Button type="button" variant="text" onClick={cancel}>Cancel</Button>}
          </div>
          {msg && (
            <Alert tone={msg.kind === 'ok' ? 'success' : 'error'} className="mt-4">{msg.text}</Alert>
          )}
        </form>

        {/* Map / list panel */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div className="flex items-center gap-3">
              <h2 className="font-serif text-h3 text-fg">
                On the map <span className="text-fg-subtle" data-numeric>({pois.length})</span>
              </h2>
              <div className="flex overflow-hidden rounded-md border border-line" role="group" aria-label="View">
                {[['map', 'Map', MapIcon], ['list', 'List', List]].map(([key, label, Glyph]) => (
                  <button key={key} type="button" onClick={() => setView(key)} aria-pressed={view === key}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-label transition-colors ${view === key ? 'bg-fg text-bg' : 'text-fg-muted hover:text-fg'}`}>
                    <Glyph className="h-3.5 w-3.5" aria-hidden />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className={`relative w-full max-w-xs ${view === 'map' ? 'hidden' : ''}`}>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
              <Input value={query} onChange={(e) => setQuery(e.target.value)}
                     placeholder="Filter locations" aria-label="Filter locations" className="pl-8" />
            </div>
          </div>

          {view === 'map' && (
            <div className="mt-3 h-[480px]">
              <EditorMap
                pois={pois} editingId={editingId}
                lat={form.lat} lng={form.lng} name={form.name}
                onPick={(a, b) => { set('lat', a.toFixed(6)); set('lng', b.toFixed(6)); }}
                onEdit={startEdit}
                onUnpublish={removePoi}
                onRepublish={republishPoi}
                onDelete={deletePoiPermanently}
                onClearDraft={clearDraftPin}
              />
            </div>
          )}

          {view === 'list' && (
            <div className="mt-1 overflow-y-auto">
              {loading && pois.length === 0 && <SkeletonRows rows={6} />}
              {shown.length > 0 && (
                <ul>
                  {shown.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-line py-3.5">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-body font-medium text-fg">
                          {p.name}
                          {p.data_origin === 'synthetic' && (
                            <span className="border border-warning/40 px-1.5 py-px text-label text-warning">placeholder</span>
                          )}
                          {p.is_published === false && (
                            <span className="border border-warning/40 bg-warning-subtle px-1.5 py-px text-label text-warning">unpublished</span>
                          )}
                        </p>
                        <p className="mt-0.5 font-mono text-data text-fg-subtle" data-numeric>
                          {Number(p.lat).toFixed(5)}, {Number(p.lng).toFixed(5)}
                          {p.department?.name ? ` · ${p.department.name}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="secondary" size="sm" onClick={() => startEdit(p)}>Edit</Button>
                        {p.is_published !== false ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={EyeOff}
                            title="Unpublish (hide from public map)"
                            onClick={() => removePoi(p)}
                          >
                            Unpublish
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={RotateCcw}
                            title="Republish to map"
                            onClick={() => republishPoi(p)}
                          >
                            Republish
                          </Button>
                        )}
                        <button
                          type="button"
                          onClick={() => deletePoiPermanently(p)}
                          title={`Permanently delete ${p.name}`}
                          className="grid h-8 w-8 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-error/10 hover:text-error focus-visible:outline-focus"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                          <span className="sr-only">Delete {p.name}</span>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {!loading && shown.length === 0 && (
                <EmptyState icon={Building2} title={pois.length === 0 ? 'No campus locations yet' : 'Nothing matches that filter'} className="mt-6">
                  {pois.length === 0 ? 'Add the first one using the form.' : 'Try a different name.'}
                </EmptyState>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function PanelFieldset({ legend, children }) {
  return (
    <fieldset className="mt-7">
      <legend className="eyebrow">{legend}</legend>
      <div className="mt-3 space-y-4">{children}</div>
    </fieldset>
  );
}
