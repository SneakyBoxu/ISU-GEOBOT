import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { CAMPUS_CENTER, CAMPUS_ZOOM } from '../../lib/constants.js';
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
const TYPE_LETTER = {
  college: 'C', administrative: 'A', laboratory: 'L',
  library: 'B', facility: 'F', landmark: 'M', other: '·',
};

function icon(type, state) {
  const size = state === 'active' ? 26 : state === 'hover' ? 22 : 18;
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

export default function CampusMiniMap({ pois, hoveredId, selectedId, onSelect }) {
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
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
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
