import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, EyeOff } from 'lucide-react';
import { useReveal } from '../../custom-react-hooks/useReducedMotionPreference.js';
import LandingRevealText from './LandingRevealText.jsx';
import LandingSchematicField from './LandingSchematicField.jsx';
import { revealStyle } from '../../custom-react-hooks/revealStyle.js';

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
 *
 * IT SHOWS THE REFUSAL RATHER THAN DESCRIBING IT. This section used to be a
 * paragraph beside a short list, and it measured 19 per cent ink -- the emptiest
 * on the page, carrying its strongest claim. Two real exchanges say it better
 * than any amount of prose: the same assistant answers one question and
 * declines the other, and the reason it declines is that there is nothing to
 * look up. Both are copied from the running system, not written for the page.
 */

const NEVER = [
  'Which room or building someone is in',
  'Where they have been',
  'Where they will be later',
];

// Verbatim from the deployed assistant. The first is answered because a
// timetable can support it; the second is refused because no table anywhere
// maps a person to a place, so there is no answer to withhold.
const EXCHANGES = [
  {
    q: 'Is Dr. Santos available for consultation right now?',
    a: 'Dr. Santos is currently in a scheduled class that ends at 1:00 PM. '
      + 'The next consultation slot is Tuesday from 12:00 PM to 2:00 PM.',
    note: 'A status and a time. No room, no building, no floor.',
    answered: true,
  },
  {
    q: 'Where is Dr. Santos?',
    a: 'I’m sorry, but I don’t have that information.',
    note: 'Not a policy refusal. The system holds no person-to-place record.',
    answered: false,
  },
];

export default function LandingPrivacyPromise() {
  const [ref, shown] = useReveal({ threshold: 0.18 });

  return (
    <section id="privacy" className="rule-fade rule-fade-y relative overflow-hidden bg-bg-sunken py-28 sm:py-36">
      <LandingSchematicField />
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

          {/* The transcript. Reveal ref lives on the element it reveals --
              attaching it to a neighbour leaves the content at opacity 0 if
              that neighbour is ever removed. */}
          <div
            ref={ref}
            className="space-y-4"
            style={revealStyle(shown)}
          >
            {EXCHANGES.map((x, i) => (
              <div
                key={x.q}
                className="overflow-hidden rounded-xl border border-line bg-surface"
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <div className="flex justify-end border-b border-line px-5 py-4">
                  <p className="max-w-[22rem] rounded-lg bg-bg-sunken px-3.5 py-2.5 text-meta leading-relaxed text-fg">
                    {x.q}
                  </p>
                </div>

                <div className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-pill text-[0.6875rem] font-semibold ${
                        x.answered
                          ? 'bg-accent-subtle text-accent'
                          : 'border border-line-strong text-fg-subtle'
                      }`}
                    >
                      G
                    </span>
                    <p className="text-meta leading-relaxed text-fg-muted">{x.a}</p>
                  </div>

                  <p className="mt-4 flex items-start gap-2 border-t border-line pt-3.5 text-label leading-relaxed text-fg-subtle">
                    <span
                      aria-hidden
                      className={`mt-1.5 h-px w-4 shrink-0 ${x.answered ? 'bg-accent' : 'bg-line-strong'}`}
                    />
                    {x.note}
                  </p>
                </div>
              </div>
            ))}

            <div className="rounded-xl border border-line bg-surface/40 p-5">
              <p className="eyebrow">What it will never tell you</p>
              <ul className="mt-4 grid gap-2.5 sm:grid-cols-3 lg:grid-cols-1">
                {NEVER.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    {/* A struck-through mark, not a tick: this is a list of
                        things that do not happen, and ticks would read as a
                        feature list at a glance. */}
                    <span
                      aria-hidden
                      className="mt-1.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-pill border border-line-strong"
                    >
                      <span className="block h-px w-1.5 bg-fg-subtle" />
                    </span>
                    <span className="text-label leading-relaxed text-fg-muted">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-line pt-3.5 text-label leading-relaxed text-fg-subtle">
                These are not settings. Nothing computes, stores or transmits them.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
