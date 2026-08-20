import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { CAMPUS_CENTER, CAMPUS_ZOOM } from '../../lib/constants.js';
import { useTheme } from '../../lib/theme.jsx';
import { usePrefersReducedMotion } from '../../hooks/useMotion.js';

/**
 * The map half of the campus section.
 *
 * LAZY-LOADED ON PURPOSE. Leaflet is ~90KB gzipped and until now lived only in
 * the workspace chunk. Importing it directly here would move that weight onto
 * the landing page's critical path for a section most visitors never scroll
 * to. The parent loads this component only when the section approaches the
 * viewport, so the initial landing bundle is unchanged.
 *
 * Markers mirror the index beside it: hovering a row raises its marker,
 * selecting a row focuses the map. The two halves are one control surface.
 */
import { getIconSvg } from '../app/pinIcon.js';

function icon(type, state) {
  const size = state === 'active' ? 26 : state === 'hover' ? 22 : 18;
  const glyphSvg = getIconSvg(type);
  const iconSize = Math.max(10, size - 8);
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span style="
      display:grid;place-items:center;width:${size}px;height:${size}px;
      border-radius:999px;
      background:${state === 'active' ? 'rgb(var(--accent))' : 'rgb(var(--surface))'};
      color:${state === 'active' ? 'rgb(var(--accent-contrast))' : 'rgb(var(--fg))'};
      border:1.5px solid rgb(var(--${state === 'rest' ? 'fg-subtle' : state === 'active' ? 'accent' : 'fg'}));
      box-shadow:var(--shadow-sm);
      transition:width 160ms,height 160ms;
    ">
      <svg width="${iconSize}" height="${iconSize}" viewBox="6 6 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;">
        ${glyphSvg}
      </svg>
    </span>`,
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

export default function CampusMiniMap({ pois, hoveredId, selectedId, onSelect }) {
  const { theme } = useTheme();
  const target = pois.find((p) => p.id === (selectedId ?? hoveredId));

  return (
    <div className="h-[22rem] w-full border border-line lg:h-[26rem]">
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
              eventHandlers={{ click: () => onSelect?.(p.id) }}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
