import { useEffect, useMemo, useRef, useState } from 'react';
import { useInView, usePointerWithin } from '../../hooks/useMotion.js';

/**
 * The hero visualization: a working campus plan.
 *
 * Every element is something a real site drawing carries — footprints with
 * internal partitions, a path network, a coordinate grid with tick labels,
 * survey markers, a scale bar, a north arrow. It is a map, not a graphic
 * about maps, and specifically not a neural-network diagram.
 *
 * MOTION, and what each piece communicates:
 *   route draw      the journey the assistant answers questions about
 *   marker pulse    the currently selected location
 *   label reveal    place names resolving, after the geometry settles
 *   parallax        depth between the grid, the buildings and the markers —
 *                   capped at 6px translate. No rotation. No tilt.
 *   proximity       markers acknowledge a nearby cursor, which is the cue
 *                   that says "this is interactive" without a tooltip
 *
 * All strokes are `currentColor` at token opacities, so Monochrome inherits
 * the whole drawing with no second asset and no colour logic.
 */

const BUILDINGS = [
  { id: 'ccs', x: 64, y: 96, w: 104, h: 66, label: 'Computing Studies', splits: [[52, 'v'], [33, 'h']] },
  { id: 'eng', x: 196, y: 74, w: 78, h: 52, label: 'Engineering', splits: [[39, 'v']] },
  { id: 'lib', x: 300, y: 118, w: 66, h: 80, label: 'Library', splits: [[40, 'h']] },
  { id: 'cas', x: 88, y: 208, w: 84, h: 58, label: 'Arts & Sciences', splits: [[42, 'v']] },
  { id: 'reg', x: 214, y: 186, w: 56, h: 44, label: 'Registrar' },
  { id: 'gym', x: 256, y: 250, w: 96, h: 50, label: 'Gymnasium' },
];

const MARKERS = [
  { id: 'a', x: 116, y: 162, label: 'A' },
  { id: 'b', x: 242, y: 208, label: 'B' },
  { id: 'c', x: 333, y: 158, label: 'C' },
];

const ROUTE =
  'M116 162 L116 184 Q116 194 128 194 L200 194 Q212 194 212 182 L212 148 Q212 138 224 138 L333 138 L333 158';

const PATHS = [
  'M40 178 L380 178',
  'M186 40 L186 310',
  'M40 240 Q140 240 186 240',
  'M282 40 L282 118',
];

export default function CampusPlan({ className = '' }) {
  const [wrapRef, inView] = useInView({ threshold: 0.25 });
  const [drawn, setDrawn] = useState(false);
  const [near, setNear] = useState(null);
  const [active, setActive] = useState('c');
  const routeRef = useRef(null);
  const [routeLen, setRouteLen] = useState(900);

  // Measure the real path length so the dash animation is exact rather than
  // a guessed constant that over- or under-shoots on different renders.
  useEffect(() => {
    if (routeRef.current) setRouteLen(Math.ceil(routeRef.current.getTotalLength()));
  }, []);

  useEffect(() => { if (inView) setDrawn(true); }, [inView]);

  // Proximity: markers acknowledge a nearby cursor. Distance is computed in
  // the SVG's own coordinate space so it behaves identically at any size.
  const [pointerRef] = usePointerWithin({
    onMove: ({ rawX, rawY, inside }) => {
      if (!inside) { setNear(null); return; }
      const el = pointerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const sx = (rawX / r.width) * 420;
      const sy = (rawY / r.height) * 340;
      let closest = null;
      let best = 46;
      for (const m of MARKERS) {
        const d = Math.hypot(m.x - sx, m.y - sy);
        if (d < best) { best = d; closest = m.id; }
      }
      setNear(closest);
    },
  });

  const setRefs = useMemo(() => (node) => {
    wrapRef.current = node;
    pointerRef.current = node;
  }, [wrapRef, pointerRef]);

  return (
    <div
      ref={setRefs}
      className={`relative ${drawn ? 'is-drawn' : ''} ${className}`}
      style={{ '--len': routeLen }}
    >
      <svg
        viewBox="0 0 420 340"
        className="w-full text-fg"
        fill="none"
        role="img"
        aria-label="Campus plan showing building footprints, pathways, a walking route and three survey markers."
      >
        <defs>
          <pattern id="hp-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0H0v20" fill="none" stroke="currentColor" strokeWidth=".5" opacity=".2" />
          </pattern>
          <marker id="hp-arrow" viewBox="0 0 8 8" refX="6" refY="4"
                  markerWidth="5" markerHeight="5" orient="auto">
            <path d="M1 1l5 3-5 3z" fill="currentColor" />
          </marker>
        </defs>

        {/* plane 1 — coordinate grid, furthest back, least parallax */}
        <g style={{ transform: 'translate(calc(var(--px, 0) * 2px), calc(var(--py, 0) * 2px))' }}>
          <rect x="0" y="0" width="420" height="340" fill="url(#hp-grid)" className="text-fg-subtle" />
          <g className="text-fg-subtle" opacity=".45">
            <path d="M40 30v280M380 30v280M30 40h360M30 300h360"
                  stroke="currentColor" strokeWidth=".75" />
            {[80, 140, 200, 260].map((y) => (
              <path key={y} d={`M36 ${y}h8M376 ${y}h8`} stroke="currentColor" strokeWidth=".75" />
            ))}
            {[100, 180, 260, 340].map((x) => (
              <path key={x} d={`M${x} 36v8M${x} 296v8`} stroke="currentColor" strokeWidth=".75" />
            ))}
          </g>
        </g>

        {/* plane 2 — path network */}
        <g
          className="text-fg-subtle"
          style={{ transform: 'translate(calc(var(--px, 0) * 3px), calc(var(--py, 0) * 3px))' }}
        >
          {PATHS.map((d) => (
            <path key={d} d={d} stroke="currentColor" strokeWidth="5" opacity=".13" strokeLinecap="round" />
          ))}
          {PATHS.map((d) => (
            <path key={`c${d}`} d={d} stroke="currentColor" strokeWidth=".5"
                  opacity=".4" strokeDasharray="2 6" />
          ))}
        </g>

        {/* plane 3 — building footprints */}
        <g style={{ transform: 'translate(calc(var(--px, 0) * 4px), calc(var(--py, 0) * 4px))' }}>
          {BUILDINGS.map((b) => (
            <g key={b.id}>
              <rect
                x={b.x} y={b.y} width={b.w} height={b.h}
                stroke="currentColor" strokeWidth="1.1"
                fill="currentColor" fillOpacity=".05"
              />
              {(b.splits ?? []).map(([o, dir], i) => (
                <path
                  key={i}
                  d={dir === 'v'
                    ? `M${b.x + o} ${b.y}v${b.h}`
                    : `M${b.x} ${b.y + o}h${b.w}`}
                  stroke="currentColor" strokeWidth=".5" opacity=".4"
                />
              ))}
            </g>
          ))}
        </g>

        {/* plane 4 — the route */}
        <g style={{ transform: 'translate(calc(var(--px, 0) * 5px), calc(var(--py, 0) * 5px))' }}>
          <path
            ref={routeRef}
            d={ROUTE}
            className="draw-path text-accent"
            stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round"
            markerEnd="url(#hp-arrow)"
          />
        </g>

        {/* plane 5 — markers and labels, nearest, most parallax */}
        <g style={{ transform: 'translate(calc(var(--px, 0) * 6px), calc(var(--py, 0) * 6px))' }}>
          {MARKERS.map((m) => {
            const isActive = active === m.id;
            const isNear = near === m.id;
            return (
              <g
                key={m.id}
                className={`text-accent ${isActive ? 'is-active' : ''}`}
                style={{ cursor: 'pointer' }}
                onPointerDown={() => setActive(m.id)}
              >
                <circle className="pulse-ring" cx={m.x} cy={m.y} r="7"
                        fill="none" stroke="currentColor" strokeWidth="1" />
                <circle className="pulse-ring" cx={m.x} cy={m.y} r="7"
                        fill="none" stroke="currentColor" strokeWidth="1" />
                <circle
                  cx={m.x} cy={m.y} r={isNear || isActive ? 8.5 : 7}
                  fill="currentColor" fillOpacity={isActive ? '.16' : '.08'}
                  style={{ transition: 'r var(--dur-state) var(--ease-in)' }}
                />
                <circle cx={m.x} cy={m.y} r={isActive ? 3.6 : 3} fill="currentColor"
                        style={{ transition: 'r var(--dur-state) var(--ease-in)' }} />
                <circle
                  cx={m.x} cy={m.y} r="7" fill="none" stroke="currentColor"
                  strokeWidth={isNear || isActive ? '1.4' : '.9'}
                  opacity={isNear || isActive ? '1' : '.55'}
                  style={{ transition: 'stroke-width var(--dur-state), opacity var(--dur-state)' }}
                />
                <text
                  x={m.x + 12} y={m.y + 3.5} fontSize="9.5" fill="currentColor"
                  fontFamily="ui-monospace, monospace" fontWeight="600"
                >
                  {m.label}
                </text>
              </g>
            );
          })}
        </g>

        {/* labels — resolve after the geometry has settled */}
        <g className="text-fg-subtle">
          {BUILDINGS.map((b, i) => (
            <text
              key={b.id}
              className="label-reveal"
              style={{ animationDelay: `${900 + i * 90}ms` }}
              x={b.x + 4} y={b.y - 5}
              fontSize="7.5" fill="currentColor"
              fontFamily="Inter, system-ui, sans-serif"
              letterSpacing=".04em"
            >
              {b.label.toUpperCase()}
            </text>
          ))}
        </g>

        {/* survey furniture — a drawing that claims to be a plan shows these */}
        <g className="text-fg-subtle" opacity=".75">
          <path d="M40 318h56M40 314v8M68 316v6M96 314v8" stroke="currentColor" strokeWidth=".9" />
          <text x="40" y="334" fontSize="7" fill="currentColor" fontFamily="ui-monospace, monospace">0</text>
          <text x="84" y="334" fontSize="7" fill="currentColor" fontFamily="ui-monospace, monospace">100 m</text>

          <g transform="translate(376 36)">
            <path d="M0 12V0M0 0l-3.2 4.4M0 0l3.2 4.4" stroke="currentColor" strokeWidth=".9" />
            <text x="-2.6" y="21" fontSize="7" fill="currentColor" fontFamily="ui-monospace, monospace">N</text>
          </g>

          <text x="300" y="334" fontSize="7" fill="currentColor"
                fontFamily="ui-monospace, monospace" letterSpacing=".06em">
            SCHEMATIC
          </text>
        </g>
      </svg>
    </div>
  );
}
