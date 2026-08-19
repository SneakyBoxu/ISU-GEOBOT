import { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { api } from '../../lib/api.js';
import SectionHeader from '../patterns/SectionHeader.jsx';
import { Alert, Button, Skeleton, StatusIndicator } from '../ui/index.js';

/**
 * Standard vs Enhanced, run live.
 *
 * WHY ONLY CURATED QUERIES (audit F-16 + F-29). The natural implementation is
 * a free-text box with an arm toggle. That would put `mode` under client
 * control on a public endpoint — making evaluation runs indistinguishable from
 * live traffic — and reopen the aggregation surface, where an unrestricted
 * availability box can be polled to reconstruct someone's presence timeline.
 * A fixed list keeps the demonstration and closes both.
 *
 * Presented as two ruled columns rather than two tinted cards: the claim is
 * that these differ in exactly one variable, and identical treatment with a
 * single marked difference states that better than colour would.
 */
export default function Comparison() {
  const [queries, setQueries] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.demoQueries()
      .then((d) => { setQueries(d.queries ?? []); setActiveId(d.queries?.[0]?.id ?? null); })
      .catch(() => setError('unreachable'));
  }, []);

  async function run() {
    if (!activeId) return;
    setLoading(true); setError(null); setResult(null);
    try { setResult(await api.demoCompare(activeId)); }
    catch { setError('failed'); }
    finally { setLoading(false); }
  }

  return (
    <section id="comparison" className="border-b border-line bg-bg-sunken py-20 sm:py-28">
      <div className="container-x">
        <SectionHeader eyebrow="Live comparison" title="What context fusion actually adds">
          Both pipelines use the same retriever, the same top-K, the same model
          and the same prompt. The only difference is whether the masked
          availability status is fused into the context.
        </SectionHeader>

        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-line py-4">
          <span className="eyebrow">Question</span>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {queries.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => { setActiveId(q.id); setResult(null); }}
                aria-pressed={activeId === q.id}
                className={`text-meta underline-offset-[6px] transition-colors duration-state ${
                  activeId === q.id
                    ? 'text-fg underline decoration-accent decoration-2'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                {q.label}
              </button>
            ))}
            {!queries.length && !error && <Skeleton className="h-4 w-64" />}
          </div>
          <Button
            variant="primary" size="sm" icon={Play}
            onClick={run} disabled={!activeId || loading} loading={loading}
            className="ml-auto"
          >
            {loading ? 'Running both pipelines' : 'Run comparison'}
          </Button>
        </div>

        {error && (
          <Alert tone="warning" title="The live comparison is not reachable" className="mt-8">
            It runs against the deployed pipeline, so it needs the API, the ML
            service and a configured language-model endpoint to be running.
          </Alert>
        )}

        {loading && (
          <div className="mt-10 grid gap-px border-t border-line md:grid-cols-2">
            {['Standard RAG', 'Enhanced RAG'].map((t, i) => (
              <div key={t} className={`pt-6 ${i === 1 ? 'md:border-l md:border-line md:pl-10' : 'md:pr-10'}`}>
                <p className="text-meta font-semibold text-fg">{t}</p>
                <div className="mt-4 space-y-2" aria-hidden>
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-3/5" />
                </div>
              </div>
            ))}
            <p className="sr-only" role="status">Running both pipelines. This usually takes a few seconds.</p>
          </div>
        )}

        {result && (
          <div className="mt-10 animate-enter">
            <p className="max-w-measure font-serif text-h3 leading-snug text-fg">
              &ldquo;{result.query}&rdquo;
            </p>

            <div className="mt-8 grid border-t border-line md:grid-cols-2">
              <Arm title="Standard RAG" subtitle="retrieval + language model" data={result.standard} />
              <Arm
                title="Enhanced RAG" subtitle="retrieval + classifier + language model"
                data={result.enhanced} marked
              />
            </div>

            <dl className="mt-8 grid gap-x-10 gap-y-4 border-t border-line pt-6 sm:grid-cols-3">
              {[
                ['Document chunks retrieved', result.fusion.retrievedChunks, 'identical in both arms'],
                ['Masked status injected', result.fusion.statusInjected ? 'Yes' : 'No', result.fusion.statusLabel ?? 'not an availability question'],
                ['Total context items', result.fusion.contextItems, 'what RAGAS scores'],
              ].map(([k, v, note]) => (
                <div key={k}>
                  <dt className="text-label text-fg-subtle">{k}</dt>
                  <dd className="mt-1 font-serif text-h3 text-fg" data-numeric>{v}</dd>
                  <p className="mt-0.5 text-label text-fg-subtle">{note}</p>
                </div>
              ))}
            </dl>

            <p className="mt-6 max-w-measure text-label leading-relaxed text-fg-subtle">
              {result.timingNote} Response time is reported from interleaved
              evaluation runs as a median and 95th percentile, never from a
              single demonstration request.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function Arm({ title, subtitle, data, marked }) {
  return (
    <div className={`pt-6 ${marked ? 'md:border-l md:border-line md:pl-10' : 'md:pr-10'}`}>
      <div className="flex items-baseline gap-3">
        <h3 className="text-meta font-semibold text-fg">{title}</h3>
        {marked && (
          <span className="border-b-2 border-accent text-label text-fg-muted">this study</span>
        )}
      </div>
      <p className="mt-0.5 font-mono text-data text-fg-subtle">{subtitle}</p>

      {data.status && (
        <div className="mt-5">
          <StatusIndicator code={data.status.code} label={data.status.label} asOf={data.status.asOf} />
        </div>
      )}

      <p className="mt-5 max-w-measure text-body leading-relaxed text-fg">{data.answer}</p>

      {data.sources?.length > 0 && (
        <div className="mt-5 border-t border-line pt-3">
          <p className="eyebrow">Grounded in</p>
          <ul className="mt-2 space-y-1">
            {data.sources.map((s, i) => (
              <li key={i} className="text-label text-fg-muted">{s.title}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="pb-8" />
    </div>
  );
}
