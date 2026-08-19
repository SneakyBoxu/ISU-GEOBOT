import { useEffect, useRef, useState } from 'react';

/**
 * Motion primitives.
 *
 * Two rules:
 *
 * 1. GPU-only properties. Every animated value lands in `transform`, `opacity`
 *    or `stroke-dashoffset`. Nothing animates layout, which is what makes
 *    "premium" pages stutter on modest hardware.
 *
 * 2. prefers-reduced-motion is honoured, not decorated. Reduced motion returns
 *    the resting state immediately rather than a faster animation — vestibular
 *    disorders are not addressed by speeding things up.
 *
 * Every observer here disconnects when its element leaves the viewport, so a
 * page with nine animated sections is never running nine animations at once.
 */

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/**
 * One-shot reveal. Fires at the threshold, then unobserves.
 */
export function useReveal({ threshold = 0.15, rootMargin = '0px 0px -80px 0px' } = {}) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) { setShown(true); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShown(true); io.unobserve(el); }
    }, { threshold, rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin, reduced]);

  return [ref, shown];
}

/**
 * Presence, for animations that should run while visible and stop when not.
 *
 * Unlike useReveal this does NOT unobserve — an animated diagram should pause
 * when scrolled past and resume when scrolled back, rather than burning frames
 * for a section nobody is looking at.
 */
export function useInView({ threshold = 0.2, rootMargin = '0px' } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), {
      threshold, rootMargin,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin]);

  return [ref, inView, reduced];
}

/**
 * Scroll progress through an element, 0 at first contact to 1 at exit.
 *
 * Writes `--progress` as a CSS custom property rather than returning state, so
 * a scrolling page does not re-render React on every frame. Read it in CSS with
 * `calc()`; read it in JS via the returned ref when a component genuinely needs
 * the number.
 *
 * The listener only does work while the element is on screen.
 */
export function useScrollProgress() {
  const ref = useRef(null);
  const value = useRef(0);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    let visible = false;

    const update = () => {
      frame = 0;
      if (!visible || !ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const total = r.height + window.innerHeight;
      const p = Math.min(1, Math.max(0, (window.innerHeight - r.top) / total));
      value.current = p;
      ref.current.style.setProperty('--progress', p.toFixed(4));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) update();
    });
    io.observe(el);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [reduced]);

  return [ref, value];
}

/**
 * Pointer position within an element, normalised to -1..1, written as
 * `--px` / `--py` custom properties.
 *
 * Deliberately NOT a tilt hook. It exists for restrained parallax — a few
 * pixels of translate — and for proximity effects where a marker responds to
 * a nearby cursor. Rotation is not offered, because that was the effect the
 * redesign removed.
 *
 * rAF-coalesced: pointermove fires far faster than the display refreshes.
 */
export function usePointerWithin({ onMove } = {}) {
  const ref = useRef(null);
  const pos = useRef({ x: 0, y: 0, inside: false });
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    let pending = { x: 0, y: 0, inside: false };

    const commit = () => {
      frame = 0;
      pos.current = pending;
      el.style.setProperty('--px', pending.x.toFixed(3));
      el.style.setProperty('--py', pending.y.toFixed(3));
      onMove?.(pending);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(commit); };

    const move = (e) => {
      const r = el.getBoundingClientRect();
      pending = {
        x: ((e.clientX - r.left) / r.width) * 2 - 1,
        y: ((e.clientY - r.top) / r.height) * 2 - 1,
        inside: true,
        rawX: e.clientX - r.left,
        rawY: e.clientY - r.top,
      };
      schedule();
    };
    const leave = () => { pending = { x: 0, y: 0, inside: false }; schedule(); };

    el.addEventListener('pointermove', move, { passive: true });
    el.addEventListener('pointerleave', leave, { passive: true });
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
      cancelAnimationFrame(frame);
    };
  }, [onMove, reduced]);

  return [ref, pos];
}
