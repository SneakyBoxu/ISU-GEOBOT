import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  AlertCircle, ChevronDown, ChevronUp, Clock, Compass, CornerUpRight,
  ExternalLink, Footprints, Locate, MapPin, Maximize, Minus, Navigation2,
  Plus, Route, Sparkles, X,
} from 'lucide-react';
import { CAMPUS_CENTER, CAMPUS_ZOOM } from '../../frontend-utilities/appConstants.js';
import { usePrefersReducedMotion } from '../../custom-react-hooks/useReducedMotionPreference.js';
import { useTheme } from '../../frontend-utilities/themeContext.jsx';
import { categoryColor } from './mapMarkerGlyphs.js';
import { PoiGlyph, teardropIcon } from './mapPinIconBuilder.js';
import LocationCard from './PlaceDetailCard.jsx';
import {
  CAMPUS_PRESET_GATES, formatDistance, formatDuration,
} from '../../frontend-utilities/campusRoutingService.js';

const CARTO_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

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
    attribution: CARTO_ATTRIBUTION,
    maxZoom: 20,
  },
};

const CTRL = 'grid h-7 w-8 place-items-center text-fg-muted transition-colors duration-state hover:bg-bg-sunken hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus';

function originIcon(isGps, name = 'Start') {
  if (isGps) {
    return L.divIcon({
      className: 'isu-origin-marker-container',
      iconSize: [160, 48],
      iconAnchor: [80, 40],
      html: `
        <div style="display:flex; flex-direction:column; align-items:center; pointer-events:none;">
          <div style="background:rgba(15,23,42,0.85); color:#ffffff; padding:2px 8px; border-radius:9999px; font-size:11px; font-weight:600; box-shadow:0 2px 6px rgba(0,0,0,0.3); margin-bottom:4px; white-space:nowrap; border:1px solid rgba(255,255,255,0.2);">
            📍 My Location
          </div>
          <div style="position:relative; width:22px; height:22px; display:flex; align-items:center; justify-content:center;">
            <span style="position:absolute; width:22px; height:22px; border-radius:9999px; background:rgba(59,130,246,0.4); animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></span>
            <span style="position:relative; width:14px; height:14px; border-radius:9999px; background:#2563eb; border:2px solid #ffffff; box-shadow:0 2px 6px rgba(0,0,0,0.35);"></span>
          </div>
        </div>
      `,
    });
  }
  return L.divIcon({
    className: 'isu-origin-marker-container',
    iconSize: [180, 56],
    iconAnchor: [90, 52],
    html: `
      <div style="display:flex; flex-direction:column; align-items:center; pointer-events:none;">
        <div style="background:rgba(15,23,42,0.88); color:#ffffff; padding:2px 8px; border-radius:9999px; font-size:11px; font-weight:600; box-shadow:0 2px 6px rgba(0,0,0,0.3); margin-bottom:3px; white-space:nowrap; border:1px solid rgba(255,255,255,0.2); max-width:170px; overflow:hidden; text-overflow:ellipsis;">
          🟢 Start: ${name.length > 22 ? name.slice(0, 20) + '…' : name}
        </div>
        <div style="width:24px; height:24px; border-radius:9999px; background:#059669; border:2px solid #ffffff; color:#ffffff; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 8px rgba(0,0,0,0.35); font-weight:700;">
          <svg style="width:13px; height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
        </div>
        <div style="width:2px; height:5px; background:#059669;"></div>
      </div>
    `,
  });
}

function BackgroundClick({ onClear, navActive }) {
  useMapEvents({
    click: () => {
      // Don't deselect destination while navigating
      if (!navActive) onClear?.();
    },
  });
  return null;
}

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

function FocusController({ target, offsetX = 0, navActive }) {
  const map = useMap();
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    if (!target || navActive) return;
    const zoom = 18;
    const point = map.project([target.lat, target.lng], zoom).subtract([offsetX / 2, 0]);
    const dest = map.unproject(point, zoom);
    if (reduced) map.setView(dest, zoom);
    else map.flyTo(dest, zoom, { duration: 0.6 });
  }, [target, map, reduced, offsetX, navActive]);
  return null;
}

function RouteBoundsController({ routeCoordinates, offsetX = 0 }) {
  const map = useMap();
  const prevCoordsRef = useRef(null);

  useEffect(() => {
    if (!routeCoordinates || routeCoordinates.length < 2) return;
    // Prevent duplicate fits
    const coordStr = JSON.stringify(routeCoordinates);
    if (prevCoordsRef.current === coordStr) return;
    prevCoordsRef.current = coordStr;

    const b = L.latLngBounds(routeCoordinates);
    map.fitBounds(b, {
      paddingTopLeft: [offsetX + 80, 80],
      paddingBottomRight: [80, 80],
      animate: true,
      duration: 0.6,
    });
  }, [routeCoordinates, map, offsetX]);

  return null;
}

function MapHandle({ onReady }) {
  const map = useMap();
  useEffect(() => { onReady(map); }, [map, onReady]);
  return null;
}

export default function CampusMap({
  pois = [],
  visible = [],
  focusId,
  onSelect,
  onClear,
  onAsk,
  onDirections,
  focusOffsetX = 0,
  navDestination = null,
  navOrigin = null,
  navRoute = null,
  navLoading = false,
  navError = null,
  onClearNavigation,
  onSetOrigin,
  onUseGpsOrigin,
}) {
  const [basemap, setBasemap] = useState('satellite');
  const [map, setMap] = useState(null);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [originPickerOpen, setOriginPickerOpen] = useState(false);
  const { theme } = useTheme();
  const initialFocus = useRef(Boolean(focusId)).current;

  // Escape clears selection or navigation
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (navDestination) onClearNavigation?.();
        else if (focusId) onClear?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusId, navDestination, onClear, onClearNavigation]);

  const focus = useMemo(
    () => pois.find((p) => p.id === focusId || p.slug === focusId),
    [pois, focusId],
  );
  const legend = useMemo(
    () => [...new Set(visible.map((p) => p.type))].slice(0, 7),
    [visible],
  );

  const markerRefs = useRef(new Map());
  useEffect(() => {
    if (!focusId || navDestination) {
      markerRefs.current.forEach((m) => m.closePopup());
      return;
    }
    const targetPoi = pois.find((p) => p.id === focusId || p.slug === focusId);
    const m = targetPoi ? markerRefs.current.get(targetPoi.id) : markerRefs.current.get(focusId);
    if (m) m.openPopup();
  }, [focusId, visible, navDestination, pois]);

  const bounds = useMemo(
    () => (pois.length ? L.latLngBounds(pois.map((p) => [p.lat, p.lng])) : null),
    [pois],
  );

  function fitCampus() {
    onClear?.();
    if (navDestination) onClearNavigation?.();
    if (bounds && map) {
      map.fitBounds(bounds, {
        paddingTopLeft: [focusOffsetX + 48, 48],
        paddingBottomRight: [48, 48],
      });
    } else {
      map?.setView(CAMPUS_CENTER, CAMPUS_ZOOM);
    }
  }

  const googleMapsUrl = useMemo(() => {
    if (!navDestination) return null;
    const dest = `${navDestination.lat},${navDestination.lng}`;
    const orig = navOrigin ? `${navOrigin.lat},${navOrigin.lng}` : '';
    return `https://www.google.com/maps/dir/?api=1&origin=${orig}&destination=${dest}&travelmode=walking`;
  }, [navDestination, navOrigin]);

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-bg" data-dock data-basemap={basemap}>
      {/* Map top toolbar */}
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

        <div className="flex items-center gap-3">
          {navDestination && (
            <div className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-subtle px-2.5 py-0.5 text-label font-medium text-accent">
              <Footprints className="h-3.5 w-3.5 animate-pulse" aria-hidden />
              <span>Route navigation active</span>
            </div>
          )}

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

          <FitCampus bounds={bounds} offsetX={focusOffsetX} skip={initialFocus || Boolean(navDestination)} />
          <FocusController target={focus} offsetX={focusOffsetX} navActive={Boolean(navDestination)} />
          {navRoute?.coordinates && (
            <RouteBoundsController routeCoordinates={navRoute.coordinates} offsetX={focusOffsetX} />
          )}
          <BackgroundClick onClear={onClear} navActive={Boolean(navDestination)} />
          <MapHandle onReady={setMap} />

          {/* Render Walking Route Polylines */}
          {navRoute?.coordinates && (
            <>
              {/* Outer Glow / Halo */}
              <Polyline
                positions={navRoute.coordinates}
                pathOptions={{
                  color: '#38bdf8',
                  weight: 8,
                  opacity: 0.45,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
              {/* Vibrant Inner Route Line */}
              <Polyline
                positions={navRoute.coordinates}
                pathOptions={{
                  color: '#1d4ed8',
                  weight: 4.5,
                  opacity: 0.95,
                  dashArray: '8, 8',
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            </>
          )}

          {/* Origin Marker */}
          {navOrigin && navDestination && (
            <Marker
              key={`origin-${navOrigin.lat}-${navOrigin.lng}-${navOrigin.isGps ? 'gps' : 'gate'}`}
              position={[navOrigin.lat, navOrigin.lng]}
              icon={originIcon(navOrigin.isGps, navOrigin.name)}
            />
          )}

          {/* Campus POI Markers */}
          {visible.map((poi, i) => (
            <Marker
              key={poi.id}
              position={[poi.lat, poi.lng]}
              icon={teardropIcon({
                type: poi.type,
                active: poi.id === (navDestination?.id ?? focusId),
                index: i,
              })}
              ref={(m) => {
                if (m) markerRefs.current.set(poi.id, m);
                else markerRefs.current.delete(poi.id);
              }}
              eventHandlers={{
                click: () => {
                  if (navDestination && poi.id !== navDestination.id) {
                    onSetOrigin?.({
                      id: poi.id,
                      name: poi.name,
                      lat: poi.lat,
                      lng: poi.lng,
                      type: poi.type,
                    });
                  } else {
                    onSelect?.(poi.id);
                  }
                },
              }}
            >
              {poi.id !== focusId && !navDestination && (
                <Tooltip
                  direction="top"
                  offset={[0, -38]}
                  opacity={1}
                  className="campus-map-tooltip"
                >
                  {poi.name}
                </Tooltip>
              )}

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
                  onDirections={onDirections}
                  onZoom={(p) => map?.flyTo([p.lat, p.lng], 19, { duration: 0.5 })}
                />
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* In-Map Walking Navigation Card (Floating HUD) */}
        {navDestination && (
          <div
            className="animate-enter pointer-events-auto absolute left-3 top-3 z-[450] max-h-[calc(100%-1.5rem)] w-[min(22.5rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-line bg-surface/95 shadow-xl backdrop-blur-md transition-all duration-300"
          >
            {/* Nav Card Header */}
            <div className="flex items-start justify-between border-b border-line px-3.5 pb-2.5 pt-3">
              <div className="min-w-0 flex-1 pr-2">
                <div className="flex items-center gap-1.5 text-label font-medium text-accent">
                  <Navigation2 className="h-3.5 w-3.5 fill-accent stroke-none" />
                  <span>Walking Directions</span>
                </div>
                <h3 className="mt-0.5 truncate text-body font-semibold text-fg">
                  {navDestination.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClearNavigation}
                aria-label="Exit navigation"
                className="btn-icon -mr-1 -mt-0.5 shrink-0 text-fg-subtle hover:text-fg"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {/* Nav Stats & ETA Bar */}
            <div className="max-h-[min(20rem,calc(100vh-14rem))] overflow-y-auto px-3.5 py-2.5">
              {navLoading ? (
                <div className="flex items-center gap-2.5 py-3 text-meta text-fg-muted">
                  <Footprints className="h-4 w-4 animate-bounce text-accent" />
                  <span>Calculating best campus walking path...</span>
                </div>
              ) : navError ? (
                <div className="flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 p-2.5 text-label text-error">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{navError}</span>
                </div>
              ) : navRoute ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent-subtle px-2.5 py-1.5">
                      <Clock className="h-4 w-4 text-accent" />
                      <span className="font-mono text-meta font-bold text-accent" data-numeric>
                        {formatDuration(navRoute.durationSeconds)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-lg border border-line bg-bg-sunken px-2.5 py-1.5">
                      <Compass className="h-4 w-4 text-fg-muted" />
                      <span className="font-mono text-meta font-medium text-fg" data-numeric>
                        {formatDistance(navRoute.distanceMeters)}
                      </span>
                    </div>
                    {navRoute.isFallback && (
                      <span className="rounded border border-warning/30 bg-warning-subtle px-1.5 py-0.5 text-label text-warning">
                        direct path
                      </span>
                    )}
                  </div>

                  {/* Origin Selector & Switcher */}
                  <div className="mt-3 rounded-lg border border-line bg-bg-sunken/60 p-2.5">
                    <div className="flex items-center justify-between text-label">
                      <span className="font-medium text-fg-subtle">Starting from:</span>
                      <button
                        type="button"
                        onClick={() => setOriginPickerOpen((v) => !v)}
                        className="flex items-center gap-1 font-semibold text-accent hover:underline"
                      >
                        Change
                        {originPickerOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                    </div>
                    <p className="mt-1 truncate text-meta font-medium text-fg">
                      {navOrigin?.name || 'Main Campus Gate'}
                    </p>

                    {/* Collapsible Origin Options */}
                    {originPickerOpen && (
                      <div className="mt-2 space-y-1 border-t border-line pt-2 text-label">
                        <button
                          type="button"
                          onClick={() => {
                            setOriginPickerOpen(false);
                            onUseGpsOrigin?.();
                          }}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-accent transition-colors hover:bg-accent-subtle"
                        >
                          <Locate className="h-3.5 w-3.5 shrink-0" />
                          <span className="font-medium">Use My Current GPS Location</span>
                        </button>
                        <div className="pt-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-fg-subtle">
                          Campus Gates & Landmarks
                        </div>
                        {CAMPUS_PRESET_GATES.map((gate) => (
                          <button
                            key={gate.id}
                            type="button"
                            onClick={() => {
                              setOriginPickerOpen(false);
                              onSetOrigin?.(gate);
                            }}
                            className={`flex w-full items-center justify-between rounded px-2 py-1 text-left transition-colors ${
                              navOrigin?.id === gate.id ? 'bg-accent-subtle font-medium text-accent' : 'text-fg-muted hover:bg-bg hover:text-fg'
                            }`}
                          >
                            <span className="truncate">{gate.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Step-by-Step Directions Accordion */}
                  {navRoute.steps?.length > 0 && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => setStepsOpen((v) => !v)}
                        className="flex w-full items-center justify-between rounded-md border border-line px-2.5 py-1.5 text-label font-medium text-fg transition-colors hover:bg-bg-sunken"
                      >
                        <span className="flex items-center gap-1.5">
                          <Route className="h-3.5 w-3.5 text-accent" />
                          Turn-by-turn guidance ({navRoute.steps.length} steps)
                        </span>
                        {stepsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>

                      {stepsOpen && (
                        <ol className="mt-2 space-y-1.5 rounded-lg border border-line bg-surface p-2.5 text-label">
                          {navRoute.steps.map((step, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-fg-muted">
                              <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-bg-sunken font-mono text-[0.625rem] font-bold text-fg">
                                {idx + 1}
                              </span>
                              <span className="leading-snug text-fg">{step.instruction}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Nav Card Footer */}
            <div className="flex items-center justify-between border-t border-line bg-bg-sunken/40 px-3.5 py-2 text-label">
              <button
                type="button"
                onClick={onClearNavigation}
                className="font-medium text-fg-subtle transition-colors hover:text-fg"
              >
                Exit Navigation
              </button>
              {googleMapsUrl && (
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-1 font-medium text-accent transition-colors hover:text-accent-hover hover:underline"
                >
                  <span>Google Maps</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Legend */}
        {legend.length > 0 && !navDestination && (
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
