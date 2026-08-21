import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Braces, Compass, Radar, ShieldCheck, Sparkles } from 'lucide-react';
import Button from '../ui-primitives/ActionButton.jsx';
import { useReveal } from '../../custom-react-hooks/useReducedMotionPreference.js';
import LandingRevealText from './LandingRevealText.jsx';

/**
 * The study. Everything technical lives here and nowhere above it.
 *
 * The homepage above sells what a student can do. This section is where the
 * thesis explains itself: the pipeline, the model choices, the parameters, and
 * the evaluation that has not been run. Same page, two audiences, in the order
 * the audiences arrive.
 *
 * THE NUMBERS ARE PARAMETERS, NOT RESULTS. 384 dimensions, a 220-token chunk
 * ceiling, exact cosine — all true today and checkable in the repository. What
 * is deliberately absent is any figure that would be a FINDING: no accuracy, no
 * RAGAS score, no comparison against the baseline. None of it has been
 * measured, and a page designed to impress is exactly where an invented
 * percentage slips in unnoticed (audit §10.3).
 *
 * The four metrics appear as instruments with labelled axes and no readings.
 * Empty instruments are not an unfinished design — they say the study is live
 * and honest, which is a stronger thing for a thesis artefact to say than any
 * number that has not been earned.
 */

const STAGES = [
  {
    icon: Compass,
    title: 'Route',
    meta: 'Deterministic gazetteer',
    body: 'A question is classified before anything is embedded: a place, a document, or a person. Name matching runs against a consented roster, and an ambiguous name is answered with a question rather than a guess.',
  },
  {
    icon: Braces,
    title: 'Embed',
    meta: 'all-MiniLM-L6-v2 · 384-dim',
    body: 'The question becomes a vector using the same model and code path that embedded the corpus. Query and document vectors from different embedders diverge silently, and retrieval degrades with no error anywhere.',
  },
  {
    icon: Radar,
    title: 'Retrieve',
    meta: 'Exact cosine over pgvector',
    body: 'Closest passages by meaning rather than keyword, across campus place-cards and university documents. An exact scan, deliberately unindexed at this corpus size — an approximate index would trade recall for speed nobody needs here.',
  },
  {
    icon: ShieldCheck,
    title: 'Estimate and mask',
    meta: 'The contribution',
    body: 'Guard presence resolves to on campus, off campus, or unknown. Only then does the Random Forest run, and its output crosses a masking boundary that admits a generalized status and nothing else — no room, no floor, no building. Every answer carrying a status is scanned again on the way out.',
    accent: true,
  },
  {
    icon: Sparkles,
    title: 'Fuse and answer',
    meta: 'Llama 3.1 8B · temperature 0',
    body: 'Retrieved context and the masked status are fused into one prompt. The answer is scanned before it is returned: if the model has speculated about a location, the response is replaced rather than sent.',
  },
];

// Three of these are fixed properties of the architecture. The fourth is a
// count of live rows, so it is passed in rather than typed — a parameters table
// that quietly disagrees with the database is worse than no table.
const PARAMETERS = [
  ['384', 'embedding dimensions', 'all-MiniLM-L6-v2'],
  ['220', 'tokens per chunk, ceiling', 'below the 256 word-piece limit'],
  ['3', 'availability states', 'generalized, never a location'],
];

const METRICS = [
  ['Context Precision', 'How much of what was retrieved was actually relevant'],
  ['Context Recall', 'How much of what was relevant was actually retrieved'],
  ['Faithfulness', 'Whether the answer is supported by the retrieved context'],
  ['Answer Relevancy', 'Whether the answer addresses the question asked'],
];

export default function LandingResearchInstruments({ count = 0 }) {
  const [ref, shown] = useReveal({ threshold: 0.1 });

  // ---- the pipeline advances on SCROLL, not on click --------------------
  // It was a click-to-open accordion, which asks the reader to drive a
  // sequence they have not read yet — you cannot choose the interesting stage
  // before you know what the stages are. Scrubbing it against scroll means the
  // five stages simply happen, in order, at reading pace, and the section is
  // finished when the last one has been seen.
  //
  // Scroll stays the single source of truth: clicking a stage does not set
  // state directly, it scrolls to that stage's position and lets the same
  // handler resolve it. Two writers for one value is how a scrubbed sequence
  // ends up fighting the user's wheel.
  const pipelineRef = useRef(null);
  const [open, setOpen] = useState(0);

  useEffect(() => {
    const host = pipelineRef.current;
    if (!host) return undefined;

    let ticking = false;
    function measure() {
      ticking = false;
      const rect = host.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      if (travel <= 0) return;
      const p = Math.min(Math.max(-rect.top / travel, 0), 0.999);
      setOpen(Math.floor(p * STAGES.length));
    }
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  function scrollToStage(i) {
    const host = pipelineRef.current;
    if (!host) return;
    const top = host.getBoundingClientRect().top + window.scrollY;
    const travel = host.offsetHeight - window.innerHeight;
    // Aim at the middle of the stage's band so it is unambiguously active.
    window.scrollTo({ top: top + ((i + 0.5) / STAGES.length) * travel, behavior: 'smooth' });
  }

  return (
    <section id="research" className="relative border-t border-line py-28 sm:py-36">
      <div className="container-x">
        <div className="max-w-[42rem]">
          <p className="eyebrow">The study</p>
          <LandingRevealText
            lines={['An Enhanced RAG architecture', 'for campus assistance.']}
            accentFrom={1}
            className="mt-5 font-serif text-[2rem] leading-[1.06] tracking-[-0.02em] text-fg sm:text-[2.7rem]"
          />
          <p className="lede mt-6">
            BSCS Data Mining track, Isabela State University &mdash; Echague.
            The architecture below is built and running. The evaluation is not
            finished, and nothing on this page reports a result.
          </p>
        </div>

        {/* ---- pipeline: scrubbed against scroll ---- */}
      </div>

      {/* Tall on purpose — the height IS the scrub track for the five stages. */}
      <div ref={pipelineRef} className="relative mt-16" style={{ height: `${STAGES.length * 62}vh` }}>
        <div className="sticky top-0 flex min-h-screen items-center">
          <div className="container-x w-full py-16">
            <div className="flex items-baseline gap-4">
              <h3 className="text-body font-semibold text-fg">How a question becomes an answer</h3>
              <span aria-hidden className="h-px flex-1 bg-line" />
              <span className="font-mono text-data text-fg-subtle" data-numeric>
                {String(Math.min(open + 1, STAGES.length)).padStart(2, '0')} / {String(STAGES.length).padStart(2, '0')}
              </span>
            </div>
            <ol className="mt-6">
            {STAGES.map((s, i) => {
              const on = i === open;
              const Icon = s.icon;
              return (
                <li key={s.title} className="border-t border-line last:border-b">
                  <button
                    type="button"
                    onClick={() => scrollToStage(i)}
                    aria-expanded={on}
                    className="flex w-full items-start gap-4 py-4 text-left"
                  >
                    <span
                      className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-colors duration-menu ${
                        on ? 'border-accent bg-accent text-accent-contrast' : 'border-line text-fg-subtle'
                      }`}
                      aria-hidden
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-4">
                        <span className={`text-body font-semibold ${on ? 'text-fg' : 'text-fg-muted'}`}>
                          {s.title}
                        </span>
                        <span className="font-mono text-data text-fg-subtle">{s.meta}</span>
                      </span>
                      {/* 0fr -> 1fr animates to content height without
                          measuring in JS and without a max-height that clips
                          long copy on a narrow screen. */}
                      <span
                        className="grid transition-all duration-500 ease-in"
                        style={{ gridTemplateRows: on ? '1fr' : '0fr', opacity: on ? 1 : 0 }}
                      >
                        <span className="overflow-hidden">
                          <span className="block max-w-measure pt-3 text-meta leading-relaxed text-fg-muted">
                            {s.body}
                          </span>
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            </ol>
          </div>
        </div>
      </div>

      <div className="container-x">
        {/* ---- parameters: true today ---- */}
        <dl ref={ref} className="mt-16 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {[
            ...PARAMETERS,
            [String(count || '—'), 'campus locations indexed', 'each with a place-card in the corpus'],
          ].map(([value, label, note], i) => (
            <div
              key={label}
              className="bg-bg p-6"
              style={{
                transitionProperty: 'transform, opacity',
                transitionDuration: '600ms',
                transitionTimingFunction: 'var(--ease-in)',
                transitionDelay: `${i * 80}ms`,
                transform: shown ? 'none' : 'translateY(16px)',
                opacity: shown ? 1 : 0,
              }}
            >
              <dt className="sr-only">{label}</dt>
              <dd>
                <span className="block font-mono text-[2.25rem] font-semibold leading-none text-fg" data-numeric>
                  {value}
                </span>
                <span className="mt-2 block text-meta text-fg-muted">{label}</span>
                <span className="mt-1 block text-label text-fg-subtle">{note}</span>
              </dd>
            </div>
          ))}
        </dl>

        {/* ---- instruments awaiting readings ---- */}
        <div className="mt-16">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-3">
            <h3 className="text-body font-semibold text-fg">RAGAS evaluation</h3>
            <p className="inline-flex items-center gap-2 text-label text-fg-subtle">
              <span className="h-1.5 w-1.5 rounded-pill bg-warning" aria-hidden />
              Awaiting evaluation &mdash; no readings recorded
            </p>
          </div>

          <ul className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {METRICS.map(([name, what]) => (
              <li key={name}>
                <p className="text-meta font-medium text-fg">{name}</p>
                <p className="mt-1.5 text-label leading-relaxed text-fg-subtle">{what}</p>
                <div className="mt-4" aria-hidden>
                  <div className="h-8 rounded-sm border border-dashed border-line-strong" />
                  <div className="mt-1.5 flex justify-between font-mono text-[0.625rem] text-fg-subtle">
                    <span>0.0</span>
                    <span>1.0</span>
                  </div>
                </div>
                <p className="sr-only">Not yet measured.</p>
              </li>
            ))}
          </ul>

          <p className="mt-10 max-w-measure text-meta leading-relaxed text-fg-subtle">
            Both arms of the comparison will be scored by the same judge model,
            which is not the model that generates the answers. The evaluation
            harness refuses to run while any placeholder data remains in the
            research tables, so no figure produced during development can reach
            the paper by accident.
          </p>
        </div>

        {/* ---- close ---- */}
        <div className="mt-24 overflow-hidden rounded-xl border border-line bg-surface p-10 sm:p-14">
          <div className="max-w-[32rem]">
            <h2 className="font-serif text-[1.9rem] leading-[1.06] tracking-[-0.02em] text-fg sm:text-[2.4rem]">
              Find your way around
              <span className="block italic text-gradient-accent">the Echague campus.</span>
            </h2>
            <p className="lede mt-5">
              Every indexed campus location is answerable now. Faculty
              availability needs the schedule data the university is preparing.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button as={Link} to="/app" variant="primary" size="lg" iconRight={ArrowRight}>
                Explore Campus
              </Button>
              <Button as={Link} to="/validate" variant="secondary" size="lg">
                Faculty Portal
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
