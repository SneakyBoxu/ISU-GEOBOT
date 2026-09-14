import React, { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { CAMPUS_CENTER, CAMPUS_ZOOM } from '../../frontend-utilities/appConstants.js';
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
 * A PICTURE, NOT A CONTROL. Every Leaflet handler is off and the container is
 * pointer-events:none, so the map cannot be dragged, zoomed, clicked, tabbed
 * into or hovered. That is deliberate: this is a 414px preview of a campus,
 * and a visitor who pans it ends up looking at a field in the next barangay
 * with no way back and no reason to have gone. The real map -- pannable,
 * searchable, with the assistant beside it -- is one click away in the
 * workspace, and every card in the list opens it.
 *
 * So the link runs ONE way: hovering a row raises its marker and flies the map
 * there. Marker to row is gone with the handlers; a marker cannot be hovered
 * when nothing can reach it.
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
      /* A ring, not just a soft shadow. --shadow-sm was enough over a flat
         grey basemap; over photography a marker can land on a bright roof
         or a dark treeline in the same frame, and a blurred shadow
         disappears against both. The ring is the marker's own outline. */
      box-shadow:0 0 0 2px rgba(0,0,0,.38), var(--shadow-sm);
      font:600 ${size > 20 ? 11 : 9}px/1 Inter,system-ui,sans-serif;
      transition:width 160ms,height 160ms;
    ">${TYPE_LETTER[type] ?? '·'}</span>`,
  });
}

/**
 * Where the map looks: the hovered location, or all of them.
 *
 * FRAMED TO THE GROUP, not to a fixed centre and zoom. With only the eight
 * preview cards pinned, CAMPUS_CENTER at CAMPUS_ZOOM happened to contain them.
 * Now the map carries the whole group, and a constant zoom silently drops
 * whichever locations sit outside that one frame -- the map would be pinning
 * thirty-one places and showing maybe twenty, with no indication any were
 * missing. fitBounds is computed from the pins themselves, so every location in
 * the group is on screen whatever the group is and however the campus grows.
 *
 * The padding keeps a pin off the rounded corners, and maxZoom stops a group of
 * one from diving to street level.
 */
function Focus({ target, pois }) {
  const map = useMap();
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    if (!target) {
      const pts = pois.filter((p) => p.lat != null && p.lng != null)
        .map((p) => [p.lat, p.lng]);
      if (pts.length) map.fitBounds(pts, { padding: [34, 34], maxZoom: 17, animate: !reduced });
      else map.setView(CAMPUS_CENTER, CAMPUS_ZOOM);
      return;
    }
    if (reduced) map.setView([target.lat, target.lng], 18);
    else map.flyTo([target.lat, target.lng], 18, { duration: 0.55 });
  }, [target, pois, map, reduced]);
  return null;
}

export default function CampusMiniMap({
  pois, hoveredId, selectedId, className = '',
}) {
  const target = pois.find((p) => p.id === (selectedId ?? hoveredId));

  return (
    // Height comes from the section, not from here — the same map is wanted at
    // different sizes beside a list and on its own.
    <div
      className={`w-full overflow-hidden rounded-xl border border-line ${className || 'h-[22rem] lg:h-[26rem]'}`}
      aria-hidden
    >
      {/* EVERY HANDLER OFF, AND pointer-events NONE ON TOP.

          The flags alone are not enough: markers carry their own click and
          hover listeners regardless of what the map's handlers do, and the
          container is focusable by default, so a keyboard user tabs into a
          rectangle that does nothing. pointer-events closes the pointer side
          for good, including any handler a future edit adds. The keyboard side
          is closed by `keyboard={false}`: that is what stops Leaflet writing
          tabindex="0" onto the container, and a tabIndex prop here would NOT
          do it -- react-leaflet forwards Leaflet map options, not DOM
          attributes. aria-hidden takes it out of the accessibility tree to
          match. Verified: no tabindex, nothing focusable inside. The list
          beside it is the control surface, and it is reachable by both. */}
      <MapContainer
        center={CAMPUS_CENTER}
        zoom={CAMPUS_ZOOM}
        className="pointer-events-none h-full w-full"
        zoomControl={false}
        attributionControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
      >
        {/* SATELLITE, THE SAME IMAGERY THE WORKSPACE OPENS ON.

            This drew Esri Canvas -- a flat grey street plan -- so the landing
            page's one look at the campus was a road diagram of Echague with the
            university indistinguishable from the town around it. Imagery shows
            the actual buildings, the oval and the field boundaries, which is
            what makes a pin mean something to a first-year who has never walked
            it. InteractiveCampusMap and CampusMapEditor both DEFAULT to this
            layer for the same reason; the preview should not be the odd one out.

            No theme key. Imagery is imagery in both themes -- only the Canvas
            basemaps had light and dark editions -- so nothing here reacts to
            the toggle. The markers still do, through CSS variables.

            Two layers: World_Imagery is the photography, which carries no
            labels at all, and Boundaries_and_Places puts the road and place
            names back on top. Without the second one the campus reads as an
            aerial photo with no way to orient yourself.

            maxNativeZoom is gone with Canvas: imagery has real tiles over
            Echague to z19, so the fly-to at z17 fetches rather than upscales. */}
        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" />
        <Focus target={target} pois={pois} />
        {pois.map((p) => {
          const state = p.id === selectedId ? 'active' : p.id === hoveredId ? 'hover' : 'rest';
          return (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              icon={icon(p.type, state)}
              interactive={false}
              keyboard={false}
            >
              {/* PERMANENT, AND ONLY WHILE ITS CARD IS HOVERED.

                  A tooltip opens on marker hover, which no longer happens --
                  so left as it was, the map would raise and fly to a location
                  and never name it, and the caption's promise that hovering a
                  row finds it on the map would go half-answered. Rendering it
                  permanently for the one active marker moves the trigger from
                  the map to the list, which is where the pointer now is. */}
              {state !== 'rest' && (
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -14]}
                  opacity={1}
                  className="campus-map-tooltip"
                >
                  {p.name}
                </Tooltip>
              )}
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
