import React, { useEffect, useRef } from 'react';
import LandingCampusFloorPlan from './LandingCampusFloorPlan.jsx';

/**
 * The schematic campus plan, as the stage the page is composed against.
 *
 * THIS REPLACED A WEBGL PARTICLE FIELD, and the swap is an improvement rather
 * than a retreat. The 3D field wanted a WebGL context — which a browser will
 * refuse if another tab already holds one, and which dies outright on a lost
 * context — so its worst case was a black screen where the hero should be. It
 * also carried three.js: 134KB gzipped for a decoration.
 *
 * The plan has none of those failure modes. It is inline SVG that draws itself
 * on load, costs nothing, cannot fail to acquire hardware, prints, scales to
 * any resolution, and reads in both themes because every stroke is
 * `currentColor` against a design token. It is also more honest about what this
 * system is: a surveyed campus drawn as a plan, not a cloud of glowing dots.
 *
 * SCROLL STILL DRIVES IT. Two transforms, both cheap and both compositor-only:
 *
 *   parallax  the plan drifts and scales slightly against the scrolling text,
 *             so the stage has depth rather than being a static wallpaper
 *   dock      it contracts into a framed panel on the right while the middle
 *             sections are being read, then opens out again
 *
 * The dock is a `clip-path`, not a width change, so nothing ever re-lays out.
 * Both are written straight to inline style from a rAF-coalesced scroll
 * handler — never through React, which would re-render the page to move a
 * background.
 */

const lerp = (a, b, t) => a + (b - a) * t;

export default function LandingCinematicBackdrop({ scrollHostRef }) {
  const stageRef = useRef(null);
  const planRef = useRef(null);
  const scrimRef = useRef(null);

  useEffect(() => {
    const host = scrollHostRef?.current;
    if (!host) return undefined;

    const narrow = window.matchMedia('(max-width: 1023px)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let ticking = false;

    function measure() {
      ticking = false;
      const rect = host.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      if (travel <= 0) return;

      const p = Math.min(Math.max(-rect.top / travel, 0), 1);

      // Peaks in the middle of the stage — docked exactly while the middle
      // sections are being read — and returns to zero at both ends.
      const dock = narrow.matches ? 0 : Math.max(0, 1 - Math.abs(p * 2 - 1) * 1.45);
      const eased = dock * dock * (3 - 2 * dock);

      if (stageRef.current) {
        stageRef.current.style.clipPath = `inset(${
          lerp(0, 12, eased)}vh ${lerp(0, 4, eased)}vw ${lerp(0, 12, eased)}vh ${
          lerp(0, 50, eased)}vw round ${lerp(0, 18, eased)}px)`;
      }

      if (planRef.current && !reduced.matches) {
        // Drifts up and grows a little across the stage. Small numbers on
        // purpose: parallax that announces itself reads as a gimmick, and this
        // only has to stop the plan feeling pinned to the page.
        planRef.current.style.transform =
          `translate3d(0, ${lerp(2.5, -6, p)}%, 0) scale(${lerp(1, 1.09, p)})`;
      }

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
  }, [scrollHostRef]);

  return (
    <div className="pointer-events-none sticky top-0 z-0 h-screen w-full" aria-hidden>
      <div
        ref={stageRef}
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: 'inset(0 0 0 0 round 0px)', transition: 'clip-path 120ms linear' }}
      >
        <div
          ref={planRef}
          className="absolute inset-0 grid place-items-center will-change-transform"
          style={{ transition: 'transform 120ms linear' }}
        >
          <LandingCampusFloorPlan className="w-[min(74rem,92vw)] opacity-[0.55]" />
        </div>

        {/* Only visible once docked, so the panel reads as a framed instrument
            rather than a hole cut out of the page. */}
        <div className="absolute inset-0 rounded-[18px] ring-1 ring-inset ring-line" />
      </div>

      {/* Holds text contrast over the plan while it is full-bleed. Fades out as
          the plan retreats into its panel, because by then there is nothing
          underneath the text to scrim. */}
      <div
        ref={scrimRef}
        className="absolute inset-0 bg-gradient-to-r from-bg via-bg/80 to-bg/40"
        style={{ transition: 'opacity 200ms linear' }}
      />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-bg to-transparent" />
    </div>
  );
}
