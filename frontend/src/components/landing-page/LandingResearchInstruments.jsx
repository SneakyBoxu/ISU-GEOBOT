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
 * One stage at a time, swapped by scroll position.
 *
 * WHY THIS IS STICKY AGAIN, AND WHY IT NO LONGER LEAVES A HOLE.
 *
 * An earlier version of this was sticky and was removed: it reserved 34vh of
 * scroll per stage inside a `min-h-screen` frame with the content centred, so
 * the panel was a full viewport tall holding a 400px block — a screen of
 * nothing above the text and a screen of nothing below it. That was the bug,
 * not the technique. Here the sticky element is only as tall as its content
 * and pins near the top, so every pixel of the travel has a stage in it.
 *
 * The rail carries all five markers throughout, so the reader can see where
 * they are in the sequence and how much is left — a single stage with no
 * context reads as a page that lost its list.
 */
function PipelineStepper({ stages }) {
  const hostRef = useRef(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let ticking = false;

    function measure() {
      ticking = false;
      const r = host.getBoundingClientRect();
      const travel = r.height - window.innerHeight;
      if (travel <= 0) { setActive(0); return; }
      // How far through the scrollable run of this block are we?
      const p = Math.min(Math.max(-r.top / travel, 0), 0.9999);
      setActive(Math.floor(p * stages.length));
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
  }, [stages.length]);

  function goTo(i) {
    const host = hostRef.current;
    if (!host) return;
    const top = host.getBoundingClientRect().top + window.scrollY;
    const travel = host.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + ((i + 0.5) / stages.length) * travel, behavior: 'smooth' });
  }

  const stage = stages[Math.min(active, stages.length - 1)];
  const Icon = stage.icon;

  return (
    <div ref={hostRef} className="relative" // A sticky child of full height only travels (parent - viewport), so the
      // viewport has to be added on top or the last stages never get their
      // turn: at 5 x 38vh the panel released after two and the rest scrolled
      // past pinned to "Fuse and answer". 45vh each is the scroll one stage
      // gets; +100vh is the frame itself.
      style={{ height: `${stages.length * 45 + 100}vh` }}>
      {/* FULL HEIGHT AND CENTRED, which is right *here* and was wrong before.
          Pinning a short panel to the top left ~470px of empty viewport under
          it and tucked the title behind the header. Centring in a full-height
          sticky frame puts the stage in the middle of the screen and clear of
          the nav.
          
          The old version did the same thing and still left holes, because it
          showed all five stages at once: four fifths of its travel changed
          nothing. Here each 38vh of scroll swaps the content, so the frame is
          never showing something the reader has already finished. */}
      {/* pt-24 clears the fixed header: centring in the full viewport put
          the top of the block behind the nav bar. The frame centres in the
          space that is actually visible, not in the window. */}
      <div className="sticky top-0 flex min-h-screen items-center pb-10 pt-24">
        <div className="flex gap-8 sm:gap-12">
          {/* The rail: every stage, so position and remaining length stay
              visible while only one body is on screen. */}
          <ol className="flex shrink-0 flex-col gap-3" aria-label="Pipeline stages">
            {stages.map((st, i) => {
              const done = i <= active;
              const now = i === active;
              const StepIcon = st.icon;
              return (
                <li key={st.title}>
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={now ? 'step' : undefined}
                    className="group flex items-center gap-3"
                  >
                    <span
                      aria-hidden
                      className="grid h-10 w-10 place-items-center rounded-lg border transition-all duration-500"
                      style={{
                        borderColor: done ? 'rgb(var(--accent))' : 'rgb(var(--line))',
                        background: now ? 'rgb(var(--accent))' : 'transparent',
                        color: now ? 'rgb(var(--accent-contrast))'
                          : done ? 'rgb(var(--accent))' : 'rgb(var(--fg-subtle))',
                        transform: now ? 'scale(1)' : 'scale(0.9)',
                      }}
                    >
                      <StepIcon className="h-4 w-4" />
                    </span>
                    <span
                      className={`hidden text-label transition-colors duration-300 sm:block ${
                        now ? 'text-fg' : 'text-fg-subtle group-hover:text-fg-muted'
                      }`}
                    >
                      {st.title}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* The body. Keyed on the stage so it re-enters on every change
              rather than the words swapping inside a static box.

              SIZED TO THE SCREEN IT OCCUPIES. At body-copy size this was a
              250px block adrift in a 950px frame, which reads as empty however
              it is aligned. A stage that owns the viewport for the length of
              its scroll should look like it means to be there: the ordinal is
              display type, the title is a heading rather than a label, and the
              sentence is set large enough to be the thing you are reading. */}
          <div key={stage.title} className="animate-enter min-w-0 flex-1">
            <p
              aria-hidden
              className="font-mono text-[3.5rem] font-semibold leading-none text-accent/20 sm:text-[4.5rem]"
              data-numeric
            >
              {String(active + 1).padStart(2, '0')}
            </p>

            <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <h4 className="font-serif text-[2rem] leading-[1.05] tracking-[-0.02em] text-fg sm:text-[2.9rem]">
                {stage.title}
              </h4>
              <span className="font-mono text-data text-fg-subtle">{stage.meta}</span>
            </div>

            <p className="lede mt-7 max-w-[38rem]">{stage.body}</p>

            <p className="mt-10 flex items-center gap-3 text-label text-fg-subtle">
              <span aria-hidden className="h-px w-8 bg-line-strong" />
              Stage {active + 1} of {stages.length}
            </p>
          </div>
        </div>
      </div>
    </div>
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

  // NO overflow-hidden ON THE SECTION. It clips the backdrop, but it also makes
  // the section the containing block for position:sticky, and since the section
  // never scrolls the sticky stepper inside simply stopped sticking -- the panel
  // scrolled away while the stage index kept advancing, so stages two to five
  // were "shown" off the top of the screen. LandingSchematicField clips itself,
  // so the section does not need to.
  return (
    <section id="research" className="rule-fade relative py-28 sm:py-36">
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
            <PipelineStepper stages={STAGES} />
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
