import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight } from 'lucide-react';
import Button from '../ui/Button.jsx';
import CampusPlan from './CampusPlan.jsx';

/**
 * WORDING RULES (audit §10.3) — these outrank the visual design.
 *
 * The thesis is a PROPOSAL. Chapters 4 and 5 do not exist, no model has been
 * trained, no comparison has been run. So nothing here claims a result:
 *
 *   NOT "94% accurate"               -> no numbers at all until measured
 *   NOT "outperforms standard RAG"   -> that is the study's hypothesis
 *   NOT "validated by 15 faculty"    -> validation has not happened
 *   NOT "real-time faculty tracking" -> "tracking" is the word the thesis avoids
 *
 * Capability claims are present tense; outcome claims are future tense.
 */
export default function Hero() {
  // The hero fills the first screen rather than sitting as a band inside it:
  // 100dvh minus the sticky bar, floored at 36rem so a short laptop window does
  // not crush the type. `dvh` and not `vh` because on a phone `vh` measures the
  // window as if the browser's own chrome were not there, and the last line of
  // the paragraph ends up underneath it.
  return (
    <section className="relative flex min-h-[36rem] items-center border-b border-line lg:min-h-[calc(100dvh-3.75rem)]">
      <div className="container-x">
        <div className="grid w-full items-center gap-12 py-16 sm:py-20 lg:grid-cols-[7fr_5fr] lg:gap-16 lg:py-24">
          <div>
            <p className="eyebrow">Isabela State University &middot; Echague Main Campus</p>

            <h1 className="mt-5 font-serif text-[2.375rem] leading-[1.06] tracking-[-0.02em] text-fg sm:text-[3rem] lg:text-display">
              Find your way around campus, and know before you go.
            </h1>

            <p className="lede mt-6">
              ISU-GeoBot answers questions about buildings, offices and
              university documents from one place &mdash; and gives a
              generalized estimate of whether a faculty member is free, without
              ever disclosing where they are.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button as={Link} to="/app" variant="primary" size="lg" iconRight={ArrowRight}>
                Launch Assistant
              </Button>
              <Button as={Link} to="/app" variant="secondary" size="lg">
                Explore the campus map
              </Button>
            </div>

            {/* Audit R6-R12: where a "94% accurate" badge would normally sit. */}
            <p className="mt-10 max-w-measure border-t border-line pt-5 text-meta leading-relaxed text-fg-subtle">
              Undergraduate thesis research. The Enhanced RAG architecture will
              be evaluated against a standard RAG baseline using the RAGAS
              framework, and its availability estimates will be validated by
              selected faculty members. No results have been published yet.
            </p>
          </div>

          <div className="relative hidden lg:block">
            <CampusPlan className="w-full" />
          </div>
        </div>

        <a
          href="#problem"
          className="mb-8 inline-flex items-center gap-2 text-meta text-fg-subtle transition-colors duration-state hover:text-fg"
        >
          <ArrowDown className="h-3.5 w-3.5" aria-hidden />
          Why this exists
        </a>
      </div>
    </section>
  );
}
