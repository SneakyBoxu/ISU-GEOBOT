import { useCallback, useEffect, useRef, useState } from 'react';
import { useInView } from '../../custom-react-hooks/useReducedMotionPreference.js';

/**
 * The Enhanced RAG pipeline as an interactive system diagram.
 *
 * Selecting a stage highlights it, animates flow along the paths that touch
 * it, and drops everything unrelated to 35% — so the diagram answers "what
 * does this stage connect to?" visually rather than in prose.
 *
 * Two structural facts the drawing has to carry, because they are the study's
 * actual architecture and a generic flowchart would misrepresent them:
 *
 *   1. Retrieval and availability are PARALLEL, not sequential. §3.5.4 says
 *      retrieval happens "simultaneously" — the classifier is an additional
 *      branch, not a step the document path passes through.
 *   2. Only the availability branch crosses the masking boundary. The
 *      document path reaches fusion directly. Drawing both through the mask
 *      would imply the protocol filters retrieved documents, which it does
 *      not — that is a separate control.
 *
 * Keyboard: arrow keys move between stages, matching the visual order.
 */

const STAGES = [
  { id: 'query', n: '01', title: 'User query', tag: 'input', x: 50, y: 22, w: 128, h: 34,
    body: 'A natural-language question submitted through the assistant.',
    note: 'Free text. The system does not require the user to know whether they are asking about a place, a document or a person — that is the router’s job.' },
  { id: 'route', n: '02', title: 'Query routing', tag: 'deterministic', x: 50, y: 88, w: 128, h: 34,
    body: 'A gazetteer of consented faculty plus an intent lexicon decides one thing: does this need an availability status?',
    note: 'Deterministic rather than model-based. A lookup answers in ~2ms where a classification call would spend 150–300ms of the response-time budget the study must report, and would make an evaluation run non-reproducible.' },
  { id: 'retrieve', n: '03', title: 'Document retrieval', tag: 'pgvector', x: 8, y: 158, w: 128, h: 34,
    body: 'The question is embedded and matched against institutional documents and campus place-cards by cosine similarity.',
    note: 'Exact nearest-neighbour search, no approximate index. At this corpus size an ANN index would trade retrieval recall for latency the system does not need.' },
  { id: 'avail', n: '04', title: 'Availability intelligence', tag: 'Random Forest', x: 164, y: 158, w: 128, h: 34,
    body: 'Presence override first, then a classifier estimating one of three generalized statuses from schedule features.',
    note: 'Runs in parallel with retrieval, not after it. The model receives a pseudonymous identifier and never a name, and never outputs a location.' },
  { id: 'mask', n: '05', title: 'Status masking', tag: 'egress boundary', x: 164, y: 224, w: 128, h: 34,
    body: 'One value from a closed set of three may cross. Intermediates are purged; generated answers are scanned for location detail.',
    note: 'Only the availability branch passes through here. Retrieved documents reach fusion directly — they are governed by corpus curation, which is a separate control.' },
  { id: 'fuse', n: '06', title: 'Context fusion', tag: 'the contribution', x: 50, y: 292, w: 128, h: 34,
    body: 'Question, retrieved chunks and masked status merge into one structured prompt.',
    note: 'The only place the two pipelines differ. Standard and Enhanced share routing, retrieval, K, model, temperature and prompt skeleton — so any measured difference is attributable to fusion alone.' },
  { id: 'llm', n: '07', title: 'Llama 3.1 8B', tag: 'Groq · temp 0', x: 50, y: 358, w: 128, h: 34,
    body: 'Generation constrained to the provided context, at temperature zero.',
    note: 'Temperature 0 is a reproducibility requirement rather than a style preference: evaluation runs have to repeat.' },
  { id: 'response', n: '08', title: 'Response', tag: 'output', x: 50, y: 424, w: 128, h: 34,
    body: 'A grounded answer, with the status marked as an estimate and no location.',
    note: 'Passes the egress filter before it is returned. If the model speculated about a room, the response is replaced with a templated safe answer.' },
];

// [from, to, path]. Orthogonal routing — a system diagram, not a bezier spray.
const EDGES = [
  ['query', 'route', 'M114 56 L114 88'],
  ['route', 'retrieve', 'M114 122 L114 138 Q114 146 106 146 L80 146 Q72 146 72 154 L72 158'],
  ['route', 'avail', 'M114 122 L114 138 Q114 146 122 146 L220 146 Q228 146 228 154 L228 158'],
  ['avail', 'mask', 'M228 192 L228 224'],
  ['retrieve', 'fuse', 'M72 192 L72 278 Q72 286 80 286 L106 286 Q114 286 114 292'],
  ['mask', 'fuse', 'M228 258 L228 278 Q228 286 220 286 L122 286 Q114 286 114 292'],
  ['fuse', 'llm', 'M114 326 L114 358'],
  ['llm', 'response', 'M114 392 L114 424'],
];

export default function PipelineDiagram() {
  const [wrapRef, inView] = useInView({ threshold: 0.15 });
  const [active, setActive] = useState('route');
  const [drawn, setDrawn] = useState(false);
  const refs = useRef({});

  useEffect(() => { if (inView) setDrawn(true); }, [inView]);

  const stage = STAGES.find((s) => s.id === active);
  const touching = useCallback(
    (id) => EDGES.filter(([f, t]) => f === id || t === id),
    [],
  );
  const activeEdges = new Set(touching(active).map(([f, t]) => `${f}-${t}`));
  const connected = new Set(
    touching(active).flatMap(([f, t]) => [f, t]),
  );

  const onKey = (e) => {
    const i = STAGES.findIndex((s) => s.id === active);
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      setActive(STAGES[Math.min(STAGES.length - 1, i + 1)].id);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setActive(STAGES[Math.max(0, i - 1)].id);
    }
  };

  return (
    <div ref={wrapRef} className={`grid gap-10 lg:grid-cols-[minmax(0,20rem)_1fr] lg:gap-14 ${drawn ? 'is-drawn' : ''}`}>
      <div className="order-2 lg:order-1">
        <svg
          viewBox="0 0 300 470"
          className="w-full max-w-[20rem] text-fg"
          fill="none"
          role="group"
          aria-label="Enhanced RAG pipeline diagram"
          tabIndex={0}
          onKeyDown={onKey}
        >
          <defs>
            <marker id="pd-head" viewBox="0 0 8 8" refX="6.5" refY="4"
                    markerWidth="5" markerHeight="5" orient="auto">
              <path d="M1 1l5 3-5 3z" fill="currentColor" />
            </marker>
          </defs>

          {EDGES.map(([from, to, d]) => {
            const key = `${from}-${to}`;
            const on = activeEdges.has(key);
            return (
              <g key={key} className={on ? 'text-accent' : 'text-fg-subtle'}
                 style={{ opacity: on ? 1 : 0.3, transition: 'opacity var(--dur-menu) var(--ease-in)' }}>
                <path d={d} stroke="currentColor" strokeWidth={on ? 1.4 : 1}
                      markerEnd="url(#pd-head)" />
                {on && <path d={d} className="flow-path" stroke="currentColor" strokeWidth="1.4" />}
              </g>
            );
          })}

          {STAGES.map((s) => {
            const on = s.id === active;
            const linked = connected.has(s.id);
            return (
              <g
                key={s.id}
                ref={(el) => { refs.current[s.id] = el; }}
                role="button"
                tabIndex={-1}
                aria-pressed={on}
                aria-label={s.title}
                onPointerDown={() => setActive(s.id)}
                style={{
                  cursor: 'pointer',
                  opacity: on || linked ? 1 : 0.35,
                  transition: 'opacity var(--dur-menu) var(--ease-in)',
                }}
              >
                <rect
                  x={s.x} y={s.y} width={s.w} height={s.h}
                  className={on ? 'text-accent' : 'text-fg'}
                  fill={on ? 'currentColor' : 'rgb(var(--surface))'}
                  fillOpacity={on ? 0.08 : 1}
                  stroke="currentColor"
                  strokeWidth={on ? 1.5 : 1}
                  style={{ transition: 'stroke-width var(--dur-state) var(--ease-in)' }}
                />
                <text x={s.x + 9} y={s.y + 14} fontSize="7"
                      className="text-fg-subtle" fill="currentColor"
                      fontFamily="ui-monospace, monospace">
                  {s.n}
                </text>
                <text x={s.x + 9} y={s.y + 26} fontSize="9.5"
                      className={on ? 'text-accent' : 'text-fg'} fill="currentColor"
                      fontFamily="Inter, system-ui, sans-serif" fontWeight={on ? 600 : 500}>
                  {s.title}
                </text>
              </g>
            );
          })}
        </svg>

        <p className="mt-4 max-w-[20rem] text-label leading-relaxed text-fg-subtle">
          Select a stage to trace its connections. Retrieval and availability run
          in parallel; only the availability branch crosses the masking boundary.
        </p>
      </div>

      <div className="order-1 lg:order-2 lg:sticky lg:top-28 lg:self-start">
        <p className="font-mono text-data text-fg-subtle">
          Stage {stage.n} &middot; {stage.tag}
        </p>
        <h3 className="mt-3 font-serif text-h2 text-fg">{stage.title}</h3>
        <p className="mt-5 max-w-measure text-body-lg leading-relaxed text-fg">{stage.body}</p>
        <div className="mt-7 border-l-2 border-accent pl-5">
          <p className="eyebrow">Design note</p>
          <p className="mt-2 max-w-measure text-meta leading-relaxed text-fg-muted">{stage.note}</p>
        </div>
      </div>
    </div>
  );
}
