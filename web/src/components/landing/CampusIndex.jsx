import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import { api } from '../../lib/api.js';
import SectionHeader from '../patterns/SectionHeader.jsx';
import { Button, EmptyState, Skeleton } from '../ui/index.js';
import { useInView } from '../../hooks/useMotion.js';

/**
 * Campus section: a gazetteer paired with a live map.
 *
 * The two halves are one control surface — hovering a row raises its marker,
 * selecting a row focuses the map and opens a detail panel. That coupling is
 * the point: a location index that does not show you where the locations are
 * is a list of names.
 *
 * PERFORMANCE. Leaflet (~90KB gzipped) is lazy-loaded and only mounted once
 * the section approaches the viewport, so it never lands on the landing page's
 * critical path. Until then the map area holds a placeholder of the same size,
 * which also prevents a layout shift when it arrives.
 */
const CampusMiniMap = lazy(() => import('./CampusMiniMap.jsx'));

const CATEGORIES = [
  ['all', 'All'], ['college', 'Colleges'], ['administrative', 'Administrative'],
  ['laboratory', 'Laboratories'], ['library', 'Libraries'], ['facility', 'Facilities'],
];

export default function CampusIndex() {
  const [pois, setPois] = useState([]);
  const [filter, setFilter] = useState('all');
  const [state, setState] = useState('loading');
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [mapRef, mapNear] = useInView({ threshold: 0, rootMargin: '400px' });

  useEffect(() => {
    api.pois()
      .then((d) => { setPois(d.pois ?? []); setState('ready'); })
      .catch(() => setState('error'));
  }, []);

  const shown = useMemo(
    () => (filter === 'all' ? pois : pois.filter((p) => p.type === filter))
      .slice().sort((a, b) => a.name.localeCompare(b.name)),
    [pois, filter],
  );

  const available = useMemo(
    () => CATEGORIES.filter(([k]) => k === 'all' || pois.some((p) => p.type === k)),
    [pois],
  );

  const selected = pois.find((p) => p.id === selectedId);

  return (
    <section id="campus" className="border-b border-line py-20 sm:py-28">
      <div className="container-x">
        <SectionHeader eyebrow="Campus index" title="Buildings, offices and points of interest">
          Each location carries contextual metadata and a generated description
          embedded into the retrieval corpus &mdash; so a navigation question is
          answered by the same pipeline as everything else.
        </SectionHeader>

        {state === 'ready' && pois.length > 0 && (
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-line py-3">
            <span className="eyebrow">Filter</span>
            {available.map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => { setFilter(k); setSelectedId(null); }}
                aria-pressed={filter === k}
                data-active={filter === k}
                className={`link-rule text-meta transition-colors duration-state ${
                  filter === k ? 'text-fg' : 'text-fg-muted hover:text-fg'
                }`}
              >
                {label}
              </button>
            ))}
            <span className="ml-auto font-mono text-data text-fg-subtle" data-numeric>
              {shown.length} of {pois.length}
            </span>
          </div>
        )}

        <div ref={mapRef} className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
          {/* map */}
          <div className="order-2 lg:order-1 lg:sticky lg:top-28 lg:self-start">
            {state === 'ready' && pois.length > 0 && mapNear ? (
              <Suspense fallback={<div className="h-[22rem] w-full border border-line bg-bg-sunken lg:h-[26rem]" />}>
                <CampusMiniMap
                  pois={pois}
                  hoveredId={hoveredId}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              </Suspense>
            ) : (
              <div className="h-[22rem] w-full border border-line bg-bg-sunken lg:h-[26rem]" aria-hidden />
            )}

            {/* detail panel — a container that earns itself: it appears only
                when something is selected, and carries state. */}
            {selected && (
              <div className="mt-4 animate-enter border-l-2 border-accent pl-4">
                <p className="text-body font-medium text-fg">{selected.name}</p>
                {selected.department && (
                  <p className="mt-0.5 text-meta text-fg-muted">{selected.department}</p>
                )}
                {selected.description && (
                  <p className="mt-2 max-w-measure text-meta leading-relaxed text-fg-muted">
                    {selected.description}
                  </p>
                )}
                <p className="mt-2 font-mono text-data text-fg-subtle" data-numeric>
                  {Number(selected.lat).toFixed(5)}, {Number(selected.lng).toFixed(5)}
                </p>
                <Button
                  as={Link}
                  to={`/app?poi=${selected.id}`}
                  variant="text"
                  size="sm"
                  iconRight={ArrowRight}
                  className="link-arrow mt-2"
                >
                  Open in the assistant
                </Button>
              </div>
            )}
          </div>

          {/* index */}
          <div className="order-1 lg:order-2">
            {state === 'loading' && (
              <div className="border-t border-line">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-6 border-b border-line py-4">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="ml-auto h-3 w-28" />
                  </div>
                ))}
                <p className="sr-only" role="status">Loading campus locations</p>
              </div>
            )}

            {state === 'ready' && shown.length > 0 && (
              <ul className="border-t border-line">
                {shown.map((poi) => (
                  <li key={poi.id}>
                    <button
                      type="button"
                      onPointerEnter={() => setHoveredId(poi.id)}
                      onPointerLeave={() => setHoveredId(null)}
                      onFocus={() => setHoveredId(poi.id)}
                      onBlur={() => setHoveredId(null)}
                      onClick={() => setSelectedId(poi.id === selectedId ? null : poi.id)}
                      aria-pressed={poi.id === selectedId}
                      data-active={poi.id === selectedId}
                      className="row-interactive grid w-full items-baseline gap-x-6 gap-y-1 border-b border-line px-3 py-3.5 text-left sm:grid-cols-[1fr_auto]"
                    >
                      <span className="min-w-0">
                        <span className="text-body font-medium text-fg">{poi.name}</span>
                        {poi.isSynthetic && (
                          <span className="ml-2 border border-warning/40 px-1.5 py-px text-label text-warning">
                            placeholder
                          </span>
                        )}
                        <span className="mt-0.5 block text-meta text-fg-muted">
                          {[poi.department, poi.buildingFunction].filter(Boolean).join(' · ') || '—'}
                        </span>
                      </span>
                      <span className="justify-self-start font-mono text-data text-fg-subtle sm:justify-self-end" data-numeric>
                        {Number(poi.lat).toFixed(4)}, {Number(poi.lng).toFixed(4)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {state === 'ready' && pois.length === 0 && (
              <EmptyState icon={MapPin} title="No campus locations yet">
                Coordinates are collected through an on-site GPS survey of the
                ISU Echague Main Campus and verified against physical landmarks
                before they are loaded. Locations added through the campus
                location manager appear here immediately.
              </EmptyState>
            )}

            {state === 'error' && (
              <EmptyState icon={MapPin} title="Campus locations could not be loaded">
                The API did not respond. If you are running this locally, check
                that the server is started.
              </EmptyState>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
