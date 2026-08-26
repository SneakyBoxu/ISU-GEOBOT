import ChartLoadingPlaceholder from './ChartLoadingPlaceholder.jsx';

/**
 * Standard vs Enhanced across the four RAGAS metrics.
 *
 * Built now so real results drop in without a redesign, and deliberately
 * rendering nothing until they exist.
 *
 * @param {Array<{metric: string, standard: number, enhanced: number}>} data
 *   Omit or pass an empty array to render the pending state.
 *
 * Series are distinguished by FILL PATTERN as well as tone — Standard is
 * hatched, Enhanced is solid — so the comparison survives greyscale printing
 * and in greyscale, where both would otherwise resolve to the same ink.
 */
export default function BarComparison({ data, caption }) {
  if (!data?.length) {
    return (
      <ChartLoadingPlaceholder>
        Comparative RAGAS scores will appear here once the evaluation harness
        has been run against real institutional data. The harness refuses to
        run on synthetic data, so no figure can reach this chart early.
      </ChartLoadingPlaceholder>
    );
  }

  const max = 1;
  return (
    <figure>
      <svg viewBox="0 0 420 200" className="w-full text-fg" fill="none" role="img"
           aria-label={caption ?? 'Standard versus Enhanced RAG across four metrics'}>
        <defs>
          <pattern id="bc-hatch" width="4" height="4" patternUnits="userSpaceOnUse"
                   patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="4" stroke="currentColor" strokeWidth="1.6" />
          </pattern>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t} className="text-fg-subtle">
            <line x1="42" y1={160 - t * 130} x2="410" y2={160 - t * 130}
                  stroke="currentColor" strokeWidth=".5" opacity=".35" />
            <text x="36" y={163 - t * 130} fontSize="8" textAnchor="end"
                  fill="currentColor" fontFamily="ui-monospace, monospace">
              {t.toFixed(2)}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const x = 56 + i * 92;
          const hS = (d.standard / max) * 130;
          const hE = (d.enhanced / max) * 130;
          return (
            <g key={d.metric}>
              <rect x={x} y={160 - hS} width="26" height={hS}
                    className="text-fg-muted" fill="url(#bc-hatch)"
                    stroke="currentColor" strokeWidth=".8" />
              <rect x={x + 32} y={160 - hE} width="26" height={hE}
                    className="text-accent" fill="currentColor" fillOpacity=".85"
                    stroke="currentColor" strokeWidth=".8" />
              <text x={x + 29} y="176" fontSize="7.5" textAnchor="middle"
                    className="text-fg-muted" fill="currentColor"
                    fontFamily="Inter, system-ui, sans-serif">
                {d.metric}
              </text>
            </g>
          );
        })}

        <line x1="42" y1="160" x2="410" y2="160" className="text-fg"
              stroke="currentColor" strokeWidth="1" />

        <g transform="translate(42 192)">
          <rect width="10" height="8" className="text-fg-muted" fill="url(#bc-hatch)"
                stroke="currentColor" strokeWidth=".8" />
          <text x="15" y="7.5" fontSize="8" className="text-fg-muted" fill="currentColor"
                fontFamily="Inter, system-ui, sans-serif">Standard RAG</text>
          <rect x="104" width="10" height="8" className="text-accent" fill="currentColor"
                fillOpacity=".85" stroke="currentColor" strokeWidth=".8" />
          <text x="119" y="7.5" fontSize="8" className="text-fg-muted" fill="currentColor"
                fontFamily="Inter, system-ui, sans-serif">Enhanced RAG</text>
        </g>
      </svg>
      {caption && <figcaption className="mt-2 text-label text-fg-subtle">{caption}</figcaption>}
    </figure>
  );
}
