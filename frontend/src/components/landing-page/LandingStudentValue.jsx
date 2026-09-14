import React from 'react';
import { Compass, MapPinned, MessageCircleQuestion, ShieldCheck } from 'lucide-react';
import { useReveal } from '../../custom-react-hooks/useReducedMotionPreference.js';
import LandingRevealText from './LandingRevealText.jsx';
import LandingSchematicField from './LandingSchematicField.jsx';
import { revealStyle } from '../../custom-react-hooks/revealStyle.js';

/**
 * What a student gets, stated as four things they can do.
 *
 * THIS REPLACED "THE PROBLEM". That section opened by calling the existing
 * campus map printed and static — an argument the thesis needs and a homepage
 * does not. Telling a first-year visitor how bad the alternative is spends
 * their attention on the thing you are replacing rather than the thing you
 * built, and it makes a working product sound like a complaint. The same
 * material still exists, in the Research section, where the study justifies
 * itself to a panel rather than to a student.
 *
 * Every claim here is a capability that exists today. Nothing about routing,
 * live positions or indoor navigation, because none of that is built.
 */

const VALUE = [
  {
    icon: MapPinned,
    title: 'Find campus locations',
    body:
      'Every indexed building, office and facility across the Echague Main Campus, each pinned on an interactive map with what it is for.',
  },
  {
    icon: MessageCircleQuestion,
    title: 'Ask instead of searching',
    body:
      'Type the question the way you would say it. ISU-GeoBot reads it, finds the place, and moves the map to it.',
  },
  {
    icon: Compass,
    title: 'Explore before you go',
    body:
      'See what a building houses, which department is inside and where it sits relative to everything else — before walking across 355 hectares.',
  },
  {
    icon: ShieldCheck,
    title: 'Availability, not surveillance',
    body:
      'Where a faculty member has opted in, you can see a generalized availability status. Never a room, a building, or where they have been.',
  },
];

export default function LandingStudentValue() {
  const [ref, shown] = useReveal({ threshold: 0.12 });

  return (
    <section id="find-your-way" className="relative overflow-hidden py-28 sm:py-36">
      <LandingSchematicField />
      <div className="container-x">
        <div className="max-w-[36rem]">
          <p className="eyebrow">What you can do</p>
          <LandingRevealText
            lines={['Everything you need', 'to find your way.']}
            accentFrom={1}
            className="mt-5 font-serif text-[2.2rem] leading-[1.04] tracking-[-0.02em] text-fg sm:text-[3rem]"
          />
        </div>

        <ul ref={ref} className="mt-16 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
          {VALUE.map(({ icon: Icon, title, body }, i) => (
            <li
              key={title}
              className="group bg-bg p-8 transition-colors duration-state hover:bg-bg-sunken sm:p-10"
style={revealStyle(shown, i, 'background-color')}
            >
              <span
                className="grid h-11 w-11 place-items-center rounded-lg bg-accent-subtle text-accent transition-transform duration-state group-hover:-translate-y-0.5"
                aria-hidden
              >
                <Icon className="h-5 w-5" strokeWidth={1.9} />
              </span>
              <h3 className="mt-5 text-h3 font-semibold text-fg">{title}</h3>
              <p className="mt-2.5 max-w-measure text-body leading-relaxed text-fg-muted">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
