import React from 'react';

/**
 * A drafting-sheet backdrop for the sections that are otherwise only text.
 *
 * The hero carries a real campus plan. Everything below it had nothing at all:
 * screens of flat ground with a paragraph floating in the middle, which reads
 * as a page that has run out rather than one that is composed. This borrows the
 * hero's visual language -- a coordinate grid, tick marks, survey crosshairs,
 * a dimension line -- without repeating the drawing, so the page stays one
 * document instead of becoming two.
 *
 * IT IS A BACKDROP, NOT A PICTURE. Nothing here means anything; it is not a
 * diagram of the system and must never be mistaken for one. Everything sits
 * below four per cent opacity and behind the content, which is the line
 * between texture and decoration.
 *
 * Strokes are `currentColor`, so the whole sheet inherits the theme with no
 * second asset. Pure SVG, no animation, no measurement: a static element that
 * costs one paint and never touches the compositor again.
 */
export default function LandingSchematicField({ className = '' }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden text-fg ${className}`}
    >
      <svg
        className="h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <defs>
          {/* Fine grid, then a heavier one every fifth line, the way a sheet
              of drafting paper is ruled. */}
          <pattern id="sf-fine" width="36" height="36" patternUnits="userSpaceOnUse">
            <path d="M36 0H0V36" stroke="currentColor" strokeWidth="0.5" opacity="0.05" />
          </pattern>
          <pattern id="sf-coarse" width="180" height="180" patternUnits="userSpaceOnUse">
            <path d="M180 0H0V180" stroke="currentColor" strokeWidth="0.8" opacity="0.07" />
          </pattern>
          {/* The sheet fades out toward the reading column so the grid never
              competes with the text sitting on top of it. */}
          <radialGradient id="sf-vignette" cx="50%" cy="45%" r="62%">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="58%" stopColor="white" stopOpacity="0.55" />
            <stop offset="100%" stopColor="white" stopOpacity="1" />
          </radialGradient>
          <mask id="sf-mask">
            <rect width="1440" height="900" fill="url(#sf-vignette)" />
          </mask>
        </defs>

        <g mask="url(#sf-mask)">
          <rect width="1440" height="900" fill="url(#sf-fine)" />
          <rect width="1440" height="900" fill="url(#sf-coarse)" />

          <g stroke="currentColor" opacity="0.09" strokeWidth="1">
            {/* survey crosshairs */}
            {[[196, 168], [1108, 236], [332, 706], [1216, 642], [764, 118]].map(([x, y]) => (
              <g key={`${x}-${y}`}>
                <path d={`M${x - 11} ${y}H${x + 11}M${x} ${y - 11}V${y + 11}`} />
                <circle cx={x} cy={y} r="4.5" />
              </g>
            ))}

            {/* a couple of plate outlines, partitioned like a footprint */}
            <rect x="960" y="352" width="196" height="128" />
            <path d="M1058 352V480" strokeOpacity="0.6" />
            <rect x="128" y="418" width="150" height="104" />
            <path d="M128 470H278" strokeOpacity="0.6" />

            {/* one routed path, the kind a services drawing carries */}
            <path
              d="M278 470H520q28 0 28 28v96q0 28 28 28h318"
              strokeWidth="1.2"
              strokeOpacity="0.75"
            />
            <circle cx="894" cy="622" r="6" strokeWidth="1.2" />
          </g>

          {/* a dimension line with its end ticks */}
          <g stroke="currentColor" opacity="0.075" strokeWidth="1">
            <path d="M960 300H1156" />
            <path d="M960 292V308M1156 292V308" />
          </g>

          {/* edge ruling, top and bottom, as a sheet has */}
          <g stroke="currentColor" opacity="0.06" strokeWidth="1">
            {Array.from({ length: 15 }, (_, i) => 48 + i * 96).map((x) => (
              <path key={x} d={`M${x} 0V14M${x} 886V900`} />
            ))}
          </g>
        </g>
      </svg>
    </div>
  );
}
