import SectionHeader from '../patterns/SectionHeader.jsx';
import PipelineDiagram from './PipelineDiagram.jsx';

/**
 * The seven-stage pipeline, explored progressively.
 *
 * Defaults to `route` — the first stage. The previous build opened on the
 * masking stage, dropping the reader into the middle of a pipeline they had
 * not been introduced to.
 *
 * Presented as a numbered index with a detail panel rather than seven cards:
 * a pipeline is a sequence, and a grid of equal boxes is the one layout that
 * cannot express sequence.
 */
const STACK = [
  ['Frontend', ['React 18', 'Leaflet 1.9', 'Vite']],
  ['Backend', ['Node.js 20', 'Express 4']],
  ['Data', ['Supabase', 'PostgreSQL', 'pgvector']],
  ['Machine learning', ['Python 3.11', 'scikit-learn 1.4', 'Flask']],
  ['AI', ['all-MiniLM-L6-v2', 'Llama 3.1 8B', 'Groq', 'RAGAS']],
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="border-b border-line py-20 sm:py-28">
      <div className="container-x">
        <SectionHeader eyebrow="Enhanced RAG" title="How a question becomes an answer">
          A three-tier system: a browser client, an application server holding
          the routing and privacy logic, and a Python service for machine
          learning inference.
        </SectionHeader>

        <div className="mt-14">
          <PipelineDiagram />
        </div>

        <div className="mt-16 border-t border-line pt-8">
          <p className="eyebrow">Built with</p>
          <dl className="mt-5 grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-5">
            {STACK.map(([group, items]) => (
              <div key={group}>
                <dt className="text-label font-semibold text-fg">{group}</dt>
                <dd className="mt-1.5 space-y-1">
                  {items.map((i) => (
                    <span key={i} className="block font-mono text-data text-fg-muted">{i}</span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
