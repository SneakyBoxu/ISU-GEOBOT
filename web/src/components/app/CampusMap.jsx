import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { CAMPUS_CENTER, CAMPUS_ZOOM, POI_CATEGORIES } from '../../lib/constants.js';
import { usePrefersReducedMotion } from '../../hooks/useMotion.js';

/**
 * Interactive campus map (thesis §3.5.1).
 *
 * Markers are distinguished by LETTER as well as by tone — C for college, A
 * for administrative, and so on — so the category survives greyscale, the
 * Monochrome theme and colour blindness. A legend states the mapping rather
 * than leaving it to be inferred.
 *
 * The toolbar sits in a ruled bar above the canvas rather than floating over
 * it. Translucent panels on top of a map hide the thing the user came to see.
 */
const TYPE_LETTER = {
  college: 'C', administrative: 'A', laboratory: 'L',
  library: 'B', facility: 'F', landmark: 'M', other: '·',
};

function markerIcon(type, active, index = 0) {
  const size = active ? 30 : 24;
  const letter = TYPE_LETTER[type] ?? '·';
  // Markers arrive staggered, like pins being placed on a board. The delay is
  // capped so a large campus does not take four seconds to finish appearing.
  const delay = Math.min(index * 45, 700);
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `
      <span class="drop-in" style="
        display:grid;place-items:center;width:${size}px;height:${size}px;
        border-radius:999px;
        background:${active ? 'rgb(var(--accent))' : 'rgb(var(--surface))'};
        color:${active ? 'rgb(var(--accent-contrast))' : 'rgb(var(--fg))'};
        border:1.5px solid rgb(var(--${active ? 'accent' : 'fg'}));
        box-shadow:var(--shadow-sm);
        font:600 ${active ? 12 : 10}px/1 Inter,system-ui,sans-serif;
        letter-spacing:.02em;
        animation-delay:${delay}ms;
        ${active ? 'outline:6px solid rgb(var(--accent) / .16);outline-offset:2px;' : ''}
      ">${letter}</span>`,
  });
}

/**
 * Clicking the map background clears the selection.
 *
 * Leaflet stops click propagation on markers, so this fires only for the
 * background — selecting a marker does not immediately deselect it. Without
 * this the selection ring is a one-way door: you can turn it on and never off,
 * which reads as a stuck highlight rather than as state.
 */
function BackgroundClick({ onClear }) {
  useMapEvents({ click: () => onClear?.() });
  return null;
}

function FocusController({ target }) {
  const map = useMap();
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    if (!target) return;
    // Map focus is meaningful motion — it carries the user from where they
    // were to where they asked about. Reduced motion still moves, instantly.
    if (reduced) map.setView([target.lat, target.lng], 18);
    else map.flyTo([target.lat, target.lng], 18, { duration: 0.6 });
  }, [target, map, reduced]);
  return null;
}

export default function CampusMap({ pois, focusId, onSelect, onClear }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Escape clears the selection too — the same affordance a keyboard user
  // reaches for, and the only way to clear it without a pointer.
  useEffect(() => {
    if (!focusId) return;
    const onKey = (e) => { if (e.key === 'Escape') onClear?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusId, onClear]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pois.filter(
      (p) => (category === 'all' || p.type === category)
        && (!q || p.name.toLowerCase().includes(q)
            || p.department?.toLowerCase().includes(q)
            || p.buildingFunction?.toLowerCase().includes(q)),
    );
  }, [pois, query, category]);

  const focus = useMemo(() => pois.find((p) => p.id === focusId), [pois, focusId]);
  const categories = useMemo(
    () => POI_CATEGORIES.filter((c) => c.key === 'all' || pois.some((p) => p.type === c.key)),
    [pois],
  );
  const legend = useMemo(
    () => [...new Set(filtered.map((p) => p.type))].slice(0, 6),
    [filtered],
  );

  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="border-b border-line bg-surface">
        <div className="flex items-center gap-2 px-4 py-2.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search buildings, offices, departments"
              aria-label="Search campus locations"
              className="input min-h-[2.25rem] border-transparent bg-bg-sunken pl-8 pr-8 text-meta"
            />
            {query && (
              <button
                type="button" onClick={() => setQuery('')} aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-subtle transition-colors duration-state hover:text-fg"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            aria-label="Filter by category"
            className={`btn-icon ${showFilters || category !== 'all' ? 'bg-accent-subtle text-accent' : ''}`}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-line px-4 py-2.5">
            {categories.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                aria-pressed={category === c.key}
                className={`text-meta underline-offset-[6px] transition-colors duration-state ${
                  category === c.key
                    ? 'text-fg underline decoration-accent decoration-2'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        <MapContainer
          center={focus ? [focus.lat, focus.lng] : CAMPUS_CENTER}
          zoom={CAMPUS_ZOOM}
          className="h-full w-full"
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          <FocusController target={focus} />
          <BackgroundClick onClear={onClear} />

          {filtered.map((poi, i) => (
            <Marker
              key={poi.id}
              position={[poi.lat, poi.lng]}
              icon={markerIcon(poi.type, poi.id === focusId, i)}
              eventHandlers={{ click: () => (poi.id === focusId ? onClear?.() : onSelect?.(poi.id)) }}
            >
              <Popup>
                <div className="min-w-[13rem] p-3.5">
                  <p className="text-meta font-semibold text-fg">{poi.name}</p>
                  {poi.department && (
                    <p className="mt-0.5 text-label text-fg-muted">{poi.department}</p>
                  )}
                  {poi.buildingFunction && (
                    <p className="mt-2 text-label leading-relaxed text-fg-muted">
                      {poi.buildingFunction}
                    </p>
                  )}
                  <p className="mt-2.5 border-t border-line pt-2 font-mono text-data text-fg-subtle" data-numeric>
                    {Number(poi.lat).toFixed(5)}, {Number(poi.lng).toFixed(5)}
                  </p>
                  {poi.isSynthetic && (
                    <p className="mt-2 text-label text-warning">
                      Placeholder coordinates &mdash; pending GPS survey
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[400] flex items-end justify-between gap-3 p-3">
          {legend.length > 0 && (
            <dl className="pointer-events-auto flex flex-wrap items-center gap-x-3 gap-y-1 border border-line bg-surface px-2.5 py-1.5 shadow-sm">
              {legend.map((t) => (
                <div key={t} className="flex items-center gap-1.5">
                  <dt className="grid h-4 w-4 place-items-center rounded-pill border border-fg text-[9px] font-semibold text-fg">
                    {TYPE_LETTER[t] ?? '·'}
                  </dt>
                  <dd className="text-label capitalize text-fg-muted">{t}</dd>
                </div>
              ))}
            </dl>
          )}
          <span className="pointer-events-auto border border-line bg-surface px-2 py-1 font-mono text-data text-fg-subtle" data-numeric>
            {filtered.length}/{pois.length}
          </span>
        </div>
      </div>
    </div>
  );
}
