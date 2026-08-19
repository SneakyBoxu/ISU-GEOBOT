import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Button from '../ui-primitives/ActionButton.jsx';
import { useReveal } from '../../custom-react-hooks/useReducedMotionPreference.js';

/**
 * The study — what is built, and what has not been measured yet.
 *
 * TWO LAYERS, AND THE SECOND ONE IS THE POINT.
 *
 * The reference this page was modelled on shows figures like "85% similarity".
 * This system has none to show: no model has been trained and no comparison has
 * been run. The temptation on a page designed to impress is to borrow the shape
 * of a result — a ring at 94%, a bar chart with plausible heights — and that is
 * precisely the thing audit §10.3 forbids and a panel would catch.
 *
 * So the numbers on screen are all PARAMETERS: true today, checkable in the
 * repository, claiming nothing. And beneath them the four RAGAS metrics appear
 * as instruments with labelled axes and no readings.
 *
 * Empty instruments are not a gap in the design. They say the study is running
 * and honest, which is a stronger thing for a thesis artefact to say than any
 * invented percentage.
 */

const PARAMETERS = [
  ['384', 'embedding dimensions', 'all-MiniLM-L6-v2'],
  ['220', 'tokens per chunk, ceiling', 'below the 256 word-piece limit'],
  ['3', 'availability states', 'generalized, never a location'],
  ['28', 'campus locations indexed', 'each with a place-card in the corpus'],
];

const METRICS = [
  ['Context Precision', 'How much of what was retrieved was actually relevant'],
  ['Context Recall', 'How much of what was relevant was actually retrieved'],
  ['Faithfulness', 'Whether the answer is supported by the retrieved context'],
  ['Answer Relevancy', 'Whether the answer addresses the question asked'],
];

export default function LandingResearchInstruments() {
  const [ref, shown] = useReveal();

  return (
    <section id="research" className="relative border-t border-line py-24 sm:py-32">
      <div className="container-x">
        <div className="max-w-[46rem]">
          <p className="eyebrow">The study</p>
          <h2 className="mt-4 font-serif text-[2rem] leading-tight tracking-[-0.015em] text-fg sm:text-[2.6rem]">
            An Enhanced RAG architecture for
            <span className="block italic text-gradient-accent">
              faculty availability classification
            </span>
          </h2>
          <p className="lede mt-6">
            BSCS Data Mining track, Isabela State University &mdash; Echague.
            The architecture below is built and running. The evaluation is not
            finished, and nothing on this page reports a result.
          </p>
        </div>

        {/* ---- layer one: parameters, all true today ---- */}
        <dl ref={ref} className="mt-16 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {PARAMETERS.map(([value, label, note], i) => (
            <div
              key={label}
              className="bg-bg p-6"
              style={{
                transitionProperty: 'transform, opacity',
                transitionDuration: '600ms',
                transitionTimingFunction: 'var(--ease-in)',
                transitionDelay: `${i * 80}ms`,
                transform: shown ? 'none' : 'translateY(16px)',
                opacity: shown ? 1 : 0,
              }}
            >
              <dt className="sr-only">{label}</dt>
              <dd>
                <span className="block font-mono text-[2.25rem] font-semibold leading-none text-fg" data-numeric>
                  {value}
                </span>
                <span className="mt-2 block text-meta text-fg-muted">{label}</span>
                <span className="mt-1 block text-label text-fg-subtle">{note}</span>
              </dd>
            </div>
          ))}
        </dl>

        {/* ---- layer two: instruments awaiting readings ---- */}
        <div className="mt-16">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-3">
            <h3 className="text-body font-semibold text-fg">RAGAS evaluation</h3>
            <p className="inline-flex items-center gap-2 text-label text-fg-subtle">
              <span className="h-1.5 w-1.5 rounded-pill bg-warning" aria-hidden />
              Awaiting evaluation &mdash; no readings recorded
            </p>
          </div>

          <ul className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {METRICS.map(([name, what]) => (
              <li key={name}>
                <p className="text-meta font-medium text-fg">{name}</p>
                <p className="mt-1.5 text-label leading-relaxed text-fg-subtle">{what}</p>

                {/* The instrument: a labelled axis with no reading on it. The
                    dashes are the whole message — a filled bar here would be a
                    fabricated finding. */}
                <div className="mt-4" aria-hidden>
                  <div className="h-8 rounded-sm border border-dashed border-line-strong" />
                  <div className="mt-1.5 flex justify-between font-mono text-[0.625rem] text-fg-subtle">
                    <span>0.0</span>
                    <span>1.0</span>
                  </div>
                </div>
                <p className="sr-only">Not yet measured.</p>
              </li>
            ))}
          </ul>

          <p className="mt-10 max-w-measure text-meta leading-relaxed text-fg-subtle">
            Both arms of the comparison will be scored by the same judge model,
            which is not the model that generates the answers. The evaluation
            harness refuses to run at all while any placeholder data remains in
            the research tables, so no figure produced during development can
            reach the paper by accident.
          </p>
        </div>

        {/* ---- close ---- */}
        <div className="mt-20 rounded-xl border border-line bg-surface/95 p-10 sm:p-14">
          <h2 className="max-w-[30rem] font-serif text-[1.9rem] leading-tight tracking-[-0.015em] text-fg sm:text-[2.4rem]">
            Ask it something about
            <span className="block italic text-gradient-accent">the Echague campus.</span>
          </h2>
          <p className="lede mt-5">
            The assistant runs on the twenty-eight real locations now. Faculty
            availability needs the schedule data the university is still
            preparing.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button as={Link} to="/app" variant="primary" size="lg" iconRight={ArrowRight}>
              Launch Assistant
            </Button>
            <Button as={Link} to="/validate" variant="secondary" size="lg">
              Faculty Portal
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
