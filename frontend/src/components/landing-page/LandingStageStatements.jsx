import { useReveal } from '../../custom-react-hooks/useReducedMotionPreference.js';
import LandingRevealText from './LandingRevealText.jsx';

/**
 * The two sections written against the moving stage.
 *
 * They are composed as opposites on purpose. The problem is FRAGMENTED — three
 * observations stepping down and across the page, each one further from the
 * margin than the last, numbered in display type that runs off its own edge. A
 * page arguing that campus information is scattered should not present that
 * argument as three tidy equal columns; the layout would contradict the
 * sentence.
 *
 * Privacy is the reverse: one centred statement with nothing else on the
 * screen, arriving exactly as the particle field flattens into its veil. After
 * two dense sections, emptiness is the loudest thing available.
 */

const OBSERVATIONS = [
  ['01', 'The map is printed, and it is static',
    'Campus navigation relies on printed maps and physical signage. They show where a building is, and nothing about what is happening inside it.'],
  ['02', 'Schedules live in separate departments',
    'Faculty timetables are maintained department by department, with no centralized or digital access point. Finding one means asking someone who has it.'],
  ['03', 'So students walk to find out',
    'Confirming whether a faculty member is available means visiting the office, or several offices. Incoming students, unfamiliar with the campus, carry most of that cost.'],
];

const SAFEGUARDS = [
  ['Generalized status only', 'Three states, and nothing finer. The system never derives, stores or discloses which room, floor or building a faculty member is in.'],
  ['Egress filtering', 'Every answer carrying a status is scanned for location detail before it is returned. If the model speculates about a room, the response is replaced.'],
  ['Pseudonymised training', 'Attendance-derived features reach the classifier under a surrogate identifier. The model never receives a name.'],
  ['Consent-gated roster', 'Only faculty who have given written informed consent can be asked about. Everyone else is outside the answerable roster.'],
  ['Faculty hold the switch', 'A faculty member can pause disclosure themselves at any time. The estimate is then never computed — not computed and withheld.'],
  ['Present-moment only', 'No history, no forecasting. Neither "was she in yesterday" nor "when will she be free" — either turns a status into a movement profile.'],
];

export function LandingProblemOverStage() {
  const [ref, shown] = useReveal({ threshold: 0.1 });

  return (
    <section id="problem" className="relative py-32 sm:py-40">
      <div className="container-x">
        <div className="max-w-[34rem]">
          <p className="eyebrow">The problem</p>
          <LandingRevealText
            lines={['A map tells you where', 'a room is. Not who is in it.']}
            accentFrom={1}
            className="mt-5 font-serif text-[2.1rem] leading-[1.06] tracking-[-0.02em] text-fg sm:text-[2.9rem]"
          />
        </div>

        <ol ref={ref} className="mt-20 space-y-16 lg:space-y-24">
          {OBSERVATIONS.map(([n, title, body], i) => (
            <li
              key={n}
              // Each observation steps further from the margin than the last.
              // The reader's eye has to travel to find the next one, which is
              // the experience being described.
              className="lg:max-w-[46rem]"
              style={{
                marginLeft: `${i * 9}%`,
                transitionProperty: 'transform, opacity',
                transitionDuration: '900ms, 700ms',
                transitionTimingFunction: 'cubic-bezier(.16,1,.3,1), ease-out',
                transitionDelay: `${i * 140}ms`,
                transform: shown ? 'none' : 'translateY(34px)',
                opacity: shown ? 1 : 0,
              }}
            >
              <div className="flex items-start gap-6 sm:gap-10">
                <span
                  aria-hidden
                  className="shrink-0 font-serif text-[3.4rem] font-semibold leading-none text-fg opacity-[0.14] sm:text-[5rem]"
                >
                  {n}
                </span>
                <div className="min-w-0 border-t border-line pt-4">
                  <h3 className="text-h3 font-semibold leading-snug text-fg">{title}</h3>
                  <p className="mt-3 max-w-measure text-body leading-relaxed text-fg-muted">{body}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function LandingPrivacyVeil() {
  const [ref, shown] = useReveal({ threshold: 0.12 });

  return (
    <section id="privacy" className="relative py-36 sm:py-48">
      <div className="container-x">
        <div className="mx-auto max-w-[44rem] text-center">
          <p className="eyebrow">Ethical design</p>
          <LandingRevealText
            lines={['Availability', 'without surveillance.']}
            accentFrom={1}
            className="mt-5 font-serif text-[2.6rem] leading-[1.02] tracking-[-0.025em] text-fg sm:text-[4rem]"
          />
          <p className="lede mx-auto mt-8 max-w-[34rem]">
            The field behind this has flattened on purpose. Every point is still
            there; not one of them is identifiable. That is the design decision
            the whole system is built around.
          </p>
        </div>

        <ul
          ref={ref}
          className="mx-auto mt-24 grid max-w-[64rem] gap-x-12 gap-y-12 sm:grid-cols-2 lg:grid-cols-3"
        >
          {SAFEGUARDS.map(([title, body], i) => (
            <li
              key={title}
              style={{
                transitionProperty: 'transform, opacity',
                transitionDuration: '800ms, 600ms',
                transitionTimingFunction: 'cubic-bezier(.16,1,.3,1), ease-out',
                transitionDelay: `${i * 80}ms`,
                transform: shown ? 'none' : 'translateY(26px) scale(0.985)',
                opacity: shown ? 1 : 0,
              }}
            >
              <span aria-hidden className="block h-px w-10 bg-accent" />
              <h3 className="mt-4 text-meta font-semibold text-fg">{title}</h3>
              <p className="mt-2 text-label leading-relaxed text-fg-muted">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
