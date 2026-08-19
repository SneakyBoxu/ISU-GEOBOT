import { useEffect, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { CAMPUS_CENTER } from '../../lib/constants.js';
import { useTheme } from '../../lib/theme.jsx';

/**
 * Visual verification for a coordinate.
 *
 * Typing latitude and longitude into two number fields is a completely blind
 * operation — a transposed digit puts a building in the next province and
 * nothing on screen objects. This shows the pin, and lets the administrator
 * drag it or click the map to set it.
 *
 * It is a verification aid, not a survey instrument. Thesis §3.4.1(a) still
 * requires on-site GPS mapping verified against physical landmarks; this only
 * makes a wrong number visible.
 *
 * SATELLITE IS THE DEFAULT HERE, unlike the public map's toolbar default being
 * a matter of taste. Checking a coordinate means checking it against the thing
 * that is actually there — a roof, a road, the edge of the oval. A plan tile
 * shows a beige polygon and confirms nothing, which makes it the wrong tool for
 * the one screen in this system whose entire job is catching a wrong number.
 */
const PICKER_BASEMAPS = {
  satellite: {
    label: 'Satellite',
    url: () => 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    reference: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
  },
  plan: {
    label: 'Plan',
    url: (theme) => `https://{s}.basemaps.cartocdn.com/${theme === 'dark' ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png`,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  },
};
// Keyed on the coordinate so React remounts the marker when it moves, which
// replays the placement animation — the visual confirmation that a typed
// coordinate was understood.
const pinFor = (key) => L.divIcon({
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `<span class="drop-in" data-k="${key}" style="
    display:block;width:22px;height:22px;border-radius:999px;
    background:rgb(var(--accent));border:2px solid rgb(var(--surface));
    box-shadow:var(--shadow-md);"></span>`,
});

function Recentre({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (Number.isFinite(lat) && Number.isFinite(lng)) map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

function ClickCapture({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function MapPicker({ lat, lng, onPick }) {
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const centre = hasCoords ? [lat, lng] : CAMPUS_CENTER;
  const [basemap, setBasemap] = useState('satellite');
  const { theme } = useTheme();
  const base = PICKER_BASEMAPS[basemap];

  return (
    <div>
      <div className="mb-1.5 flex justify-end">
        <div className="flex overflow-hidden rounded-md border border-line" role="group" aria-label="Base map">
          {Object.entries(PICKER_BASEMAPS).map(([key, b]) => (
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
      </div>
      <div className="h-56 overflow-hidden rounded-md border border-line">
        <MapContainer center={centre} zoom={hasCoords ? 18 : 16}
                      className="h-full w-full" zoomControl={false}>
          <TileLayer key={`${basemap}-${theme}`} attribution={base.attribution} url={base.url(theme)} />
          {base.reference && <TileLayer key={`${basemap}-ref`} url={base.reference} />}
          <ClickCapture onPick={onPick} />
          {hasCoords && (
            <>
              <Recentre lat={lat} lng={lng} />
              <Marker
                key={`${lat.toFixed(5)},${lng.toFixed(5)}`}
                position={[lat, lng]} icon={pinFor(`${lat},${lng}`)} draggable
                eventHandlers={{
                  dragend: (e) => {
                    const { lat: a, lng: b } = e.target.getLatLng();
                    onPick(a, b);
                  },
                }}
              />
            </>
          )}
        </MapContainer>
      </div>
      <p className="field-hint">
        {hasCoords
          ? 'Drag the marker or click the map to adjust. Check the pin against a landmark before saving.'
          : 'Click the map to place a marker, or type coordinates above.'}
      </p>
    </div>
  );
}
