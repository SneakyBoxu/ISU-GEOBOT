import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Braces, Compass, Radar, ShieldCheck, Sparkles } from 'lucide-react';
import Button from '../ui-primitives/ActionButton.jsx';
import { useReveal } from '../../custom-react-hooks/useReducedMotionPreference.js';
import LandingRevealText from './LandingRevealText.jsx';
import LandingSchematicField from './LandingSchematicField.jsx';
import { revealStyle } from '../../custom-react-hooks/revealStyle.js';

/**
The study. The technical account lives here and nowhere above it.
 *
 * The page above sells what a visitor can do. This section is where the thesis
 * explains itself: the pipeline, the model choices, and the evaluation.
 *
 * WHAT THIS SECTION SHOWS, AND WHAT IT DOES NOT. It used to carry the
 * embedding width, the chunk ceiling and the state count, and four empty
 * instruments captioned "awaiting evaluation". Both were wrong by the end of
 * the study for opposite reasons. The parameters were true and irrelevant --
 * nobody choosing whether to use a campus assistant cares how many dimensions
 * the embedder has -- so they are replaced by what a visitor actually gets and
 * what the system will not do with anyone's data. The empty instruments were
 * simply stale: all four metrics ran to completion, and an unread dial beside
 * a finished study reads as a broken page.
 *
 * THE FIGURES HERE ARE RESULTS, NOT STATE. Scores from the evaluation run do
 * not drift the way a corpus count does, so they are written here rather than
 * fetched. Anything that changes when an administrator adds a building is
 * deliberately absent from this page -- see the note in LandingHeroCinematic.
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
    body: 'A consent gate runs first: a lecturer who has not opted in is never estimated at all. Only then does the Random Forest run, and its output crosses a masking boundary that admits a generalized status and nothing else — no room, no floor, no building. Every answer carrying a status is scanned again on the way out.',
    accent: true,
  },
  {
    icon: Sparkles,
    title: 'Fuse and answer',
    meta: 'openai/gpt-oss-120b · temperature 0',
    body: 'Retrieved context and the masked status are fused into one prompt. The answer is scanned before it is returned: if the model has speculated about a location, the response is replaced rather than sent.',
  },
];

// Three of these are fixed properties of the architecture. The fourth is a
// count of live rows, so it is passed in rather than typed — a parameters table
// that quietly disagrees with the database is worse than no table.

// SCORED, NOT AWAITING. These four ran to completion over the full test set,
// graded by a model that did not write the answers. The figures are the
// Enhanced arm pooled over every question, and they are results of the study
// rather than state of the deployment, so they do not go stale the way a
// corpus count does. Plain-language labels: the RAGAS names mean nothing to
// someone deciding whether to trust the assistant.
const TRUST = [
  ['It shows you where the answer came from',
   'Every response lists the university documents it used, so you can open them and check the claim yourself.',
   'Sources appear under each answer'],
  ['It cannot tell anyone where a lecturer is',
   'Ask where someone is and it declines — not because it was told to refuse, but because no table anywhere links a person to a place.',
   'No person-to-place record exists'],
  ['It answers from university records, not memory',
   'Responses are composed from the student handbook, the academic calendar and the campus records it has been given. If the answer is not in them, it says so.',
   'Retrieval before generation'],
  ['A lecturer decides whether to appear at all',
   'Availability is shown only for staff who opted in, only as a general status, and only to signed-in campus users.',
   'Consent checked before any estimate'],
];




/**
 * One pipeline stage, revealing when it reaches the reading line.
 *
 * Each stage observes itself rather than the list observing all five: a shared
 * observer fires once and staggers the rest on a timer, so by the time you
 * scroll to stage four it has long since animated and you see nothing. Watching
 * per item means the reveal happens where you are looking, every time, at
 * whatever speed you happen to scroll.
 *
 * This is NOT the sticky stepper that used to live here. That one reserved 34vh
 * of scroll per stage -- 1700px of travel for a 405px list -- and left a screen
 * of empty page above and below the content. The list is its own height now;
 * only the entrance is tied to scroll.
 */
function PipelineStage({ stage, index, total }) {
  const [ref, shown] = useReveal({ threshold: 0.55, rootMargin: '0px 0px -18% 0px' });
  const Icon = stage.icon;

  return (
    <li ref={ref} className="relative pl-14">
      {/* The spine, drawn between markers rather than behind them, so it reads
          as a connection and not as a rule the icons happen to sit on. */}
      {index < total - 1 && (
        <span
          aria-hidden
          className="absolute left-[19px] top-12 -bottom-8 w-px bg-line sm:-bottom-10"
        >
          <span
            className="block w-px bg-accent/50 transition-[height] duration-700 ease-out"
            style={{ height: shown ? '100%' : '0%', transitionDelay: '220ms' }}
          />
        </span>
      )}

      <span
        aria-hidden
        className="absolute left-0 top-3 grid h-10 w-10 place-items-center rounded-lg border transition-all duration-500"
        style={{
          borderColor: shown ? 'rgb(var(--accent))' : 'rgb(var(--line))',
          background: shown ? 'rgb(var(--accent))' : 'transparent',
          color: shown ? 'rgb(var(--accent-contrast))' : 'rgb(var(--fg-subtle))',
          transform: shown ? 'scale(1)' : 'scale(0.88)',
        }}
      >
        <Icon className="h-4 w-4" />
      </span>

      <div className="py-2" style={revealStyle(shown)}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <h4 className="text-body font-semibold text-fg">{stage.title}</h4>
          <span className="font-mono text-data text-fg-subtle">{stage.meta}</span>
        </div>
        <p className="mt-2 max-w-measure text-meta leading-relaxed text-fg-muted">
          {stage.body}
        </p>
      </div>
    </li>
  );
}

export default function LandingResearchInstruments() {
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
    <section id="research" className="rule-fade relative overflow-hidden py-28 sm:py-36">
      {/* The section was text on flat ground for several screens. A drafting
          sheet behind it carries the hero's language down the page without
          repeating the campus plan. It means nothing and is not a diagram. */}
      <LandingSchematicField />
      <div className="relative">
      <div className="container-x">
        <div className="max-w-[42rem]">
          <p className="eyebrow">The study</p>
          <LandingRevealText
            lines={['An Enhanced RAG architecture', 'for campus assistance.']}
            accentFrom={1}
            className="mt-5 font-serif text-[2rem] leading-[1.06] tracking-[-0.02em] text-fg sm:text-[2.7rem]"
          />
          <p className="lede mt-6">
            BSCS Data Mining track, Isabela State University &mdash; Echague. The
            architecture below is built, running, and now measured: both
            architectures were scored on the same questions by the same judge,
            and the figures further down are what came back.
          </p>
        </div>

        {/* ---- pipeline: scrubbed against scroll ---- */}
      </div>

      {/* Tall on purpose — the height IS the scrub track for the five stages. */}
      {/* A PLAIN LIST, NOT A SCROLL-DRIVEN STEPPER.
          This reserved 34vh of scroll per stage -- 1700px of travel for a
          405px list, inside a 100vh sticky frame that centred it. The
          result was a screen of nothing above the content, a screen of
          nothing below it, and a reader who had to scroll through an empty
          page to reach the next sentence. Every stage is open, the list is
          as tall as its content, and the section now joins to what follows
          it. */}
      <div className="relative mt-16">
        <div>
          <div className="container-x w-full">
            <div className="flex items-baseline gap-4">
              <h3 className="text-body font-semibold text-fg">How a question becomes an answer</h3>
              <span aria-hidden className="h-px flex-1 bg-line" />
              <span className="font-mono text-data text-fg-subtle" data-numeric>
                {String(STAGES.length).padStart(2, '0')} stages
              </span>
            </div>
            <ol className="mt-10 space-y-8 sm:space-y-10">
              {STAGES.map((st, i) => (
                <PipelineStage key={st.title} stage={st} index={i} total={STAGES.length} />
              ))}
            </ol>
          </div>
        </div>
      </div>

      <div className="container-x">
        {/* ---- why you can trust it ---- */}
        {/* THIS WAS FOUR RAGAS DIALS. They were real scores, honestly earned,
            and the wrong thing to put here: "Context Precision 0.68" tells a
            student nothing about whether to use a campus app, and a bar two
            thirds full reads as a failing grade to anyone who does not know
            the scale. The measurements belong in the paper, where there is
            room to say what they mean. What belongs here is what the system
            will and will not do, in words. */}
        <div className="mt-16">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-3">
            <h3 className="text-body font-semibold text-fg">Why you can trust the answer</h3>
            <p className="inline-flex items-center gap-2 text-label text-fg-subtle">
              <span className="h-1.5 w-1.5 rounded-pill bg-accent" aria-hidden />
              Every claim here is checkable
            </p>
          </div>

          {/* The reveal ref lives here. It used to sit on the stats strip
              above; when that was removed the ref went with it, `shown`
              never flipped, and these cards stayed at opacity 0 -- present
              in the DOM, invisible on the page. A reveal that hides content
              by default must be anchored to the content it reveals. */}
          <ul ref={ref} className="mt-8 grid gap-x-10 gap-y-9 sm:grid-cols-2">
            {TRUST.map(([title, body, how], i) => (
              <li
                key={title}
                className="group rounded-xl border border-line bg-surface/40 p-6 transition-colors duration-state hover:border-line-strong"
style={revealStyle(shown, i, 'border-color')}
              >
                <p className="text-body font-medium leading-snug text-fg">{title}</p>
                <p className="mt-2.5 text-label leading-relaxed text-fg-subtle">
                  {body}
                </p>
                {/* The mechanism, not a slogan: each promise names the thing in
                    the system that makes it true, so a sceptical reader has
                    somewhere to go and check. */}
                <p className="mt-4 inline-flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-accent">
                  <span aria-hidden className="h-px w-4 bg-accent" />
                  {how}
                </p>
              </li>
            ))}
          </ul>

          <p className="mt-10 max-w-measure text-meta leading-relaxed text-fg-subtle">
            The assistant was measured against a plain retrieval system on the
            same set of questions, graded by a model that did not write any of
            the answers. Availability was tested against a simulated cohort,
            never against a real lecturer&rsquo;s movements. The full figures
            and their limits are in the study.
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
              availability is answered for lecturers who have opted in, as a
              generalized status and never as a place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button as={Link} to="/app" variant="primary" size="lg" iconRight={ArrowRight}>
                Explore Campus
              </Button>
              <Button as={Link} to="/admin-dashboard" variant="secondary" size="lg">
                Admin Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}
