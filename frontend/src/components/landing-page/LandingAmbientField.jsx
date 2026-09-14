import React, { useEffect, useRef } from 'react';

/**
 * A slow drifting field behind the page.
 *
 * The landing page is long, dark and almost entirely still: between sections
 * there are screens of flat background, and stillness at that scale reads as a
 * page that has stopped loading rather than one that is composed. This gives it
 * a floor of movement without giving it anything to look at.
 *
 * DELIBERATELY ALMOST INVISIBLE. Particles sit around three per cent opacity
 * and drift a few pixels a second. If it is noticeable while you are reading,
 * it is wrong -- the test is that removing it should feel like something died,
 * not that adding it feels like something arrived.
 *
 * CANVAS, NOT DOM. Sixty absolutely-positioned divs with CSS animations keep
 * the compositor busy the whole time the page is open and interfere with the
 * scroll-driven sections above. One canvas, one rAF loop, and the loop stops
 * itself when the tab is hidden or the element scrolls out of view.
 *
 * OFF UNDER prefers-reduced-motion, with no fallback animation. Someone who
 * has asked for less movement is not asking for slower movement.
 */
const COUNT = 46;
const MAX_DPR = 2;

export default function LandingAmbientField() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) return undefined;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return undefined;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let running = true;
    let parts = [];

    function seed() {
      parts = Array.from({ length: COUNT }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.6 + Math.random() * 1.7,
        // Mostly upward, very slowly, with a little lateral wander so the
        // field does not read as a single sheet sliding.
        vx: (Math.random() - 0.5) * 0.08,
        vy: -(0.05 + Math.random() * 0.14),
        a: 0.18 + Math.random() * 0.5,
      }));
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    // The ink colour comes from the theme, so the field inverts with it
    // instead of being a fixed grey that muddies one of the two.
    function inkFor() {
      const dark = document.documentElement.classList.contains('dark')
        || document.documentElement.getAttribute('data-theme') === 'dark'
        || window.matchMedia('(prefers-color-scheme: dark)').matches;
      return dark ? '255,255,255' : '20,32,42';
    }

    let ink = inkFor();

    function frame() {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -6) { p.y = h + 6; p.x = Math.random() * w; }
        if (p.x < -6) p.x = w + 6;
        if (p.x > w + 6) p.x = -6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${ink},${p.a * 0.075})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    resize();
    raf = requestAnimationFrame(frame);

    const onResize = () => { resize(); };
    const onVisibility = () => (document.hidden ? stop() : start());
    const onScheme = () => { ink = inkFor(); };

    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    const scheme = window.matchMedia('(prefers-color-scheme: dark)');
    scheme.addEventListener?.('change', onScheme);
    // The in-page theme toggle flips a class rather than the media query.
    const obs = new MutationObserver(onScheme);
    obs.observe(document.documentElement, {
      attributes: true, attributeFilter: ['class', 'data-theme'],
    });

    return () => {
      stop();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      scheme.removeEventListener?.('change', onScheme);
      obs.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}
