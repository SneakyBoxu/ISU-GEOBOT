import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  Check, Copy, Crosshair, Edit3, ExternalLink, Maximize2, Minimize2,
  Minus, Move, Plus, Trash2,
} from 'lucide-react';
import { CAMPUS_CENTER, CAMPUS_ZOOM } from '../../frontend-utilities/appConstants.js';
import { useTheme } from '../../frontend-utilities/themeContext.jsx';
import { teardropIcon, draftIcon } from '../main-assistant/mapPinIconBuilder.js';

/**
 * The Campus Location editor's map.
 *
 * It replaced a 224px preview pane inside the form, which was the wrong shape
 * for every job it had: too small to recognise a roof, too small to see whether
 * a new pin sits sensibly among the others, and showing only the pin being
 * edited so there was nothing to judge it against.
 *
 * So it shows EVERY location, with the one being edited full size and
 * draggable. Placing a building is a question about where it sits relative to
 * the others, and this is the only view that can answer it.
 *
 * SATELLITE IS THE DEFAULT and that is not a preference. Checking a coordinate
 * means checking it against the thing that is actually there — a roof, a road,
 * the edge of the oval. A plan tile shows a beige polygon and confirms nothing,
 * which makes it the wrong basemap for the one screen whose entire job is
 * catching a wrong number.
 *
 * THE MAP IS AN INPUT DEVICE, NOT A WRITER. Right-clicking a pin offers Edit,
 * Reposition, Copy coordinates and Delete, but every one of those either
 * changes local form state or calls a handler the PARENT owns. Nothing here
 * talks to the server, and the endpoints the parent calls still check the role
 * server-side. A context menu is a shortcut through the UI, never around the
 * authorization.
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

/** Context-menu box, used to keep it inside the viewport. */
const MENU_W = 224;
const MENU_H = { poi: 264, point: 152 };

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

/**
 * Copy to clipboard, including where the Clipboard API does not exist.
 *
 * `navigator.clipboard` is undefined on any origin that is not HTTPS or
 * localhost, and `writeText` rejects when the document is not focused. Both
 * happen in normal use, so the caller is told whether it actually worked
 * rather than being shown a tick regardless.
 */
async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to the textarea path */ }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function MapInteraction({ onPick, onContextMenu }) {
  useMapEvents({
    click: (e) => onPick(e.latlng.lat, e.latlng.lng),
    contextmenu: (e) => {
      e.originalEvent.preventDefault();
      onContextMenu(e.latlng.lat, e.latlng.lng, e.originalEvent.clientX, e.originalEvent.clientY);
    },
  });
  return null;
}

function Controller({ target, fitTo, resizeKey }) {
  const map = useMap();

  /**
   * Leaflet measures its container once, at mount. This pane changes size
   * without the window changing size — going fullscreen, the form growing a
   * validation message, the browser pane being dragged — and a stale
   * measurement renders as grey tiles in the newly-exposed strip.
   *
   * A ResizeObserver catches every one of those. The trailing timeouts cover
   * the case where the size change is animated, so the observer fires on the
   * first frame of the transition and the final size arrives later.
   */
  useEffect(() => {
    const container = map.getContainer();
    if (!container) return undefined;

    const onResize = () => map.invalidateSize({ pan: false });
    const observer = new ResizeObserver(onResize);
    observer.observe(container);

    onResize();
    const timers = [100, 300, 600].map((ms) => setTimeout(onResize, ms));

    return () => {
      observer.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [map]);

  useEffect(() => {
    const id = setTimeout(() => map.invalidateSize({ pan: false }), 200);
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
  pois = [], editingId, lat, lng, onPick, name, onEdit, onDelete,
}) {
  const [basemap, setBasemap] = useState('satellite');
  const [full, setFull] = useState(false);
  const [recentre, setRecentre] = useState(0);
  const [copied, setCopied] = useState(false);
  const [menu, setMenu] = useState(null);   // { x, y, poi, lat, lng }
  const menuRef = useRef(null);
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

  // Dismiss the context menu on outside press or Escape. `pointerdown` rather
  // than `click`, so the menu closes on the press that starts a map drag
  // instead of hanging around through it.
  useEffect(() => {
    if (!menu) return undefined;
    const onDown = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenu(null);
    };
    const onKey = (e) => { if (e.key === 'Escape') setMenu(null); };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  // Move focus into the menu when it opens, so it is operable from the
  // keyboard and so Escape has somewhere to return from.
  useEffect(() => {
    if (menu) menuRef.current?.querySelector('[role="menuitem"]')?.focus();
  }, [menu]);

  /**
   * Place the menu against the VIEWPORT, not the map container.
   *
   * It is `position: fixed`, so viewport coordinates are the ones that apply,
   * and it is allowed to overhang the map. Clamping on both ends matters:
   * clamping only the far edge lets a right-click near the left or top of the
   * screen position the menu at a negative offset, off-screen.
   */
  const placeMenu = useCallback((clientX, clientY, kind) => {
    const h = MENU_H[kind];
    return {
      x: Math.max(8, Math.min(clientX, window.innerWidth - MENU_W - 8)),
      y: Math.max(8, Math.min(clientY, window.innerHeight - h - 8)),
    };
  }, []);

  const handleCopy = async (y, x) => {
    const ok = await copyText(`${Number(y).toFixed(6)}, ${Number(x).toFixed(6)}`);
    if (!ok) return;                       // no tick for a copy that did not happen
    setCopied(true);
    setTimeout(() => { setCopied(false); setMenu(null); }, 900);
  };

  const openMarkerMenu = (e, p) => {
    e.originalEvent.preventDefault();
    e.originalEvent.stopPropagation();
    const { x, y } = placeMenu(e.originalEvent.clientX, e.originalEvent.clientY, 'poi');
    setMenu({ x, y, poi: p, lat: Number(p.lat), lng: Number(p.lng) });
  };

  const openPointMenu = (y, x, clientX, clientY) => {
    const pos = placeMenu(clientX, clientY, 'point');
    setMenu({ x: pos.x, y: pos.y, poi: null, lat: y, lng: x });
  };

  const item = 'flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-label text-fg transition-colors duration-state hover:bg-bg-sunken focus-visible:bg-bg-sunken focus-visible:outline-none';

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

          <MapInteraction onPick={onPick} onContextMenu={openPointMenu} />
          <Controller target={draft} fitTo={draft ? null : bounds} resizeKey={`${full}-${recentre}`} />
          <Controls bounds={bounds} hasDraft={hasDraft} onLocate={() => setRecentre((n) => n + 1)} />

          {context.map((p, i) => (
            <Marker
              key={p.id}
              position={[Number(p.lat), Number(p.lng)]}
              icon={teardropIcon({ type: p.poi_type, icon: p.icon, dim: true, index: i })}
              title={`${p.name} — right-click for options`}
              eventHandlers={{ contextmenu: (e) => openMarkerMenu(e, p) }}
            >
              <Tooltip
                direction="top"
                offset={[0, -32]}
                opacity={1}
                className="campus-map-tooltip"
              >
                {p.name}
              </Tooltip>
              <Popup className="editor-popup" closeButton={false}>
                <div className="w-[min(18rem,calc(100vw-6rem))] rounded-xl border border-line bg-surface p-3.5 text-left text-fg shadow-lg">
                  <p className="truncate font-serif text-meta font-semibold leading-tight text-fg">{p.name}</p>
                  <span className="mt-1 inline-block rounded-sm bg-accent-subtle px-1.5 py-0.5 text-label font-medium uppercase tracking-wider text-accent">
                    {p.poi_type ?? 'location'}
                  </span>
                  <p className="mt-1.5 font-mono text-label text-fg-subtle" data-numeric>
                    {Number(p.lat).toFixed(5)}, {Number(p.lng).toFixed(5)}
                  </p>
                  {p.description && (
                    <p className="mt-2 line-clamp-2 border-t border-line pt-1.5 text-label leading-relaxed text-fg-muted">
                      {p.description}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-2 border-t border-line pt-2.5">
                    {onEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(p)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-accent px-2 py-1.5 text-label font-medium text-accent-contrast transition-colors duration-state hover:bg-accent-hover"
                      >
                        <Edit3 className="h-3.5 w-3.5" aria-hidden /> Edit
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(p)}
                        title={`Unpublish ${p.name}`}
                        className="flex items-center justify-center rounded-md bg-error/10 px-2.5 py-1.5 text-error transition-colors duration-state hover:bg-error hover:text-bg"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        <span className="sr-only">Unpublish {p.name}</span>
                      </button>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {draft && (
            <Marker
              position={draft}
              icon={draftIcon()}
              draggable
              title={name || 'New location — drag to reposition'}
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

      {menu && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={menu.poi ? `Options for ${menu.poi.name}` : 'Map point options'}
          style={{ top: menu.y, left: menu.x, width: MENU_W }}
          className="animate-pop fixed z-[2000] rounded-lg border border-line bg-surface/95 p-1.5 shadow-lg backdrop-blur-md"
        >
          <div className="mb-1 border-b border-line px-2.5 py-1.5">
            <p className="truncate text-label font-medium text-fg">{menu.poi ? menu.poi.name : 'Map point'}</p>
            <p className="truncate font-mono text-label text-fg-subtle" data-numeric>
              {Number(menu.lat).toFixed(5)}, {Number(menu.lng).toFixed(5)}
            </p>
          </div>

          {menu.poi ? (
            <>
              {onEdit && (
                <button type="button" role="menuitem" className={item}
                  onClick={() => { onEdit(menu.poi); setMenu(null); }}>
                  <Edit3 className="h-3.5 w-3.5 text-accent" aria-hidden /> Edit in the form
                </button>
              )}
              <button type="button" role="menuitem" className={item}
                onClick={() => { onPick(menu.lat, menu.lng); setMenu(null); }}>
                <Move className="h-3.5 w-3.5 text-fg-muted" aria-hidden /> Reposition pin
              </button>
              <button type="button" role="menuitem" className={item}
                onClick={() => handleCopy(menu.lat, menu.lng)}>
                {copied
                  ? <Check className="h-3.5 w-3.5 text-success" aria-hidden />
                  : <Copy className="h-3.5 w-3.5 text-fg-muted" aria-hidden />}
                {copied ? 'Coordinates copied' : 'Copy coordinates'}
              </button>
              <a
                role="menuitem"
                href={`/app?poi=${encodeURIComponent(menu.poi.id)}`}
                target="_blank"
                rel="noreferrer"
                className={item}
                onClick={() => setMenu(null)}
              >
                <ExternalLink className="h-3.5 w-3.5 text-fg-muted" aria-hidden /> View on public map
              </a>
              {onDelete && (
                <>
                  <div className="my-1 border-t border-line" />
                  <button
                    type="button"
                    role="menuitem"
                    className={`${item} text-error hover:bg-error/10 focus-visible:bg-error/10`}
                    onClick={() => { onDelete(menu.poi); setMenu(null); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> Unpublish location
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <button type="button" role="menuitem" className={item}
                onClick={() => { onPick(menu.lat, menu.lng); setMenu(null); }}>
                <Plus className="h-3.5 w-3.5 text-accent" aria-hidden /> Place the pin here
              </button>
              <button type="button" role="menuitem" className={item}
                onClick={() => handleCopy(menu.lat, menu.lng)}>
                {copied
                  ? <Check className="h-3.5 w-3.5 text-success" aria-hidden />
                  : <Copy className="h-3.5 w-3.5 text-fg-muted" aria-hidden />}
                {copied ? 'Coordinates copied' : 'Copy coordinates'}
              </button>
            </>
          )}
        </div>
      )}

      <p className="mt-1.5 shrink-0 text-label text-fg-subtle">
        {hasDraft
          ? 'Drag the pin, or right-click any location for options. Check it against a landmark on the satellite view before saving.'
          : 'Right-click a pin to edit, reposition or unpublish it. Nothing is saved until you use the form.'}
      </p>
    </div>
  );
}
