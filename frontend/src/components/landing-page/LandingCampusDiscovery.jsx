import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { TYPE_LETTER, categoryColor, iconFor } from '../main-assistant/mapMarkerGlyphs.js';
import Button from '../ui-primitives/ActionButton.jsx';
import LandingRevealText from './LandingRevealText.jsx';
import LandingSchematicField from './LandingSchematicField.jsx';

// Leaflet is ~90KB gzipped and lives in the workspace chunk. Lazy here so the
// landing's critical path does not carry a map most visitors scroll past.
const LandingMiniMapPreview = lazy(() => import('./LandingMiniMapPreview.jsx'));

/**
 * The campus, grouped the way a student would look for it.
 *
 * NOT A LIST OF TWENTY-EIGHT NAMES. A flat alphabetical dump is a database
 * table with a nicer font — nobody scans it, because "Alba Hall" next to
 * "Bike Station" next to "Cashier's Office" answers no question anybody has.
 * Grouped into what you are actually looking for — a college, a service, or a
 * place on campus — the same data becomes browsable.
 *
 * The grouping maps the poi_type vocabulary onto three student-facing headings.
 * The DATA IS LIVE: it comes from the same /api/map/pois the workspace draws, so
 * a location added through the Admin Dashboard appears here without
 * anyone editing this file, and nothing here is hardcoded or invented.
 *
 * Every card is a deep link into the workspace with that location focused.
 *
 * THE MAP IS THE RIGHT-HAND COLUMN, and it is the point. This panel was a grid
 * of identical cards with a third of the section empty beside it — a phone book
 * on a page whose whole product is a map. Now hovering a card lights its pin,
 * names it and flies the map there, and the empty third is the thing being
 * described.
 *
 * The map is INERT — see the note in LandingMiniMapPreview. Only the cards take
 * a pointer, and every one of them opens the campus assistant at that location.
 *
 * The map is given only the ACTIVE GROUP, not every location. The tab is asking
 * "where are the colleges"; showing all twenty-eight pins would answer a
 * question nobody pressed.
 *
 * Hover is bound to focus as well as to the pointer, so tabbing through the
 * cards drives the map too. Below `lg` the map is not rendered at all: on a
 * 375px screen it would cost most of the first screen to show pins too small to
 * read, and there is no hover on touch.
 */

// Eight fills four rows of two on a wide screen and stops well short of
// the map beside it, so the two columns finish together.
const PREVIEW_COUNT = 8;

const GROUPS = [
  {
    key: 'academic',
    title: 'Academic',
    blurb: 'Colleges, the graduate school and teaching facilities.',
    types: ['college', 'laboratory'],
  },
  {
    key: 'services',
    title: 'Student services',
    blurb: 'Offices, the library and everyday campus services.',
    types: ['administrative', 'library'],
  },
  {
    key: 'campus',
    title: 'Campus & facilities',
    blurb: 'Gates, open spaces, sport and accommodation.',
    types: ['facility', 'landmark', 'sports', 'other'],
  },
];

/**
 * Is there room for the map?
 *
 * A JavaScript check, not a `hidden lg:block` class. Hiding it with CSS still
 * MOUNTS it — Leaflet initialises, the lazy chunk downloads, and a phone pays
 * ~90KB and a map instance for something it never shows. The map has to not
 * exist below `lg`, not merely be invisible.
 */
function useHasRoomForMap() {
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e) => setWide(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return wide;
}

export default function LandingCampusDiscovery({ pois = [] }) {
  const [group, setGroup] = useState('academic');
  const [hoveredId, setHoveredId] = useState(null);
  const hasRoomForMap = useHasRoomForMap();
  const navigate = useNavigate();

  const grouped = useMemo(() => {
    const out = {};
    for (const g of GROUPS) {
      out[g.key] = pois
        .filter((p) => g.types.includes(p.type))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    return out;
  }, [pois]);

  if (pois.length < 6) return null;

  // A PREVIEW, NOT THE DIRECTORY.
  //
  // This rendered every location in the group -- thirty-one under Academic
  // alone -- so the section ran to two and a half screens of cards that
  // nobody reads top to bottom. A landing page shows enough to prove the
  // index is real and populated, and sends you to the map for the rest;
  // the map is where you would search anyway, and it is one click away.
  const all = grouped[group] ?? [];
  const shown = all.slice(0, PREVIEW_COUNT);
  const remaining = all.length - shown.length;

  return (
    <section id="campus" className="rule-fade rule-fade-y relative overflow-hidden py-28 sm:py-36">
      <LandingSchematicField />
      <div className="container-x">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div className="max-w-[34rem]">
            <p className="eyebrow">Explore the campus</p>
            <LandingRevealText
              lines={['Every place on campus,', 'grouped how you look.']}
              accentFrom={1}
              className="mt-5 font-serif text-[2.2rem] leading-[1.04] tracking-[-0.02em] text-fg sm:text-[3rem]"
            />
          </div>
          <Button variant="secondary" iconRight={ArrowRight} onClick={() => navigate('/app')}>
            Open the campus map
          </Button>
        </div>

        {/* group switch */}
        <div className="mt-12 flex flex-wrap gap-2 border-b border-line pb-4" role="tablist" aria-label="Location groups">
          {GROUPS.map((g) => {
            const on = group === g.key;
            const n = grouped[g.key]?.length ?? 0;
            if (!n) return null;
            return (
              <button
                key={g.key}
                role="tab"
                aria-selected={on}
                onClick={() => setGroup(g.key)}
                className={`inline-flex items-center gap-2 rounded-pill px-4 py-2 text-meta transition-colors duration-state ${
                  on
                    ? 'bg-fg text-bg'
                    : 'border border-line text-fg-muted hover:border-line-strong hover:text-fg'
                }`}
              >
                {g.title}
                <span className={`font-mono text-data ${on ? 'opacity-70' : 'text-fg-subtle'}`} data-numeric>
                  {n}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-meta text-fg-muted">
          {GROUPS.find((g) => g.key === group)?.blurb}
        </p>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-12">
          {/* ONE CHILD PER COLUMN. The list and its button used to be separate
              children of this grid, and the button's `sm:col-span-2` -- correct
              when it lived inside the two-up <ul> -- spanned THIS grid instead,
              pushing the map onto a third row in the left column. That is how a
              map ends up under the cards on a page whose product is the map.
              Wrapping them makes the grid exactly two children, so the map
              cannot be displaced by anything the list does. */}
          <div className="min-w-0">
        {/* Keyed on the group so the cards re-enter when the tab changes,
            rather than the text swapping inside static boxes. */}
        <ul key={group} className="grid gap-3 sm:grid-cols-2">
          {shown.map((p, i) => {
            const Icon = iconFor(p.type, p.icon);
            return (
              <li
                key={p.id}
                className="animate-enter"
                style={{ animationDelay: `${Math.min(i * 45, 400)}ms` }}
              >
                <button
                  type="button"
                  onClick={() => navigate(`/app?poi=${encodeURIComponent(p.id)}`)}
                  onMouseEnter={() => setHoveredId(p.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onFocus={() => setHoveredId(p.id)}
                  onBlur={() => setHoveredId(null)}
                  className={`group flex w-full items-start gap-3.5 rounded-xl border bg-bg p-4 text-left transition-all duration-state hover:-translate-y-0.5 hover:shadow-md ${
                    hoveredId === p.id ? 'border-accent shadow-md' : 'border-line hover:border-line-strong'
                  }`}
                >
                  <span
                    aria-hidden
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-lg"
                    style={{ background: categoryColor(p.type, 0.16), color: categoryColor(p.type) }}
                  >
                    <Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={2} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-meta font-medium leading-snug text-fg">{p.name}</span>
                    {p.buildingFunction && (
                      <span className="mt-1 block text-label leading-relaxed text-fg-subtle">
                        {p.buildingFunction}
                      </span>
                    )}
                  </span>

                  <ArrowUpRight
                    className="h-4 w-4 shrink-0 text-fg-subtle opacity-0 transition-all duration-state group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100"
                    aria-hidden
                  />
                </button>
              </li>
            );
          })}
        </ul>

          {/* Where the rest are. The cards are a preview; every location in the
              group is already pinned beside this, so the button is about
              opening the searchable map rather than revealing hidden pins. */}
          {remaining > 0 && (
            <p className="mt-6">
              <button
                type="button"
                onClick={() => navigate('/app')}
                className="group inline-flex items-center gap-2 rounded-lg border border-line bg-bg px-4 py-3 text-meta text-fg-muted transition-colors duration-state hover:border-accent hover:text-fg"
              >
                Open all {all.length} in the campus map
                <ArrowRight
                  className="h-4 w-4 text-fg-subtle transition-transform duration-state group-hover:translate-x-0.5 group-hover:text-accent"
                  aria-hidden
                />
              </button>
            </p>
          )}
          </div>

          {/* The map. Sticky, so it stays beside a long group while scrolling.
              Not rendered at all on narrow screens — see useHasRoomForMap. */}
          {hasRoomForMap && (
          <div>
            <div className="sticky top-24">
              <Suspense
                fallback={<div className="h-[34rem] w-full rounded-xl border border-line bg-bg-sunken" />}
              >
                {/* THE WHOLE GROUP, not `shown`. The map was given the eight
                    preview cards, so a button reading "the other 23" sat beside
                    a map that did not have them either -- the section claimed
                    twenty-three locations it never drew. */}
                <LandingMiniMapPreview
                  pois={all}
                  hoveredId={hoveredId}
                  className="h-[34rem]"
                />
              </Suspense>
              {/* Says what the LIST does, because the list is the only thing
                  here that does anything. The old wording -- "click to open
                  it" -- read as an instruction about the map, which is now a
                  picture; a caption that invites a click the map will not
                  accept is worse than no caption. */}
              <p className="mt-3 text-label text-fg-subtle">
                Hover a location on the left to find it here. Click it to open
                the campus assistant.
              </p>
            </div>
          </div>
          )}
        </div>

        {/* The letter legend. Truthful now that the markers it describes are on
            screen — before the map was here it explained glyphs that appeared
            nowhere in the section. */}
        <dl className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-5">
          {[...new Set(all.map((p) => p.type))].map((t) => (
            <div key={t} className="flex items-center gap-2">
              <dt
                className="grid h-5 w-5 place-items-center rounded-pill text-[9px] font-semibold"
                style={{ background: categoryColor(t), color: 'rgb(var(--cat-ink))' }}
              >
                {TYPE_LETTER[t] ?? '·'}
              </dt>
              <dd className="text-label capitalize text-fg-subtle">{t}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
