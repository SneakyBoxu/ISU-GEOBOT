import React, { useEffect, useMemo } from 'react';
import { ChevronRight, PanelLeftClose, Search, X } from 'lucide-react';
import { POI_CATEGORIES } from '../../frontend-utilities/appConstants.js';
import { categoryColor } from './mapMarkerGlyphs.js';
import { PoiGlyph } from './mapPinIconBuilder.js';

/**
 * The campus index.
 *
 * The map answers "where is this"; it is bad at "what is here". A pin gives up
 * nothing until you click it, so finding a building you cannot already name
 * means clicking pins until one is right. This panel is the other half: a
 * browsable, filterable list of every location, carrying the same letter and
 * the same category ink as the markers, so the two readings of the campus
 * agree at a glance.
 *
 * It stays a LIST. Selecting a location raises the detail card over the map
 * instead — see LocationCard. Putting the detail in here as well would print
 * the same building twice on one screen and cost the user their place in the
 * list every time they looked something up.
 *
 * LAYOUT. From `md` up it is a permanent column in the flow: no rail, no
 * toggle, the map simply starts to its right. Below `md` a 320px column would
 * leave 55px of campus, so there it becomes a drawer over the map with a scrim,
 * sliding on `transform` — the one property that moves without reflowing a
 * Leaflet canvas underneath it.
 */

function CategoryChips({ value, onChange, pois }) {
  const available = useMemo(
    () => POI_CATEGORIES.filter((c) => c.key === 'all' || pois.some((p) => p.type === c.key)),
    [pois],
  );

  return (
    <div className="flex flex-wrap gap-x-3.5 gap-y-1.5">
      {available.map((c) => {
        const active = value === c.key;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onChange(c.key)}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 text-label underline-offset-[6px] transition-colors duration-state ${
              active ? 'text-fg underline decoration-2' : 'text-fg-muted hover:text-fg'
            }`}
            style={active && c.key !== 'all'
              ? { textDecorationColor: categoryColor(c.key) }
              : undefined}
          >
            {c.key !== 'all' && (
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-pill"
                style={{ background: categoryColor(c.key) }}
              />
            )}
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

function LocationRow({ poi, active, onSelect }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(poi.id)}
        aria-current={active ? 'true' : undefined}
        className={`group flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left transition-colors duration-state ${
          active ? 'bg-accent-subtle' : 'hover:bg-bg-sunken'
        }`}
      >
        <span
          aria-hidden
          className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-pill"
          style={{ background: categoryColor(poi.type), color: 'rgb(var(--cat-ink))' }}
        >
          <PoiGlyph type={poi.type} icon={poi.icon} size={14} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-meta font-medium text-fg">{poi.name}</span>
          {poi.buildingFunction && (
            <span className="mt-0.5 block truncate text-label text-fg-muted">
              {poi.buildingFunction}
            </span>
          )}
        </span>

        <ChevronRight
          className="mt-1 h-3.5 w-3.5 shrink-0 text-fg-subtle opacity-0 transition-opacity duration-state group-hover:opacity-100"
          aria-hidden
        />
      </button>
    </li>
  );
}

/**
 * Three figures at the foot of the index.
 *
 * Two are counted from the data on screen, so they cannot go stale. The third
 * is the campus area, which is an institutional fact already carried in the
 * assistant's system prompt — the same source, stated once.
 *
 * The reference project's version of this bar also showed a founding year.
 * That is omitted here: it is not in any document this system holds, and a
 * date printed under a university's name in a thesis artefact is exactly the
 * kind of unsourced detail that has to be verified before it is displayed.
 */
function Stats({ count, categories }) {
  const cells = [
    [count, count === 1 ? 'Location' : 'Locations'],
    [categories, categories === 1 ? 'Category' : 'Categories'],
    ['355', 'Hectares'],
  ];
  return (
    <dl className="grid grid-cols-3 border-t border-line">
      {cells.map(([value, label], i) => (
        <div key={label} className={`px-3 py-2.5 ${i ? 'border-l border-line' : ''}`}>
          <dt className="sr-only">{label}</dt>
          <dd>
            <span className="block font-mono text-body font-semibold text-fg" data-numeric>
              {value}
            </span>
            <span className="mt-0.5 block text-[0.6875rem] uppercase tracking-[0.08em] text-fg-subtle">
              {label}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function LocationPanel({
  pois = [], visible = [], focusId, onSelect, open, onToggle,
  query = '', onQueryChange, category = 'all', onCategoryChange,
}) {
  const categories = useMemo(
    () => new Set(visible.map((p) => p.type)).size,
    [visible],
  );

  // Escape closes the drawer. Only meaningful below `md`, where it overlays
  // the map — above that the panel is part of the layout and has no closed
  // state to return to.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onToggle(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onToggle]);

  return (
    <>
      {/* Phone-only rail: the only way back to the index once it is dismissed. */}
      <div className="relative z-[500] flex w-11 shrink-0 flex-col items-center border-r border-line bg-surface py-2.5 md:hidden">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls="campus-index"
          aria-label={open ? 'Hide campus index' : 'Show campus index'}
          className="btn-icon"
        >
          <Search className="h-4 w-4" aria-hidden />
        </button>
        <span
          className="mt-3 select-none font-mono text-data text-fg-subtle [writing-mode:vertical-rl]"
          data-numeric
        >
          {pois.length} locations
        </span>
      </div>

      <div
        onClick={onToggle}
        aria-hidden
        className={`absolute inset-0 z-[600] bg-fg/20 transition-opacity duration-dialog md:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <div
        id="campus-index"
        className={`absolute inset-y-0 left-0 z-[700] flex w-[min(20rem,85vw)] flex-col border-r border-line bg-surface shadow-lg transition-[transform,visibility] duration-dialog ease-in md:static md:visible md:w-[16rem] md:translate-x-0 md:shadow-none lg:w-[18rem] xl:w-[20rem] ${
          open ? 'visible translate-x-0' : 'invisible -translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <p className="eyebrow">Campus index</p>
          <button
            type="button"
            onClick={onToggle}
            aria-label="Hide campus index"
            className="btn-icon -mr-1 md:hidden"
          >
            <PanelLeftClose className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-2.5 border-b border-line px-4 py-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
              aria-hidden
            />
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search buildings, offices"
              aria-label="Search campus locations"
              className="input min-h-[2.25rem] border-transparent bg-bg-sunken pl-8 pr-8 text-meta"
            />
            {query && (
              <button
                type="button"
                onClick={() => onQueryChange('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded text-fg-subtle transition-colors duration-state hover:text-fg"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
          <CategoryChips value={category} onChange={onCategoryChange} pois={pois} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-meta text-fg-muted">No location matches that search.</p>
              {(query || category !== 'all') && (
                <button
                  type="button"
                  onClick={() => { onQueryChange(''); onCategoryChange('all'); }}
                  className="mt-2 rounded text-label text-fg-subtle underline decoration-line-strong underline-offset-4 transition-colors duration-state hover:text-fg"
                >
                  Clear the filters
                </button>
              )}
            </div>
          ) : (
            <ul>
              {visible.map((p) => (
                <LocationRow
                  key={p.id}
                  poi={p}
                  active={p.id === focusId}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          )}
        </div>

        <Stats count={visible.length} categories={categories} />
      </div>
    </>
  );
}
