import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import SectionHeader from '../patterns/SectionHeader.jsx';
import Roadmap from './Roadmap.jsx';
import BarComparison from '../charts/BarComparison.jsx';

/**
 * THE RULE FOR THIS SECTION (audit §10.3, R6-R12).
 *
 * No numeric performance figure appears here — not as a placeholder, not in a
 * mockup, not as filler. Placeholder numbers survive into screenshots, and a
 * screenshot of a fabricated RAGAS score is indistinguishable from a
 * fabricated research result.
 *
 * With no evaluation run, this renders an empty state that explains what will
 * fill it. Objectives are in the thesis's own future tense, because none of
 * them has been achieved.
 */
const OBJECTIVES = [
  'Integrate a Random Forest classifier into the retrieval-augmented generation pipeline to estimate real-time faculty availability from temporal schedule data.',
  'Evaluate and compare the standard and Enhanced RAG architectures in terms of response time and the four RAGAS metrics: context precision, context recall, faithfulness and answer relevancy.',
  'Deploy the Enhanced RAG architecture within the web-based ISU-GeoBot system to provide context-aware navigation and privacy-compliant availability information.',
  'Evaluate the functional accuracy and reliability of the system\u2019s availability estimates through ground-truth validation by selected faculty members.',
];

const META = [
  ['Researchers', 'Michael Allan Almario · Christian Paul Simbulan'],
  ['Degree', 'BSCS — Data Mining Track'],
  ['College', 'Computing Studies, Information and Communication Technology'],
  ['Institution', 'Isabela State University — Echague Main Campus'],
  ['Research design', 'Developmental Research Design'],
  ['Evaluation', 'RAGAS comparison · faculty ground-truth validation'],
];

export default function Research() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    api.evalStatus().then(setStatus).catch(() => setStatus({ hasResults: false }));
  }, []);

  return (
    <section id="research" className="border-b border-line bg-bg-sunken py-20 sm:py-28">
      <div className="container-x">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
          <div>
            <SectionHeader
              eyebrow="The study"
              title="An Enhanced RAG architecture for faculty availability classification"
            >
              Standard retrieval-augmented generation grounds a language model
              in static documents. It has no way to answer a question whose
              answer changes by the hour. This study embeds a probabilistic
              classifier directly into the retrieval pipeline so a real-time,
              privacy-masked signal becomes part of the context the model
              reasons over.
            </SectionHeader>

            <dl className="mt-10 border-t border-line">
              {META.map(([k, v]) => (
                <div key={k} className="grid gap-1 border-b border-line py-3 sm:grid-cols-[10rem_1fr] sm:gap-6">
                  <dt className="text-label text-fg-subtle">{k}</dt>
                  <dd className="text-meta text-fg">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <p className="eyebrow">Objectives</p>
            <ol className="mt-4 border-t border-line">
              {OBJECTIVES.map((o, i) => (
                <li key={i} className="flex gap-5 border-b border-line py-4">
                  <span className="font-mono text-data text-fg-subtle" data-numeric>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="max-w-measure text-meta leading-relaxed text-fg-muted">{o}</p>
                </li>
              ))}
            </ol>

            <div className="mt-12">
              <Roadmap />
            </div>

            <div className="mt-10">
              <p className="eyebrow">Comparative results</p>
              <div className="mt-4">
                {/* No data prop: the chart renders its pending state. Real
                    scores drop in here without a redesign. */}
                <BarComparison />
              </div>
              {status?.hasResults && (
                <p className="mt-3 text-label text-fg-subtle" data-numeric>
                  {status.scoredResults} scored result
                  {status.scoredResults === 1 ? '' : 's'} recorded across{' '}
                  {status.runs?.length ?? 0} run{status.runs?.length === 1 ? '' : 's'}.
                  Figures are reported in the thesis document.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
