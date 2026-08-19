import SectionHeader from '../patterns/SectionHeader.jsx';
import { useReveal } from '../../hooks/useMotion.js';
import MaskingFlow from './MaskingFlow.jsx';

/**
 * The privacy boundary, drawn.
 *
 * Audit F-25 governs the wording. The thesis's §3.10 claim — "no personally
 * identifiable information of faculty members will be stored, transmitted, or
 * displayed" — is not true of the architecture it describes: the system cannot
 * answer "Is Prof. Santos available?" without storing faculty identity, and the
 * presence log is timestamped, person-linked data.
 *
 * So this section makes the DATA MINIMISATION claim instead, which is true,
 * stronger, and defensible. It also does not claim RA 10173 compliance —
 * compliance is a legal determination, not a design property.
 */
const SAFEGUARDS = [
  ['Generalized status only', 'The system reports one of three states. It never derives, stores or discloses which room, floor or building a faculty member is in.'],
  ['Egress filtering', 'Every generated answer carrying a status is scanned for location detail before it is returned. If the model speculates about a room, the response is replaced.'],
  ['Pseudonymised training data', 'Attendance-derived features reach the classifier under a surrogate identifier. The model never receives a name.'],
  ['Consent-gated roster', 'Only faculty who have given written informed consent can be asked about. Everyone else is outside the answerable roster.'],
  ['Faculty hold the switch', 'A faculty member can pause disclosure themselves at any time. The estimate is then never computed, not computed and withheld.'],
  ['Present-moment only', 'No history, no forecasting. Neither "was she in yesterday" nor "when will she be free" — either turns a status into a movement profile.'],
];

export default function Privacy() {
  const [ref, shown] = useReveal();

  return (
    <section id="privacy" className="border-b border-line py-20 sm:py-28">
      <div className="container-x">
        <SectionHeader eyebrow="Ethical design" title="Availability without surveillance">
          Knowing whether a professor is free should not require knowing where
          they are. The status masking protocol is the architectural boundary
          that keeps those two questions apart.
        </SectionHeader>

        <div className="mt-14">
          <MaskingFlow />
        </div>

        <div ref={ref} className="stagger mt-16 grid gap-x-12 gap-y-9 sm:grid-cols-2">
          {SAFEGUARDS.map(([title, body], i) => (
            <div
              key={title}
              style={{ '--i': i }}
              className={`reveal ${shown ? 'is-in' : ''} border-t border-line pt-5`}
            >
              <h3 className="text-meta font-semibold text-fg">{title}</h3>
              <p className="mt-2 max-w-measure text-meta leading-relaxed text-fg-muted">{body}</p>
            </div>
          ))}
        </div>

        <p className="mt-14 max-w-measure text-meta leading-relaxed text-fg-subtle">
          ISU-GeoBot is designed in accordance with the principles of Republic
          Act No. 10173 (Data Privacy Act of 2012), applying data minimisation
          and purpose limitation. That is a description of the system&rsquo;s
          design, not a claim of certified legal compliance.
        </p>
      </div>
    </section>
  );
}

