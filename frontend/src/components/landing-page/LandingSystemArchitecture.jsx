import { useInView } from '../../custom-react-hooks/useReducedMotionPreference.js';

/**
 * Environmental background.
 *
 * Three layers, all SVG, all `currentColor`: a fine coordinate grid, a set of
 * topographic contours that drift very slowly, and paper grain. Together they
 * give the page a ground to sit on rather than a flat fill — the difference
 * between "white background" and "paper".
 *
 * Deliberately NOT: particles, stars, blobs, gradients or anything that moves
 * fast enough to notice. The contours drift 40px over 90 seconds. If you can
 * see it moving, it is wrong.
 *
 * Fixed and pointer-events-none, one instance per page, paused when scrolled
 * out of view.
 */
export default function Environment() {
  const [ref, inView] = useInView({ threshold: 0 });

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg"
    >
      {/* coordinate grid */}
      <svg className="absolute inset-0 h-full w-full text-fg-subtle" aria-hidden>
        <defs>
          <pattern id="env-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M32 0H0v32" fill="none" stroke="currentColor" strokeWidth=".5" opacity=".13" />
          </pattern>
          <pattern id="env-grid-lg" width="160" height="160" patternUnits="userSpaceOnUse">
            <path d="M160 0H0v160" fill="none" stroke="currentColor" strokeWidth=".5" opacity=".2" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#env-grid)" />
        <rect width="100%" height="100%" fill="url(#env-grid-lg)" />
      </svg>

      {/* topographic contours */}
      <svg
        className={`absolute left-1/2 top-0 h-[140%] w-[140%] -translate-x-1/2 text-fg-subtle ${
          inView ? 'contour-drift' : ''
        }`}
        viewBox="0 0 1200 900"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        {[
          'M-60 210 Q220 130 470 200 T980 170 T1300 240',
          'M-60 262 Q230 186 480 254 T990 224 T1300 292',
          'M-60 318 Q240 244 494 310 T1000 282 T1300 346',
          'M-60 606 Q210 528 460 598 T970 566 T1300 636',
          'M-60 664 Q220 588 470 656 T980 626 T1300 692',
        ].map((d, i) => (
          <path
            key={d}
            d={d}
            stroke="currentColor"
            strokeWidth=".85"
            opacity={i % 2 ? 0.09 : 0.13}
          />
        ))}
      </svg>

      {/* paper grain — one turbulence pass, no animation */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.028]" aria-hidden>
        <filter id="env-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#env-grain)" />
      </svg>
    </div>
  );
}
