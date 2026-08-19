import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Search } from 'lucide-react';
import Button from '../ui-primitives/ActionButton.jsx';
import LandingRevealText from './LandingRevealText.jsx';

/**
 * WORDING RULES (audit §10.3) — these outrank the visual design.
 *
 * The thesis is a PROPOSAL. Chapters 4 and 5 do not exist, no model has been
 * trained, no comparison has been run. So nothing here claims a result:
 *
 *   NOT "94% accurate"               -> no numbers at all until measured
 *   NOT "outperforms standard RAG"   -> that is the study's hypothesis
 *   NOT "validated by 15 faculty"    -> validation has not happened
 *   NOT "real-time faculty tracking" -> "tracking" is the word the thesis avoids
 *
 * Capability claims are present tense; outcome claims are future tense. The
 * page around this got considerably louder; the sentences did not.
 *
 * COMPOSITION. Anchored to the corners of the viewport rather than stacked down
 * the middle. A centred column is the default every template arrives at, and it
 * wastes the two things a full-bleed 3D hero actually has — width, and negative
 * space. Here the meta sits top-left, the statement occupies the lower-left
 * quadrant where the eye lands after the field has moved, and the index card
 * holds the right margin. The field is left visible through the middle instead
 * of being covered by the text that is supposed to be sharing the screen with
 * it.
 */

const INDEX = [
  ['01', 'Campus', 'Twenty-eight surveyed locations'],
  ['02', 'Retrieval', 'Grounded in university documents'],
  ['03', 'Privacy', 'A status, never a location'],
];

export default function LandingHeroCinematic() {
  const [question, setQuestion] = useState('');
  const navigate = useNavigate();

  // A real control. It hands the question to the assistant rather than
  // answering it here — a search box on a landing page that does nothing is a
  // small lie told at the top of the page.
  function ask(e) {
    e.preventDefault();
    const q = question.trim();
    navigate(q ? `/app?q=${encodeURIComponent(q)}` : '/app');
  }

  return (
    <section className="relative flex min-h-[calc(100dvh-3.75rem)] flex-col justify-between overflow-hidden py-10 lg:py-14">
      <div className="container-x">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-data uppercase tracking-[0.16em] text-fg-subtle">
          <span className="text-accent">Isabela State University</span>
          <span aria-hidden className="hidden h-px w-8 bg-line-strong sm:block" />
          Echague Main Campus
          <span aria-hidden className="hidden h-px w-8 bg-line-strong sm:block" />
          Undergraduate thesis
        </p>
      </div>

      <div className="container-x grid flex-1 items-end gap-12 pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] lg:gap-16">
        {/* ---- statement ---- */}
        <div className="max-w-[36rem]">
          <LandingRevealText
            as="h1"
            lines={['Find your way', 'around campus,', 'and know before you go.']}
            accentFrom={2}
            className="font-serif text-[2.7rem] leading-[0.98] tracking-[-0.03em] text-fg sm:text-[3.6rem] lg:text-[4.4rem]"
          />

          <p className="lede mt-8 max-w-[30rem]">
            One place to ask about buildings, offices and university documents
            &mdash; and a generalized estimate of whether a faculty member is
            free, without ever disclosing where they are.
          </p>

          <form
            onSubmit={ask}
            className="mt-9 flex max-w-[30rem] items-center gap-2 rounded-pill border border-line bg-surface/95 py-1.5 pl-4 pr-1.5 transition-colors duration-state focus-within:border-accent"
          >
            <label htmlFor="hero-ask" className="sr-only">Ask about the campus</label>
            <Search className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden />
            <input
              id="hero-ask"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Where is the College of Computing?"
              maxLength={200}
              className="min-w-0 flex-1 bg-transparent py-1.5 text-meta text-fg outline-none placeholder:text-fg-subtle"
            />
            <Button type="submit" variant="primary" size="sm" className="shrink-0 !rounded-pill">
              Ask
            </Button>
          </form>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button as={Link} to="/app" variant="primary" size="lg" iconRight={ArrowRight}>
              Launch Assistant
            </Button>
            <Link
              to="/app"
              className="group inline-flex items-center gap-1.5 text-meta text-fg-muted transition-colors duration-state hover:text-fg"
            >
              Explore the campus map
              <ArrowUpRight className="h-4 w-4 transition-transform duration-state group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        </div>

        {/* ---- index, right margin ----
            Doubles as a contents page for the scroll and as the three claims
            the field is about to make in sequence. */}
        <ol className="hidden border-l border-line pl-6 lg:block">
          {INDEX.map(([n, title, note], i) => (
            <li key={n} className={i ? 'mt-7' : ''}>
              <span className="font-mono text-data text-accent">{n}</span>
              <p className="mt-1 text-meta font-medium text-fg">{title}</p>
              <p className="mt-0.5 text-label leading-relaxed text-fg-subtle">{note}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* ---- footer band ---- */}
      <div className="container-x mt-14">
        <div className="flex flex-wrap items-end justify-between gap-6 border-t border-line pt-5">
          {/* Audit R6-R12: where a "94% accurate" badge would normally sit. */}
          <p className="max-w-[38rem] text-label leading-relaxed text-fg-subtle">
            The Enhanced RAG architecture will be evaluated against a standard
            RAG baseline using the RAGAS framework, and its availability
            estimates will be validated by selected faculty members.
            <strong className="font-medium text-fg-muted"> No results have been published yet.</strong>
          </p>
          <a
            href="#problem"
            className="group inline-flex items-center gap-2 font-mono text-data uppercase tracking-[0.16em] text-fg-subtle transition-colors duration-state hover:text-fg"
          >
            Scroll
            <span aria-hidden className="relative block h-8 w-px overflow-hidden bg-line-strong">
              <span className="absolute inset-x-0 top-0 h-3 animate-scroll-hint bg-accent" />
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
