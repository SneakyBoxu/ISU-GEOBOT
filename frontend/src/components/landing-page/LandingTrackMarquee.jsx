import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { api } from '../../frontend-utilities/backendApiClient.js';
import { TYPE_LETTER, categoryColor } from '../main-assistant/mapMarkerGlyphs.js';
import Button from '../ui-primitives/ActionButton.jsx';

/**
 * The campus, as a marquee of what is actually in the database.
 *
 * Two rows drifting in opposite directions — the reference's device, and a good
 * one, because it turns a flat list of twenty-eight names into something that
 * reads as an archive with more in it than fits on screen.
 *
 * The names are LIVE. They come from the same endpoint the workspace map draws,
 * so a location added in the Campus Location portal appears here without anyone
 * editing this file. A hardcoded marquee of place names would have looked
 * identical today and been wrong within a week.
 *
 * The row is duplicated once and translated by exactly -50%, which is what makes
 * the loop seamless: at the moment the animation resets, the second copy is
 * sitting precisely where the first began.
 */
export default function LandingTrackMarquee() {
  const [pois, setPois] = useState([]);

  useEffect(() => {
    let alive = true;
    api.pois()
      .then((d) => { if (alive) setPois(d.pois ?? []); })
      .catch(() => { /* the marquee simply does not render */ });
    return () => { alive = false; };
  }, []);

  if (pois.length < 6) return null;

  const mid = Math.ceil(pois.length / 2);
  const rows = [pois.slice(0, mid), pois.slice(mid)];

  return (
    <section id="campus" className="relative overflow-hidden border-y border-line bg-bg-sunken py-24 sm:py-32">
      <div className="container-x">
        <div className="max-w-[40rem]">
          <p className="eyebrow">The campus</p>
          <h2 className="mt-4 font-serif text-[2rem] leading-tight tracking-[-0.015em] text-fg sm:text-[2.6rem]">
            Twenty-eight locations,
            <span className="block italic text-gradient-accent">answerable by name.</span>
          </h2>
          <p className="lede mt-6">
            Colleges, offices, laboratories, the library, the oval and the
            covered court &mdash; each one carries a description embedded into
            the same retrieval corpus as every university document, so a
            navigation question is answered by the same pipeline as everything
            else.
          </p>
        </div>
      </div>

      <div className="relative -mt-6 space-y-4 [mask-image:linear-gradient(90deg,transparent,#000_9%,#000_91%,transparent)]" aria-hidden>
        {rows.map((row, i) => (
          <div key={i} className="flex overflow-hidden">
            <div className={`flex shrink-0 gap-3 pr-3 ${i ? 'marquee-rtl' : 'marquee-ltr'}`}>
              {[...row, ...row].map((p, k) => (
                <span
                  key={`${p.id}-${k}`}
                  className="inline-flex shrink-0 items-center gap-2 rounded-pill border border-line bg-surface px-4 py-2 text-meta text-fg-muted"
                >
                  <span
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-pill text-[9px] font-semibold"
                    style={{ background: categoryColor(p.type), color: 'rgb(var(--cat-ink))' }}
                  >
                    {TYPE_LETTER[p.type] ?? '·'}
                  </span>
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* The marquee is decorative; the same information has to be reachable as
          text, so the list exists for assistive technology and the link is the
          route for everyone else. */}
      <ul className="sr-only">
        {pois.map((p) => <li key={p.id}>{p.name}</li>)}
      </ul>

      <div className="container-x mt-14">
        <Button as={Link} to="/app" variant="secondary" iconRight={ArrowRight}>
          Open the campus map
        </Button>
      </div>
    </section>
  );
}
