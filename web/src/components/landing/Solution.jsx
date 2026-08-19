import { FileText, MapPin, UserCheck } from 'lucide-react';
import SectionHeader from '../patterns/SectionHeader.jsx';
import { useReveal } from '../../hooks/useMotion.js';

/**
 * Three inputs, one assistant. Drawn as a convergence rather than three
 * feature cards, because the claim being made is specifically that these
 * things stop being separate.
 */
const INPUTS = [
  { icon: MapPin, label: 'Campus geography', body: 'Buildings, offices and points of interest, with the metadata that explains what each one is for.' },
  { icon: FileText, label: 'Institutional documents', body: 'Memoranda, academic calendars and handbooks, retrieved and quoted rather than summarised from memory.' },
  { icon: UserCheck, label: 'Availability intelligence', body: 'A generalized, schedule-derived estimate of whether a faculty member is free — never a location.' },
];

export default function Solution() {
  const [ref, shown] = useReveal();

  return (
    <section className="border-b border-line bg-bg-sunken py-20 sm:py-28">
      <div className="container-x">
        <SectionHeader eyebrow="The system" title="Three sources, one answer">
          ISU-GeoBot reads all three in the same pass, so a question that spans
          them does not become three separate errands.
        </SectionHeader>

        <div ref={ref} className="stagger mt-14 grid gap-10 md:grid-cols-3">
          {INPUTS.map((s, i) => (
            <div
              key={s.label}
              style={{
                transition: 'transform 650ms var(--ease-in), opacity 650ms var(--ease-in)',
                transitionDelay: `${i * 110}ms`,
                transform: shown ? 'none' : 'translateY(18px)',
                opacity: shown ? 1 : 0,
              }}
            >
              <div className="flex items-center gap-2.5 border-b border-line pb-3">
                <s.icon className="h-4 w-4 text-accent" strokeWidth={1.75} aria-hidden />
                <h3 className="text-meta font-semibold text-fg">{s.label}</h3>
              </div>
              <p className="mt-4 text-meta leading-relaxed text-fg-muted">{s.body}</p>
            </div>
          ))}
        </div>

        {/* three sources converging on one assistant */}
        <svg
          className="mt-12 h-16 w-full text-fg-subtle" viewBox="0 0 600 60"
          fill="none" preserveAspectRatio="none" aria-hidden
        >
          {['M100 0 L100 26 Q100 38 112 38 L288 38 Q300 38 300 50 L300 60',
            'M300 0 L300 60',
            'M500 0 L500 26 Q500 38 488 38 L312 38 Q300 38 300 50 L300 60'].map((d, i) => (
            <path
              key={d} d={d} stroke="currentColor" strokeWidth="1"
              style={{
                strokeDasharray: 220, strokeDashoffset: shown ? 0 : 220,
                transition: 'stroke-dashoffset 900ms var(--ease-in)',
                transitionDelay: `${300 + i * 120}ms`,
              }}
            />
          ))}
          <circle
            cx="300" cy="56" r="3.5" className="text-accent" fill="currentColor"
            style={{
              transition: 'opacity 400ms var(--ease-in)',
              transitionDelay: '1150ms', opacity: shown ? 1 : 0,
            }}
          />
        </svg>

        <div className="mt-2 border-t border-line pt-8">
          <p className="max-w-measure font-serif text-h3 leading-snug text-fg">
            &ldquo;Where is the College of Computing Studies, and is Prof. Santos
            free this afternoon?&rdquo;
          </p>
          <p className="mt-3 max-w-measure text-meta leading-relaxed text-fg-muted">
            One question, one answer, drawn from a campus map, an institutional
            corpus and a classifier &mdash; with the location half answered
            precisely and the availability half answered only in general terms.
          </p>
        </div>
      </div>
    </section>
  );
}
