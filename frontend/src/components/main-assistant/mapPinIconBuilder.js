import React from 'react';
import L from 'leaflet';
import { categoryColor } from './mapMarkerGlyphs.js';

/**
 * The campus pin, in one place.
 *
 * The public map and the Campus Location editor both draw it, and two copies of
 * a marker definition is one copy away from an editor whose pins do not match
 * the map they are editing.
 *
 * A teardrop, anchored at its TIP: the shape exists to point at a coordinate,
 * and centring it would place every building half a pin north of where it
 * actually is. Category colour in the body, a vector glyph in a white disc.
 *
 * WHY A GLYPH AND NOT A LETTER. The disc used to hold `TYPE_LETTER[type]` — "C"
 * for college, "L" for library. The reasoning was that a letter survives
 * greyscale and a printed appendix, which is true, but so does a line drawing,
 * and a graduation cap says "college" to someone who has never seen the legend.
 * A letter only works if you have already read the key; twenty-nine pins reading
 * C, C, C, A, L is a cipher, not a map.
 *
 * The legends elsewhere render the SAME glyph through `PoiGlyph` below. That
 * coupling is deliberate: a legend that explains marks the map does not draw is
 * worse than no legend, so both come from `getIconSvg`.
 */

/**
 * The glyph inside the disc, as raw SVG children.
 *
 * Resolution order is icon-name first, then poi_type, then a graduation cap as
 * the fallback — an academic campus is mostly academic buildings, so the
 * fallback is right more often than a generic dot.
 *
 * Icon names are matched loosely (`includes`) and normalised for FontAwesome
 * spellings, because the value in `poi.icon` is typed by a human in the Campus
 * Location portal and arrives as any of `library`, `fa-book`, or `fas fa-book`.
 *
 * Geometry note: every path is drawn for a 28x36 viewBox with the disc centred
 * at (14, 13.4), radius 6.6. Keep new glyphs inside that circle.
 */
export function getIconSvg(type = '', icon = '') {
  const t = String(type || '').toLowerCase();
  const ic = String(icon || '').toLowerCase().replace(/^fas fa-/, '').replace(/^fa-/, '');

  if (ic.includes('book') || t === 'library') {
    return `
      <path d="M9.2 10.2 C10.6 9.7 12.3 10.1 14 11.2 C15.7 10.1 17.4 9.7 18.8 10.2 V16.5 C17.4 16 15.7 16.4 14 17.3 C12.3 16.4 10.6 16 9.2 16.5 Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M14 11.2 V17.3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    `;
  }

  if (ic.includes('hospital') || ic.includes('stethoscope') || ic.includes('clinic') || ic.includes('infirmary') || ic.includes('med')) {
    return `
      <path d="M12.4 9.2 H15.6 V11.6 H18 V14.8 H15.6 V17.2 H12.4 V14.8 H10 V11.6 H12.4 Z" fill="currentColor" opacity="0.95"/>
    `;
  }

  if (ic.includes('utensil') || ic.includes('canteen') || ic.includes('food') || ic.includes('dining')) {
    return `
      <path d="M9.8 9.2 V12.2 C9.8 13.1 10.8 13.5 10.8 14.4 V17.4 M10.8 9.2 V11.5 M12.2 9.2 V12.2 C12.2 13.1 11.2 13.5 11.2 14.4 M16.8 9.2 C15.4 9.2 15.4 12.2 15.4 13.5 C15.4 14.4 16.8 14.4 16.8 17.4 V9.2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    `;
  }

  if (ic.includes('cpu') || ic.includes('laptop') || ic.includes('computer') || ic.includes('code') || ic.includes('network')) {
    return `
      <rect x="10.8" y="10.2" width="6.4" height="6.4" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>
      <path d="M12.5 8.6 V10.2 M15.5 8.6 V10.2 M12.5 16.6 V18.2 M15.5 16.6 V18.2 M9.2 12 H10.8 M9.2 14.8 H10.8 M17.2 12 H18.8 M17.2 14.8 H18.8" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
    `;
  }

  if (ic.includes('running') || ic.includes('trophy') || ic.includes('sport') || ic.includes('dumbbell') || t === 'sports') {
    return `
      <path d="M10.8 9.2 H17.2 V12.8 C17.2 14.4 15.8 15.6 14 15.6 C12.2 15.6 10.8 14.4 10.8 12.8 Z M14 15.6 V17.4 M11.8 17.4 H16.2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M10.8 10.4 H9.2 C9.2 12 10.4 13 10.8 13.2 M17.2 10.4 H18.8 C18.8 12 17.6 13 17.2 13.2" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
    `;
  }

  if (ic.includes('flask') || ic.includes('microscope') || ic.includes('science') || t === 'laboratory') {
    return `
      <path d="M12.6 9.2 H15.4 M13.1 9.2 V11.8 L10 16.6 C9.6 17.2 10 17.8 10.8 17.8 H17.2 C18 17.8 18.4 17.2 18 16.6 L14.9 11.8 V9.2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M11.4 15.2 H16.6" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
    `;
  }

  if (ic.includes('shield') || ic.includes('security') || ic.includes('gate') || ic.includes('dungeon')) {
    return `
      <path d="M14 9.2 L18 10.8 V13.8 C18 16.2 15.8 17.6 14 18.1 C12.2 17.6 10 16.2 10 13.8 V10.8 Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M12.2 13.4 L13.4 14.6 L15.8 11.8" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    `;
  }

  if (ic.includes('tree') || ic.includes('park') || ic.includes('nature') || ic.includes('seedling') || ic.includes('leaf') || ic.includes('wheat')) {
    return `
      <path d="M14 9.2 L10.5 13.2 H12.2 L9.8 16.4 H18.2 L15.8 13.2 H17.5 Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M14 16.4 V18.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
    `;
  }

  if (ic.includes('bike') || ic.includes('bicycle')) {
    return `
      <circle cx="10.8" cy="15.2" r="1.8" fill="none" stroke="currentColor" stroke-width="1.1"/>
      <circle cx="17.2" cy="15.2" r="1.8" fill="none" stroke="currentColor" stroke-width="1.1"/>
      <path d="M10.8 15.2 L13 11.8 H14.8 L17.2 15.2 M13 11.8 L14 15.2 L16.2 12.2" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
    `;
  }

  if (ic.includes('tools') || ic.includes('wrench') || ic.includes('gear') || ic.includes('cogs') || ic.includes('industry')) {
    return `
      <path d="M16.5 10.2 A2.2 2.2 0 0 0 13.8 12.8 L10.6 16 L12 17.4 L15.2 14.2 A2.2 2.2 0 0 0 17.8 11.5 L16.2 11.5 L15.8 10.2 Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"/>
    `;
  }

  if (ic.includes('users') || ic.includes('student') || ic.includes('plaza') || ic.includes('osas')) {
    return `
      <circle cx="12.5" cy="11.2" r="1.8" fill="none" stroke="currentColor" stroke-width="1.1"/>
      <path d="M9.8 16.6 C9.8 14.6 11.2 13.8 12.5 13.8 C13.8 13.8 15.2 14.6 15.2 16.6" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
      <circle cx="16" cy="11.8" r="1.3" fill="none" stroke="currentColor" stroke-width="1"/>
      <path d="M15.5 14.6 C16.4 14.7 17.6 15.2 17.6 16.6" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
    `;
  }

  if (ic.includes('building-columns') || ic.includes('landmark') || ic.includes('theater') || ic.includes('music') || t === 'administrative' || t === 'landmark') {
    return `
      <path d="M9.4 10.2 L14 8 L18.6 10.2 H9.4 Z M10.4 11 V15.6 M12.8 11 V15.6 M15.2 11 V15.6 M17.6 11 V15.6 M9 16.2 H19" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    `;
  }

  if (ic.includes('bed') || ic.includes('dormitory') || t === 'facility') {
    return `
      <rect x="9.5" y="9.2" width="9" height="8.4" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>
      <path d="M11.6 11.4 H12.6 M15.4 11.4 H16.4 M11.6 13.8 H12.6 M15.4 13.8 H16.4 M13 17.6 V15.4 H15 V17.6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    `;
  }

  // Academic / college — the graduation cap, and the default.
  return `
    <path d="M14 9.4 L8.8 11.8 L14 14.2 L19.2 11.8 Z" fill="currentColor" />
    <path d="M10.2 13.2 V15.4 C10.2 16.6 14 17.4 14 17.4 C14 17.4 17.8 16.6 17.8 15.4 V13.2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
    <path d="M19.2 12 V15.8" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" />
  `;
}

/**
 * The same glyph, as a React element, for legends and list rows.
 *
 * `React.createElement` rather than JSX because this module is a `.js` file
 * shared with the Leaflet icon builders, which are plain string templates.
 */
export function PoiGlyph({ type, icon, size = 16, className = '' }) {
  return React.createElement('svg', {
    width: size,
    height: size,
    viewBox: '6 6 16 16',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    className,
    'aria-hidden': 'true',
    dangerouslySetInnerHTML: { __html: getIconSvg(type, icon) },
  });
}

/**
 * @param {object}  o
 * @param {string}  o.type      poi_type
 * @param {string}  [o.icon]    icon-name override from the portal
 * @param {boolean} [o.active]  larger, ringed — the current selection
 * @param {boolean} [o.dim]     context only: present for reference, not the subject
 * @param {number}  [o.index]   staggers the entrance animation
 */
export function teardropIcon({ type, icon, active = false, dim = false, index = 0 }) {
  const w = active ? 36 : dim ? 24 : 30;
  const h = Math.round(w * 1.28);
  const ink = categoryColor(type);
  const delay = Math.min(index * 45, 700);
  // The gradient id must vary with everything that changes the artwork, or two
  // pins rendered in the same document share one <defs> and the second silently
  // reuses the first one's fill.
  const id = `pin-${type}-${icon || 'def'}-${active ? 'a' : dim ? 'd' : 'r'}`;
  const glyph = getIconSvg(type, icon);

  return L.divIcon({
    // The hover lift lives in CSS (index.css) rather than here: a divIcon's
    // html is re-generated on every React render, and a transform applied
    // inline would restart mid-gesture.
    className: 'campus-pin-wrapper',
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h + 2],
    html: `
      <span class="drop-in campus-pin" style="
        display:block;width:${w}px;height:${h}px;
        animation-delay:${delay}ms;
        ${dim ? 'opacity:.65;' : ''}
      ">
        <svg width="${w}" height="${h}" viewBox="0 0 28 36" fill="none"
             xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#fff" stop-opacity=".32"/>
              <stop offset=".6" stop-color="#fff" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <path d="M14 35.2c0-.1 11.6-12.6 11.6-21.2A11.6 11.6 0 1 0 2.4 14c0 8.6 11.6 21.1 11.6 21.2Z"
                fill="${ink}"/>
          <path d="M14 35.2c0-.1 11.6-12.6 11.6-21.2A11.6 11.6 0 1 0 2.4 14c0 8.6 11.6 21.1 11.6 21.2Z"
                fill="url(#${id})"/>
          <path d="M14 35.2c0-.1 11.6-12.6 11.6-21.2A11.6 11.6 0 1 0 2.4 14c0 8.6 11.6 21.1 11.6 21.2Z"
                fill="none" stroke="${active ? 'rgb(var(--fg))' : 'rgb(0 0 0 / .22)'}"
                stroke-width="${active ? 1.8 : 1}"/>
          <circle cx="14" cy="13.4" r="6.6" fill="rgb(var(--pin-disc))"
                  stroke="rgb(0 0 0 / .08)" stroke-width="0.5"/>
          <g color="rgb(var(--pin-disc-ink))">
            ${glyph}
          </g>
        </svg>
      </span>`,
  });
}

/**
 * The pin being placed, as distinct from the pins already placed.
 *
 * Deliberately NOT a teardrop: while you are dragging it, it is a coordinate
 * rather than a location, and it should not look like the twenty-nine things
 * around it that are already saved. A ringed accent dot reads as "this one is
 * live" at a glance.
 */
export function draftIcon() {
  return L.divIcon({
    className: 'draft-pin-wrapper',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `
      <span class="draft-pin" style="
        display:block;width:28px;height:28px;border-radius:999px;
        background:rgb(var(--accent));
        border:3.5px solid rgb(var(--surface));
        box-shadow:0 0 0 3px rgb(var(--accent) / .35), var(--shadow-md);
      "></span>`,
  });
}
