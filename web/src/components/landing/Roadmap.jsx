import { useReveal } from '../../hooks/useMotion.js';

/**
 * The evaluation roadmap.
 *
 * Replaces a blank "no results" panel with the actual methodology, staged.
 * `System development` is the only step marked complete, because it is the
 * only one that is — and the roadmap says so rather than implying progress
 * the study has not made.
 *
 * The spine fills to the last completed step as the section enters. It does
 * not fill further, and there is no percentage anywhere: a progress bar
 * implies a measurable fraction, and "how far through a thesis are you" is
 * not a measurable fraction.
 */
const STEPS = [
  ['System development', 'Pipeline, privacy boundary, portals and evaluation harness built.', true],
  ['Curated test dataset', 'Representative campus queries with ground-truth answers, registered before any run.', false],
  ['Standard vs Enhanced', 'Both arms run interleaved in one session against identical configuration.', false],
  ['RAGAS evaluation', 'Context precision, context recall, faithfulness and answer relevancy, scored by an independent judge model.', false],
  ['Faculty validation', 'Selected faculty confirm estimates against their actual status across five departments.', false],
  ['Results', 'Accuracy, per-category precision and recall, and the confusion matrix.', false],
];

export default function Roadmap() {
  const [ref, shown] = useReveal({ threshold: 0.2 });
  const doneCount = STEPS.filter(([, , d]) => d).length;

  return (
    <div ref={ref}>
      <p className="eyebrow">Evaluation roadmap</p>
      <ol className="relative mt-5">
        {/* spine */}
        <span aria-hidden className="absolute left-[7px] top-2 bottom-2 w-px bg-line" />
        <span
          aria-hidden
          className="absolute left-[7px] top-2 w-px origin-top bg-accent"
          style={{
            height: `calc((100% - 1rem) * ${doneCount / STEPS.length})`,
            transform: shown ? 'scaleY(1)' : 'scaleY(0)',
            transition: 'transform 900ms var(--ease-in)',
          }}
        />

        {STEPS.map(([title, body, done], i) => (
          <li
            key={title}
            className="relative flex gap-5 pb-6 pl-8 last:pb-0"
            style={{
              transition: 'transform 550ms var(--ease-in), opacity 550ms var(--ease-in)',
              transitionDelay: `${i * 80}ms`,
              transform: shown ? 'none' : 'translateY(10px)',
              opacity: shown ? 1 : 0,
            }}
          >
            <span
              aria-hidden
              className={`absolute left-0 top-1 grid h-[15px] w-[15px] place-items-center rounded-pill border-2 ${
                done ? 'border-accent bg-accent' : 'border-line-strong bg-bg'
              }`}
            >
              {done && <span className="h-[5px] w-[5px] rounded-pill bg-accent-contrast" />}
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-baseline gap-2 text-meta font-medium text-fg">
                {title}
                <span className={`text-label font-normal ${done ? 'text-accent' : 'text-fg-subtle'}`}>
                  {done ? 'complete' : 'pending'}
                </span>
              </p>
              <p className="mt-1 max-w-measure text-label leading-relaxed text-fg-muted">{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
