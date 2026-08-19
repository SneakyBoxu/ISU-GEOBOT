import L from 'leaflet';
import { TYPE_LETTER, categoryColor } from './markerGlyph.js';

/**
 * The campus pin, in one place.
 *
 * The public map and the Campus Location editor both draw it, and two copies of
 * a marker definition is one copy away from an editor whose pins do not match
 * the map they are editing.
 *
 * A teardrop, anchored at its TIP: the shape exists to point at a coordinate,
 * and centring it would place every building half a pin north of where it
 * actually is. Category colour in the body, category letter in a white disc —
 * the colour is the fast read across a screen of pins, the letter is what
 * survives greyscale, colour blindness and a printed appendix.
 *
 * @param {object}  o
 * @param {string}  o.type      poi_type
 * @param {boolean} [o.active]  larger, ringed — the current selection
 * @param {boolean} [o.dim]     context only: present for reference, not the subject
 * @param {number}  [o.index]   staggers the entrance animation
 */
export function teardropIcon({ type, active = false, dim = false, index = 0 }) {
  const w = active ? 34 : dim ? 22 : 28;
  const h = Math.round(w * 1.28);
  const letter = TYPE_LETTER[type] ?? '·';
  const ink = categoryColor(type);
  const delay = Math.min(index * 45, 700);
  const id = `pin-${type}-${active ? 'a' : dim ? 'd' : 'r'}`;

  return L.divIcon({
    className: '',
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h + 2],
    html: `
      <span class="drop-in" style="
        display:block;width:${w}px;height:${h}px;
        animation-delay:${delay}ms;
        ${dim ? 'opacity:.55;' : ''}
        filter:drop-shadow(0 3px 4px rgb(0 0 0 / .34)) drop-shadow(0 1px 1px rgb(0 0 0 / .22));
      ">
        <svg width="${w}" height="${h}" viewBox="0 0 28 36" fill="none"
             xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#fff" stop-opacity=".26"/>
              <stop offset=".55" stop-color="#fff" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <path d="M14 35.2c0-.1 11.6-12.6 11.6-21.2A11.6 11.6 0 1 0 2.4 14c0 8.6 11.6 21.1 11.6 21.2Z"
                fill="${ink}"/>
          <path d="M14 35.2c0-.1 11.6-12.6 11.6-21.2A11.6 11.6 0 1 0 2.4 14c0 8.6 11.6 21.1 11.6 21.2Z"
                fill="url(#${id})"/>
          <path d="M14 35.2c0-.1 11.6-12.6 11.6-21.2A11.6 11.6 0 1 0 2.4 14c0 8.6 11.6 21.1 11.6 21.2Z"
                fill="none" stroke="${active ? 'rgb(var(--fg))' : 'rgb(0 0 0 / .18)'}"
                stroke-width="${active ? 1.6 : 1}"/>
          <circle cx="14" cy="13.4" r="6.4" fill="rgb(var(--pin-disc))"/>
          <text x="14" y="13.4" text-anchor="middle" dominant-baseline="central"
                fill="rgb(var(--pin-disc-ink))"
                style="font:600 9px/1 Inter,system-ui,sans-serif;letter-spacing:.02em">${letter}</text>
        </svg>
      </span>`,
  });
}

/**
 * The pin being placed, as distinct from the pins already placed.
 *
 * Deliberately NOT a teardrop: while you are dragging it, it is a coordinate
 * rather than a location, and it should not look like the twenty-eight things
 * around it that are already saved. A ringed accent dot reads as "this one is
 * live" at a glance.
 */
export function draftIcon() {
  return L.divIcon({
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html: `
      <span style="
        display:block;width:26px;height:26px;border-radius:999px;
        background:rgb(var(--accent));
        border:3px solid rgb(var(--surface));
        box-shadow:0 0 0 3px rgb(var(--accent) / .3), var(--shadow-md);
        cursor:grab;
      "></span>`,
  });
}
