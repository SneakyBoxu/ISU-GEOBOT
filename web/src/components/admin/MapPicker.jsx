import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { CAMPUS_CENTER } from '../../lib/constants.js';

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
 */
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

  return (
    <div>
      <div className="h-56 border border-line">
        <MapContainer center={centre} zoom={hasCoords ? 18 : 16}
                      className="h-full w-full" zoomControl={false}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
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
