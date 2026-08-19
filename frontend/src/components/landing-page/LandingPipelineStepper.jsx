import { useEffect, useRef, useState } from 'react';
import { Braces, Compass, Radar, ShieldCheck, Sparkles } from 'lucide-react';

/**
 * The Enhanced RAG pipeline, as a scroll-driven accordion.
 *
 * COMPOSED AROUND THE DOCKED FIELD. While this section is on screen the
 * particle field has contracted into a panel on the right, so the content lives
 * in the left half — the two are sharing one screen deliberately rather than
 * the text sitting on top of a background. That is why this is not the usual
 * rail-plus-card: the card would be competing with the panel for the same half
 * of the page.
 *
 * An accordion rather than five equal cards because the pipeline IS sequential,
 * and the thesis's contribution is one specific stage in it — stage four, where
 * a masked availability estimate joins the retrieved context. Five equal boxes
 * flatten exactly the distinction the study is about. Here the active stage
 * takes the space and the others collapse to a line, so the shape of the
 * section says "one of these is the point".
 *
 * THE NUMBERS ARE ARCHITECTURE, NOT RESULTS. 384 dimensions, a 220-token chunk
 * ceiling, exact cosine — true of the system today and checkable in the code.
 * No accuracy, no score, no comparison. See §10.3.
 */

const STEPS = [
  {
    icon: Compass,
    title: 'Route the question',
    meta: 'Deterministic gazetteer',
    body:
      'A question is classified before anything is embedded: a place, a document, or a person. Name matching runs against a consented roster, and an ambiguous name is answered with a question rather than a guess.',
    detail: ['navigation', 'document', 'availability'],
  },
  {
    icon: Braces,
    title: 'Embed the query',
    meta: 'all-MiniLM-L6-v2',
    body:
      'The question becomes a vector using the same model and the same code path that embedded the corpus. Query and document vectors from different embedders diverge silently, and retrieval degrades with no error anywhere.',
    detail: ['384 dimensions', '220-token chunks'],
  },
  {
    icon: Radar,
    title: 'Retrieve by meaning',
    meta: 'Exact cosine over pgvector',
    body:
      'The closest passages are found by meaning rather than keyword, across campus place-cards and institutional documents. An exact scan, deliberately unindexed at this corpus size — an approximate index would trade recall for speed nobody needs here.',
    detail: ['top-K', 'similarity floor'],
  },
  {
    icon: ShieldCheck,
    title: 'Estimate and mask',
    meta: 'The contribution',
    body:
      'Guard presence resolves to one of three states — on campus, off campus, unknown. Only then does the Random Forest run, and its output crosses a masking boundary that admits a generalized status and nothing else. No room, no floor, no building.',
    detail: ['confirmed', 'unknown → classify', 'masked'],
    accent: true,
  },
  {
    icon: Sparkles,
    title: 'Fuse and answer',
    meta: 'Llama 3.1 8B · temperature 0',
    body:
      'Retrieved context and the masked status are fused into one prompt. The answer is scanned on the way out: if the model has speculated about a location, the response is replaced rather than returned.',
    detail: ['context fusion', 'egress filter'],
  },
];

export default function LandingPipelineStepper() {
  const hostRef = useRef(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let ticking = false;
    function measure() {
      ticking = false;
      const rect = host.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      if (travel <= 0) return;
      const p = Math.min(Math.max(-rect.top / travel, 0), 0.999);
      setActive(Math.floor(p * STEPS.length));
    }
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    // Tall on purpose: the height is the scrub track for the five stages.
    <section
      id="how-it-works"
      ref={hostRef}
      className="relative"
      style={{ height: `${STEPS.length * 74}vh` }}
    >
      <div className="sticky top-0 flex min-h-screen items-center">
        <div className="container-x w-full py-16">
          {/* Constrained to the left half from `lg` up, which is where the
              docked field leaves room. */}
          <div className="lg:max-w-[46%]">
            <div className="flex items-baseline gap-4">
              <p className="eyebrow">Enhanced RAG</p>
              <span aria-hidden className="h-px flex-1 bg-line" />
              <span className="font-mono text-data text-fg-subtle" data-numeric>
                {String(active + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}
              </span>
            </div>

            <h2 className="mt-5 font-serif text-[2.1rem] leading-[1.06] tracking-[-0.02em] text-fg sm:text-[2.7rem]">
              How a question
              <span className="block italic text-gradient-accent">becomes an answer</span>
            </h2>

            <ol className="mt-12">
              {STEPS.map((s, i) => {
                const on = i === active;
                const done = i < active;
                const StepIcon = s.icon;
                return (
                  <li key={s.title} className="border-t border-line last:border-b">
                    <div className="flex items-start gap-4 py-4">
                      <span
                        className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-all duration-menu ${
                          on
                            ? 'border-accent bg-accent text-accent-contrast'
                            : done
                              ? 'border-line-strong bg-transparent text-fg-muted'
                              : 'border-line bg-transparent text-fg-subtle'
                        }`}
                        aria-hidden
                      >
                        <StepIcon className="h-4 w-4" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                          <h3 className={`text-body font-semibold transition-colors duration-menu ${
                            on ? 'text-fg' : 'text-fg-muted'
                          }`}
                          >
                            {s.title}
                          </h3>
                          <span className="font-mono text-data text-fg-subtle">{s.meta}</span>
                        </div>

                        {/* grid-template-rows 0fr -> 1fr is the one way to
                            animate to content height without measuring it in
                            JavaScript and without a magic max-height that
                            clips long copy on a narrow screen. */}
                        <div
                          className="grid transition-all duration-500 ease-in"
                          style={{
                            gridTemplateRows: on ? '1fr' : '0fr',
                            opacity: on ? 1 : 0,
                          }}
                        >
                          <div className="overflow-hidden">
                            <p className="pt-3 text-meta leading-relaxed text-fg-muted">
                              {s.body}
                            </p>
                            <ul className="mt-4 flex flex-wrap gap-2 pb-1">
                              {s.detail.map((d) => (
                                <li
                                  key={d}
                                  className={`rounded-pill px-2.5 py-1 font-mono text-data ${
                                    s.accent
                                      ? 'bg-accent-subtle text-accent'
                                      : 'border border-line text-fg-subtle'
                                  }`}
                                >
                                  {d}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
