import { useEffect, useState } from 'react';
import { useInView } from '../../hooks/useMotion.js';

/**
 * The status masking boundary, animated.
 *
 * Five labelled tokens descend from the private side, meet a heavy rule, and
 * one generalized status emerges below it. The animation IS the argument: many
 * things go in, one thing comes out, and the boundary is where that reduction
 * happens.
 *
 * WHAT THESE LABELS ARE. Field NAMES from the architecture — "probability
 * vector", "schedule row" — never values. Nothing here is or resembles real
 * data about a real person. This is a diagram of a mechanism, and it would be
 * a poor one if it demonstrated the mechanism by showing what the mechanism
 * exists to hide.
 *
 * Runs only while on screen and only once per entry; it does not loop
 * indefinitely in a section the reader has scrolled past.
 */

const PRIVATE = [
  'Raw classifier output',
  'Probability vector',
  'Schedule row · room label',
  'Presence log entry',
  'Model feature vector',
];

export default function MaskingFlow() {
  const [ref, inView, reduced] = useInView({ threshold: 0.35 });
  const [phase, setPhase] = useState(0);

  // 0 resting · 1 descending · 2 absorbed · 3 emerged
  useEffect(() => {
    if (!inView) { setPhase(0); return; }
    if (reduced) { setPhase(3); return; }
    const t1 = setTimeout(() => setPhase(1), 120);
    const t2 = setTimeout(() => setPhase(2), 1500);
    const t3 = setTimeout(() => setPhase(3), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [inView, reduced]);

  return (
    <div ref={ref} className="border-y border-line">
      {/* private side */}
      <div className="grid gap-4 py-8 sm:grid-cols-[minmax(0,13rem)_1fr] sm:gap-10">
        <p className="eyebrow pt-0.5">Private — never leaves the server</p>
        <ul className="flex flex-wrap gap-x-3 gap-y-2">
          {PRIVATE.map((label, i) => (
            <li
              key={label}
              className="border border-line px-2.5 py-1 font-mono text-data text-fg-muted"
              style={{
                transition: 'transform 900ms var(--ease-in), opacity 700ms var(--ease-in)',
                transitionDelay: `${i * 70}ms`,
                transform: phase >= 2 ? 'translateY(10px) scale(.96)' : 'none',
                // Settles dimmed rather than vanishing. The diagram's argument
                // is "many things go in, one comes out" — if the many things
                // disappear, a reader arriving after the animation sees an
                // empty band and the argument is lost.
                opacity: phase >= 2 ? 0.32 : phase >= 1 ? 1 : 0.5,
              }}
            >
              {label}
            </li>
          ))}
        </ul>
      </div>

      {/* the boundary */}
      <div className="relative border-y-2 border-fg py-6">
        {/* descent lines, drawn only while the tokens are travelling */}
        <svg
          className="pointer-events-none absolute inset-x-0 -top-8 h-8 w-full text-fg-subtle"
          aria-hidden
          fill="none"
          preserveAspectRatio="none"
          viewBox="0 0 100 32"
        >
          {[18, 34, 50, 66, 82].map((x, i) => (
            <path
              key={x}
              d={`M${x} 0 L${x} 32`}
              stroke="currentColor"
              strokeWidth=".4"
              strokeDasharray="2 3"
              style={{
                opacity: phase === 1 ? 0.7 : 0,
                transition: 'opacity 400ms var(--ease-in)',
                transitionDelay: `${i * 70}ms`,
              }}
            />
          ))}
        </svg>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-5">
          <p className="font-serif text-h3 text-fg">Status masking</p>
          <p className="max-w-measure text-meta leading-relaxed text-fg-muted">
            Allowlist projection, intermediate purge, and an egress scan of the
            generated answer. One value from a closed set of three may cross —
            anything else is rejected, never substituted with a default.
          </p>
        </div>
      </div>

      {/* disclosed side */}
      <div className="grid gap-4 py-8 sm:grid-cols-[minmax(0,13rem)_1fr] sm:gap-10">
        <p className="eyebrow pt-0.5">Disclosed — to signed-in campus users</p>
        <div>
          <div
            className="inline-flex items-center gap-2 border border-accent bg-accent-subtle px-3 py-1.5"
            style={{
              transition: 'transform 600ms var(--ease-in), opacity 600ms var(--ease-in)',
              transform: phase >= 3 ? 'none' : 'translateY(-10px)',
              opacity: phase >= 3 ? 1 : 0,
            }}
          >
            <span className="h-1.5 w-1.5 rounded-pill bg-accent" aria-hidden />
            <span className="text-meta font-medium text-fg">
              One generalized availability status
            </span>
          </div>
          <p className="mt-3 max-w-measure text-label leading-relaxed text-fg-subtle">
            Available for Consultation, In Scheduled Class / Lecture, or
            Unavailable / Off-Schedule &mdash; marked as an estimate, with no
            probability, no confidence figure and no location.
          </p>
        </div>
      </div>
    </div>
  );
}
