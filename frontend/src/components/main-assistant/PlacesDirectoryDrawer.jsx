import React, { useEffect, useMemo } from 'react';
import { CornerUpRight, PanelLeftClose, Search, X } from 'lucide-react';
import { POI_CATEGORIES } from '../../frontend-utilities/appConstants.js';
import { categoryColor } from './mapMarkerGlyphs.js';
import { PoiGlyph } from './mapPinIconBuilder.js';
import BuildingDirectoryPanel from './BuildingDirectoryPanel.jsx';

/**
 * The campus index & dynamic building directory.
 *
 * When no building is selected:
 *   Displays the "Campus Index" — a browsable, filterable list of all locations,
 *   with category chips and statistics.
 *
 * When a building is selected:
 *   Replaces the index with the "Building Directory" — showing tabs for
 *   [Rooms & Facilities] and [Faculty & Staff], with internal room details and
 *   teacher/staff listings.
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

function LocationRow({ poi, active, isNavigating, onSelect, onDirections }) {
  return (
    <li className="group relative border-b border-line">
      <button
        type="button"
        onClick={() => onSelect(poi.id)}
        aria-current={active ? 'true' : undefined}
        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-state ${
          isNavigating ? 'bg-accent-subtle/80 font-medium' : active ? 'bg-accent-subtle' : 'hover:bg-bg-sunken'
        }`}
      >
        <span
          aria-hidden
          className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-pill"
          style={{ background: categoryColor(poi.type), color: 'rgb(var(--cat-ink))' }}
        >
          <PoiGlyph type={poi.type} icon={poi.icon} size={14} />
        </span>

        <span className="min-w-0 flex-1 pr-7">
          <span className="block truncate text-meta font-medium text-fg">{poi.name}</span>
          {poi.buildingFunction && (
            <span className="mt-0.5 block truncate text-label text-fg-muted">
              {poi.buildingFunction}
            </span>
          )}
        </span>
      </button>

      {onDirections && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDirections(poi);
          }}
          title={`Get walking directions to ${poi.name}`}
          aria-label={`Get walking directions to ${poi.name}`}
          className="absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-fg-subtle transition-all hover:bg-accent hover:text-accent-contrast focus-visible:opacity-100"
        >
          <CornerUpRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </li>
  );
}

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
  pois = [],
  visible = [],
  focusId,
  navDestinationId,
  onSelect,
  onClear,
  onAsk,
  onDirections,
  open,
  onToggle,
  query = '',
  onQueryChange,
  category = 'all',
  onCategoryChange,
}) {
  const categories = useMemo(
    () => new Set(visible.map((p) => p.type)).size,
    [visible],
  );

  // Find currently selected POI (if any)
  const selectedPoi = useMemo(
    () => (focusId ? pois.find((p) => p.id === focusId || p.slug === focusId) : null),
    [focusId, pois],
  );

  // Escape closes the drawer on mobile
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (window.matchMedia('(min-width: 768px)').matches) return;
      onToggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onToggle]);

  return (
    <>
      <div
        onClick={onToggle}
        aria-hidden
        className={`absolute inset-0 z-[600] bg-fg/20 transition-opacity duration-dialog md:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <div
        id="campus-index"
        className={`absolute inset-y-0 left-0 z-[700] flex w-[min(20rem,85vw)] flex-col border-r border-line bg-surface shadow-lg transition-[transform,visibility,margin] duration-dialog ease-in md:static md:w-[16rem] md:translate-x-0 md:shadow-none lg:w-[18rem] xl:w-[20rem] ${
          open
            ? 'visible translate-x-0 md:ml-0'
            : 'invisible -translate-x-full md:-ml-[16rem] lg:-ml-[18rem] xl:-ml-[20rem]'
        }`}
      >
        {selectedPoi ? (
          /* ── Building Directory View (when building is selected) ── */
          <BuildingDirectoryPanel
            poi={selectedPoi}
            onBack={onClear}
            onToggle={onToggle}
            open={open}
            onAsk={onAsk}
            onDirections={onDirections}
          />
        ) : (
          /* ── Default Campus Index View ── */
          <>
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
              <p className="eyebrow">Campus index</p>
              <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                aria-controls="campus-index"
                aria-label="Hide campus index"
                title="Hide campus index"
                className="btn-icon -mr-1"
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
                      active={p.id === focusId || p.slug === focusId}
                      isNavigating={p.id === navDestinationId || p.slug === navDestinationId}
                      onSelect={onSelect}
                      onDirections={onDirections}
                    />
                  ))}
                </ul>
              )}
            </div>

            <Stats count={visible.length} categories={categories} />
          </>
        )}
      </div>
    </>
  );
}
