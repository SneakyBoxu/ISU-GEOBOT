import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, MessageSquare, Search } from 'lucide-react';
import Button from '../ui-primitives/ActionButton.jsx';
import LandingRevealText from './LandingRevealText.jsx';

/**
 * The hero, written for a student standing outside a building they cannot find.
 *
 * IT USED TO OPEN WITH THE THESIS. Retrieval-augmented generation, an
 * evaluation plan, a disclaimer about unpublished results — all true, none of
 * it an answer to "can this help me right now". The research has not gone
 * anywhere; it moved to the section that is about the research.
 *
 * WHAT IS CLAIMED HERE IS ONLY WHAT THE SYSTEM DOES TODAY: find the 28 indexed
 * campus locations, answer questions grounded in university documents, and show
 * a generalized availability status where one exists. No turn-by-turn routing,
 * no live tracking, no indoor positioning — none of that is built, so none of
 * it is advertised.
 */

const EXAMPLES = [
  'Where is the College of Computing?',
  'Where can I find the Registrar?',
  'Where is the university library?',
];

export default function LandingHeroCinematic({ onAskAssistant, count, categories }) {
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
        </p>
      </div>

      <div className="container-x grid flex-1 items-end gap-12 pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,17rem)] lg:gap-16">
        <div className="max-w-[38rem]">
          <LandingRevealText
            as="h1"
            lines={['Your campus,', 'easier to explore.']}
            accentFrom={1}
            className="font-serif text-[2.8rem] leading-[0.98] tracking-[-0.03em] text-fg sm:text-[3.8rem] lg:text-[4.6rem]"
          />

          <p className="lede mt-8 max-w-[31rem]">
            Find buildings, offices and facilities across the Echague Main
            Campus &mdash; and ask ISU-GeoBot anything about them, in plain
            language.
          </p>

          <form
            onSubmit={ask}
            className="mt-9 flex max-w-[31rem] items-center gap-2 rounded-pill border border-line bg-surface py-1.5 pl-4 pr-1.5 shadow-sm transition-colors duration-state focus-within:border-accent"
          >
            <label htmlFor="hero-ask" className="sr-only">Search for a campus location</label>
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
              Find it
            </Button>
          </form>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button as={Link} to="/app" variant="primary" size="lg" iconRight={ArrowRight}>
              Explore Campus
            </Button>
            <Button
              variant="secondary"
              size="lg"
              icon={MessageSquare}
              onClick={onAskAssistant}
            >
              Ask ISU-GeoBot
            </Button>
          </div>
        </div>

        {/* Example questions, in the right margin. Three things a student would
            actually type, so the search box above reads as usable rather than
            decorative. */}
        <div className="hidden border-l border-line pl-6 lg:block">
          <p className="eyebrow">Try asking</p>
          <ul className="mt-4 space-y-3">
            {EXAMPLES.map((q) => (
              <li key={q}>
                <button
                  type="button"
                  onClick={() => navigate(`/app?q=${encodeURIComponent(q)}`)}
                  className="text-left text-meta leading-snug text-fg-muted transition-colors duration-state hover:text-accent"
                >
                  &ldquo;{q}&rdquo;
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="container-x mt-14">
        <div className="flex flex-wrap items-center justify-between gap-6 border-t border-line pt-5">
          {/* Counted from the data, not typed in. Adding a building through
              the Campus Location portal changes these without anyone editing
              this file. 355 hectares is an institutional fact, not a count. */}
          <p className="flex flex-wrap items-center gap-x-6 gap-y-2 text-label text-fg-subtle">
            <span>
              <strong className="font-medium text-fg-muted" data-numeric>{count || '—'}</strong>
              {' '}campus {count === 1 ? 'location' : 'locations'} indexed
            </span>
            <span>
              <strong className="font-medium text-fg-muted" data-numeric>{categories || '—'}</strong>
              {' '}{categories === 1 ? 'category' : 'categories'}
            </span>
            <span><strong className="font-medium text-fg-muted">355</strong> hectares</span>
          </p>
          <a
            href="#find-your-way"
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
