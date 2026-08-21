import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Maximize, Minus, Plus } from 'lucide-react';
import { CAMPUS_CENTER, CAMPUS_ZOOM } from '../../frontend-utilities/appConstants.js';
import { usePrefersReducedMotion } from '../../custom-react-hooks/useReducedMotionPreference.js';
import { useTheme } from '../../frontend-utilities/themeContext.jsx';
import { categoryColor } from './mapMarkerGlyphs.js';
import { PoiGlyph, teardropIcon } from './mapPinIconBuilder.js';
import LocationCard from './PlaceDetailCard.jsx';

/**
 * Interactive campus map (thesis §3.5.1).
 *
 * Markers are teardrop pins: category colour in the body, a white disc at the
 * centre, and the category LETTER in that disc. The colour is the fast read
 * across a screen of 28 pins; the letter is what survives greyscale, colour
 * blindness and a printed appendix. Neither is load-bearing alone, which is
 * the only way to put colour on a map without excluding the people it
 * excludes. A legend states the mapping rather than leaving it to be inferred.
 *
 * The pin points at its coordinate rather than sitting on it — that is the
 * whole reason the shape exists, and it is why `iconAnchor` is the tip.
 *
 * Searching and filtering live in the campus index beside this map, not in a
 * toolbar above it. They were here first; they moved when the index arrived,
 * because two search boxes on one screen is a question about which one is the
 * real one. This component now renders what it is given.
 *
 * Two basemaps, and SATELLITE IS THE DEFAULT. The campus is 355 hectares of
 * largely unlabelled ground: on a plan tile most of it is empty polygons, and
 * imagery is how you tell the oval from the rice fields that surround it. The
 * plan view stays one click away for when the labels matter more than the
 * ground truth.
 *
 * The plan basemap is theme-aware — CARTO publish a genuine dark cartography,
 * so the dark theme gets a real nighttime map rather than the day map with a
 * filter dropped over it.
 */
const CARTO_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const BASEMAPS = {
  satellite: {
    label: 'Satellite',
    url: () => 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    // Roads and place names, drawn over the imagery. Esri publish this as a
    // companion to World_Imagery, which is the licensed way to get the hybrid
    // view — the reference project pulled Google's `lyrs=y` tiles straight off
    // an undocumented endpoint, which is not something to put in a thesis.
    reference: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  plan: {
    label: 'Plan',
    url: (theme) => `https://{s}.basemaps.cartocdn.com/${theme === 'dark' ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png`,
    attribution: CARTO_ATTRIBUTION,
    maxZoom: 20,
  },
};

const CTRL = 'grid h-7 w-8 place-items-center text-fg-muted transition-colors duration-state hover:bg-bg-sunken hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus';


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

/**
 * Frames the whole campus, once, from the locations actually loaded.
 *
 * A hardcoded centre goes stale the moment the data moves — this map spent the
 * whole integration opening on the town of San Fabian because its centre was
 * still the synthetic placeholder's. Bounds derived from the markers cannot
 * drift: correct a coordinate in the GPS survey and the opening view corrects
 * itself.
 *
 * Runs once. A user who has panned somewhere has not asked to be sent back.
 */
function FitCampus({ bounds, offsetX, skip }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || skip || !bounds) return;
    done.current = true;
    map.fitBounds(bounds, {
      paddingTopLeft: [offsetX + 48, 48],
      paddingBottomRight: [48, 48],
      animate: false,
    });
  }, [bounds, map, offsetX, skip]);
  return null;
}

function FocusController({ target, offsetX = 0 }) {
  const map = useMap();
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    if (!target) return;

    // The campus index overlays the left of the map, so the geometric centre
    // is not the visible centre. Flying to the raw coordinate puts the pin
    // behind the panel that asked for it. Shifting the destination by half the
    // panel width lands it in the middle of what the user can actually see.
    const zoom = 18;
    const point = map.project([target.lat, target.lng], zoom).subtract([offsetX / 2, 0]);
    const dest = map.unproject(point, zoom);

    // Map focus is meaningful motion — it carries the user from where they
    // were to where they asked about. Reduced motion still moves, instantly.
    if (reduced) map.setView(dest, zoom);
    else map.flyTo(dest, zoom, { duration: 0.6 });
  }, [target, map, reduced, offsetX]);
  return null;
}

/**
 * Hands the Leaflet instance up to the component so the toolbar can drive it.
 * `useMap` only works inside MapContainer, and the zoom controls deliberately
 * live outside it — see the toolbar comment below.
 */
function MapHandle({ onReady }) {
  const map = useMap();
  useEffect(() => { onReady(map); }, [map, onReady]);
  return null;
}

export default function CampusMap({
  pois = [], visible = [], focusId, onSelect, onClear, onAsk, focusOffsetX = 0,
}) {
  const [basemap, setBasemap] = useState('satellite');
  const [map, setMap] = useState(null);
  const { theme } = useTheme();
  const initialFocus = useRef(Boolean(focusId)).current;

  // Escape clears the selection too — the same affordance a keyboard user
  // reaches for, and the only way to clear it without a pointer.
  useEffect(() => {
    if (!focusId) return;
    const onKey = (e) => { if (e.key === 'Escape') onClear?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusId, onClear]);

  // Looked up in the FULL set, not the filtered one. An answer that focuses a
  // library while the filter reads "Colleges" should still move the map — the
  // alternative is a focus request that silently does nothing.
  const focus = useMemo(() => pois.find((p) => p.id === focusId), [pois, focusId]);
  const legend = useMemo(
    () => [...new Set(visible.map((p) => p.type))].slice(0, 7),
    [visible],
  );

  // Selection can come from the index, an answer, or a deep link, none of which
  // go through Leaflet. Holding the marker instances is what lets those open
  // the same popup a click would.
  const markerRefs = useRef(new Map());
  useEffect(() => {
    if (!focusId) {
      markerRefs.current.forEach((m) => m.closePopup());
      return;
    }
    const m = markerRefs.current.get(focusId);
    if (m) m.openPopup();
  }, [focusId, visible]);

  const bounds = useMemo(
    () => (pois.length ? L.latLngBounds(pois.map((p) => [p.lat, p.lng])) : null),
    [pois],
  );

  function fitCampus() {
    onClear?.();
    if (bounds && map) {
      map.fitBounds(bounds, {
        paddingTopLeft: [focusOffsetX + 48, 48],
        paddingBottomRight: [48, 48],
      });
    } else {
      map?.setView(CAMPUS_CENTER, CAMPUS_ZOOM);
    }
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-bg" data-dock data-basemap={basemap}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface px-3 py-2">
        <div className="flex overflow-hidden rounded-md border border-line" role="group" aria-label="Base map">
          {Object.entries(BASEMAPS).map(([key, b]) => (
            <button
              key={key}
              type="button"
              onClick={() => setBasemap(key)}
              aria-pressed={basemap === key}
              className={`px-2.5 py-1 text-label transition-colors duration-state ${
                basemap === key ? 'bg-fg text-bg' : 'text-fg-muted hover:text-fg'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>

        {/* Zoom and reset live in the toolbar rather than floating over the
            map. On the map they sat top-right, which is exactly where the
            docked assistant opens — so on a 768px-tall laptop the chat covered
            the only way to zoom out. A control that a second control can hide
            is not a control. Here nothing overlaps them at any size. */}
        <div className="flex items-center gap-3">
          <div className="flex overflow-hidden rounded-md border border-line" role="group" aria-label="Zoom">
            <button
              type="button"
              onClick={() => map?.zoomOut()}
              aria-label="Zoom out"
              className={CTRL}
            >
              <Minus className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => map?.zoomIn()}
              aria-label="Zoom in"
              className={`${CTRL} border-l border-line`}
            >
              <Plus className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={fitCampus}
              aria-label="Fit the whole campus"
              title="Fit the whole campus"
              className={`${CTRL} border-l border-line`}
            >
              <Maximize className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <span className="font-mono text-data text-fg-subtle" data-numeric>
            {visible.length}/{pois.length}
          </span>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <MapContainer
          center={focus ? [focus.lat, focus.lng] : CAMPUS_CENTER}
          zoom={CAMPUS_ZOOM}
          className="h-full w-full"
          zoomControl={false}
        >
          {/* Keying on the basemap forces a fresh layer rather than a URL swap,
              which otherwise leaves the previous provider's tiles cached in
              place at zoom levels the new one does not serve. */}
          <TileLayer
            key={`${basemap}-${theme}`}
            attribution={BASEMAPS[basemap].attribution}
            url={BASEMAPS[basemap].url(theme)}
            maxZoom={BASEMAPS[basemap].maxZoom}
          />
          {BASEMAPS[basemap].reference && (
            <TileLayer
              key={`${basemap}-ref`}
              url={BASEMAPS[basemap].reference}
              maxZoom={BASEMAPS[basemap].maxZoom}
            />
          )}
          <FitCampus bounds={bounds} offsetX={focusOffsetX} skip={initialFocus} />
          <FocusController target={focus} offsetX={focusOffsetX} />
          <BackgroundClick onClear={onClear} />
          <MapHandle onReady={setMap} />

          {visible.map((poi, i) => (
            <Marker
              key={poi.id}
              position={[poi.lat, poi.lng]}
              icon={teardropIcon({ type: poi.type, active: poi.id === focusId, index: i })}
              ref={(m) => { if (m) markerRefs.current.set(poi.id, m); else markerRefs.current.delete(poi.id); }}
              eventHandlers={{ click: () => onSelect?.(poi.id) }}
            >
              {/* The detail floats ON the pin rather than in a corner panel.
                  A card in the bottom-left states which building it describes;
                  a card on the pin SHOWS it, and the eye does not have to
                  carry a name across the screen to check. */}
              <Popup
                closeButton={false}
                keepInView
                autoPanPadding={[16, 16]}
                maxWidth={304}
                minWidth={220}
              >
                <LocationCard
                  poi={poi}
                  onClose={onClear}
                  onAsk={onAsk}
                  onZoom={(p) => map?.flyTo([p.lat, p.lng], 19, { duration: 0.5 })}
                />
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {legend.length > 0 && (
          <dl className="absolute bottom-3 left-3 z-[400] flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-surface px-3 py-2 shadow-sm">
            {legend.map((t) => (
              <div key={t} className="flex items-center gap-1.5">
                <dt
                  className="grid h-4 w-4 place-items-center rounded-pill"
                  style={{ background: categoryColor(t), color: 'rgb(var(--cat-ink))' }}
                >
                  <PoiGlyph type={t} size={11} />
                </dt>
                <dd className="text-label capitalize text-fg-muted">{t}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
