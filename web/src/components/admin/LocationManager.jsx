import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, List, Map as MapIcon, MapPin, Plus, RefreshCw, Save, Search, Settings2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import { currentSession, signOut } from '../../lib/supabase.js';
import PortalShell, { SignOutButton } from '../patterns/PortalShell.jsx';
import PortalLogin from '../shared/PortalLogin.jsx';
import EditorMap from './EditorMap.jsx';
import { ICON_CHOICES } from '../app/markerGlyph.js';
import {
  Alert, Button, EmptyState, Field, Input, Select, SkeletonRows, Textarea,
} from '../ui/index.js';

/**
 * Campus location manager.
 *
 * The important behaviour is not the form — it is what happens on submit. A
 * campus location has a dual representation: coordinates drive the map, and a
 * generated place-card is embedded so navigation questions retrieve it. Saving
 * does both in one operation, so a new building is answerable by the assistant
 * immediately. A map pin the chatbot has never heard of is worse than no pin.
 *
 * TWO FIELDS THAT LOOK LIKE PAPERWORK AND ARE NOT:
 *   Data origin    the evaluation harness refuses to run while any placeholder
 *                  row exists. Getting it wrong stops a run rather than
 *                  corrupting a result.
 *   Survey method  §3.4.1(a) specifies GPS survey verified against landmarks.
 *                  A coordinate read off a floor plan is not survey data, and
 *                  recording which is which keeps the methodology reportable.
 */
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

export default function LocationManager() {
  const [pois, setPois] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState('');
  // The right pane is a MAP first and a list second. Placing a building is a
  // question about where it sits relative to the others, and a text list of
  // twenty-eight coordinates cannot answer it.
  const [view, setView] = useState('map');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, d] = await Promise.all([
        api.adminPois(''),
        api.adminDepartments(''),
      ]);
      setPois(p.pois ?? []); setDepartments(d.departments ?? []);
    } catch (err) { setMsg({ kind: 'error', text: err.message }); }
    finally { setLoading(false); }
  }, []);

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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const cancel = () => { setEditingId(null); setForm(EMPTY); setMsg(null); };

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
        ? await api.adminUpdatePoi('', editingId, payload)
        : await api.adminCreatePoi('', payload);
      setMsg({ kind: 'ok', text: res.message ?? `Saved.${res.reindexed ? ` Place-card re-embedded (${res.indexed} chunk${res.indexed === 1 ? '' : 's'}).` : ''}` });
      cancel(); await load();
    } catch (err) { setMsg({ kind: 'error', text: err.message }); }
    finally { setBusy(false); }
  }

  async function removePoi(id, name) {
    if (!window.confirm(`Are you sure you want to remove "${name}" from the campus map and Supabase database?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      await api.adminUnpublishPoi('', id, 'Removed via Map Editor');
      setMsg({ kind: 'ok', text: `"${name}" was deleted from the map and database.` });
      if (editingId === id) cancel();
      await load();
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  const shown = useMemo(() => pois.filter(
    (p) => p.name.toLowerCase().includes(query.trim().toLowerCase()),
  ), [pois, query]);

  const placeholders = pois.filter((p) => p.data_origin === 'synthetic').length;

  return (
    <PortalShell showHeader={false}>
      {placeholders > 0 && (
        <div className="mb-4">
          <Alert tone="warning" title={`${placeholders} placeholder location${placeholders === 1 ? '' : 's'}`}>
            These are marked <code className="font-mono">[DEMO]</code> wherever they
            appear, and the evaluation harness will refuse to run until every one is
            replaced with surveyed coordinates.
          </Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,28rem)_1fr] lg:items-start">
        {/* Left Form: Sticky panel with independent internal scroll */}
        <div className="rounded-xl border border-line bg-surface p-5 shadow-sm lg:sticky lg:top-4 lg:flex lg:flex-col lg:h-[calc(100vh-3.5rem)]">
          <h2 className="flex items-center gap-2 border-b border-line pb-3 font-serif text-h3 text-fg shrink-0">
            {editingId ? <><Save className="h-4 w-4 text-accent" aria-hidden /> Edit location</>
                       : <><Plus className="h-4 w-4 text-accent" aria-hidden /> Add a location</>}
          </h2>

          <form onSubmit={submit} className="mt-3 flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto pr-2.5 custom-scrollbar space-y-5">
              <Fieldset legend="Identity">
                <Field label="Building or office name" required>
                  {({ id }) => (
                    <Input id={id} required minLength={2} maxLength={160} value={form.name}
                           onChange={(e) => set('name', e.target.value)}
                           placeholder="Innovation and Research Center" />
                  )}
                </Field>
                <Field
                  label="Icon"
                  hint="Optional. Leave unset and the location is drawn with its category's icon — set one only where the category glyph is misleading, like a bicycle stand drawn as a building."
                >
                  {() => (
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => set('icon', '')}
                        aria-pressed={!form.icon}
                        title="Use the category icon"
                        className={`grid h-9 w-9 place-items-center rounded-md border transition-colors duration-state ${
                          !form.icon
                            ? 'border-accent bg-accent-subtle text-accent'
                            : 'border-line text-fg-subtle hover:border-line-strong hover:text-fg'
                        }`}
                      >
                        <span aria-hidden className="text-label font-semibold">Aa</span>
                        <span className="sr-only">Use the category icon</span>
                      </button>
                      {ICON_CHOICES.map(([value, label, Glyph]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => set('icon', value)}
                          aria-pressed={form.icon === value}
                          title={label}
                          className={`grid h-9 w-9 place-items-center rounded-md border transition-colors duration-state ${
                            form.icon === value
                              ? 'border-accent bg-accent-subtle text-accent'
                              : 'border-line text-fg-muted hover:border-line-strong hover:text-fg'
                          }`}
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
                        <option value="">(None / shared)</option>
                        {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </Select>
                    )}
                  </Field>
                </div>
              </Fieldset>

              <Fieldset legend="Coordinates">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Latitude" required>
                    {({ id }) => (
                      <Input id={id} required type="number" step="any" min="-90" max="90"
                             value={form.lat} onChange={(e) => set('lat', e.target.value)}
                             placeholder="16.7123" />
                    )}
                  </Field>
                  <Field label="Longitude" required>
                    {({ id }) => (
                      <Input id={id} required type="number" step="any" min="-180" max="180"
                             value={form.lng} onChange={(e) => set('lng', e.target.value)}
                             placeholder="121.6751" />
                    )}
                  </Field>
                </div>
                <p className="field-hint">
                  {form.lat && form.lng
                    ? 'Set. Drag the pin on the map or right-click any marker to edit/adjust.'
                    : 'Not set yet.'}{' '}
                  <button
                    type="button"
                    onClick={() => setView('map')}
                    className="rounded underline decoration-line-strong underline-offset-4 transition-colors duration-state hover:text-fg"
                  >
                    Place it on the map
                  </button>{' '}
                  &mdash; every other location is shown there for reference.
                </p>
              </Fieldset>

              <Fieldset legend="Description">
                <Field label="Primary function">
                  {({ id }) => (
                    <Input id={id} maxLength={200} value={form.buildingFunction}
                           onChange={(e) => set('buildingFunction', e.target.value)}
                           placeholder="Research laboratories and innovation hub" />
                  )}
                </Field>
                <Field
                  label="Description"
                  hint="Embedded into the retrieval corpus, so this is what the assistant draws on. Describe the place — do not list which faculty sit there."
                >
                  {({ id, describedBy }) => (
                    <Textarea id={id} rows={3} maxLength={1000} aria-describedby={describedBy}
                              value={form.description}
                              onChange={(e) => set('description', e.target.value)}
                              placeholder="What is inside, who it serves, anything a student would want to know." />
                  )}
                </Field>
              </Fieldset>

              <Fieldset legend="Data provenance">
                <Field label="How was the coordinate obtained?" required>
                  {({ id }) => (
                    <Select id={id} value={form.surveyMethod}
                            onChange={(e) => set('surveyMethod', e.target.value)}>
                      {SURVEY_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </Select>
                  )}
                </Field>
                <fieldset>
                  <legend className="field-label">Data origin <span className="text-accent">*</span></legend>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {[
                      ['real', 'Real ISU data', 'Surveyed and verified'],
                      ['synthetic', 'Placeholder', 'Blocks evaluation runs'],
                    ].map(([v, l, hint]) => (
                      <button
                        key={v} type="button" onClick={() => set('dataOrigin', v)}
                        aria-pressed={form.dataOrigin === v}
                        className={`border px-3 py-2.5 text-left transition-colors duration-state ${
                          form.dataOrigin === v
                            ? v === 'real' ? 'border-accent bg-accent-subtle' : 'border-warning bg-warning-subtle'
                            : 'border-line hover:border-line-strong'
                        }`}
                      >
                        <span className="block text-meta font-medium text-fg">{l}</span>
                        <span className="mt-0.5 block text-label text-fg-subtle">{hint}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
                {editingId && (
                  <Field label="Reason for this change" hint="Recorded in the poi_audit log with your identity and a timestamp.">
                    {({ id, describedBy }) => (
                      <Input id={id} maxLength={280} aria-describedby={describedBy}
                             value={form.note} onChange={(e) => set('note', e.target.value)}
                             placeholder="e.g. Corrected coordinate after on-site GPS survey" />
                    )}
                  </Field>
                )}
              </Fieldset>

              {msg && (
                <div className="mt-4">
                  <Alert tone={msg.kind === 'ok' ? 'success' : 'error'}>{msg.text}</Alert>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center gap-3 border-t border-line pt-3 shrink-0 bg-surface">
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving…' : editingId ? 'Save changes' : 'Save location'}
              </Button>
              {editingId && (
                <>
                  <Button type="button" variant="secondary" onClick={cancel} disabled={busy}>Cancel</Button>
                  <Button type="button" variant="danger" onClick={() => removePoi(editingId, form.name)} disabled={busy}>Delete</Button>
                </>
              )}
            </div>
          </form>
        </div>

        {/* Right Section: Large Map that fills the viewport height */}
        <section className="flex flex-col h-[calc(100vh-3.5rem)] min-h-[38rem] lg:sticky lg:top-4 rounded-xl border border-line bg-surface p-4 shadow-sm" aria-label="Campus locations">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-serif text-h3 text-fg">{pois.length}</span>
              <span className="text-body text-fg-muted">location{pois.length === 1 ? '' : 's'}</span>

              <div className="ml-3 flex rounded-md border border-line" role="group" aria-label="View mode">
                {[
                  ['map', 'Map view', MapIcon],
                  ['list', 'List view', List],
                ].map(([v, l, Icon]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    aria-pressed={view === v}
                    title={l}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-label transition-colors duration-state ${
                      view === v ? 'bg-fg text-bg' : 'text-fg-muted hover:text-fg'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    <span>{l.split(' ')[0]}</span>
                  </button>
                ))}
              </div>

              <Button variant="ghost" size="sm" icon={RefreshCw} onClick={load} disabled={loading} title="Refresh locations" className="ml-1" />
            </div>
            <div className={`relative w-full max-w-xs ${view === 'map' ? 'hidden' : ''}`}>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
              <Input value={query} onChange={(e) => setQuery(e.target.value)}
                     placeholder="Filter locations" aria-label="Filter locations" className="pl-8" />
            </div>
          </div>

          {view === 'map' && (
            <div className="min-h-0 flex-1 pt-3">
              <EditorMap
                pois={pois}
                editingId={editingId}
                lat={form.lat}
                lng={form.lng}
                name={form.name}
                onPick={(a, b) => { set('lat', a.toFixed(6)); set('lng', b.toFixed(6)); }}
                onEdit={startEdit}
                onDelete={removePoi}
              />
            </div>
          )}

          <div className={`min-h-0 flex-1 overflow-y-auto custom-scrollbar ${view === 'list' ? '' : 'hidden'}`}>
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
                      {p.survey_method === 'estimated' && (
                        <span className="border border-line px-1.5 py-px text-label text-fg-subtle">estimated</span>
                      )}
                      {p.is_published === false && (
                        <span className="border border-line px-1.5 py-px text-label text-fg-subtle">unpublished</span>
                      )}
                    </p>
                    <p className="mt-0.5 font-mono text-data text-fg-subtle" data-numeric>
                      {Number(p.lat).toFixed(5)}, {Number(p.lng).toFixed(5)}
                      {p.department?.name ? ` · ${p.department.name}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => startEdit(p)}>Edit</Button>
                    <Button variant="danger" size="sm" onClick={() => removePoi(p.id, p.name)}>Delete</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!loading && shown.length === 0 && (
            <EmptyState icon={Building2} title={pois.length === 0 ? 'No campus locations yet' : 'Nothing matches that filter'} className="mt-6">
              {pois.length === 0
                ? 'Add the first one using the form. It will appear on the map and become answerable by the assistant immediately.'
                : 'Try a different name.'}
            </EmptyState>
          )}
          </div>
        </section>
      </div>
    </PortalShell>
  );
}

function Fieldset({ legend, children }) {
  return (
    <fieldset className="mt-7">
      <legend className="eyebrow">{legend}</legend>
      <div className="mt-3 space-y-4">{children}</div>
    </fieldset>
  );
}
