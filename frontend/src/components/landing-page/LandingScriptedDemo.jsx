import { useEffect, useRef, useState } from 'react';
import { Compass, FileText } from 'lucide-react';
import { useInView, usePrefersReducedMotion } from '../../custom-react-hooks/useReducedMotionPreference.js';

/**
 * A scripted preview of one exchange.
 *
 * IT SAYS SO, IN VISIBLE COPY, NOT IN A FOOTNOTE. This is a rehearsed sequence
 * on a fixed timer — it is not talking to the pipeline. On a page for a thesis,
 * an animation that looks like a live system and is not one is the kind of thing
 * that gets asked about in a defense, so the caption is part of the component
 * rather than something the page can be laid out without.
 *
 * The answer shown is the shape a real answer takes: grounded in retrieved
 * place-cards, with the sources named, and the map moving to what actually
 * grounded it. No availability is shown here — that would require a trained
 * classifier and consented faculty, neither of which exists yet.
 *
 * Runs once when scrolled into view, then holds. Reduced motion skips straight
 * to the finished state.
 */

const QUESTION = 'Where is the College of Computing Studies?';
const ANSWER = 'The College of Computing, Information and Communication Technology is on the eastern side of the Echague Main Campus, near the Centrum Building. It houses the Information Technology, Computer Science and Information Systems programs.';
const SOURCES = ['College of Computing — place-card', 'Campus directory extract'];

export default function LandingScriptedDemo() {
  const [ref, inView] = useInView({ threshold: 0.35 });
  const reduced = usePrefersReducedMotion();

  const [typed, setTyped] = useState('');
  const [phase, setPhase] = useState('idle'); // idle → typing → thinking → answered
  const started = useRef(false);

  useEffect(() => {
    if (!inView || started.current) return undefined;
    started.current = true;

    if (reduced) {
      setTyped(QUESTION);
      setPhase('answered');
      return undefined;
    }

    const timers = [];
    setPhase('typing');

    // Per-character rather than a CSS width animation, so the caret sits at the
    // real end of the text and the line wraps like typing rather than a reveal.
    let i = 0;
    const type = setInterval(() => {
      i += 1;
      setTyped(QUESTION.slice(0, i));
      if (i >= QUESTION.length) {
        clearInterval(type);
        timers.push(setTimeout(() => setPhase('thinking'), 420));
        timers.push(setTimeout(() => setPhase('answered'), 1750));
      }
    }, 38);

    return () => {
      clearInterval(type);
      timers.forEach(clearTimeout);
    };
  }, [inView, reduced]);

  return (
    <section id="demo" ref={ref} className="relative py-24 sm:py-32">
      <div className="container-x">
        <div className="max-w-[38rem]">
          <p className="eyebrow">See it think</p>
          <h2 className="mt-3 font-serif text-[2rem] leading-tight tracking-[-0.015em] text-fg sm:text-[2.6rem]">
            Ask like a student,
            <span className="block italic text-gradient-accent">answered from the archive.</span>
          </h2>
        </div>

        {/* Tilted a degree and a half and offset from centre. A perfectly
            square, perfectly centred frame reads as a screenshot; a slight
            rotation reads as an object sitting on the page. */}
        <div className="mx-auto mt-14 max-w-[46rem] overflow-hidden rounded-xl border border-line bg-surface/95 shadow-lg lg:-rotate-[1.2deg] lg:translate-x-6">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <span className="flex gap-1.5" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-pill bg-error/70" />
              <span className="h-2.5 w-2.5 rounded-pill bg-warning/70" />
              <span className="h-2.5 w-2.5 rounded-pill bg-success/70" />
            </span>
            <p className="flex-1 text-center font-mono text-data uppercase tracking-[0.12em] text-fg-subtle">
              Scripted preview · ISU-GeoBot
            </p>
          </div>

          <div className="min-h-[19rem] space-y-6 p-6 sm:p-8">
            {/* question */}
            <div className="flex justify-end">
              <p className="max-w-[80%] rounded-lg border border-line-strong bg-bg px-4 py-2.5 text-meta font-medium text-fg">
                {typed || ' '}
                {phase === 'typing' && <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-accent align-middle" />}
              </p>
            </div>

            {/* answer */}
            {phase === 'thinking' && (
              <div className="flex items-start gap-2.5" role="status">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-pill bg-accent text-accent-contrast" aria-hidden>
                  <span className="font-serif text-[12px] font-semibold leading-none">G</span>
                </span>
                <p className="pt-1 text-label text-fg-subtle">Retrieving place-cards…</p>
              </div>
            )}

            {phase === 'answered' && (
              <div className="animate-enter flex items-start gap-2.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-pill bg-accent text-accent-contrast" aria-hidden>
                  <span className="font-serif text-[12px] font-semibold leading-none">G</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body leading-relaxed text-fg">{ANSWER}</p>

                  <p className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line bg-bg-sunken px-2.5 py-1.5 text-label text-fg-muted">
                    <Compass className="h-3.5 w-3.5 text-accent" aria-hidden />
                    Shown on the map:{' '}
                    <span className="font-medium text-fg">College of Computing</span>
                  </p>

                  <ul className="mt-3 space-y-1">
                    {SOURCES.map((s) => (
                      <li key={s} className="flex items-center gap-1.5 text-label text-fg-subtle">
                        <FileText className="h-3 w-3" aria-hidden />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="mx-auto mt-5 max-w-[34rem] text-center text-label leading-relaxed text-fg-subtle">
          A scripted preview on a fixed timer, not a live query. The assistant
          answers from the twenty-eight indexed campus locations &mdash; open it
          and ask the same question yourself.
        </p>
      </div>
    </section>
  );
}
