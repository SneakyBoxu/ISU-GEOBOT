import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { api } from '../../frontend-utilities/backendApiClient.js';
import LandingCampusFloorPlan from './LandingCampusFloorPlan.jsx';

// three.js is ~134KB gzipped and wanted by exactly one element on one route.
// Lazy, so the workspace and the four portals never download any of it.
const LandingMorphField = lazy(() => import('./LandingMorphField.jsx'));

/**
 * The stage the first half of the page is composed against.
 *
 * It owns two numbers, both derived from one scroll position:
 *
 *   morph  0 campus · 1 constellation · 2 veil — which shape the field holds
 *   dock   0 full-bleed · 1 framed into a panel — how much of the screen it takes
 *
 * THE DOCK IS THE LAYOUT IDEA. The field opens full-bleed under the hero,
 * contracts into a framed panel on the right while the pipeline is being
 * explained beside it, then opens out again for the privacy statement. One
 * element, three roles: backdrop, illustration, backdrop. It is what stops the
 * 3D being wallpaper that the text merely sits on top of.
 *
 * DOCKING IS A CLIP, NOT A RESIZE. Animating the canvas's width would
 * reallocate the drawing buffer on every scroll frame — a GPU memory
 * reallocation sixty times a second. `clip-path` is a compositor operation on a
 * canvas that never changes size, so the dock costs nothing.
 *
 * Both numbers are written straight to a ref and to inline style. Neither goes
 * through React: they change on every scroll event, and re-rendering a page to
 * move a camera that is not in React would be the most expensive thing here.
 *
 * FALLBACK ORDER. The flat SVG plan renders first and always, underneath. The
 * field fades in over it once the real locations load, and removes itself on any
 * failure — no WebGL, a lost context, an unreachable API. Nobody sees an empty
 * rectangle, and the page reads with JavaScript half dead.
 */

const lerp = (a, b, t) => a + (b - a) * t;

export default function LandingCinematicBackdrop({ scrollHostRef }) {
  const morphRef = useRef(0);
  const stageRef = useRef(null);
  const scrimRef = useRef(null);
  const [pois, setPois] = useState(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    api.pois()
      .then((d) => { if (alive) setPois(d.pois ?? []); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!pois?.length) return undefined;
    const t = setTimeout(() => setReady(true), 120);
    return () => clearTimeout(t);
  }, [pois]);

  useEffect(() => {
    const host = scrollHostRef?.current;
    if (!host) return undefined;

    const narrow = window.matchMedia('(max-width: 1023px)');
    let ticking = false;

    function measure() {
      ticking = false;
      const rect = host.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      if (travel <= 0) return;

      const p = Math.min(Math.max(-rect.top / travel, 0), 1);
      const morph = p * 2;
      morphRef.current = morph;

      // Peaks at morph 1 — fully docked exactly while the pipeline is the
      // subject — and returns to zero at both ends.
      const dock = narrow.matches ? 0 : Math.max(0, 1 - Math.abs(morph - 1) * 1.45);
      const eased = dock * dock * (3 - 2 * dock);

      if (stageRef.current) {
        stageRef.current.style.clipPath = `inset(${
          lerp(0, 12, eased)}vh ${lerp(0, 4, eased)}vw ${lerp(0, 12, eased)}vh ${
          lerp(0, 50, eased)}vw round ${lerp(0, 18, eased)}px)`;
      }
      // The left-hand scrim exists to hold text over a full-bleed field. Once
      // the field has retreated to a panel there is nothing under the text to
      // scrim, and leaving it on just greys the page.
      if (scrimRef.current) scrimRef.current.style.opacity = String(1 - eased);
    }

    const onScroll = () => {
      // rAF-coalesced: scroll fires far more often than the screen refreshes,
      // and measuring layout per event is how a smooth page starts to jank.
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
  }, [scrollHostRef, pois]);

  const show = !failed && pois?.length > 0;

  return (
    <div className="pointer-events-none sticky top-0 z-0 h-screen w-full" aria-hidden>
      <div
        ref={stageRef}
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: 'inset(0 0 0 0 round 0px)', transition: 'clip-path 120ms linear' }}
      >
        {/* The flat plan, always underneath, and the thing that remains if the
            field cannot run. */}
        <div className={`absolute inset-0 grid place-items-center transition-opacity duration-1000 ${
          show && ready ? 'opacity-0' : 'opacity-30'
        }`}
        >
          <LandingCampusFloorPlan className="w-[min(58rem,74vw)]" />
        </div>

        {show && (
          <Suspense fallback={null}>
            <div className={`absolute inset-0 transition-opacity duration-[1400ms] ease-in ${
              ready ? 'opacity-100' : 'opacity-0'
            }`}
            >
              <LandingMorphField pois={pois} morphRef={morphRef} onFail={() => setFailed(true)} />
            </div>
          </Suspense>
        )}

        {/* A hairline that only exists while docked, so the panel reads as a
            framed instrument rather than a hole cut in the page. */}
        <div className="absolute inset-0 rounded-[18px] ring-1 ring-inset ring-line" />
      </div>

      <div
        ref={scrimRef}
        className="absolute inset-0 bg-gradient-to-r from-bg via-bg/70 to-transparent"
        style={{ transition: 'opacity 200ms linear' }}
      />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-bg to-transparent" />
    </div>
  );
}
