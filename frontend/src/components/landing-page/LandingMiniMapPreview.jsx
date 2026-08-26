import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { CAMPUS_CENTER, CAMPUS_ZOOM } from '../../frontend-utilities/appConstants.js';
import { useTheme } from '../../frontend-utilities/themeContext.jsx';
import { usePrefersReducedMotion } from '../../custom-react-hooks/useReducedMotionPreference.js';
import { TYPE_LETTER, categoryColor } from '../main-assistant/mapMarkerGlyphs.js';

/**
 * The map half of the campus section.
 *
 * LAZY-LOADED ON PURPOSE. Leaflet is ~90KB gzipped and until now lived only in
 * the workspace chunk. Importing it directly here would move that weight onto
 * the landing page's critical path for a section most visitors never scroll
 * to. The parent loads this component only when the section approaches the
 * viewport, so the initial landing bundle is unchanged.
 *
 * Markers mirror the index beside it and the link runs BOTH ways: hovering a
 * row raises its marker and flies the map there, and hovering a marker raises
 * its row. The two halves are one control surface, not a list with a picture
 * next to it.
 *
 * The letter table is imported rather than local. The copy that used to live
 * here was missing `sports`, so the oval and the covered court drew as a
 * generic dot on this map while showing S everywhere else — the exact drift a
 * second copy of a lookup table always produces.
 */
function icon(type, state) {
  const size = state === 'active' ? 26 : state === 'hover' ? 22 : 18;
  const ink = categoryColor(type);
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span style="
      display:grid;place-items:center;width:${size}px;height:${size}px;
      border-radius:999px;
      background:${state === 'rest' ? 'rgb(var(--surface))' : ink};
      color:${state === 'rest' ? 'rgb(var(--fg))' : 'rgb(var(--cat-ink))'};
      border:1.5px solid ${state === 'rest' ? 'rgb(var(--line-strong))' : ink};
      box-shadow:var(--shadow-sm);
      font:600 ${size > 20 ? 11 : 9}px/1 Inter,system-ui,sans-serif;
      transition:width 160ms,height 160ms;
    ">${TYPE_LETTER[type] ?? '·'}</span>`,
  });
}

function Focus({ target }) {
  const map = useMap();
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    if (!target) { map.setView(CAMPUS_CENTER, CAMPUS_ZOOM); return; }
    if (reduced) map.setView([target.lat, target.lng], 17);
    else map.flyTo([target.lat, target.lng], 17, { duration: 0.55 });
  }, [target, map, reduced]);
  return null;
}

export default function CampusMiniMap({
  pois, hoveredId, selectedId, onSelect, onHover, className = '',
}) {
  const { theme } = useTheme();
  const target = pois.find((p) => p.id === (selectedId ?? hoveredId));

  return (
    // Height comes from the section, not from here — the same map is wanted at
    // different sizes beside a list and on its own.
    <div className={`w-full overflow-hidden rounded-xl border border-line ${className || 'h-[22rem] lg:h-[26rem]'}`}>
      <MapContainer
        center={CAMPUS_CENTER}
        zoom={CAMPUS_ZOOM}
        className="h-full w-full"
        zoomControl={false}
        scrollWheelZoom={false}
        attributionControl={false}
      >
        {/* Themed rather than fixed: a light basemap in the dark theme is a
            lit rectangle in the middle of a night page. */}
        <TileLayer
          key={theme}
          url={`https://{s}.basemaps.cartocdn.com/${theme === 'dark' ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png`}
        />
        <Focus target={target} />
        {pois.map((p) => {
          const state = p.id === selectedId ? 'active' : p.id === hoveredId ? 'hover' : 'rest';
          return (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              icon={icon(p.type, state)}
              eventHandlers={{
                click: () => onSelect?.(p.id),
                mouseover: () => onHover?.(p.id),
                mouseout: () => onHover?.(null),
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -14]}
                opacity={1}
                className="campus-map-tooltip"
              >
                {p.name}
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
