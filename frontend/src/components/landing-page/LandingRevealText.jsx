import { useReveal } from '../../custom-react-hooks/useReducedMotionPreference.js';

/**
 * Display headings that arrive a line at a time.
 *
 * The signature move of an expensive page, and the reason it works is that it
 * respects how the sentence is read: line one lands, line two answers it. A
 * whole heading fading in as one block says nothing about its own structure.
 *
 * Lines are passed as an ARRAY rather than measured from the rendered text.
 * Measuring wrapped lines means reading layout, splitting nodes and re-reading
 * on every resize — fragile, and it fights the browser for no gain when the
 * headings on this page are two or three deliberate lines that the design
 * already controls.
 *
 * Each line gets a clipping mask, so the text rises out of an edge rather than
 * drifting up through empty space. That edge is what makes it read as
 * typography rather than as a generic fade.
 */
export default function LandingRevealText({
  lines,
  as: Tag = 'h2',
  className = '',
  lineClassName = '',
  accentFrom = 1,
  delay = 0,
}) {
  const [ref, shown] = useReveal({ threshold: 0.25 });

  return (
    <Tag ref={ref} className={className}>
      {lines.map((line, i) => (
        // overflow-hidden on the outer span is the mask; the inner span is what
        // moves. Animating the text itself without a mask lets it appear before
        // it is in place, which is the whole effect lost.
        <span key={line} className="block overflow-hidden pb-[0.08em]">
          <span
            className={`block ${i >= accentFrom ? 'italic text-gradient-accent' : ''} ${lineClassName}`}
            style={{
              transitionProperty: 'transform, opacity',
              transitionDuration: '900ms, 700ms',
              transitionTimingFunction: 'cubic-bezier(.16,1,.3,1), ease-out',
              transitionDelay: `${delay + i * 110}ms`,
              transform: shown ? 'translateY(0)' : 'translateY(108%)',
              opacity: shown ? 1 : 0,
            }}
          >
            {line}
          </span>
        </span>
      ))}
    </Tag>
  );
}
