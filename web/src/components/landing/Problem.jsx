import SectionHeader from '../patterns/SectionHeader.jsx';
import { useReveal } from '../../hooks/useMotion.js';

/**
 * The problem, stated as the thesis states it (§1.1) and no more strongly.
 *
 * Editorial rather than infographic: three numbered observations set in a
 * ruled list. No cards, no icons in circles — the point is that the current
 * situation is fragmented, and a page made of six identical boxes would
 * contradict its own argument.
 */
const OBSERVATIONS = [
  {
    n: '01',
    title: 'The map is printed, and it is static',
    body:
      'Campus navigation relies on printed maps and physical signage. They show where a building is, and nothing about what is happening inside it.',
  },
  {
    n: '02',
    title: 'Schedules live in separate departments',
    body:
      'Faculty timetables are maintained department by department, with no centralized or digital access point. Finding one means asking someone who has it.',
  },
  {
    n: '03',
    title: 'So students walk to find out',
    body:
      'Confirming whether a faculty member is available means visiting the office, or several offices. Incoming students, unfamiliar with the campus, carry most of that cost.',
  },
];

export default function Problem() {
  const [ref, shown] = useReveal();

  return (
    <section id="problem" className="border-b border-line py-20 sm:py-28">
      <div className="container-x">
        <SectionHeader eyebrow="The problem" title="Spatial information, and everything it leaves out">
          A campus map tells you where a room is. It cannot tell you whether
          the person you are looking for is in it.
        </SectionHeader>

        <ol ref={ref} className="stagger mt-14 grid gap-px border-t border-line md:grid-cols-3">
          {OBSERVATIONS.map((o, i) => (
            <li
              key={o.n}
              className={`border-b border-line pt-7 md:border-b-0 md:pr-8 ${
                i > 0 ? 'md:border-l md:border-line md:pl-8' : ''
              }`}
              style={{
                // Scattered observations converge as the section arrives —
                // the outer columns travel inward, the centre stays put.
                transition: 'transform 700ms var(--ease-in), opacity 700ms var(--ease-in)',
                transitionDelay: `${i * 90}ms`,
                transform: shown ? 'none' : `translateX(${(i - 1) * 26}px) translateY(14px)`,
                opacity: shown ? 1 : 0,
              }}
            >
              <span className="font-mono text-data text-fg-subtle">{o.n}</span>
              <h3 className="mt-3 font-serif text-h3 text-fg">{o.title}</h3>
              <p className="mt-3 max-w-measure pb-7 text-meta leading-relaxed text-fg-muted">
                {o.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
