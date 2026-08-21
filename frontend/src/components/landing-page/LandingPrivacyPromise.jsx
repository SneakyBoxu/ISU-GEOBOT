import { Link } from 'react-router-dom';
import { ArrowRight, EyeOff } from 'lucide-react';
import { useReveal } from '../../custom-react-hooks/useReducedMotionPreference.js';
import LandingRevealText from './LandingRevealText.jsx';

/**
 * Privacy, said plainly.
 *
 * A student needs three sentences: what you can see, what you can never see,
 * and who decides. The six-safeguard architecture — egress filtering,
 * pseudonymised training, the consent-gated roster, the masking boundary — is
 * still documented in full; it moved to the Research section, where the people
 * who need that level of detail will look for it.
 *
 * The distinction is deliberate and it is not a softening. Everything asserted
 * here is exactly what the system enforces. What changed is that a first-year
 * looking for the Registrar is no longer asked to read a threat model first.
 */

const NEVER = [
  'Which room or building someone is in',
  'Where they have been',
  'Where they will be later',
];

export default function LandingPrivacyPromise() {
  const [ref, shown] = useReveal({ threshold: 0.18 });

  return (
    <section id="privacy" className="relative py-28 sm:py-36">
      <div className="container-x">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-20">
          <div className="max-w-[34rem]">
            <p className="inline-flex items-center gap-2 rounded-pill bg-accent-subtle px-3 py-1.5 text-label font-medium text-accent">
              <EyeOff className="h-3.5 w-3.5" aria-hidden />
              Privacy by design
            </p>

            <LandingRevealText
              lines={['Availability,', 'never location.']}
              accentFrom={1}
              className="mt-6 font-serif text-[2.2rem] leading-[1.04] tracking-[-0.02em] text-fg sm:text-[3rem]"
            />

            <p className="lede mt-6">
              Where a faculty member has agreed to take part, ISU-GeoBot can
              tell you a generalized status &mdash; available for consultation,
              in a scheduled class, or unavailable. That is the entire disclosure.
            </p>

            <p className="mt-5 max-w-measure text-meta leading-relaxed text-fg-muted">
              Taking part is opt-in and reversible: a faculty member can switch
              it off themselves at any time, and the estimate is then never
              calculated at all. The status is derived from timetables, so it is
              an estimate rather than an observation &mdash; and the interface
              says so wherever it appears.
            </p>

            <Link
              to="#research"
              className="group mt-7 inline-flex items-center gap-2 text-meta text-accent transition-colors duration-state hover:text-accent-hover"
            >
              How the privacy architecture works
              <ArrowRight className="h-4 w-4 transition-transform duration-state group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>

          <div
            ref={ref}
            className="rounded-xl border border-line bg-surface p-8"
            style={{
              transitionProperty: 'transform, opacity',
              transitionDuration: '800ms, 600ms',
              transitionTimingFunction: 'cubic-bezier(.16,1,.3,1), ease-out',
              transform: shown ? 'none' : 'translateY(22px)',
              opacity: shown ? 1 : 0,
            }}
          >
            <p className="eyebrow">What it will never tell you</p>
            <ul className="mt-5 space-y-4">
              {NEVER.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  {/* A struck-through mark rather than a tick: this is a list
                      of things that do not happen, and a checklist of ticks
                      would read as a feature list at a glance. */}
                  <span
                    aria-hidden
                    className="mt-1.5 grid h-4 w-4 shrink-0 place-items-center rounded-pill border border-line-strong"
                  >
                    <span className="block h-px w-2 bg-fg-subtle" />
                  </span>
                  <span className="text-meta leading-relaxed text-fg-muted">{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 border-t border-line pt-5 text-label leading-relaxed text-fg-subtle">
              These are not settings. Nothing in the system computes, stores or
              transmits them.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
