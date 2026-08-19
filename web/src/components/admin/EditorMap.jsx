import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Crosshair, Maximize2, Minimize2, Minus, Plus } from 'lucide-react';
import { CAMPUS_CENTER, CAMPUS_ZOOM } from '../../lib/constants.js';
import { useTheme } from '../../lib/theme.jsx';
import { teardropIcon, draftIcon } from '../app/pinIcon.js';

/**
 * The Campus Location editor's map.
 *
 * It replaced a 224px preview pane inside the form, which was the wrong shape
 * for every job it had: too small to recognise a roof, too small to see whether
 * a new pin sits sensibly among the others, and showing only the pin being
 * edited so there was nothing to judge it against.
 *
 * So it shows EVERY location, dimmed, with the one being edited full size and
 * draggable. Placing a building is a question about where it sits relative to
 * the others, and this is the only view that can answer it.
 *
 * SATELLITE IS THE DEFAULT and that is not a preference. Checking a coordinate
 * means checking it against the thing that is actually there — a roof, a road,
 * the edge of the oval. A plan tile shows a beige polygon and confirms nothing,
 * which makes it the wrong basemap for the one screen whose entire job is
 * catching a wrong number.
 *
 * READ-ONLY except through the form. Dragging a pin changes the coordinate in
 * the form; nothing here writes to the server. The save button is still the
 * only thing that calls an endpoint, and that endpoint still checks the role.
 */
const BASEMAPS = {
  satellite: {
    label: 'Satellite',
    url: () => 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    reference: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  plan: {
    label: 'Plan',
    url: (theme) => `https://{s}.basemaps.cartocdn.com/${theme === 'dark' ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png`,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 20,
  },
};

/**
 * Empty is not zero.
 *
 * `Number('')` is 0 and `Number.isFinite(0)` is true, so an untouched form used
 * to hand this map a perfectly valid coordinate in the Gulf of Guinea — which
 * Esri serves as a grey square, making it look like the tiles had failed. They
 * had not. The map was exactly where it was told to go.
 */
function toCoord(v) {
  if (v === '' || v === null || v === undefined) return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function ClickToPlace({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

function Controller({ target, fitTo, resizeKey }) {
  const map = useMap();

  // The container changes size when the pane goes fullscreen, and Leaflet only
  // measures itself at mount.
  useEffect(() => {
    const id = setTimeout(() => map.invalidateSize(), 260);
    return () => clearTimeout(id);
  }, [resizeKey, map]);

  useEffect(() => {
    if (target) map.setView(target, Math.max(map.getZoom(), 18));
    else if (fitTo) map.fitBounds(fitTo, { padding: [48, 48], animate: false });
  }, [target?.[0], target?.[1], map]);   // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

function Controls({ bounds, onLocate, hasDraft }) {
  const map = useMap();
  const btn = 'grid h-8 w-8 place-items-center text-fg-muted transition-colors duration-state hover:bg-bg-sunken hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus';

  return (
    <div className="absolute right-3 top-3 z-[500] flex flex-col overflow-hidden rounded-md border border-line bg-surface shadow-sm">
      <button type="button" className={`${btn} border-b border-line`} onClick={() => map.zoomIn()} aria-label="Zoom in">
        <Plus className="h-4 w-4" aria-hidden />
      </button>
      <button type="button" className={`${btn} border-b border-line`} onClick={() => map.zoomOut()} aria-label="Zoom out">
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => {
          if (hasDraft) onLocate();
          else if (bounds) map.fitBounds(bounds, { padding: [48, 48] });
          else map.setView(CAMPUS_CENTER, CAMPUS_ZOOM);
        }}
        aria-label={hasDraft ? 'Centre on the location being edited' : 'Fit the whole campus'}
        title={hasDraft ? 'Centre on the location being edited' : 'Fit the whole campus'}
      >
        <Crosshair className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

export default function EditorMap({
  pois = [], editingId, lat, lng, onPick, name,
}) {
  const [basemap, setBasemap] = useState('satellite');
  const [full, setFull] = useState(false);
  const [recentre, setRecentre] = useState(0);
  const { theme } = useTheme();
  const base = BASEMAPS[basemap];

  const a = toCoord(lat);
  const b = toCoord(lng);
  const hasDraft = Number.isFinite(a) && Number.isFinite(b);
  const draft = hasDraft ? [a, b] : null;

  // Everything except the one being edited — it is drawn from the form's live
  // coordinate instead, so dragging the pin and typing in the field agree.
  const context = useMemo(
    () => pois.filter((p) => p.id !== editingId && Number.isFinite(Number(p.lat))),
    [pois, editingId],
  );

  const bounds = useMemo(() => {
    const pts = pois.filter((p) => Number.isFinite(Number(p.lat)))
      .map((p) => [Number(p.lat), Number(p.lng)]);
    return pts.length ? L.latLngBounds(pts) : null;
  }, [pois]);

  useEffect(() => {
    if (!full) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setFull(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [full]);

  return (
    <div className={full
      ? 'fixed inset-0 z-[1100] flex flex-col bg-bg p-3'
      : 'flex h-full min-h-[22rem] flex-col'}
    >
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
        <div className="flex overflow-hidden rounded-md border border-line" role="group" aria-label="Base map">
          {Object.entries(BASEMAPS).map(([key, m]) => (
            <button
              key={key}
              type="button"
              onClick={() => setBasemap(key)}
              aria-pressed={basemap === key}
              className={`px-2.5 py-1 text-label transition-colors duration-state ${
                basemap === key ? 'bg-fg text-bg' : 'text-fg-muted hover:text-fg'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <p className="font-mono text-data text-fg-subtle" data-numeric>
            {hasDraft ? `${a.toFixed(5)}, ${b.toFixed(5)}` : 'no coordinate set'}
          </p>
          <button
            type="button"
            onClick={() => setFull((v) => !v)}
            aria-pressed={full}
            aria-label={full ? 'Exit full screen' : 'Full screen map'}
            title={full ? 'Exit full screen (Esc)' : 'Full screen map'}
            className="btn-icon"
          >
            {full ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border border-line">
        <MapContainer
          center={draft ?? CAMPUS_CENTER}
          zoom={draft ? 18 : CAMPUS_ZOOM}
          className="h-full w-full"
          zoomControl={false}
        >
          <TileLayer
            key={`${basemap}-${theme}`}
            attribution={base.attribution}
            url={base.url(theme)}
            maxZoom={base.maxZoom}
          />
          {base.reference && <TileLayer key={`${basemap}-ref`} url={base.reference} maxZoom={base.maxZoom} />}

          <ClickToPlace onPick={onPick} />
          <Controller target={draft} fitTo={draft ? null : bounds} resizeKey={`${full}-${recentre}`} />
          <Controls bounds={bounds} hasDraft={hasDraft} onLocate={() => setRecentre((n) => n + 1)} />

          {context.map((p, i) => (
            <Marker
              key={p.id}
              position={[Number(p.lat), Number(p.lng)]}
              icon={teardropIcon({ type: p.poi_type, dim: true, index: i })}
              title={p.name}
              interactive={false}
            />
          ))}

          {draft && (
            <Marker
              position={draft}
              icon={draftIcon()}
              draggable
              title={name || 'New location'}
              eventHandlers={{
                dragend: (e) => {
                  const { lat: y, lng: x } = e.target.getLatLng();
                  onPick(y, x);
                },
              }}
            />
          )}
        </MapContainer>

        {!hasDraft && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] border-t border-line bg-surface/95 px-3 py-2">
            <p className="text-label text-fg-muted">
              Click anywhere on the map to place
              {name ? <strong className="font-medium text-fg"> {name}</strong> : ' this location'}.
              The other {context.length} are shown for reference.
            </p>
          </div>
        )}
      </div>

      <p className="mt-1.5 shrink-0 text-label text-fg-subtle">
        {hasDraft
          ? 'Drag the pin or click elsewhere to adjust. Check it against a landmark on the satellite view before saving.'
          : 'Nothing is saved until you use the form. This map only sets the coordinate.'}
      </p>
    </div>
  );
}
