import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  Check, Copy, Crosshair, Edit3, ExternalLink, Maximize2, Minimize2,
  Minus, Move, Navigation, Plus, Trash2,
} from 'lucide-react';
import { CAMPUS_CENTER, CAMPUS_ZOOM } from '../../lib/constants.js';
import { useTheme } from '../../lib/theme.jsx';
import { teardropIcon, draftIcon } from '../app/pinIcon.js';

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

function toCoord(v) {
  if (v === '' || v === null || v === undefined) return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function MapInteractionHandler({ onPick, onRightClickMap }) {
  useMapEvents({
    click: (e) => {
      onPick(e.latlng.lat, e.latlng.lng);
    },
    contextmenu: (e) => {
      e.originalEvent.preventDefault();
      onRightClickMap(e.latlng.lat, e.latlng.lng, e.originalEvent.clientX, e.originalEvent.clientY);
    },
  });
  return null;
}

function Controller({ target, fitTo, resizeKey }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    if (!container) return undefined;

    const onResize = () => {
      map.invalidateSize({ pan: false });
    };

    const observer = new ResizeObserver(onResize);
    observer.observe(container);

    onResize();
    const t1 = setTimeout(onResize, 100);
    const t2 = setTimeout(onResize, 300);
    const t3 = setTimeout(onResize, 600);

    return () => {
      observer.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [map]);

  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize({ pan: false }), 200);
    return () => clearTimeout(t);
  }, [resizeKey, map]);

  useEffect(() => {
    if (target) map.setView(target, Math.max(map.getZoom(), 18));
    else if (fitTo) map.fitBounds(fitTo, { padding: [48, 48], animate: false });
  }, [target?.[0], target?.[1], map]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const [menu, setMenu] = useState(null); // { x, y, poi, lat, lng }
  const containerRef = useRef(null);
  const { theme } = useTheme();
  const base = BASEMAPS[basemap];

  const a = toCoord(lat);
  const b = toCoord(lng);
  const hasDraft = Number.isFinite(a) && Number.isFinite(b);
  const draft = hasDraft ? [a, b] : null;

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

  // Close context menu on document click or escape
  useEffect(() => {
    const close = (e) => {
      if (menu && !e.target.closest('#editor-context-menu')) {
        setMenu(null);
      }
    };
    const onKey = (e) => { if (e.key === 'Escape') setMenu(null); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const handleCopyCoords = (y, x) => {
    const text = `${Number(y).toFixed(6)}, ${Number(x).toFixed(6)}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setMenu(null);
    }, 1000);
  };

  const handleMarkerContextMenu = (e, p) => {
    e.originalEvent.preventDefault();
    e.originalEvent.stopPropagation();
    
    // Position relative to viewport or map container
    const rect = containerRef.current?.getBoundingClientRect();
    const x = Math.min(e.originalEvent.clientX, (rect?.right ?? window.innerWidth) - 220);
    const y = Math.min(e.originalEvent.clientY, (rect?.bottom ?? window.innerHeight) - 260);

    setMenu({
      x,
      y,
      poi: p,
      lat: p.lat,
      lng: p.lng,
    });
  };

  const handleMapContextMenu = (y, x, clientX, clientY) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const posX = Math.min(clientX, (rect?.right ?? window.innerWidth) - 220);
    const posY = Math.min(clientY, (rect?.bottom ?? window.innerHeight) - 180);

    setMenu({
      x: posX,
      y: posY,
      poi: null,
      lat: y,
      lng: x,
    });
  };

  return (
    <div
      ref={containerRef}
      className={full
        ? 'fixed inset-0 z-[1100] flex flex-col bg-bg p-3'
        : 'flex h-full min-h-0 flex-col relative'}
    >
      <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
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
        </div>

        <div className="flex items-center gap-2">
          <p className="font-mono text-data text-fg-subtle text-xs" data-numeric>
            {hasDraft ? `${a.toFixed(5)}, ${b.toFixed(5)}` : 'Click or right-click to place pin'}
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

          <MapInteractionHandler onPick={onPick} onRightClickMap={handleMapContextMenu} />
          <Controller target={draft} fitTo={draft ? null : bounds} resizeKey={`${full}-${recentre}`} />
          <Controls bounds={bounds} hasDraft={hasDraft} onLocate={() => setRecentre((n) => n + 1)} />

          {context.map((p, i) => (
            <Marker
              key={p.id}
              position={[Number(p.lat), Number(p.lng)]}
              icon={teardropIcon({ type: p.poi_type || p.category, icon: p.icon, dim: false, index: i })}
              title={`${p.name} (Right-click for options)`}
              eventHandlers={{
                contextmenu: (e) => handleMarkerContextMenu(e, p),
              }}
            >
              <Popup className="editor-popup" closeButton={false}>
                <div className="w-[min(18rem,calc(100vw-6rem))] overflow-hidden rounded-xl border border-line bg-surface p-3.5 shadow-2xl text-left pointer-events-auto text-fg">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-serif font-bold text-sm text-fg leading-tight truncate">{p.name}</p>
                      <span className="mt-1 inline-block text-[10px] uppercase font-semibold tracking-wider text-accent bg-accent-subtle px-1.5 py-0.5 rounded">
                        {p.poi_type || p.category || 'Location'}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-[11px] font-mono text-fg-subtle mt-1.5" data-numeric>
                    {Number(p.lat).toFixed(5)}, {Number(p.lng).toFixed(5)}
                  </p>

                  {p.description && (
                    <p className="text-xs text-fg-muted mt-2 line-clamp-2 leading-relaxed border-t border-line/50 pt-1.5">
                      {p.description}
                    </p>
                  )}

                  <div className="mt-3 flex items-center gap-2 border-t border-line/60 pt-2.5">
                    {onEdit && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(p);
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 px-2 bg-accent text-white rounded-md hover:bg-accent-hover transition-colors shadow-sm"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(p.id, p.name);
                        }}
                        className="flex items-center justify-center gap-1 text-xs font-medium py-1.5 px-2.5 bg-danger/10 text-danger rounded-md hover:bg-danger hover:text-white transition-colors"
                        title="Delete Location"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
              title={name || 'New location (Drag to reposition)'}
              eventHandlers={{
                dragend: (e) => {
                  const { lat: y, lng: x } = e.target.getLatLng();
                  onPick(y, x);
                },
              }}
            >
              <Popup autoPan={false} closeButton={false}>
                <div className="w-48 overflow-hidden rounded-xl border border-line bg-surface p-2.5 shadow-xl text-left pointer-events-auto text-fg">
                  <p className="font-bold text-xs text-fg leading-tight">{name || 'Selected Pin'}</p>
                  <p className="text-[11px] text-fg-muted mt-0.5">Drag marker to adjust position</p>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* Floating Right-Click Context Menu */}
      {menu && (
        <div
          id="editor-context-menu"
          style={{ top: menu.y, left: menu.x }}
          className="fixed z-[2000] w-56 rounded-lg border border-line bg-surface/95 backdrop-blur-md shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-100"
        >
          {menu.poi ? (
            <>
              <div className="px-2.5 py-1.5 border-b border-line/60 mb-1">
                <p className="font-medium text-xs text-fg truncate">{menu.poi.name}</p>
                <p className="text-[10px] text-fg-subtle font-mono truncate">
                  {Number(menu.poi.lat).toFixed(5)}, {Number(menu.poi.lng).toFixed(5)}
                </p>
              </div>

              {onEdit && (
                <button
                  type="button"
                  onClick={() => {
                    onEdit(menu.poi);
                    setMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-fg rounded-md hover:bg-accent-subtle hover:text-accent transition-colors"
                >
                  <Edit3 className="h-3.5 w-3.5 text-accent" />
                  <span>Edit Location in Form</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onPick(Number(menu.poi.lat), Number(menu.poi.lng));
                  setMenu(null);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-fg rounded-md hover:bg-bg-sunken transition-colors"
              >
                <Move className="h-3.5 w-3.5 text-fg-muted" />
                <span>Move / Reposition Pin</span>
              </button>

              <button
                type="button"
                onClick={() => handleCopyCoords(menu.poi.lat, menu.poi.lng)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-fg rounded-md hover:bg-bg-sunken transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5 text-fg-muted" />}
                <span>{copied ? 'Coordinates Copied!' : 'Copy Coordinates'}</span>
              </button>

              <a
                href={`/app?poi=${menu.poi.id}`}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-fg rounded-md hover:bg-bg-sunken transition-colors"
                onClick={() => setMenu(null)}
              >
                <ExternalLink className="h-3.5 w-3.5 text-fg-muted" />
                <span>View on Public Map</span>
              </a>

              {onDelete && (
                <>
                  <div className="border-t border-line/60 my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(menu.poi.id, menu.poi.name);
                      setMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-danger rounded-md hover:bg-danger/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-danger" />
                    <span>Delete Location</span>
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <div className="px-2.5 py-1.5 border-b border-line/60 mb-1">
                <p className="font-medium text-xs text-fg">Map Point</p>
                <p className="text-[10px] text-fg-subtle font-mono">
                  {Number(menu.lat).toFixed(5)}, {Number(menu.lng).toFixed(5)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  onPick(menu.lat, menu.lng);
                  setMenu(null);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-fg rounded-md hover:bg-accent-subtle hover:text-accent transition-colors"
              >
                <Plus className="h-3.5 w-3.5 text-accent" />
                <span>Add New Location Here</span>
              </button>

              <button
                type="button"
                onClick={() => handleCopyCoords(menu.lat, menu.lng)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-fg rounded-md hover:bg-bg-sunken transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5 text-fg-muted" />}
                <span>{copied ? 'Coordinates Copied!' : 'Copy Coordinates'}</span>
              </button>
            </>
          )}
        </div>
      )}

      <p className="mt-1.5 shrink-0 text-label text-fg-subtle">
        {hasDraft
          ? 'Pin selected. Drag the marker or right-click any location for options. Check satellite view before saving.'
          : '💡 Right-click any marker to edit, reposition, or delete. Click or right-click anywhere to place a new pin.'}
      </p>
    </div>
  );
}
