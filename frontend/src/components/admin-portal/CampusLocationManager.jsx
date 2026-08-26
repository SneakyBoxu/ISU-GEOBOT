import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, List, Map as MapIcon, MapPin, Plus, RefreshCw, Save, Search, Settings2 } from 'lucide-react';
import { api } from '../../frontend-utilities/backendApiClient.js';
import { currentSession, signOut } from '../../frontend-utilities/supabaseClient.js';
import PortalShell, { SignOutButton } from '../layout-patterns/PortalLayoutFrame.jsx';
import PortalLogin from '../shared-components/UserRoleLoginModal.jsx';
import EditorMap from './CampusMapEditor.jsx';
import { ICON_CHOICES } from '../main-assistant/mapMarkerGlyphs.js';
import {
  Alert, Button, EmptyState, Field, Input, Select, SkeletonRows, Textarea,
} from '../ui-primitives/index.js';

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
  const [session, setSession] = useState(undefined);
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

  useEffect(() => { currentSession().then((s) => setSession(s ?? null)); }, []);

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
        ? await api.adminUpdatePoi(session.access_token, editingId, payload)
        : await api.adminCreatePoi(session.access_token, payload);
      setMsg({ kind: 'ok', text: res.message ?? `Saved.${res.reindexed ? ` Place-card re-embedded (${res.indexed} chunk${res.indexed === 1 ? '' : 's'}).` : ''}` });
      cancel(); await load();
    } catch (err) { setMsg({ kind: 'error', text: err.message }); }
    finally { setBusy(false); }
  }

  /**
   * Retire a location, from the map rather than from the form.
   *
   * UNPUBLISH, NOT DELETE. A hard delete removes a row an earlier evaluation
   * run may have retrieved against, which would make that run unreproducible.
   * The server enforces the same thing — there is no delete endpoint to call —
   * so the wording here says "unpublish" rather than promising a deletion the
   * system will not perform.
   *
   * The confirm step is deliberate. This is reachable from a right-click menu,
   * which is a much easier thing to hit by accident than a button in a form.
   */
  async function removePoi(poi) {
    const ok = window.confirm(
      `Unpublish "${poi.name}"?\n\n`
      + 'It will be removed from the campus map, the landing page and the '
      + "assistant's answers. The record is kept, and it can be republished.",
    );
    if (!ok) return;

    setBusy(true); setMsg(null);
    try {
      await api.adminUnpublishPoi(session.access_token, poi.id, 'Unpublished from the map editor');
      setMsg({ kind: 'ok', text: `"${poi.name}" is no longer published.` });
      if (editingId === poi.id) cancel();
      await load();
    } catch (err) { setMsg({ kind: 'error', text: err.message }); }
    finally { setBusy(false); }
  }

  const shown = useMemo(() => pois.filter(
    (p) => p.name.toLowerCase().includes(query.trim().toLowerCase()),
  ), [pois, query]);

  const placeholders = pois.filter((p) => p.data_origin === 'synthetic').length;

  if (session === undefined) return null;
  if (!session) {
    return (
      <PortalLogin
        role="admin"
        icon={Settings2}
        title="Campus Locations"
        description="For researchers and campus administrators. Add or correct buildings, offices and points of interest on the ISU-GeoBot map."
        onSession={setSession}
      />
    );
  }

  return (
    <PortalShell
      icon={Settings2}
      title="Campus Locations"
      subtitle="Saving a location updates the map and regenerates its place-card in the retrieval corpus, so the assistant can answer about it straight away."
      actions={
        <>
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={load} disabled={loading}>
            Refresh
          </Button>
          <SignOutButton onSignOut={async () => { await signOut(); setSession(null); }} />
        </>
      }
    >
      {placeholders > 0 && (
        <Alert tone="warning" title={`${placeholders} placeholder location${placeholders === 1 ? '' : 's'}`}>
          These are marked <code className="font-mono">[DEMO]</code> wherever they
          appear, and the evaluation harness will refuse to run until every one is
          replaced with surveyed coordinates.
        </Alert>
      )}

      <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <form onSubmit={submit} className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="flex items-center gap-2 border-b border-line pb-3 font-serif text-h3 text-fg">
            {editingId ? <><Save className="h-4 w-4 text-accent" aria-hidden /> Edit location</>
                       : <><Plus className="h-4 w-4 text-accent" aria-hidden /> Add a location</>}
          </h2>

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
                  <Select id={id} value={form.departmentId}
                          onChange={(e) => set('departmentId', e.target.value)}>
                    <option value="">None</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </Select>
                )}
              </Field>
            </div>
          </Fieldset>

          <Fieldset legend="Location">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Latitude" required>
                {({ id }) => (
                  <Input id={id} type="number" step="0.000001" min={-90} max={90} required
                         value={form.lat} onChange={(e) => set('lat', e.target.value)}
                         placeholder="16.7102" />
                )}
              </Field>
              <Field label="Longitude" required>
                {({ id }) => (
                  <Input id={id} type="number" step="0.000001" min={-180} max={180} required
                         value={form.lng} onChange={(e) => set('lng', e.target.value)}
                         placeholder="121.6751" />
                )}
              </Field>
            </div>
            <p className="field-hint">
              {form.lat && form.lng
                ? 'Set. Drag the pin on the map to adjust, and check it against a landmark before saving.'
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
          </Fieldset>

          <Fieldset legend="Publishing">
            <label className="flex cursor-pointer items-center gap-2.5 text-meta text-fg">
              <input type="checkbox" checked={form.isFeatured}
                     onChange={(e) => set('isFeatured', e.target.checked)}
                     className="accent-accent" />
              Feature on the public homepage
            </label>
            <Field label="Change note" hint="Recorded in the audit trail.">
              {({ id, describedBy }) => (
                <Input id={id} maxLength={280} value={form.note} aria-describedby={describedBy}
                       onChange={(e) => set('note', e.target.value)}
                       placeholder="Building completed August 2026" />
              )}
            </Field>
          </Fieldset>

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

        <section className="flex min-h-0 flex-col lg:sticky lg:top-6 lg:h-[calc(100dvh-8rem)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div className="flex items-center gap-3">
              <h2 className="font-serif text-h3 text-fg">
                On the map <span className="text-fg-subtle" data-numeric>({pois.length})</span>
              </h2>
              <div className="flex overflow-hidden rounded-md border border-line" role="group" aria-label="View">
                {[['map', 'Map', MapIcon], ['list', 'List', List]].map(([key, label, Glyph]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setView(key)}
                    aria-pressed={view === key}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-label transition-colors duration-state ${
                      view === key ? 'bg-fg text-bg' : 'text-fg-muted hover:text-fg'
                    }`}
                  >
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

          <div className={`min-h-0 flex-1 overflow-y-auto ${view === 'list' ? '' : 'hidden'}`}>
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
                  <Button variant="secondary" size="sm" onClick={() => startEdit(p)}>Edit</Button>
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
