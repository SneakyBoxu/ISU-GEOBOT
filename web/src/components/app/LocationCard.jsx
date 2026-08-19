import { CornerUpRight, MapPin, MessageSquarePlus, X, ZoomIn } from 'lucide-react';
import { Button } from '../ui/index.js';
import { categoryColor, iconFor } from './markerGlyph.js';

/**
 * The selected location, floating on its own pin.
 *
 * It is the content of a Leaflet popup, which is why it carries no positioning
 * of its own — it is anchored to the marker and moves with the map.
 *
 * On the pin rather than in a corner, for the obvious reason: a panel in the
 * bottom-left has to NAME the building it describes and trust the reader to
 * find it among twenty-seven others, while a card on the pin has already
 * pointed at it. It is also why the index stays a list — putting the detail
 * there as well would cost the reader their place in it every time they looked
 * something up.
 *
 * Read-only, like everything else the map surfaces. Editing a location happens
 * in the Campus Location portal behind an authenticated, role-checked endpoint,
 * and nothing on this card reaches a write path.
 */
/**
 * Coordinates as a reader states them, not as a database stores them.
 *
 * 16.71854°N rather than a bare signed decimal: the hemisphere is the half of
 * a coordinate a person can actually check, and a minus sign in front of a
 * longitude is not something anyone reads as "west".
 */
function coord(lat, lng) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(5)}°${ns}, ${Math.abs(lng).toFixed(5)}°${ew}`;
}

export default function LocationCard({ poi, onClose, onAsk, onZoom }) {
  if (!poi) return null;
  const Icon = iconFor(poi.type, poi.icon);

  return (
    // Sized against the MAP, not the window: on a phone the index rail takes
    // 44px off the left and the pin itself needs room either side, so a card
    // measured off the viewport hangs over the edge before auto-pan can fix it.
    <div className="animate-enter pointer-events-auto w-[min(19rem,calc(100vw-6rem))] overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
      <div className="flex items-start gap-3 px-4 pb-2 pt-3.5">
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
          style={{
            background: categoryColor(poi.type, 0.16),
            color: categoryColor(poi.type),
          }}
        >
          <Icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={2} />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="text-body font-semibold leading-snug text-fg">{poi.name}</h2>
          <p
            className="mt-1.5 inline-block rounded-pill px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.09em]"
            style={{
              color: categoryColor(poi.type),
              background: categoryColor(poi.type, 0.16),
            }}
          >
            {poi.type}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close location details"
          className="btn-icon -mr-1.5 -mt-1 shrink-0"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="max-h-[13rem] overflow-y-auto px-4 pb-3 pt-1">
        {poi.department && (
          <p className="text-meta font-medium text-fg-muted">{poi.department}</p>
        )}
        {poi.buildingFunction && (
          <p className="mt-1 text-meta leading-relaxed text-fg-muted">{poi.buildingFunction}</p>
        )}
        {poi.description && (
          <p className="mt-2 text-meta leading-relaxed text-fg-muted">{poi.description}</p>
        )}

        <p className="mt-3 flex items-center gap-1.5 border-t border-line pt-2.5">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2} aria-hidden />
          <span className="font-mono text-data text-fg-subtle" data-numeric>
            {coord(Number(poi.lat), Number(poi.lng))}
          </span>
        </p>

        {poi.isSynthetic && (
          <p className="mt-2 rounded-sm border-l-2 border-warning bg-warning-subtle py-1.5 pl-2.5 pr-2 text-label leading-relaxed text-warning">
            Placeholder coordinates &mdash; pending GPS survey. Not research data.
          </p>
        )}
      </div>

      <div className="flex gap-1.5 border-t border-line p-2.5">
        <Button
          variant="secondary"
          size="sm"
          icon={MessageSquarePlus}
          onClick={() => onAsk(poi)}
          className="flex-1 justify-center"
        >
          Ask
        </Button>
        <Button
          as="a"
          variant="tertiary"
          size="sm"
          icon={CornerUpRight}
          href={`https://www.google.com/maps/dir/?api=1&destination=${poi.lat},${poi.lng}`}
          target="_blank"
          rel="noreferrer noopener"
          className="flex-1 justify-center"
        >
          Directions
        </Button>
        <Button
          variant="tertiary"
          size="sm"
          icon={ZoomIn}
          onClick={() => onZoom(poi)}
          aria-label={`Zoom to ${poi.name}`}
          className="shrink-0"
        />
      </div>
    </div>
  );
}
