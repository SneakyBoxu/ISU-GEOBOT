import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, Upload } from 'lucide-react';
import { api } from '../../frontend-utilities/backendApiClient.js';
import { Field, Input } from '../ui-primitives/index.js';

/**
 * The location photograph, for the campus-location editor.
 *
 * ONE COMPONENT, TWO HOSTS. CampusLocationManager (the standalone page) and
 * AdminCampusLocationsPanel (the dashboard panel) each carry their own copy of
 * the location form. Duplicating an upload control across both is how the two
 * drift: a fix lands in one and not the other, and nobody notices until an
 * administrator uses the wrong door. The control lives here and both render it.
 *
 * WHY IT UPLOADS ON ITS OWN, NOT WITH THE FORM.
 * The photograph is stored under the location's id, so the location has to
 * exist before there is anywhere to put it. Saving a new location first and
 * attaching a picture second is not a limitation to apologise for — it is the
 * only order that can work, so the control says so plainly rather than failing
 * on click.
 *
 * DOWNSCALED IN THE BROWSER.
 * A phone photograph is three to eight megabytes; the banner it feeds is about
 * three hundred pixels wide. Sending the original would spend the upload budget
 * on detail no one will ever see, so the long edge is capped and the image is
 * re-encoded before it leaves the machine. Same approach the announcement
 * uploader already uses for its crop step.
 */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;
const ACCEPT = 'image/jpeg,image/png,image/webp';

/** Read a File into a data URL. */
function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Cap the long edge and re-encode as JPEG. Returns a bare base64 string. */
function downscale(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, MAX_EDGE / image.width, MAX_EDGE / image.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const out = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      resolve({
        base64: out.split(',')[1],
        preview: out,
        width: canvas.width,
        height: canvas.height,
      });
    };
    image.onerror = () => reject(new Error('That file could not be read as an image.'));
    image.src = dataUrl;
  });
}

export default function PoiPhotoField({ poiId, session, imageUrl, imageAlt, onSaved }) {
  const [pending, setPending] = useState(null);      // { base64, preview, width, height }
  const [alt, setAlt] = useState(imageAlt ?? '');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  // Switching to a different location must not carry the previous one's picture.
  useEffect(() => {
    setPending(null);
    setAlt(imageAlt ?? '');
    setError(null);
  }, [poiId, imageAlt]);

  const pick = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';                          // allow re-picking the same file
    if (!file) return;
    setError(null);
    try {
      setPending(await downscale(await readAsDataURL(file)));
    } catch (err) {
      setError(err.message || 'That file could not be read as an image.');
    }
  }, []);

  const upload = useCallback(async () => {
    if (!pending || !poiId) return;
    setBusy('upload');
    setError(null);
    try {
      const result = await api.adminSetPoiPhoto(session.access_token, poiId, {
        contentB64: pending.base64,
        alt: alt.trim() || undefined,
      });
      setPending(null);
      onSaved?.(result.poi);
    } catch (err) {
      setError(err?.message || 'The upload failed.');
    } finally {
      setBusy('');
    }
  }, [pending, poiId, alt, session, onSaved]);

  const remove = useCallback(async () => {
    if (!poiId) return;
    setBusy('remove');
    setError(null);
    try {
      const result = await api.adminClearPoiPhoto(session.access_token, poiId);
      setPending(null);
      setAlt('');
      onSaved?.(result.poi);
    } catch (err) {
      setError(err?.message || 'The photograph could not be removed.');
    } finally {
      setBusy('');
    }
  }, [poiId, session, onSaved]);

  const shown = pending?.preview ?? imageUrl ?? null;

  return (
    <>
      {!poiId ? (
        <p className="text-meta text-fg-muted">
          Save the location first. The photograph is stored against its record, so there
          has to be a record to store it against.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {shown ? (
            <img
              src={shown}
              alt={alt || 'Selected location photograph'}
              className="h-40 w-full rounded-lg border border-line object-cover"
            />
          ) : (
            <div className="grid h-40 w-full place-items-center rounded-lg border border-dashed border-line text-fg-muted">
              <span className="flex flex-col items-center gap-2 text-meta">
                <ImagePlus className="h-6 w-6" aria-hidden />
                No photograph yet
              </span>
            </div>
          )}

          <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only"
                 onChange={pick} />

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => inputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-meta hover:bg-surface-raised">
              <Upload className="h-4 w-4" aria-hidden />
              {shown ? 'Choose a different photo' : 'Choose a photo'}
            </button>

            {pending && (
              <button type="button" onClick={upload} disabled={busy === 'upload'}
                      className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-meta font-semibold text-accent-contrast disabled:opacity-50">
                {busy === 'upload'
                  ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Uploading…</>
                  : 'Upload'}
              </button>
            )}

            {imageUrl && !pending && (
              <button type="button" onClick={remove} disabled={busy === 'remove'}
                      className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-meta text-error hover:bg-surface-raised disabled:opacity-50">
                {busy === 'remove'
                  ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Removing…</>
                  : <><Trash2 className="h-4 w-4" aria-hidden /> Remove</>}
              </button>
            )}
          </div>

          {pending && (
            <p className="text-meta text-fg-muted">
              Ready to upload — {pending.width}&thinsp;×&thinsp;{pending.height}px,{' '}
              {Math.round((pending.base64.length * 3) / 4 / 1024)}&thinsp;KB after
              resizing. Nothing is stored until you press Upload.
            </p>
          )}

          <Field
            label="Alternative text"
            hint="Read aloud by screen readers. Describe the building, not the photograph — “the Old Admin Building from the courtyard”, not “a photo of a building”."
          >
            {({ id, describedBy }) => (
              <Input id={id} value={alt} maxLength={200} aria-describedby={describedBy}
                     onChange={(e) => setAlt(e.target.value)}
                     placeholder="The Old Admin Building, seen from the front" />
            )}
          </Field>

          {error && <p className="text-meta text-error">{error}</p>}
        </div>
      )}
    </>
  );
}
