import React, { useEffect, useState } from 'react';

/**
 * A fixed index of the page, down the left edge.
 *
 * Two jobs. It tells you where you are in a long scrolling document, which a
 * page built out of full-height stages badly needs — without it a visitor three
 * screens down has no idea how much is left. And it is a control: the labels
 * are links, so the rail doubles as the navigation the top bar deliberately
 * does not carry on this route.
 *
 * Driven by scroll position against each section's box rather than by
 * IntersectionObserver. Observers fire on threshold crossings, which for
 * sections taller than the viewport means the "active" one flips at the wrong
 * moments — a 400vh stepper never crosses a 50% threshold at all. Measuring
 * which section owns the middle of the screen is the question actually being
 * asked.
 *
 * Hidden below `xl`: at narrower widths it would either overlap the content or
 * squeeze it, and a progress indicator is not worth either.
 */
const SECTIONS = [
  ['top', 'Start'],
  ['problem', 'The problem'],
  ['how-it-works', 'How it works'],
  ['privacy', 'Privacy'],
  ['campus', 'Campus'],
  ['demo', 'Demo'],
  ['research', 'The study'],
];

export default function LandingScrollRail() {
  const [active, setActive] = useState('top');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let ticking = false;

    function measure() {
      ticking = false;
      const mid = window.innerHeight * 0.42;
      let current = 'top';
      for (const [id] of SECTIONS) {
        if (id === 'top') continue;
        const el = document.getElementById(id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        // The section that owns the reading line, not the one merely visible.
        if (r.top <= mid && r.bottom > mid) { current = id; break; }
        if (r.top <= mid) current = id;
      }
      setActive(current);

      const doc = document.documentElement;
      const total = doc.scrollHeight - window.innerHeight;
      setProgress(total > 0 ? Math.min(window.scrollY / total, 1) : 0);
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
    <>
      {/* Page progress, hairline, top edge. */}
      <div className="fixed inset-x-0 top-0 z-[1200] h-px bg-transparent" aria-hidden>
        <div
          className="h-full origin-left bg-accent"
          style={{ transform: `scaleX(${progress})`, transition: 'transform 120ms linear' }}
        />
      </div>

      <nav
        aria-label="Page sections"
        className="fixed left-6 top-1/2 z-[900] hidden -translate-y-1/2 xl:block"
      >
        <ul className="space-y-3.5">
          {SECTIONS.map(([id, label]) => {
            const on = active === id;
            return (
              <li key={id}>
                <a
                  href={id === 'top' ? '#main' : `#${id}`}
                  aria-current={on ? 'true' : undefined}
                  className="group flex items-center gap-3"
                >
                  {/* The dash grows into a rule when active — a size change
                      rather than only a colour change, so the state survives
                      greyscale and does not depend on hue. */}
                  <span
                    aria-hidden
                    className={`h-px transition-all duration-menu ${
                      on ? 'w-8 bg-accent' : 'w-3.5 bg-line-strong group-hover:w-6 group-hover:bg-fg-muted'
                    }`}
                  />
                  <span
                    className={`whitespace-nowrap text-label transition-all duration-menu ${
                      on
                        ? 'text-fg opacity-100'
                        : 'text-fg-subtle opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {label}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
