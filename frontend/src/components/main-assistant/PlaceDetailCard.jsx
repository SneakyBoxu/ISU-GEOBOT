import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CornerUpRight, MapPin, Maximize2, MessageSquarePlus, X, ZoomIn } from 'lucide-react';
import { Button } from '../ui-primitives/index.js';
import { categoryColor, iconFor } from './mapMarkerGlyphs.js';

/**
 * Fullscreen Messenger-style lightbox for location photographs.
 */
function ImageLightboxModal({ photo, onClose, onAsk, onDirections }) {
  // The call site only mounts this when a photo is open, so the guard is
  // belt-and-braces here -- but it keeps the component safe to render
  // unconditionally, which is exactly the mistake that locked body scroll in
  // ChatbotMessagePanel.
  useEffect(() => {
    if (!photo) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, photo]);

  if (!photo || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-between bg-black/92 p-4 sm:p-6 backdrop-blur-md animate-enter select-none"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={photo.title || 'Location photograph'}
    >
      {/* Top action bar */}
      <div
        className="flex w-full max-w-5xl items-center justify-between gap-4 py-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="truncate font-serif text-lg font-semibold text-white">
            {photo.title || 'Campus Location Photo'}
          </p>
          <p className="text-label text-white/60">
            ISU Echague Main Campus
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onAsk && (
            <button
              type="button"
              onClick={() => { onClose(); onAsk(); }}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-label font-medium text-white transition-colors hover:bg-white/20"
            >
              <MessageSquarePlus className="h-3.5 w-3.5 text-accent" aria-hidden />
              <span>Ask assistant</span>
            </button>
          )}
          {onDirections && (
            <button
              type="button"
              onClick={() => { onClose(); onDirections(); }}
              className="inline-flex items-center gap-1.5 rounded-full border border-accent/60 bg-accent px-3.5 py-1.5 text-label font-medium text-accent-contrast transition-colors hover:bg-accent-hover"
            >
              <CornerUpRight className="h-3.5 w-3.5" aria-hidden />
              <span>Get directions</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close photo preview (Esc)"
            title="Close (Esc)"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div
        className="relative flex flex-1 w-full max-w-5xl items-center justify-center p-2 min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={photo.url}
          alt={photo.alt || photo.title || 'Location photograph'}
          className="max-h-[78vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl ring-1 ring-white/10"
        />
      </div>

      {/* Bottom caption */}
      <div className="w-full max-w-2xl text-center py-2" onClick={(e) => e.stopPropagation()}>
        {photo.alt ? (
          <p className="inline-block rounded-full bg-black/60 px-4 py-1.5 text-label text-white/80 backdrop-blur-sm border border-white/10">
            {photo.alt}
          </p>
        ) : (
          <p className="text-label text-white/40">
            Press Esc or click anywhere outside to close
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}

/**
 * The selected location, floating on its own pin.
 *
 * It is the content of a Leaflet popup, which is why it carries no positioning
 * of its own — it is anchored to the marker and moves with the map.
 *
 * On the pin rather than in a corner, for the obvious reason: a panel in the
 * bottom-left has to NAME the building it describes and trust the reader to
 * find it among thirty-odd others, while a card on the pin has already
 * pointed at it. It is also why the index stays a list — putting the detail
 * there as well would cost the reader their place in it every time they looked
 * something up.
 *
 * Read-only, like everything else the map surfaces. Editing a location happens
 * in the Admin Dashboard behind an authenticated, role-checked endpoint,
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

export default function LocationCard({ poi, onClose, onAsk, onZoom, onDirections }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const url = poi?.imageUrl ?? null;

  // A new pin gets a fresh chance at its own photograph: without this, one
  // broken image would suppress the banner for every location opened after it.
  useEffect(() => setPhotoFailed(false), [url]);

  if (!poi) return null;
  const Icon = iconFor(poi.type, poi.icon);
  const showPhoto = Boolean(url) && !photoFailed;

  return (
    // Sized against the MAP, not the window: on a phone the index rail takes
    // 44px off the left and the pin itself needs room either side, so a card
    // measured off the viewport hangs over the edge before auto-pan can fix it.
    <div className="animate-enter pointer-events-auto w-[min(19rem,calc(100vw-6rem))] overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
      {/*
        ABOVE the header, not inside the body. The body below is
        `max-h-[13rem] overflow-y-auto`, so an image placed in it would eat the
        description's scroll height. Here the root's `overflow-hidden
        rounded-xl` clips the photograph to the card's corners for free.

        Clicking the photo expands it into a fullscreen Messenger-style lightbox.
      */}
      {showPhoto && (
        <div className="group relative border-b border-line bg-bg-sunken">
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="block w-full text-left cursor-pointer"
            title="Click to view full photograph"
          >
            <img
              src={url}
              alt={poi.imageAlt || `Photograph of ${poi.name}`}
              loading="lazy"
              onError={() => setPhotoFailed(true)}
              className="h-32 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-200 group-hover:bg-black/30">
              <span className="flex items-center gap-1.5 rounded-full bg-surface/90 px-2.5 py-1 text-label font-medium text-fg opacity-0 shadow-sm transition-opacity duration-200 group-hover:opacity-100">
                <Maximize2 className="h-3.5 w-3.5 text-accent" aria-hidden /> View full photo
              </span>
            </div>
          </button>
        </div>
      )}

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
        {onDirections ? (
          <Button
            variant="primary"
            size="sm"
            icon={CornerUpRight}
            onClick={() => onDirections(poi)}
            className="flex-1 justify-center"
          >
            Directions
          </Button>
        ) : (
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
        )}
        <Button
          variant="tertiary"
          size="sm"
          icon={ZoomIn}
          onClick={() => onZoom(poi)}
          aria-label={`Zoom to ${poi.name}`}
          className="shrink-0"
        />
      </div>

      {lightboxOpen && showPhoto && (
        <ImageLightboxModal
          photo={{ url, alt: poi.imageAlt, title: poi.name }}
          onClose={() => setLightboxOpen(false)}
          onAsk={() => onAsk(poi)}
          onDirections={onDirections ? () => onDirections(poi) : null}
        />
      )}
    </div>
  );
}
