import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, MessageSquare, Search, Sparkles } from 'lucide-react';
import Button from '../ui-primitives/ActionButton.jsx';
import { useReveal } from '../../custom-react-hooks/useReducedMotionPreference.js';
import LandingRevealText from './LandingRevealText.jsx';

/**
 * The three-step explanation, and the invitation to try it.
 *
 * Search → Explore → Get there. Three steps because that is genuinely how many
 * there are; padding it to five to fill a row would be inventing process.
 *
 * The example questions are real questions about real indexed locations — the
 * College of Computing, the Registrar, the library, the covered court all exist
 * in the campus dataset, so every one of these returns an actual answer. Demo
 * prompts that fail when a visitor tries them are worse than no prompts.
 *
 * Both actions here are live: the buttons open the floating assistant on this
 * page, and the questions carry themselves into the workspace as a query.
 */

const STEPS = [
  ['01', 'Search', 'Type a building, an office or a facility — or just describe what you are looking for.'],
  ['02', 'Explore', 'See it on the campus map with what it houses, which department is inside, and its coordinates.'],
  ['03', 'Get there', 'Open directions in Google Maps, or ask a follow-up question about the place.'],
];

const QUESTIONS = [
  'Where is the College of Computing?',
  'Where can I find the Registrar?',
  'Where is the university library?',
  'Where is the covered court?',
];

export default function LandingAskAssistant({ onAskAssistant }) {
  const [ref, shown] = useReveal({ threshold: 0.15 });
  const navigate = useNavigate();

  return (
    <section id="assistant" className="relative py-28 sm:py-36">
      <div className="container-x">
        {/* ---- how it works, for a student ---- */}
        <ol ref={ref} className="grid gap-10 sm:grid-cols-3 sm:gap-8">
          {STEPS.map(([n, title, body], i) => (
            <li
              key={n}
              className="relative"
              style={{
                transitionProperty: 'transform, opacity',
                transitionDuration: '800ms, 600ms',
                transitionTimingFunction: 'cubic-bezier(.16,1,.3,1), ease-out',
                transitionDelay: `${i * 110}ms`,
                transform: shown ? 'none' : 'translateY(22px)',
                opacity: shown ? 1 : 0,
              }}
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-data text-accent">{n}</span>
                <span aria-hidden className="h-px flex-1 bg-line" />
              </div>
              <h3 className="mt-4 text-h3 font-semibold text-fg">{title}</h3>
              <p className="mt-2 text-meta leading-relaxed text-fg-muted">{body}</p>
            </li>
          ))}
        </ol>

        {/* ---- the invitation ---- */}
        <div className="mt-24 overflow-hidden rounded-xl border border-line bg-surface">
          <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16 lg:p-16">
            <div>
              <p className="inline-flex items-center gap-2 rounded-pill bg-accent-subtle px-3 py-1.5 text-label font-medium text-accent">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Campus assistant
              </p>

              <LandingRevealText
                lines={['Not sure where to go?', 'Just ask.']}
                accentFrom={1}
                className="mt-6 font-serif text-[2rem] leading-[1.06] tracking-[-0.02em] text-fg sm:text-[2.7rem]"
              />

              <p className="lede mt-6 max-w-[30rem]">
                ISU-GeoBot answers from the campus locations and university
                documents it has been given &mdash; and shows you which sources
                it used, so you can check it.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button variant="primary" size="lg" icon={MessageSquare} onClick={onAskAssistant}>
                  Ask a question
                </Button>
                <Button
                  variant="tertiary"
                  size="lg"
                  icon={Search}
                  onClick={() => navigate('/app')}
                >
                  Open the campus map
                </Button>
              </div>
            </div>

            {/* Real questions, each one a live query. */}
            <ul className="space-y-2.5">
              {QUESTIONS.map((q) => (
                <li key={q}>
                  <button
                    type="button"
                    onClick={() => navigate(`/app?q=${encodeURIComponent(q)}`)}
                    className="group flex w-full items-center justify-between gap-4 rounded-lg border border-line bg-bg px-4 py-3.5 text-left transition-colors duration-state hover:border-accent hover:bg-accent-subtle"
                  >
                    <span className="text-meta text-fg-muted transition-colors duration-state group-hover:text-fg">
                      &ldquo;{q}&rdquo;
                    </span>
                    <ArrowUpRight
                      className="h-4 w-4 shrink-0 text-fg-subtle transition-all duration-state group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
                      aria-hidden
                    />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
