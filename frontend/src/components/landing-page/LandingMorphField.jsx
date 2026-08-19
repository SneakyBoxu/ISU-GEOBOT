import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { buildMorphTargets, particleBudget } from './LandingMorphTargets.js';

/**
 * One particle field, three shapes, morphed on the GPU.
 *
 *   uMorph 0 → 1   the campus becomes the retrieval constellation
 *   uMorph 1 → 2   the constellation collapses into the privacy veil
 *
 * THE MORPH COSTS NOTHING PER FRAME. Three position attributes are uploaded
 * once and interpolated in the vertex shader against a single uniform, so
 * sixty thousand points cost what six hundred would. That budget is spent
 * instead on the things that actually read as expensive: round soft sprites
 * rather than square dots, per-particle colour and size, and staggered arrival
 * so the change ripples across the form.
 *
 * Doing the same interpolation in JavaScript would mean writing 180,000 floats
 * and re-uploading a buffer every frame, which is the difference between this
 * running at 60fps and it running at 12.
 *
 * The shape carries the argument. Campus: the system knows the ground.
 * Constellation: retrieval over a corpus. Veil: individuals collapse into one
 * surface — a status, never a location. Scroll drives it; the sections land as
 * each shape completes.
 */

const VERT = /* glsl */`
  attribute vec3 aGraph;
  attribute vec3 aVeil;
  attribute float aOffset;
  attribute float aTint;
  attribute float aScale;

  uniform float uMorph;      // 0 campus · 1 constellation · 2 veil
  uniform float uTime;
  uniform float uSize;
  uniform float uPulse;      // 0..1 sweep of the retrieval pulse

  varying float vTint;
  varying float vGlow;

  void main() {
    // Each particle starts a little before or after its neighbours, so the
    // transition washes across the form rather than snapping in lockstep.
    float stagger = aOffset * 0.35;
    float m1 = smoothstep(0.0 + stagger, 0.85 + stagger, uMorph);
    float m2 = smoothstep(1.0 + stagger, 1.85 + stagger, uMorph);

    vec3 pos = mix(mix(position, aGraph, m1), aVeil, m2);

    // A slow drift, strongest while the field is loose in the constellation
    // and almost gone once it settles into the veil.
    float loose = m1 * (1.0 - m2);
    pos.x += sin(uTime * 0.28 + aOffset * 31.4) * 5.0 * loose;
    pos.y += cos(uTime * 0.21 + aOffset * 17.7) * 6.5 * loose;
    pos.z += sin(uTime * 0.24 + aOffset * 23.1) * 5.0 * loose;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);

    // The retrieval pulse: a band travelling outward through the constellation,
    // brightening what it passes. This is the query finding its evidence.
    float radius = length(pos) / 520.0;
    float band = 1.0 - smoothstep(0.0, 0.22, abs(radius - uPulse));
    vGlow = band * loose;

    vTint = aTint;
    // Perspective size attenuation, or distant particles stay as fat as near
    // ones and the cloud loses all depth.
    // CLAMPED. Perspective attenuation divides by view depth, so a particle
    // near the camera would otherwise be drawn hundreds of pixels wide — and
    // with additive blending and no depth rejection, a handful of those fills
    // the screen several times over in one frame. The ceiling is the single
    // most important line in this shader for frame time.
    float size = uSize * aScale * (300.0 / -mv.z) * (1.0 + vGlow * 1.6);
    gl_PointSize = clamp(size, 1.0, 9.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */`
  precision mediump float;

  uniform vec3 uAccent;
  uniform vec3 uGold;
  uniform float uOpacity;

  varying float vTint;
  varying float vGlow;

  void main() {
    // Round, soft-edged sprites. A square point is the single clearest tell of
    // an unfinished particle system.
    vec2 d = gl_PointCoord - vec2(0.5);
    float r = dot(d, d);
    if (r > 0.25) discard;
    float alpha = smoothstep(0.25, 0.02, r);

    vec3 colour = mix(uAccent, uGold, clamp(vTint + vGlow * 0.7, 0.0, 1.0));
    gl_FragColor = vec4(colour * (1.0 + vGlow * 1.4), alpha * uOpacity);
  }
`;

function token(name, fallback) {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!v) return fallback;
  const [r, g, b] = v.split(/\s+/).map(Number);
  if (![r, g, b].every(Number.isFinite)) return fallback;
  // setRGB with an explicit colour space: THREE.Color(r,g,b) treats its
  // arguments as LINEAR since r152, and the design tokens are sRGB.
  return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
}

export default function LandingMorphField({ pois = [], morphRef, onFail }) {
  const hostRef = useRef(null);
  const [failed, setFailed] = useState(false);

  // A ref, not a dependency: the parent passes an inline arrow, and rebuilding
  // a WebGL scene because a callback got a new identity is an expensive way to
  // do nothing.
  const onFailRef = useRef(onFail);
  onFailRef.current = onFail;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !pois.length || failed) return undefined;

    let disposed = false;
    let teardown = null;
    // Deferred a task so the dark wrapper's attribute and its CSS are current
    // before the tokens below are read — React flushes effects child-first.
    const deferred = setTimeout(() => { if (!disposed) teardown = build(); }, 0);

    function build() {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
      } catch {
        setFailed(true);
        onFailRef.current?.();
        return null;
      }

      // Capped at 1.5, not 2. Additive particles are fill-rate bound, and the
      // step from 1.5x to 2x costs 78% more pixels for a difference nobody sees
      // on a soft-edged sprite.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      renderer.setPixelRatio(dpr);
      renderer.setSize(host.clientWidth, host.clientHeight, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.setAttribute('aria-hidden', 'true');
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(46, host.clientWidth / host.clientHeight, 1, 8000);

      const count = particleBudget();
      const targets = buildMorphTargets(pois, count);
      if (!targets) { renderer.dispose(); return null; }

      const accent = token('--accent', new THREE.Color(0.43, 0.69, 0.56));
      const gold = new THREE.Color().setRGB(0.85, 0.68, 0.28, THREE.SRGBColorSpace);

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(targets.campus, 3));
      geo.setAttribute('aGraph', new THREE.BufferAttribute(targets.graph, 3));
      geo.setAttribute('aVeil', new THREE.BufferAttribute(targets.veil, 3));
      geo.setAttribute('aOffset', new THREE.BufferAttribute(targets.offset, 1));
      geo.setAttribute('aTint', new THREE.BufferAttribute(targets.tint, 1));
      geo.setAttribute('aScale', new THREE.BufferAttribute(targets.scale, 1));
      // The campus is wide and flat; a bounding sphere computed from it would
      // cull the constellation the moment it rises above the roofline.
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 120, 0), 1400);

      const uniforms = {
        uMorph: { value: 0 },
        uTime: { value: 0 },
        uSize: { value: dpr > 1 ? 2.6 : 3.4 },
        uPulse: { value: -1 },
        uAccent: { value: accent },
        uGold: { value: gold },
        uOpacity: { value: 0.92 },
      };

      const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        // Additive: overlapping particles accumulate into brightness, which is
        // what makes a dense cluster glow instead of flattening to one tone.
        blending: THREE.AdditiveBlending,
      });

      const points = new THREE.Points(geo, material);
      scene.add(points);

      // ---- wireframe volumes, campus state only ---------------------------
      // Without these the campus reads as confetti. They give it edges, and
      // they dissolve as soon as the morph leaves.
      const edgeGroup = new THREE.Group();
      const edgeMat = new THREE.LineBasicMaterial({
        color: accent, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      for (const p of targets.places) {
        const w = 26 + p.h * 0.34;
        const box = new THREE.BoxGeometry(w, p.h, w * 0.8);
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box), edgeMat);
        edges.position.set(p.x, p.h / 2, p.z);
        edgeGroup.add(edges);
        box.dispose();
      }
      scene.add(edgeGroup);

      // ---- ground rings ---------------------------------------------------
      const rings = new THREE.Group();
      for (let i = 1; i <= 5; i += 1) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(i * 170, i * 170 + 1.4, 128),
          new THREE.MeshBasicMaterial({
            color: accent, transparent: true, opacity: 0.13 - i * 0.017,
            side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
          }),
        );
        ring.rotation.x = -Math.PI / 2;
        rings.add(ring);
      }
      scene.add(rings);

      // ---- no post-processing, deliberately ---------------------------------
      // UnrealBloomPass was here and it was the single most expensive thing on
      // the page: a mip chain of separable blurs, roughly eleven extra
      // full-screen passes, at devicePixelRatio-squared resolution. On a
      // 1920x1080 display at dpr 2 that is eleven passes over 3840x2160 —
      // costing multiples of what sixty thousand points cost.
      //
      // It bought very little. Additive blending of soft sprites already
      // accumulates into glow where particles are dense, which is the effect
      // bloom was being asked to produce. Rendering straight to the canvas is
      // the difference between this page being smooth and being a slideshow.

      // ---- camera keyframes -------------------------------------------------
      // One per shape. The camera pulling BACK for the veil is the argument:
      // at altitude nobody is identifiable.
      const KEYS = [
        { pos: new THREE.Vector3(0, 300, 880), look: new THREE.Vector3(0, 70, 0) },
        { pos: new THREE.Vector3(430, 360, 700), look: new THREE.Vector3(0, 150, 0) },
        { pos: new THREE.Vector3(0, 1180, 30), look: new THREE.Vector3(0, 0, 0) },
      ];
      const camPos = KEYS[0].pos.clone();
      const camLook = KEYS[0].look.clone();
      const tmpPos = new THREE.Vector3();
      const tmpLook = new THREE.Vector3();

      let pointerX = 0;
      let pointerY = 0;
      let driftX = 0;
      let driftY = 0;

      function resize() {
        const w = host.clientWidth;
        const h = host.clientHeight;
        if (!w || !h) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      }

      const onPointer = (e) => {
        pointerX = (e.clientX / window.innerWidth) * 2 - 1;
        pointerY = (e.clientY / window.innerHeight) * 2 - 1;
      };

      const clock = new THREE.Clock();
      let raf = 0;
      let running = !reduced;

      // ---- adaptive quality -------------------------------------------------
      // Hardware guesses are always wrong for somebody. Rather than pick a
      // particle count for an imagined machine, watch the actual frame times and
      // back off if they are bad. Point SIZE is the lever, not point count:
      // these are additive sprites with no depth rejection, so cost tracks
      // covered pixels, and shrinking every sprite is both cheaper and less
      // visible than deleting a third of the field.
      let frames = 0;
      let elapsed = 0;
      let tier = 0;                       // 0 full · 1 reduced · 2 minimal
      let last = performance.now();
      const FULL_SIZE = uniforms.uSize.value;

      function watchFrameTime() {
        const now = performance.now();
        const dt = now - last;
        last = now;
        // Ignore the first frames and any hitch over 100ms — a tab switch or a
        // GC pause is not evidence that the GPU cannot cope.
        if (dt > 100) return;
        frames += 1;
        elapsed += dt;
        if (frames < 45) return;

        const avg = elapsed / frames;
        frames = 0;
        elapsed = 0;

        if (avg > 20 && tier < 2) {
          tier += 1;
          uniforms.uSize.value = FULL_SIZE * (tier === 1 ? 0.72 : 0.5);
          uniforms.uOpacity.value = tier === 1 ? 0.85 : 0.75;
          if (tier === 2) rings.visible = false;
        }
      }

      function draw() {
        const morph = THREE.MathUtils.clamp(morphRef?.current ?? 0, 0, 2);
        uniforms.uMorph.value += (morph - uniforms.uMorph.value) * 0.075;
        uniforms.uTime.value = clock.getElapsedTime();

        const m = uniforms.uMorph.value;

        // The pulse only runs while the constellation is the dominant shape.
        const inGraph = Math.max(0, 1 - Math.abs(m - 1) * 1.6);
        uniforms.uPulse.value = inGraph > 0.05
          ? (uniforms.uTime.value * 0.42) % 1.35
          : -1;

        edgeMat.opacity = 0.34 * Math.max(0, 1 - m * 1.5);
        edgeGroup.visible = edgeMat.opacity > 0.005;
        rings.children.forEach((r, i) => {
          r.material.opacity = (0.13 - i * 0.017) * Math.max(0, 1 - m * 0.8);
        });
        rings.rotation.y = uniforms.uTime.value * 0.02;

        // Keyframe interpolation across the two segments.
        const seg = Math.min(Math.floor(m), 1);
        const t = THREE.MathUtils.clamp(m - seg, 0, 1);
        const ease = t * t * (3 - 2 * t);
        tmpPos.lerpVectors(KEYS[seg].pos, KEYS[seg + 1].pos, ease);
        tmpLook.lerpVectors(KEYS[seg].look, KEYS[seg + 1].look, ease);

        driftX += (pointerX - driftX) * 0.03;
        driftY += (pointerY - driftY) * 0.03;
        tmpPos.x += driftX * 90;
        tmpPos.y += -driftY * 55;

        camPos.lerp(tmpPos, 0.08);
        camLook.lerp(tmpLook, 0.08);
        camera.position.copy(camPos);
        camera.lookAt(camLook);

        renderer.render(scene, camera);
      }

      function frame() {
        if (!running) return;
        watchFrameTime();
        draw();
        raf = requestAnimationFrame(frame);
      }

      const onVisibility = () => {
        if (document.hidden) { running = false; cancelAnimationFrame(raf); }
        else if (!reduced) { running = true; raf = requestAnimationFrame(frame); }
      };

      const onLost = (e) => {
        e.preventDefault();
        running = false;
        cancelAnimationFrame(raf);
        setFailed(true);
        onFailRef.current?.();
      };

      const ro = new ResizeObserver(() => { resize(); draw(); });
      ro.observe(host);

      resize();
      draw();

      if (!reduced) {
        window.addEventListener('pointermove', onPointer, { passive: true });
        document.addEventListener('visibilitychange', onVisibility);
        raf = requestAnimationFrame(frame);
      }
      renderer.domElement.addEventListener('webglcontextlost', onLost);

      // Exposed so the field can be asserted in an environment that never
      // paints a frame — see the verification note in the plan.
      host.__field = {
        scene, camera, renderer, uniforms, count, reduced, dpr,
        edges: edgeGroup.children.length,
        get tier() { return tier; },
        step: () => draw(),
      };

      return () => {
        running = false;
        cancelAnimationFrame(raf);
        ro.disconnect();
        window.removeEventListener('pointermove', onPointer);
        document.removeEventListener('visibilitychange', onVisibility);
        renderer.domElement.removeEventListener('webglcontextlost', onLost);
        // three does not garbage-collect GPU memory; leaving this out leaks a
        // 60k-point buffer and a bloom render target per navigation.
        scene.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((mm) => mm.dispose());
        });
        renderer.dispose();
        if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
        delete host.__field;
      };
    }

    return () => {
      disposed = true;
      clearTimeout(deferred);
      teardown?.();
    };
  }, [pois, failed, morphRef]);

  if (failed) return null;
  return <div ref={hostRef} className="absolute inset-0" aria-hidden />;
}
