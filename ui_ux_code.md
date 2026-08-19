# ISU-GeoBot — Complete UI/UX Frontend Codebase & Design System

> **Comprehensive UI/UX Architecture & Source Code Package**  
> **Project:** ISU-GeoBot (Undergraduate Thesis — Isabela State University, Echague Main Campus)  
> **Tech Stack:** React 18, Vite, Tailwind CSS, Leaflet / React-Leaflet, Lucide React, Supabase Auth client, Custom 3D Canvas & Motion Primitives.  
> **Purpose:** Ready-to-share single document containing all frontend UI/UX source files for review, prompt engineering, or LLM-assisted iteration (e.g., ChatGPT, Claude).

---

## Table of Contents

1. [Design System & Configuration](#1-design-system--configuration)
   - [`web/index.html`](#webindexhtml)
   - [`web/tailwind.config.js`](#webtailwindconfigjs)
   - [`web/src/index.css`](#websrcindexcss)
2. [Entry Points & Routing](#2-entry-points--routing)
   - [`web/src/main.jsx`](#websrcmainjsx)
   - [`web/src/App.jsx`](#websrcappjsx)
3. [Client Libraries & Motion Hooks](#3-client-libraries--motion-hooks)
   - [`web/src/lib/constants.js`](#websrclibconstantsjs)
   - [`web/src/lib/api.js`](#websrclibapijs)
   - [`web/src/lib/supabase.js`](#websrclibsupabasejs)
   - [`web/src/hooks/useMotion.js`](#websrchooksusemotionjs)
4. [Shared UI Components](#4-shared-ui-components)
   - [`web/src/components/shared/Nav.jsx`](#websrccomponentssharednavjsx)
   - [`web/src/components/shared/Footer.jsx`](#websrccomponentssharedfooterjsx)
   - [`web/src/components/shared/DemoBanner.jsx`](#websrccomponentsshareddemobannerjsx)
   - [`web/src/components/shared/StatusChip.jsx`](#websrccomponentssharedstatuschipjsx)
   - [`web/src/components/shared/PortalLogin.jsx`](#websrccomponentssharedportalloginjsx)
   - [`web/src/components/shared/Loading.jsx`](#websrccomponentssharedloadingjsx)
5. [Landing Page Components](#5-landing-page-components)
   - [`web/src/components/landing/Landing.jsx`](#websrccomponentslandinglandingjsx)
   - [`web/src/components/landing/Hero.jsx`](#websrccomponentslandingherojsx)
   - [`web/src/components/landing/CampusField.jsx`](#websrccomponentslandingcampusfieldjsx)
   - [`web/src/components/landing/DemoWidget.jsx`](#websrccomponentslandingdemowidgetjsx)
   - [`web/src/components/landing/PoiGrid.jsx`](#websrccomponentslandingpoigridjsx)
   - [`web/src/components/landing/Architecture.jsx`](#websrccomponentslandingarchitecturejsx)
   - [`web/src/components/landing/Privacy.jsx`](#websrccomponentslandingprivacyjsx)
   - [`web/src/components/landing/Research.jsx`](#websrccomponentslandingresearchjsx)
6. [Interactive Campus Workspace](#6-interactive-campus-workspace)
   - [`web/src/components/app/Workspace.jsx`](#websrccomponentsappworkspacejsx)
   - [`web/src/components/app/ChatInterface.jsx`](#websrccomponentsappchatinterfacejsx)
   - [`web/src/components/app/CampusMap.jsx`](#websrccomponentsappcampusmapjsx)
7. [Admin & Operational Portals](#7-admin--operational-portals)
   - [`web/src/components/admin/LocationManager.jsx`](#websrccomponentsadminlocationmanagerjsx)
   - [`web/src/components/guard/GuardDashboard.jsx`](#websrccomponentsguardguarddashboardjsx)
   - [`web/src/components/validate/ValidationChecklist.jsx`](#websrccomponentsvalidatevalidationchecklistjsx)
   - [`web/src/components/validate/PrivacyControls.jsx`](#websrccomponentsvalidateprivacycontrolsjsx)

---

# 1. Design System & Configuration

### `web/index.html`
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ISU-GeoBot — Campus Navigation Assistant</title>
    <meta name="description"
      content="A web-based campus navigation assistant integrating an Enhanced RAG architecture for privacy-compliant faculty availability estimation. Undergraduate thesis research, Isabela State University Echague." />
    <!-- Thesis §1.3 claims cross-device accessibility. That is a claim you must
         be able to demonstrate on a phone in the defense room, so responsive
         layout is not optional polish here. -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

---

### `web/tailwind.config.js`
```javascript
/** ISU-GeoBot design system — modern university theme. */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#020617', 900: '#0F172A', 800: '#1E293B',
          700: '#334155', 600: '#475569', 400: '#94A3B8',
          300: '#CBD5E1', 100: '#F1F5F9',
        },
        brand: {
          50: '#ECFDF5', 100: '#D1FAE5', 300: '#6EE7B7',
          400: '#34D399', 500: '#10B981', 600: '#059669', 700: '#047857',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      animation: {
        'fade-up': 'fadeUp .5s cubic-bezier(.16,1,.3,1) both',
        'fade-in': 'fadeIn .4s ease-out both',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: { '0%': { opacity: 0, transform: 'translateY(14px)' },
                  '100%': { opacity: 1, transform: 'none' } },
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        pulseSoft: { '0%,100%': { opacity: 1 }, '50%': { opacity: .45 } },
      },
    },
  },
  plugins: [],
};
```

---

### `web/src/index.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root { color-scheme: dark; }
  html { scroll-behavior: smooth; }
  body {
    @apply bg-ink-950 text-ink-100 font-sans antialiased;
  }
  ::selection { @apply bg-brand-500/30 text-white; }
}

@layer components {
  .container-x { @apply mx-auto w-full max-w-6xl px-5 sm:px-8; }

  .card {
    @apply rounded-2xl border border-white/10 bg-ink-900/60 backdrop-blur
           transition-colors duration-200;
  }
  .card-hover { @apply hover:border-brand-500/40 hover:bg-ink-800/60; }

  .btn {
    @apply inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3
           text-sm font-semibold transition-all duration-200
           focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400
           focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950
           disabled:cursor-not-allowed disabled:opacity-50;
  }
  .btn-primary {
    @apply btn bg-brand-500 text-ink-950 hover:bg-brand-400
           shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30;
  }
  .btn-ghost {
    @apply btn border border-white/15 text-ink-100 hover:border-white/30
           hover:bg-white/5;
  }

  .chip {
    @apply inline-flex items-center gap-1.5 rounded-full border px-3 py-1
           text-xs font-medium;
  }
  .eyebrow {
    @apply text-xs font-semibold uppercase tracking-[0.18em] text-brand-400;
  }
  .h-section {
    @apply text-3xl font-bold tracking-tight text-white sm:text-4xl;
  }
  .prose-muted { @apply text-[15px] leading-relaxed text-ink-400; }
}

/* Leaflet dark tuning */
.leaflet-container { @apply bg-ink-900 font-sans; }
.leaflet-popup-content-wrapper, .leaflet-popup-tip {
  @apply bg-ink-800 text-ink-100 shadow-xl;
}
.leaflet-popup-content-wrapper { @apply rounded-xl border border-white/10; }
.leaflet-bar a { @apply bg-ink-800 text-ink-100 border-white/10; }
.leaflet-bar a:hover { @apply bg-ink-700; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
  html { scroll-behavior: auto; }
}

/* ===================================================================
   Motion system
   -------------------------------------------------------------------
   Everything below animates only `transform`, `opacity` and `filter`.
   No layout properties are animated anywhere on this page — that is
   what keeps it smooth on the i5 / 8 GB machine the thesis specifies.
   =================================================================== */

@layer components {

  /* Scroll reveal ------------------------------------------------- */
  .reveal {
    opacity: 0;
    transform: translate3d(0, 26px, 0);
    transition:
      opacity 720ms cubic-bezier(.16, 1, .3, 1),
      transform 720ms cubic-bezier(.16, 1, .3, 1);
    will-change: transform, opacity;
  }
  .reveal.is-in { opacity: 1; transform: none; }
  .reveal-scale { transform: translate3d(0, 26px, 0) scale(.97); }

  /* Stagger children by index via --i ------------------------------ */
  .stagger > * { transition-delay: calc(var(--i, 0) * 70ms); }

  /* 3D tilt card --------------------------------------------------- */
  .scene { perspective: 1200px; perspective-origin: 50% 40%; }
  .tilt {
    transform:
      rotateX(var(--rx, 0deg))
      rotateY(var(--ry, 0deg))
      scale3d(var(--sc, 1), var(--sc, 1), 1);
    transform-style: preserve-3d;
    transition: transform 520ms cubic-bezier(.16, 1, .3, 1);
    will-change: transform;
  }
  /* Pointer glare. A radial highlight that tracks the cursor and fades
     out on leave — the cheap trick that makes a flat card read as glass. */
  .tilt-glare::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    opacity: var(--glare, 0);
    transition: opacity 420ms ease;
    background: radial-gradient(
      420px circle at var(--mx, 50%) var(--my, 50%),
      rgba(255, 255, 255, .07),
      transparent 42%
    );
  }
  /* Lift nested content out of the card plane for real parallax depth. */
  .layer-1 { transform: translateZ(28px); }
  .layer-2 { transform: translateZ(56px); }

  /* Parallax ------------------------------------------------------- */
  .parallax { transform: translate3d(0, var(--py, 0px), 0); will-change: transform; }

  /* Gradient text -------------------------------------------------- */
  .text-gradient {
    background: linear-gradient(105deg, #34D399 0%, #10B981 42%, #38BDF8 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  /* Aurora blobs --------------------------------------------------- */
  .aurora {
    position: absolute;
    border-radius: 9999px;
    filter: blur(80px);
    will-change: transform;
    animation: drift 22s ease-in-out infinite alternate;
  }

  /* Perspective floor grid ----------------------------------------- */
  .grid-floor {
    position: absolute;
    inset: auto 0 0 0;
    height: 55%;
    transform: perspective(680px) rotateX(72deg) translateZ(-40px);
    transform-origin: 50% 100%;
    background-image:
      linear-gradient(rgba(16, 185, 129, .30) 1px, transparent 1px),
      linear-gradient(90deg, rgba(148, 163, 184, .18) 1px, transparent 1px);
    background-size: 72px 72px;
    mask-image: linear-gradient(to top, #000 0%, transparent 72%);
    -webkit-mask-image: linear-gradient(to top, #000 0%, transparent 72%);
    animation: floor 18s linear infinite;
  }

  /* Shine sweep on hover ------------------------------------------- */
  .shine { position: relative; overflow: hidden; }
  .shine::before {
    content: '';
    position: absolute;
    inset: 0;
    transform: translateX(-120%) skewX(-18deg);
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, .10), transparent);
    transition: transform 780ms cubic-bezier(.16, 1, .3, 1);
  }
  .shine:hover::before { transform: translateX(120%) skewX(-18deg); }

  /* Animated conic border ------------------------------------------ */
  .ring-glow { position: relative; }
  .ring-glow::before {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    padding: 1px;
    background: conic-gradient(from var(--a, 0deg),
      transparent 0deg, rgba(16, 185, 129, .55) 40deg, transparent 120deg);
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    opacity: 0;
    transition: opacity 420ms ease;
    animation: spin-border 4.5s linear infinite;
  }
  .ring-glow:hover::before { opacity: 1; }
}

@property --a {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

@keyframes spin-border { to { --a: 360deg; } }
@keyframes floor      { to { background-position: 0 72px, 72px 0; } }
@keyframes drift {
  0%   { transform: translate3d(0, 0, 0) scale(1); }
  50%  { transform: translate3d(3%, -4%, 0) scale(1.08); }
  100% { transform: translate3d(-3%, 3%, 0) scale(.96); }
}
@keyframes float-y {
  0%, 100% { transform: translate3d(0, 0, 0); }
  50%      { transform: translate3d(0, -10px, 0); }
}
@keyframes sheen {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.animate-float { animation: float-y 7s ease-in-out infinite; }

@media (prefers-reduced-motion: reduce) {
  .aurora, .grid-floor, .animate-float, .ring-glow::before { animation: none !important; }
  .reveal { opacity: 1 !important; transform: none !important; }
  .tilt { transform: none !important; }
}
```

---

# 2. Entry Points & Routing

### `web/src/main.jsx`
```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import './index.css';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
```

---

### `web/src/App.jsx`
```javascript
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import Landing from './components/landing/Landing.jsx';
import Loading from './components/shared/Loading.jsx';

// Audit F-12 / W4: the guard dashboard is lazy-loaded so its code and query
// shapes are not shipped inside the bundle every anonymous visitor downloads.
const Workspace = lazy(() => import('./components/app/Workspace.jsx'));
const GuardDashboard = lazy(() => import('./components/guard/GuardDashboard.jsx'));
const ValidationChecklist = lazy(() => import('./components/validate/ValidationChecklist.jsx'));
const LocationManager = lazy(() => import('./components/admin/LocationManager.jsx'));

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<Workspace />} />
        <Route path="/guard" element={<GuardDashboard />} />
        <Route path="/validate" element={<ValidationChecklist />} />
        <Route path="/admin" element={<LocationManager />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </Suspense>
  );
}
```

---

# 3. Client Libraries & Motion Hooks

### `web/src/lib/constants.js`
```javascript
import { CheckCircle2, GraduationCap, MinusCircle } from 'lucide-react';

/**
 * Status presentation.
 *
 * `label` is the display wording from the build brief. `thesisLabel` is the
 * §3.9 evaluated wording. Both are kept because they differ, and the deviation
 * is a live researcher decision (docs/OPEN_DECISIONS.md item 2) — not
 * something the UI should quietly pick a side on.
 *
 * Audit §4.3: there is deliberately NO confidence level, percentage or
 * High/Medium/Low badge here. Displaying confidence creates an evaluation
 * obligation the thesis does not plan for and hands the panel a metric that
 * cannot be defended.
 */
export const STATUS = {
  available_consultation: {
    label: 'Available for Consultation',
    thesisLabel: 'Available for Consultation',
    icon: CheckCircle2,
    tone: 'border-brand-500/40 bg-brand-500/10 text-brand-300',
    dot: 'bg-brand-400',
  },
  in_scheduled_class: {
    label: 'In Scheduled Class / Lecture',
    thesisLabel: 'Currently in a Lecture',
    icon: GraduationCap,
    tone: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    dot: 'bg-amber-400',
  },
  unavailable_off_schedule: {
    label: 'Unavailable / Off-Schedule',
    thesisLabel: 'Unavailable',
    icon: MinusCircle,
    tone: 'border-ink-600 bg-ink-800 text-ink-300',
    dot: 'bg-ink-400',
  },
};

// ISU Echague Main Campus. Used only as an initial map view.
// Audit R4: real POI coordinates come from the on-site GPS survey (§3.4.1a).
// Placeholder POIs are marked [DEMO] by the API and rendered as such.
export const CAMPUS_CENTER = [16.7089, 121.6742];
export const CAMPUS_ZOOM = 16;

export const POI_CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'college', label: 'Colleges' },
  { key: 'administrative', label: 'Administrative' },
  { key: 'laboratory', label: 'Laboratories' },
  { key: 'library', label: 'Libraries' },
  { key: 'facility', label: 'Facilities' },
];
```

---

### `web/src/lib/api.js`
```javascript
/**
 * API client.
 *
 * The browser talks ONLY to the Express API. It never calls Groq (audit W6),
 * never calls the Flask ML service (W7), and never holds the Supabase
 * service_role key (W2). Those boundaries are why this file is thin.
 */

const BASE = import.meta.env.VITE_API_BASE ?? '/api';

async function request(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.message || json.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = json.error;
    throw err;
  }
  return json;
}

export const api = {
  health: () => request('/health'),

  // Note: no `mode` parameter. Audit F-16 — the standard/enhanced switch is a
  // server-side evaluation concern and is deliberately not reachable from here.
  chat: (query) => request('/chat', { method: 'POST', body: { query } }),

  demoQueries: () => request('/demo/queries'),
  demoCompare: (demoQueryId) =>
    request('/demo/compare', { method: 'POST', body: { demoQueryId } }),

  pois: () => request('/map/pois'),
  facultySearch: (q) => request(`/faculty/search?q=${encodeURIComponent(q)}`),
  evalStatus: () => request('/eval/status'),

  guardRoster: (token) => request('/guard/roster', { token }),
  guardLog: (token, body) => request('/guard/events', { method: 'POST', body, token }),

  me: (token) => request('/me', { token }),

  // Campus location management (admin / researcher only — enforced server-side
  // and by RLS, never by hiding the button).
  adminPois: (token) => request('/admin/pois', { token }),
  adminDepartments: (token) => request('/admin/departments', { token }),
  adminCreatePoi: (token, body) =>
    request('/admin/pois', { method: 'POST', body, token }),
  adminUpdatePoi: (token, id, body) =>
    request(`/admin/pois/${id}`, { method: 'PATCH', body, token }),
  adminUnpublishPoi: (token, id, note) =>
    request(`/admin/pois/${id}/unpublish`, { method: 'POST', body: { note }, token }),

  // Faculty self-service (RA 10173 right to object)
  myFaculty: (token) => request('/admin/me/faculty', { token }),
  setMyVisibility: (token, body) =>
    request('/admin/me/faculty/visibility', { method: 'POST', body, token }),

  validateContext: (token) => request('/validate/context', { token }),
  validateSubmit: (token, body) =>
    request('/validate/entries', { method: 'POST', body, token }),
  validateEntries: (token) => request('/validate/entries', { token }),
};
```

---

### `web/src/lib/supabase.js`
```javascript
import { createClient } from '@supabase/supabase-js';

/**
 * Auth only.
 *
 * This client holds the ANON key, which ships in the bundle and is readable by
 * anyone. It is used exclusively to sign guard and validator accounts in and to
 * obtain a JWT for the Express API. It must never be used to read data
 * directly: RLS is deny-by-default (audit F-30/W1) precisely so that a leaked
 * anon key is worth nothing.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anon ? createClient(url, anon) : null;

/**
 * Demo sessions.
 *
 * When Supabase is not configured the portals still need to be reachable so
 * the guard and validation flows can be shown. These tokens are recognised
 * only by a server running with DEMO_MODE=true, and the login screen displays
 * them on-screen so they cannot be mistaken for real credentials.
 */
const DEMO_ACCOUNTS = {
  'guard@demo.local': { access_token: 'demo-guard-token', role: 'guard' },
  'faculty@demo.local': { access_token: 'demo-validator-token', role: 'faculty' },
  'student@demo.local': { access_token: 'demo-student-token', role: 'student' },
  'admin@demo.local': { access_token: 'demo-admin-token', role: 'admin' },
};

export const DEMO_AUTH = !supabase;

export async function signIn(email, password) {
  if (!supabase) {
    const account = DEMO_ACCOUNTS[email.trim().toLowerCase()];
    if (!account || password !== 'demo') {
      throw new Error('Use one of the demonstration accounts shown below.');
    }
    const session = { access_token: account.access_token, demo: true };
    sessionStorage.setItem('geobot.demoSession', JSON.stringify(session));
    return session;
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function currentSession() {
  if (!supabase) {
    const raw = sessionStorage.getItem('geobot.demoSession');
    return raw ? JSON.parse(raw) : null;
  }
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

export async function signOut() {
  if (!supabase) {
    sessionStorage.removeItem('geobot.demoSession');
    return;
  }
  await supabase.auth.signOut();
}
```

---

### `web/src/hooks/useMotion.js`
```javascript
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Motion primitives for the landing page.
 *
 * Three rules everything here follows:
 *
 * 1. GPU-only properties. Every animated value lands in `transform` or
 *    `opacity`. Nothing animates layout (width, top, margin) because that
 *    forces reflow on every frame and is what makes "premium" pages stutter.
 *
 * 2. rAF-coalesced. Pointer and scroll events fire far faster than the display
 *    refreshes; writing to the DOM on each one is wasted work. Handlers record
 *    a value and a single rAF applies it.
 *
 * 3. prefers-reduced-motion is honoured, not decorated. Reduced motion returns
 *    the resting state immediately rather than a faster animation — vestibular
 *    disorders are not addressed by speeding things up.
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
 * Reveal-on-scroll via IntersectionObserver.
 *
 * Not a scroll listener: the observer fires only at threshold crossings, so
 * there is no per-frame work while the user scrolls past forty sections.
 * Unobserves after firing — these reveals are one-shot.
 */
export function useReveal({ threshold = 0.15, rootMargin = '0px 0px -80px 0px' } = {}) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) { setShown(true); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setShown(true); io.unobserve(el); }
      },
      { threshold, rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin, reduced]);

  return [ref, shown];
}

/**
 * Pointer-driven 3D tilt.
 *
 * Writes CSS custom properties rather than React state so the card re-renders
 * zero times while the pointer moves — the browser composites the transform
 * without touching the React tree at all.
 */
export function useTilt({ max = 8, scale = 1.015, glare = true } = {}) {
  const ref = useRef(null);
  const frame = useRef(0);
  const target = useRef({ rx: 0, ry: 0, mx: 50, my: 50, active: 0 });
  const reduced = usePrefersReducedMotion();

  const apply = useCallback(() => {
    frame.current = 0;
    const el = ref.current;
    if (!el) return;
    const { rx, ry, mx, my, active } = target.current;
    el.style.setProperty('--rx', `${rx}deg`);
    el.style.setProperty('--ry', `${ry}deg`);
    el.style.setProperty('--sc', String(active ? scale : 1));
    if (glare) {
      el.style.setProperty('--mx', `${mx}%`);
      el.style.setProperty('--my', `${my}%`);
      el.style.setProperty('--glare', String(active ? 1 : 0));
    }
  }, [scale, glare]);

  const schedule = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(apply);
  }, [apply]);

  const onPointerMove = useCallback((e) => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    target.current = {
      rx: (0.5 - py) * max * 2,
      ry: (px - 0.5) * max * 2,
      mx: px * 100,
      my: py * 100,
      active: 1,
    };
    schedule();
  }, [max, reduced, schedule]);

  const onPointerLeave = useCallback(() => {
    target.current = { rx: 0, ry: 0, mx: 50, my: 50, active: 0 };
    schedule();
  }, [schedule]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return {
    ref,
    handlers: reduced ? {} : { onPointerMove, onPointerLeave },
  };
}

/**
 * Scroll parallax. Returns a ref; the element's --p custom property tracks its
 * progress through the viewport from -1 (below) to 1 (above).
 *
 * Uses a passive scroll listener coalesced into rAF. IntersectionObserver
 * cannot do this — it reports crossings, not continuous position — but the
 * listener only does work while the element is actually on screen.
 */
export function useParallax(strength = 40) {
  const ref = useRef(null);
  const frame = useRef(0);
  const visible = useRef(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting; });
    io.observe(el);

    const update = () => {
      frame.current = 0;
      if (!visible.current || !ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const centre = r.top + r.height / 2;
      const p = (window.innerHeight / 2 - centre) / (window.innerHeight / 2);
      ref.current.style.setProperty('--p', p.toFixed(4));
      ref.current.style.setProperty('--py', `${(p * strength).toFixed(2)}px`);
    };
    const onScroll = () => {
      if (!frame.current) frame.current = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame.current);
    };
  }, [strength, reduced]);

  return ref;
}

/** Pointer position for the page, normalised to -1..1. Throttled to rAF. */
export function usePointer() {
  const ref = useRef({ x: 0, y: 0 });
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    let pending = { x: 0, y: 0 };
    const commit = () => { frame = 0; ref.current = pending; };
    const onMove = (e) => {
      pending = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      };
      if (!frame) frame = requestAnimationFrame(commit);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame);
    };
  }, [reduced]);

  return ref;
}
```

---

# 4. Shared UI Components

### `web/src/components/shared/Nav.jsx`
```javascript
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChevronDown, ClipboardCheck, Compass, Menu, Settings2, ShieldCheck, X,
} from 'lucide-react';

/**
 * Portals are reachable from every page, but they are not marketing links.
 *
 * Only `/validate` is something a person outside the research team is expected
 * to look for — faculty members are told to go there, so it is named plainly
 * and listed first. `/guard` and `/admin` are operational surfaces for one or
 * two people each; they belong in the menu so nobody has to be told a URL, but
 * not in the top bar where they would imply a general-purpose audience.
 *
 * Nothing here is an access control. Every portal enforces its own auth and
 * role check server-side, and RLS enforces it again at the database. Hiding a
 * link is presentation, never protection — a signed-out visitor can click any
 * of these and will simply meet the sign-in screen.
 */
const PORTALS = [
  {
    to: '/validate',
    label: 'Faculty Portal',
    hint: 'Validation checklist and privacy controls',
    icon: ClipboardCheck,
    primary: true,
  },
  {
    to: '/guard',
    label: 'Security Presence',
    hint: 'Log faculty arrivals and departures',
    icon: ShieldCheck,
  },
  {
    to: '/admin',
    label: 'Campus Locations',
    hint: 'Add or correct buildings on the map',
    icon: Settings2,
  },
];

export default function Nav({ transparent = false }) {
  const [open, setOpen] = useState(false);
  const [portalsOpen, setPortalsOpen] = useState(false);
  const { pathname } = useLocation();
  const portalsRef = useRef(null);

  const links = [
    { href: '#architecture', label: 'Architecture' },
    { href: '#privacy', label: 'Privacy' },
    { href: '#research', label: 'Research' },
  ];

  // Close the dropdown on outside click or Escape.
  useEffect(() => {
    if (!portalsOpen) return;
    const onClick = (e) => {
      if (portalsRef.current && !portalsRef.current.contains(e.target)) {
        setPortalsOpen(false);
      }
    };
    const onKey = (e) => { if (e.key === 'Escape') setPortalsOpen(false); };
    document.addEventListener('pointerdown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [portalsOpen]);

  // Close both menus on navigation.
  useEffect(() => { setPortalsOpen(false); setOpen(false); }, [pathname]);

  const onPortal = PORTALS.some((p) => p.to === pathname);

  return (
    <header
      className={`sticky top-0 z-[1000] border-b transition-colors ${
        transparent
          ? 'border-white/5 bg-ink-950/70 backdrop-blur-xl'
          : 'border-white/10 bg-ink-900'
      }`}
    >
      <nav className="container-x flex h-16 items-center justify-between">
        <Link to="/" className="group flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500/15 ring-1 ring-brand-500/30 transition-transform duration-500 group-hover:rotate-[24deg]">
            <Compass className="h-5 w-5 text-brand-400" strokeWidth={1.75} />
          </span>
          <span className="text-[15px] font-bold tracking-tight text-white">ISU-GeoBot</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {pathname === '/' &&
            links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-lg px-3 py-2 text-sm text-ink-300 transition-colors hover:bg-white/5 hover:text-white"
              >
                {l.label}
              </a>
            ))}

          <div ref={portalsRef} className="relative">
            <button
              onClick={() => setPortalsOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={portalsOpen}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                portalsOpen || onPortal
                  ? 'bg-white/5 text-white'
                  : 'text-ink-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              Portals
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  portalsOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {portalsOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-10 mt-2 w-72 origin-top-right animate-fade-up rounded-xl border border-white/10 bg-ink-900 p-1.5 shadow-2xl shadow-black/50"
              >
                {PORTALS.map((p) => (
                  <Link
                    key={p.to}
                    to={p.to}
                    role="menuitem"
                    className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                      pathname === p.to
                        ? 'bg-brand-500/10 text-white'
                        : 'text-ink-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <p.icon
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        p.primary ? 'text-brand-400' : 'text-ink-500'
                      }`}
                      strokeWidth={1.75}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{p.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-ink-600">
                        {p.hint}
                      </span>
                    </span>
                  </Link>
                ))}
                <p className="border-t border-white/10 px-3 pb-1 pt-2.5 text-[11px] leading-relaxed text-ink-600">
                  Sign-in required. Accounts are issued by the researchers.
                </p>
              </div>
            )}
          </div>

          <Link to="/app" className="btn-primary shine ml-2 !px-4 !py-2">
            Launch Assistant
          </Link>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg p-2 text-ink-300 md:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-white/10 bg-ink-900 px-5 py-3 md:hidden">
          {pathname === '/' &&
            links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm text-ink-300"
              >
                {l.label}
              </a>
            ))}

          <p className="mt-3 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-600">
            Portals
          </p>
          {PORTALS.map((p) => (
            <Link
              key={p.to}
              to={p.to}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm ${
                pathname === p.to ? 'bg-brand-500/10 text-white' : 'text-ink-300'
              }`}
            >
              <p.icon
                className={`h-4 w-4 shrink-0 ${p.primary ? 'text-brand-400' : 'text-ink-500'}`}
                strokeWidth={1.75}
              />
              {p.label}
            </Link>
          ))}

          <Link to="/app" className="btn-primary mt-3 w-full" onClick={() => setOpen(false)}>
            Launch Assistant
          </Link>
        </div>
      )}
    </header>
  );
}
```

---

### `web/src/components/shared/Footer.jsx`
```javascript
import { Link } from 'react-router-dom';
import { Compass, ShieldCheck, ClipboardCheck, Settings2 } from 'lucide-react';

/**
 * Audit Section 10.3. Every claim here is in FUTURE TENSE where it refers to
 * something not yet measured. The thesis is a proposal: Chapters 4 and 5 do not
 * exist, no model has been trained, and no evaluation has been run. Tense is
 * the tell - present tense on an unmeasured claim reads as a result.
 */
export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink-950">
      <div className="container-x py-12">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500/15 ring-1 ring-brand-500/30">
                <Compass className="h-4 w-4 text-brand-400" strokeWidth={1.75} />
              </span>
              <span className="font-bold text-white">ISU-GeoBot</span>
            </div>
            <p className="prose-muted mt-3 max-w-xs text-sm">
              A web-based campus navigation assistant integrating an Enhanced RAG
              architecture for faculty availability classification.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white">Portals</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to="/app" className="text-ink-400 transition-colors hover:text-brand-400">
                  Assistant &amp; Campus Map
                </Link>
              </li>
              <li>
                <Link to="/guard" className="inline-flex items-center gap-1.5 text-ink-400 transition-colors hover:text-brand-400">
                  <ShieldCheck className="h-3.5 w-3.5" /> Security Presence Dashboard
                </Link>
              </li>
              <li>
                <Link to="/validate" className="inline-flex items-center gap-1.5 text-ink-400 transition-colors hover:text-brand-400">
                  <ClipboardCheck className="h-3.5 w-3.5" /> Faculty Portal
                </Link>
              </li>
              <li>
                <Link to="/admin" className="inline-flex items-center gap-1.5 text-ink-400 transition-colors hover:text-brand-400">
                  <Settings2 className="h-3.5 w-3.5" /> Campus Location Manager
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white">Academic Notice</h4>
            <p className="prose-muted mt-3 text-sm">
              ISU-GeoBot is an undergraduate research prototype developed for a
              thesis in partial fulfillment of the BSCS (Data Mining Track) at
              Isabela State University, Echague Main Campus. It is not an
              official university service.
            </p>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6">
          <p className="text-xs leading-relaxed text-ink-600">
            <strong className="text-ink-400">Evaluation status:</strong> the
            system will be evaluated using the RAGAS framework against a
            standard RAG baseline, and its availability estimates will be
            validated by selected faculty members across at least five academic
            departments. No evaluation results have been published for this
            deployment.
          </p>
          <p className="mt-3 text-xs text-ink-600">
            &copy; {new Date().getFullYear()} Michael Allan Almario &amp;
            Christian Paul Simbulan &middot; College of Computing Studies,
            Information and Communication Technology &middot; Isabela State
            University &ndash; Echague
          </p>
        </div>
      </div>
    </footer>
  );
}
```

---

### `web/src/components/shared/DemoBanner.jsx`
```javascript
import { useEffect, useState } from 'react';
import { FlaskConical, X } from 'lucide-react';
import { api } from '../../lib/api.js';

/**
 * Persistent demonstration-mode banner.
 *
 * Audit R5/R6/R8. In demo mode three things are stand-ins:
 *
 *   · availability comes from a deterministic schedule lookup, NOT a trained
 *     Random Forest — no model has been trained, so there is nothing to serve;
 *   · answers are composed from templates over retrieved text, NOT generated
 *     by Llama 3.1 8B;
 *   · campus locations, faculty and documents are placeholders.
 *
 * The banner is dismissible per session but reappears on reload, and the
 * disclosure is repeated in the assistant footer and on every status chip.
 * The failure this guards against is mundane and real: a screenshot taken
 * during a demo ending up in a slide deck or a thesis draft, where it becomes
 * indistinguishable from a result.
 */
export default function DemoBanner() {
  const [info, setInfo] = useState(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    api.health()
      .then((h) => { if (h.demoMode) setInfo(h); })
      .catch(() => { /* API down — the affected views report it themselves */ });
  }, []);

  if (!info || hidden) return null;

  return (
    <div className="relative z-[1100] border-b border-amber-500/30 bg-amber-500/10">
      <div className="container-x flex items-start gap-3 py-2.5">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" strokeWidth={1.75} />
        <p className="flex-1 text-xs leading-relaxed text-amber-100/90">
          <strong className="font-semibold text-amber-300">Demonstration mode.</strong>{' '}
          Availability is produced by a deterministic schedule lookup, not a
          trained Random Forest. Replies are composed from templates over
          retrieved text, not generated by Llama&nbsp;3.1&nbsp;8B. Campus,
          faculty and document data are placeholders.{' '}
          <span className="text-amber-200/70">
            Nothing shown here is a research result.
          </span>
        </p>
        <button
          onClick={() => setHidden(true)}
          aria-label="Dismiss notice"
          className="shrink-0 rounded p-1 text-amber-400/70 transition-colors hover:text-amber-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
```

---

### `web/src/components/shared/StatusChip.jsx`
```javascript
import { STATUS } from '../../lib/constants.js';

/**
 * Availability status display.
 *
 * Three things this component does deliberately:
 *
 *  - Shows the "Estimated" qualifier. Audit 4.3 treats this as a PRIVACY
 *    CONTROL, not decoration: a user who reads "In Scheduled Class" as fact is
 *    being told something more precise than the system actually knows, and the
 *    thesis's entire ethical posture is that these are estimates.
 *  - Shows a freshness timestamp, because the system claims "real-time" while
 *    its inputs are a static schedule and asynchronous guard logs (audit AMB-6).
 *  - Shows NO confidence value, percentage or High/Medium/Low badge (audit A11).
 */
export default function StatusChip({ code, label, asOf, compact = false }) {
  const meta = STATUS[code];
  if (!meta) return null;
  const Icon = meta.icon;

  const time = asOf
    ? new Date(asOf).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;

  if (compact) {
    return (
      <span className={`chip ${meta.tone}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
        {label ?? meta.label}
      </span>
    );
  }

  return (
    <div className={`rounded-xl border px-4 py-3 ${meta.tone}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{label ?? meta.label}</p>
          <p className="mt-0.5 text-xs opacity-70">
            Estimated{time ? ` as of ${time}` : ''} &middot; schedule-derived, not observed
          </p>
        </div>
      </div>
    </div>
  );
}
```

---

### `web/src/components/shared/PortalLogin.jsx`
```javascript
import { useState } from 'react';
import { Loader2, LogIn } from 'lucide-react';
import { DEMO_AUTH, signIn } from '../../lib/supabase.js';

/**
 * Sign-in for the guard and validator portals.
 *
 * Audit §7.2: NO self-registration. Accounts are provisioned manually by the
 * researchers. The guard population is small, known and fixed for the
 * evaluation period, and self-registration on the dashboard that writes to the
 * presence log would be an open door to the most sensitive table in the system.
 *
 * A shared PIN was explicitly rejected: it destroys `logged_by` accountability,
 * which is the only thing making the presence log defensible as research
 * evidence.
 */
export default function PortalLogin({ title, description, icon: Icon, onSession }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSession(await signIn(email, password));
    } catch (err) {
      setError(err.message ?? 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-5 py-12">
      <div className="card w-full max-w-sm p-7">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/15 ring-1 ring-brand-500/30">
          <Icon className="h-5 w-5 text-brand-400" strokeWidth={1.75} />
        </span>
        <h1 className="mt-4 text-xl font-bold text-white">{title}</h1>
        <p className="prose-muted mt-2 text-sm">{description}</p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <div>
            <label htmlFor="email" className="text-xs font-medium text-ink-400">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-950 px-3.5 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-xs font-medium text-ink-400">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-950 px-3.5 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            Sign in
          </button>
        </form>

        {DEMO_AUTH ? (
          <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
              Demonstration accounts
            </p>
            <ul className="mt-2 space-y-1 font-mono text-[11px] text-amber-100/80">
              <li>student@demo.local &middot; demo</li>
              <li>faculty@demo.local &middot; demo</li>
              <li>guard@demo.local &middot; demo</li>
              <li>admin@demo.local &middot; demo</li>
            </ul>
            <p className="mt-2 text-[11px] leading-relaxed text-amber-200/60">
              These exist only while the server runs in demonstration mode. Real
              accounts are provisioned by the researchers through Supabase.
            </p>
          </div>
        ) : (
          <p className="mt-5 border-t border-white/10 pt-4 text-[11px] leading-relaxed text-ink-600">
            Accounts are issued by the researchers. There is no self-registration
            for this portal.
          </p>
        )}
      </div>
    </div>
  );
}
```

---

### `web/src/components/shared/Loading.jsx`
```javascript
import { Compass } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950">
      <div className="flex flex-col items-center gap-3 text-ink-400">
        <Compass className="h-8 w-8 animate-spin text-brand-500" strokeWidth={1.5} />
        <p className="text-sm">Loading ISU-GeoBot...</p>
      </div>
    </div>
  );
}
```

---

# 5. Landing Page Components

### `web/src/components/landing/Landing.jsx`
```javascript
import Nav from '../shared/Nav.jsx';
import DemoBanner from '../shared/DemoBanner.jsx';
import Footer from '../shared/Footer.jsx';
import Hero from './Hero.jsx';
import DemoWidget from './DemoWidget.jsx';
import Architecture from './Architecture.jsx';
import PoiGrid from './PoiGrid.jsx';
import Privacy from './Privacy.jsx';
import Research from './Research.jsx';

export default function Landing() {
  return (
    <div className="min-h-screen bg-ink-950">
      <Nav transparent />
      <DemoBanner />
      <main>
        <Hero />
        <DemoWidget />
        <Architecture />
        <PoiGrid />
        <Privacy />
        <Research />
      </main>
      <Footer />
    </div>
  );
}
```

---

### `web/src/components/landing/Hero.jsx`
```javascript
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, Navigation, ShieldCheck, Sparkles } from 'lucide-react';
import { useParallax, useReveal, useTilt } from '../../hooks/useMotion.js';
import CampusField from './CampusField.jsx';
import StatusChip from '../shared/StatusChip.jsx';

/**
 * Hero.
 *
 * WORDING RULES (audit Section 10.3) — these outrank the visual design.
 *
 * The thesis is a PROPOSAL. Chapters 4 and 5 do not exist, no model has been
 * trained, no comparison has been run. So nothing here claims a result:
 *
 *   NOT "94% accurate"               -> no numbers at all until measured
 *   NOT "outperforms standard RAG"   -> that is the study's hypothesis
 *   NOT "validated by 15 faculty"    -> validation has not happened
 *   NOT "real-time faculty tracking" -> "tracking" is the word the thesis avoids
 *
 * Capability claims are present tense (the system does retrieve, does classify).
 * Outcome claims are future tense (it WILL be evaluated). Tense is the tell,
 * and it is the single easiest thing for a panelist to catch.
 *
 * DEPTH BUDGET. Five parallax planes, back to front: aurora, node field,
 * perspective floor, copy, floating cards. Each moves at a different rate so
 * the scene reads as space rather than as a stack of images.
 */
export default function Hero() {
  const [copyRef, copyIn] = useReveal({ threshold: 0.1 });
  const floorRef = useParallax(28);
  const cardA = useTilt({ max: 9 });
  const cardB = useTilt({ max: 9 });

  return (
    <section className="relative isolate overflow-hidden">
      {/* plane 1 — aurora */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="aurora left-1/2 top-[-18rem] h-[38rem] w-[38rem] -translate-x-1/2 bg-brand-500/[0.20]" />
        <div className="aurora right-[-8rem] top-[8rem] h-[26rem] w-[26rem] bg-sky-500/[0.11]"
             style={{ animationDelay: '-7s' }} />
        <div className="aurora bottom-[-12rem] left-[-6rem] h-[30rem] w-[30rem] bg-emerald-400/[0.10]"
             style={{ animationDelay: '-13s' }} />
      </div>

      {/* plane 2 — projected 3D node field */}
      <CampusField className="opacity-100" />

      {/* plane 3 — perspective floor */}
      <div aria-hidden ref={floorRef} className="pointer-events-none absolute inset-0 parallax">
        <div className="grid-floor" />
      </div>

      {/* vignette so the copy always wins on contrast */}
      <div aria-hidden
           className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_58%_46%_at_50%_44%,transparent,rgba(2,6,23,.55))]" />

      <div className="container-x relative py-24 sm:py-28 lg:py-36">
        <div ref={copyRef} className={`stagger mx-auto max-w-3xl text-center`}>
          <div className={`reveal ${copyIn ? 'is-in' : ''} flex flex-wrap items-center justify-center gap-2`}
               style={{ '--i': 0 }}>
            <span className="chip border-brand-500/30 bg-brand-500/10 text-brand-300 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" /> Enhanced RAG Architecture
            </span>
            <span className="chip border-white/15 bg-white/5 text-ink-300 backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5" /> Privacy-Preserving AI
            </span>
            <span className="chip border-white/15 bg-white/5 text-ink-300 backdrop-blur">
              <MapPin className="h-3.5 w-3.5" /> ISU Echague Main Campus
            </span>
          </div>

          <h1 className={`reveal ${copyIn ? 'is-in' : ''} mt-8 text-[2.6rem] font-extrabold leading-[1.06] tracking-tight text-white sm:text-6xl lg:text-[4.25rem]`}
              style={{ '--i': 1 }}>
            Find your way around campus
            <span className="mt-1 block text-gradient">and know before you go.</span>
          </h1>

          <p className={`reveal ${copyIn ? 'is-in' : ''} prose-muted mx-auto mt-7 max-w-2xl text-base sm:text-lg`}
             style={{ '--i': 2 }}>
            ISU-GeoBot combines an interactive campus map, retrieval over official
            university documents, and a Random Forest classifier that estimates
            faculty availability &mdash; without ever disclosing where a faculty
            member physically is.
          </p>

          <div className={`reveal ${copyIn ? 'is-in' : ''} mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row`}
               style={{ '--i': 3 }}>
            <Link to="/app" className="btn-primary shine ring-glow group w-full sm:w-auto">
              Launch Assistant
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <a href="#explore" className="btn-ghost shine w-full sm:w-auto">
              Explore Campus Map
            </a>
          </div>
        </div>

        {/* plane 5 — floating specimen cards, tilting under the pointer */}
        <div className="scene mx-auto mt-16 grid max-w-4xl gap-5 sm:grid-cols-2">
          <div
            ref={cardA.ref}
            {...cardA.handlers}
            className={`reveal reveal-scale ${copyIn ? 'is-in' : ''} tilt tilt-glare card animate-float relative p-5`}
            style={{ '--i': 4, animationDelay: '-1.5s' }}
          >
            <div className="layer-1">
              <div className="flex items-center gap-2 text-ink-500">
                <Navigation className="h-3.5 w-3.5" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Campus navigation
                </span>
              </div>
              <p className="mt-3 text-sm font-medium text-white">
                &ldquo;Where is the College of Computing Studies?&rdquo;
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-400">
                Answered from the same retrieval pipeline as every other
                question, then highlighted on the interactive map.
              </p>
            </div>
          </div>

          <div
            ref={cardB.ref}
            {...cardB.handlers}
            className={`reveal reveal-scale ${copyIn ? 'is-in' : ''} tilt tilt-glare card animate-float relative p-5`}
            style={{ '--i': 5 }}
          >
            <div className="layer-1">
              <div className="flex items-center gap-2 text-ink-500">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Faculty availability
                </span>
              </div>
              <p className="mt-3 text-sm font-medium text-white">
                &ldquo;Is Prof. Santos free right now?&rdquo;
              </p>
              <div className="mt-3">
                {/* An illustration of the OUTPUT SHAPE, not a live reading:
                    a generalized status, marked as an estimate, with no
                    confidence figure and no location. */}
                <StatusChip
                  code="in_scheduled_class"
                  label="In Scheduled Class / Lecture"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Audit R6-R12: where a "94% accurate" badge would normally go. */}
        <p className={`reveal ${copyIn ? 'is-in' : ''} mx-auto mt-12 max-w-xl text-center text-xs leading-relaxed text-ink-600`}
           style={{ '--i': 6 }}>
          Undergraduate thesis research. The Enhanced RAG architecture will be
          evaluated against a standard RAG baseline using the RAGAS framework,
          and its availability estimates will be validated by selected faculty
          members. No results have been published yet.
        </p>
      </div>
    </section>
  );
}
```

---

### `web/src/components/landing/CampusField.jsx`
```javascript
import { useEffect, useRef } from 'react';
import { usePointer, usePrefersReducedMotion } from '../../hooks/useMotion.js';

/**
 * A slowly rotating 3D field of connected nodes behind the hero.
 *
 * Real perspective projection — points live in a 3D box, rotate about the Y
 * axis, and are projected with `s = fov / (fov + z)` so nearer nodes are
 * larger, brighter and move further under parallax. Depth is genuine, not a
 * stack of blurred layers.
 *
 * WHY NOT THREE.JS. A WebGL scene would cost roughly 600 KB of JavaScript and
 * a GPU context for something that is decorative. The thesis specifies an
 * i5 / 8 GB development machine (§3.7 Table 2), and the defense will likely run
 * through a projector on exactly that class of hardware. This draws ~90 nodes
 * on a 2D canvas at a capped frame rate and costs about 1 % CPU — it will not
 * be the reason a demo stutters.
 *
 * The imagery is not arbitrary: a connected field of points is what the system
 * actually is — campus locations linked by retrieval similarity.
 */

const NODES = 120;
const FOV = 320;
const LINK_DIST = 128;

export default function CampusField({ className = '' }) {
  const canvasRef = useRef(null);
  const pointer = usePointer();
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });

    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let running = true;

    // Cap the backing store at 2x. On a 3x phone the extra pixels are
    // invisible and cost 2.25x the fill rate.
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      width = r.width;
      height = r.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const rand = (a, b) => a + Math.random() * (b - a);
    const nodes = Array.from({ length: NODES }, () => ({
      x: rand(-260, 260),
      y: rand(-170, 170),
      z: rand(-190, 190),
      r: rand(0.9, 2.4),
      // A tenth of the nodes are emerald "anchors" — visually these read as the
      // campus buildings among the ambient points.
      accent: Math.random() < 0.12,
      drift: rand(0.0004, 0.0016),
      phase: rand(0, Math.PI * 2),
    }));

    // Pause when off-screen or on a hidden tab. An animation nobody can see
    // still burns battery.
    const io = new IntersectionObserver(([e]) => { running = e.isIntersecting; });
    io.observe(canvas);
    const onVisibility = () => { running = !document.hidden; };
    document.addEventListener('visibilitychange', onVisibility);

    let t = 0;
    let camX = 0;
    let camY = 0;

    const project = (n, cos, sin) => {
      const x = n.x * cos - n.z * sin;
      const z = n.x * sin + n.z * cos;
      const s = FOV / (FOV + z + 260);
      return {
        sx: width / 2 + (x + camX * 26) * s,
        sy: height / 2 + (n.y + camY * 18) * s,
        s,
        z,
      };
    };

    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (!running) return;

      t += 0.0016;
      // Ease the camera toward the pointer so motion feels weighted rather
      // than snapping frame to frame.
      camX += (pointer.current.x - camX) * 0.045;
      camY += (pointer.current.y - camY) * 0.045;

      ctx.clearRect(0, 0, width, height);

      const cos = Math.cos(t);
      const sin = Math.sin(t);

      const pts = nodes.map((n) => {
        const bob = Math.sin(t * 6 + n.phase) * 8;
        return { n, ...project({ ...n, y: n.y + bob }, cos, sin) };
      });
      // Painter's algorithm: far nodes first so near ones overlap correctly.
      pts.sort((a, b) => b.z - a.z);

      // Links. Only forward pairs, and only when both ends are near the
      // camera — O(n²) over 90 nodes is fine, but drawing 4000 faint lines is
      // not, so distance culls most of them before any stroke happens.
      ctx.lineWidth = 1;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        if (a.s < 0.55) continue;
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j];
          if (b.s < 0.55) continue;
          const dx = a.sx - b.sx;
          const dy = a.sy - b.sy;
          const d2 = dx * dx + dy * dy;
          if (d2 > LINK_DIST * LINK_DIST) continue;
          const alpha = (1 - Math.sqrt(d2) / LINK_DIST) * 0.30 * a.s * b.s;
          ctx.strokeStyle = a.n.accent || b.n.accent
            ? `rgba(16,185,129,${alpha * 1.8})`
            : `rgba(148,163,184,${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b.sx, b.sy);
          ctx.stroke();
        }
      }

      for (const p of pts) {
        const alpha = Math.min(1, p.s * p.s) * (p.n.accent ? 1 : 0.72);
        const radius = p.n.r * p.s * 1.5;
        if (p.n.accent) {
          const g = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, radius * 7);
          g.addColorStop(0, `rgba(52,211,153,${alpha * 0.6})`);
          g.addColorStop(1, 'rgba(52,211,153,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, radius * 7, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = p.n.accent
          ? `rgba(52,211,153,${alpha})`
          : `rgba(203,213,225,${alpha})`;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    // Reduced motion still gets the field — it is depth, not movement — but
    // rendered once and left still.
    if (reduced) {
      const cos = Math.cos(0.4);
      const sin = Math.sin(0.4);
      ctx.clearRect(0, 0, width, height);
      for (const n of nodes) {
        const p = project(n, cos, sin);
        ctx.fillStyle = n.accent
          ? `rgba(52,211,153,${Math.min(1, p.s * p.s) * 0.9})`
          : `rgba(203,213,225,${Math.min(1, p.s * p.s) * 0.45})`;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, n.r * p.s * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      raf = requestAnimationFrame(draw);
    }

    const onResize = () => { resize(); };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
    };
  }, [pointer, reduced]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
```

---

### `web/src/components/landing/DemoWidget.jsx`
```javascript
import { useEffect, useState } from 'react';
import {
  AlertCircle, ArrowRight, Boxes, FileText, GitCompare, Loader2, Play, Shield,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import StatusChip from '../shared/StatusChip.jsx';
import { useReveal } from '../../hooks/useMotion.js';

/**
 * Interactive Standard vs Enhanced comparison.
 *
 * This is the single best demonstration of the study's contribution: it shows,
 * side by side, what injecting the masked availability status into Context
 * Fusion actually changes about the answer.
 *
 * WHY IT ONLY ACCEPTS CURATED QUERIES (audit F-16 + F-29).
 *
 * The natural implementation is a free-text box with a Standard/Enhanced
 * toggle. Two problems with that:
 *
 *   1. `mode` becomes client-controlled on a public endpoint. Anyone can drive
 *      the baseline arm, and evaluation runs stop being distinguishable from
 *      live traffic in the logs.
 *   2. It reopens the aggregation surface: an unrestricted availability query
 *      box can be polled to reconstruct a named person's presence timeline,
 *      which status masking does nothing to prevent.
 *
 * A curated allowlist keeps the demonstration and closes both. The server
 * resolves the query id to text; the client never sends free text here.
 */
export default function DemoWidget() {
  const [queries, setQueries] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [headRef, headIn] = useReveal();

  useEffect(() => {
    api.demoQueries()
      .then((d) => {
        setQueries(d.queries ?? []);
        setActiveId(d.queries?.[0]?.id ?? null);
      })
      .catch(() => setError('demo_unavailable'));
  }, []);

  async function run() {
    if (!activeId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api.demoCompare(activeId));
    } catch (err) {
      setError(err.code === 'service_unavailable' ? 'backend_down' : 'failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="explore" className="border-y border-white/10 bg-ink-900/40 py-20 sm:py-24">
      <div className="container-x">
        <div ref={headRef} className={`reveal ${headIn ? 'is-in' : ''} mx-auto max-w-2xl text-center`}>
          <p className="eyebrow">Live comparison</p>
          <h2 className="h-section mt-3">See what Context Fusion adds</h2>
          <p className="prose-muted mx-auto mt-4 max-w-xl">
            Both pipelines use the same retriever, the same top-K, the same
            model and the same prompt. The only difference is whether the masked
            availability status is fused into the context.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-5xl">
          {/* query picker */}
          <div className="flex flex-wrap justify-center gap-2">
            {queries.map((q) => (
              <button
                key={q.id}
                onClick={() => { setActiveId(q.id); setResult(null); }}
                className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-300 ${
                  activeId === q.id
                    ? 'scale-105 border-brand-500/50 bg-brand-500/10 text-brand-300 shadow-lg shadow-brand-500/10'
                    : 'border-white/10 bg-ink-900/60 text-ink-300 hover:-translate-y-0.5 hover:border-white/25 hover:text-white'
                }`}
              >
                {q.label}
              </button>
            ))}
            {!queries.length && !error && (
              <div className="h-11 w-72 animate-pulse rounded-xl bg-ink-800" />
            )}
          </div>

          {error && (
            <div className="mx-auto mt-6 flex max-w-lg items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <p className="text-sm text-amber-200/90">
                The live demo is not reachable right now. The comparison runs
                against the deployed pipeline, so it needs the API, the ML
                service and a configured LLM endpoint to be running.
              </p>
            </div>
          )}

          {activeId && !error && (
            <div className="mt-6 text-center">
              <button onClick={run} disabled={loading} className="btn-primary shine ring-glow">
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Running both pipelines...</>
                ) : (
                  <><Play className="h-4 w-4" /> Run comparison</>
                )}
              </button>
            </div>
          )}

          {result && (
            <div className="mt-10 animate-fade-up">
              <p className="mb-5 text-center text-sm text-ink-400">
                <span className="text-ink-600">Query:</span>{' '}
                <span className="font-medium text-white">&ldquo;{result.query}&rdquo;</span>
              </p>

              <div className="grid gap-5 lg:grid-cols-2">
                <Arm
                  title="Standard RAG"
                  subtitle="retrieval + LLM"
                  data={result.standard}
                  accent="border-white/10"
                />
                <Arm
                  title="Enhanced RAG"
                  subtitle="retrieval + Random Forest + LLM"
                  data={result.enhanced}
                  accent="border-brand-500/30"
                  highlight
                />
              </div>

              {/* Context Fusion breakdown */}
              <div className="card mt-5 p-5">
                <div className="flex items-center gap-2">
                  <GitCompare className="h-4 w-4 text-brand-400" />
                  <h4 className="text-sm font-semibold text-white">
                    Context Fusion breakdown
                  </h4>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Metric
                    icon={FileText}
                    label="Document chunks retrieved"
                    value={result.fusion.retrievedChunks}
                    note="identical in both arms"
                  />
                  <Metric
                    icon={Shield}
                    label="Masked status injected"
                    value={result.fusion.statusInjected ? 'Yes' : 'No'}
                    note={result.fusion.statusLabel ?? 'not an availability query'}
                  />
                  <Metric
                    icon={Boxes}
                    label="Total context items"
                    value={result.fusion.contextItems}
                    note="what RAGAS scores"
                  />
                </div>
                <p className="mt-4 border-t border-white/10 pt-3 text-xs leading-relaxed text-ink-600">
                  {result.timingNote} Response Time is reported from interleaved
                  evaluation runs (median and p95), not from a single
                  demonstration request.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Arm({ title, subtitle, data, accent, highlight }) {
  return (
    <div className={`card p-5 transition-transform duration-500 ${accent} ${
      highlight ? 'bg-brand-500/[0.03] lg:scale-[1.02]' : ''
    }`}>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className={`text-sm font-bold ${highlight ? 'text-brand-300' : 'text-white'}`}>
            {title}
          </h3>
          <p className="mt-0.5 font-mono text-[11px] text-ink-600">{subtitle}</p>
        </div>
        {highlight && (
          <span className="chip border-brand-500/30 bg-brand-500/10 text-brand-300">
            this study
          </span>
        )}
      </div>

      {data.status && (
        <div className="mt-4">
          <StatusChip code={data.status.code} label={data.status.label} asOf={data.status.asOf} />
        </div>
      )}

      <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink-200">
        {data.answer}
      </p>

      {data.sources?.length > 0 && (
        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-600">
            Grounded in
          </p>
          <ul className="mt-2 space-y-1">
            {data.sources.map((s, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-ink-400">
                <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-ink-600" />
                {s.title}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value, note }) {
  return (
    <div className="rounded-xl border border-white/10 bg-ink-950/50 p-4">
      <div className="flex items-center gap-2 text-ink-400">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-2 text-xl font-bold text-white">{value}</p>
      <p className="mt-0.5 text-[11px] text-ink-600">{note}</p>
    </div>
  );
}
```

---

### `web/src/components/landing/PoiGrid.jsx`
```javascript
import { useEffect, useMemo, useState } from 'react';
import { Building2, FlaskConical, GraduationCap, Landmark, Library, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useReveal } from '../../hooks/useMotion.js';
import { POI_CATEGORIES } from '../../lib/constants.js';

const ICONS = {
  college: GraduationCap,
  administrative: Landmark,
  laboratory: FlaskConical,
  library: Library,
  facility: Building2,
  landmark: MapPin,
  other: MapPin,
};

/**
 * Category-filtered campus highlights.
 *
 * Audit R4 / F-38: placeholder coordinates are surfaced with a visible [DEMO]
 * marker (applied server-side) and an explicit badge here. If a screenshot of
 * synthetic data ends up in the thesis, it must be self-evidently synthetic.
 */
export default function PoiGrid() {
  const [pois, setPois] = useState([]);
  const [filter, setFilter] = useState('all');
  const [state, setState] = useState('loading');
  const [gridRef, gridIn] = useReveal({ threshold: 0.05 });

  useEffect(() => {
    api.pois()
      .then((d) => { setPois(d.pois ?? []); setState('ready'); })
      .catch(() => setState('error'));
  }, []);

  const shown = useMemo(
    () => (filter === 'all' ? pois : pois.filter((p) => p.type === filter)),
    [pois, filter],
  );

  const available = useMemo(
    () => POI_CATEGORIES.filter(
      (c) => c.key === 'all' || pois.some((p) => p.type === c.key),
    ),
    [pois],
  );

  return (
    <section className="border-y border-white/10 bg-ink-900/40 py-20 sm:py-24">
      <div className="container-x">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Campus coverage</p>
          <h2 className="h-section mt-3">Buildings, offices and points of interest</h2>
          <p className="prose-muted mx-auto mt-4 max-w-xl">
            Each location carries contextual metadata &mdash; department, building
            function, description &mdash; and a generated place-card that is
            embedded into the retrieval corpus so navigation questions are
            answered from the same pipeline as everything else.
          </p>
        </div>

        {state === 'ready' && pois.length > 0 && (
          <div className="mt-9 flex flex-wrap justify-center gap-2">
            {available.map((c) => (
              <button
                key={c.key}
                onClick={() => setFilter(c.key)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                  filter === c.key
                    ? 'border-brand-500/50 bg-brand-500/10 text-brand-300'
                    : 'border-white/10 bg-ink-900/60 text-ink-400 hover:border-white/25 hover:text-white'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        <div ref={gridRef} className="stagger mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {state === 'loading' &&
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-ink-800/60" />
            ))}

          {state === 'ready' &&
            shown.map((poi, i) => {
              const Icon = ICONS[poi.type] ?? MapPin;
              return (
                <article key={poi.id}
                         style={{ '--i': i % 9 }}
                         className={`reveal reveal-scale ${gridIn ? 'is-in' : ''} card card-hover ring-glow group relative p-5 transition-transform duration-300 hover:-translate-y-1`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/10 ring-1 ring-brand-500/20 transition-transform duration-300 group-hover:scale-110">
                      <Icon className="h-5 w-5 text-brand-400" strokeWidth={1.75} />
                    </span>
                    {poi.isSynthetic && (
                      <span className="chip border-amber-500/30 bg-amber-500/10 text-amber-300">
                        placeholder data
                      </span>
                    )}
                  </div>

                  <h3 className="mt-4 font-semibold leading-snug text-white">{poi.name}</h3>
                  {poi.department && (
                    <p className="mt-1 text-xs text-brand-400">{poi.department}</p>
                  )}
                  {poi.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-ink-400">{poi.description}</p>
                  )}

                  <Link
                    to={`/app?poi=${poi.id}`}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-400 transition-colors hover:text-brand-300"
                  >
                    <MapPin className="h-3.5 w-3.5" /> Locate on map
                  </Link>
                </article>
              );
            })}
        </div>

        {state === 'ready' && pois.length === 0 && (
          <div className="card mx-auto mt-8 max-w-lg p-8 text-center">
            <MapPin className="mx-auto h-8 w-8 text-ink-600" strokeWidth={1.5} />
            <p className="mt-3 font-medium text-white">No campus locations yet</p>
            <p className="prose-muted mt-2 text-sm">
              Coordinates are collected through an on-site GPS survey of the ISU
              Echague Main Campus and verified against physical landmarks before
              they are loaded.
            </p>
          </div>
        )}

        {state === 'error' && (
          <p className="mt-8 text-center text-sm text-ink-600">
            Campus locations could not be loaded. The API may not be running.
          </p>
        )}
      </div>
    </section>
  );
}
```

---

### `web/src/components/landing/Architecture.jsx`
```javascript
import { useState } from 'react';
import {
  Brain, Database, MessageSquareText, Route, ShieldCheck, Sparkles,
} from 'lucide-react';
import { useReveal, useTilt } from '../../hooks/useMotion.js';

/**
 * Interactive walkthrough of the pipeline (thesis §3.5, Figure 6).
 *
 * The masking boundary is presented as its own stage rather than as a footnote,
 * because that is architecturally what it is: the chokepoint every
 * faculty-availability value must pass through, enforcing an allowlist on the
 * way in and a location-leak filter on the way out.
 */
const STAGES = [
  {
    id: 'route',
    icon: Route,
    title: 'Query Routing',
    tag: 'deterministic',
    body:
      'A gazetteer built from the consented faculty roster, plus an intent lexicon, decides one thing: does this query need an availability status? Retrieval happens either way, so routing stays a single binary decision.',
    detail:
      'Deterministic rather than LLM-based: a database lookup answers in ~2ms where a classification call would spend 150-300ms of the Response Time budget the study has to report, and would make evaluation runs non-reproducible.',
  },
  {
    id: 'presence',
    icon: ShieldCheck,
    title: 'Presence Override',
    tag: 'tri-state',
    body:
      'Security personnel log arrivals and departures to an append-only event log. A guard-confirmed departure short-circuits the classifier entirely and returns Unavailable.',
    detail:
      'Three states, not two. "No log today" is not the same as "left campus" - it resolves to unknown and proceeds to the classifier, which is precisely the component meant to estimate presence when ground truth is absent.',
  },
  {
    id: 'rf',
    icon: Brain,
    title: 'Random Forest',
    tag: 'scikit-learn',
    body:
      'An ensemble classifier estimates one of three generalized availability statuses from temporal schedule features, institutional event flags and a pseudonymous faculty identifier.',
    detail:
      'The model never receives a name and never outputs a location. Its probability distribution is retained server-side for evaluation and is never sent to the language model or the browser.',
  },
  {
    id: 'mask',
    icon: ShieldCheck,
    title: 'Status Masking Boundary',
    tag: 'egress control',
    body:
      'The single chokepoint for availability data. Only one member of a closed three-value set may cross into Context Fusion; intermediates are purged; generated answers are scanned for location leakage before they are returned.',
    detail:
      'Enforceable invariant: no faculty-location-bearing value can reach the client, from any path. Verified by an adversarial test suite rather than asserted.',
  },
  {
    id: 'retrieve',
    icon: Database,
    title: 'Retrieval',
    tag: 'pgvector',
    body:
      'The query is embedded with all-MiniLM-L6-v2 and matched against institutional document chunks and campus place-cards by exact cosine similarity.',
    detail:
      'Exact nearest-neighbour search, no approximate index: at this corpus size an ANN index would trade retrieval recall for latency the system does not need, and Context Recall is a primary metric.',
  },
  {
    id: 'fuse',
    icon: Sparkles,
    title: 'Context Fusion',
    tag: 'the contribution',
    body:
      'Three sources merge into one structured prompt: the user query, the retrieved document chunks, and the masked availability status.',
    detail:
      'This is the only place the two pipelines differ. Standard and Enhanced share routing, retrieval, K, model, temperature and prompt skeleton - so any measured difference is attributable to fusion and nothing else.',
  },
  {
    id: 'generate',
    icon: MessageSquareText,
    title: 'Response Generation',
    tag: 'Llama 3.1 8B',
    body:
      'The fused prompt is sent to Llama 3.1 8B via the Groq API at temperature 0, constrained to answer only from the provided context.',
    detail:
      'Temperature 0 is a reproducibility requirement, not a style preference: evaluation runs have to be repeatable, and lower temperature reduces hallucination.',
  },
];

export default function Architecture() {
  const [active, setActive] = useState('mask');
  const stage = STAGES.find((s) => s.id === active);
  const [headRef, headIn] = useReveal();
  const [railRef, railIn] = useReveal({ threshold: 0.08 });
  const panel = useTilt({ max: 5 });

  return (
    <section id="architecture" className="relative py-20 sm:py-24">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="aurora left-[-10rem] top-1/3 h-[24rem] w-[24rem] bg-brand-500/[0.05]" />
      </div>
      <div className="container-x relative">
        <div ref={headRef}
             className={`reveal ${headIn ? 'is-in' : ''} mx-auto max-w-2xl text-center`}>
          <p className="eyebrow">System architecture</p>
          <h2 className="h-section mt-3">How a question becomes an answer</h2>
          <p className="prose-muted mx-auto mt-4 max-w-xl">
            A three-tier system: a React client, a Node.js application server
            holding the routing and privacy logic, and a Python microservice for
            machine learning inference.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          {/* pipeline rail */}
          <ol ref={railRef} className="stagger relative space-y-1">
            <span
              aria-hidden
              className="absolute left-[1.4rem] top-4 bottom-4 w-px bg-gradient-to-b from-brand-500/40 via-white/10 to-transparent"
            />
            {STAGES.map((s, i) => {
              const Icon = s.icon;
              const on = s.id === active;
              return (
                <li key={s.id}
                    className={`reveal ${railIn ? 'is-in' : ''}`}
                    style={{ '--i': i }}>
                  <button
                    onClick={() => setActive(s.id)}
                    className={`group relative flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left transition-all duration-300 ${
                      on ? 'translate-x-1 bg-brand-500/10' : 'hover:translate-x-1 hover:bg-white/5'
                    }`}
                    aria-current={on}
                  >
                    <span
                      className={`relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-all duration-300 ${
                        on
                          ? 'scale-110 border-brand-500/50 bg-brand-500/20 text-brand-300 shadow-lg shadow-brand-500/20'
                          : 'border-white/10 bg-ink-900 text-ink-400 group-hover:scale-105 group-hover:text-ink-100'
                      }`}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`block text-sm font-semibold ${on ? 'text-white' : 'text-ink-200'}`}
                      >
                        {i + 1}. {s.title}
                      </span>
                      <span className="mt-0.5 block font-mono text-[11px] text-ink-600">
                        {s.tag}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* detail panel */}
          <div className="scene lg:sticky lg:top-24 lg:self-start">
          <div ref={panel.ref} {...panel.handlers}
               className="tilt tilt-glare card relative p-6">
            <div className="flex items-center gap-2.5">
              <stage.icon className="h-5 w-5 text-brand-400" strokeWidth={1.75} />
              <h3 className="text-lg font-bold text-white">{stage.title}</h3>
            </div>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-200">{stage.body}</p>
            <div className="layer-1 mt-5 rounded-xl border border-white/10 bg-ink-950/60 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">
                Design note
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-400">{stage.detail}</p>
            </div>
          </div>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-2">
          {['React 18', 'Leaflet 1.9', 'Node.js 20', 'Express 4', 'Supabase',
            'pgvector', 'Python 3.11', 'scikit-learn 1.4', 'Flask',
            'all-MiniLM-L6-v2', 'Llama 3.1 8B', 'Groq', 'RAGAS'].map((t) => (
            <span key={t}
                  className="chip border-white/10 bg-ink-900 font-mono text-ink-400 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-500/40 hover:text-brand-300">
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
```

---

### `web/src/components/landing/Privacy.jsx`
```javascript
import { EyeOff, FileLock2, KeyRound, ScanLine, Timer, UserCheck } from 'lucide-react';
import { useReveal, useTilt } from '../../hooks/useMotion.js';

/**
 * Privacy and ethical safeguards.
 *
 * Audit F-25 governs the wording here. The thesis's §3.10 claim — "no
 * personally identifiable information of faculty members will be stored,
 * transmitted, or displayed" — is not true of the architecture it describes:
 * the system cannot answer "Is Prof. Santos available?" without storing faculty
 * identity, and the guard log is timestamped, person-linked presence data.
 *
 * So this section makes the DATA MINIMISATION claim instead, which is true,
 * stronger rhetorically, and defensible:
 *
 *   personal information is processed under a legitimate institutional purpose,
 *   identity is pseudonymised in the ML feature store, only a generalized
 *   status is disclosed, exact location is never derived or disclosed, and
 *   presence logs are restricted and retained only for the evaluation period.
 *
 * Note also what is NOT claimed: full RA 10173 compliance. Compliance is a
 * legal determination requiring a formal assessment, not a design property.
 */
const SAFEGUARDS = [
  {
    icon: EyeOff,
    title: 'Generalized status only',
    body:
      'The system reports one of three availability statuses. It never derives, stores, or discloses which room, floor or building a faculty member is in.',
  },
  {
    icon: ScanLine,
    title: 'Egress filtering',
    body:
      'Every generated answer that carries an availability status is scanned for location detail before it is returned. If the language model speculates about a room or a floor, the response is replaced.',
  },
  {
    icon: KeyRound,
    title: 'Pseudonymised training data',
    body:
      'Attendance-derived features reach the classifier under a surrogate identifier. The model never receives a name, and the identity map is held separately.',
  },
  {
    icon: UserCheck,
    title: 'Consent-gated roster',
    body:
      'Only faculty members who have given written informed consent can be asked about. Everyone else is outside the system’s answerable roster.',
  },
  {
    icon: Timer,
    title: 'Present-moment queries only',
    body:
      'No history and no forecasting. The assistant will not answer "was she in yesterday" or "when will she be free", because either would turn a generalized status into a movement profile.',
  },
  {
    icon: FileLock2,
    title: 'Restricted presence logs',
    body:
      'Security presence entries are append-only, scoped to the current day for the personnel who write them, and never reachable from the public assistant.',
  },
];

export default function Privacy() {
  const [headRef, headIn] = useReveal();
  const [gridRef, gridIn] = useReveal({ threshold: 0.05 });
  const boundary = useTilt({ max: 4 });

  return (
    <section id="privacy" className="relative py-20 sm:py-24">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="aurora right-[-8rem] top-1/4 h-[26rem] w-[26rem] bg-sky-500/[0.05]" />
      </div>
      <div className="container-x relative">
        <div ref={headRef} className={`reveal ${headIn ? 'is-in' : ''} mx-auto max-w-2xl text-center`}>
          <p className="eyebrow">Ethical design</p>
          <h2 className="h-section mt-3">Availability without surveillance</h2>
          <p className="prose-muted mx-auto mt-4 max-w-xl">
            Knowing whether a professor is free should not require knowing where
            they are. The Status Masking Protocol is the architectural boundary
            that keeps those two questions apart.
          </p>
        </div>

        {/* the boundary, drawn */}
        <div className="scene mx-auto mt-12 max-w-3xl">
        <div ref={boundary.ref} {...boundary.handlers}
             className="tilt tilt-glare card relative overflow-hidden">
          <div className="grid divide-y divide-white/10 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <div className="p-6">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-600">
                Stays inside the server
              </p>
              <ul className="mt-3 space-y-2 text-sm text-ink-400">
                {['Raw classifier output', 'Probability distribution',
                  'Schedule rows and room labels', 'Guard presence entries',
                  'Feature vectors'].map((x) => (
                  <li key={x} className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-ink-600" />{x}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-brand-500/[0.04] p-6">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">
                Crosses to the language model and the user
              </p>
              <ul className="mt-3 space-y-2 text-sm text-ink-200">
                {['Available for Consultation', 'In Scheduled Class / Lecture',
                  'Unavailable / Off-Schedule'].map((x) => (
                  <li key={x} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />{x}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-ink-500">
                One value from a closed set of three. Anything else is rejected
                at the boundary rather than substituted with a default.
              </p>
            </div>
          </div>
        </div>

        </div>

        <div ref={gridRef} className="stagger mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SAFEGUARDS.map((s, i) => (
            <div key={s.title}
                 style={{ '--i': i }}
                 className={`reveal reveal-scale ${gridIn ? 'is-in' : ''} card card-hover p-5 transition-transform duration-300 hover:-translate-y-1`}>
              <s.icon className="h-5 w-5 text-brand-400" strokeWidth={1.75} />
              <h3 className="mt-3 text-sm font-semibold text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-400">{s.body}</p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-ink-600">
          ISU-GeoBot is designed in accordance with the principles of Republic
          Act No. 10173 (Data Privacy Act of 2012), applying data minimisation
          and purpose limitation. This is a description of the system&rsquo;s
          design, not a claim of certified legal compliance.
        </p>
      </div>
    </section>
  );
}
```

---

### `web/src/components/landing/Research.jsx`
```javascript
import { useEffect, useState } from 'react';
import { BookOpen, FlaskConical, Target, Users } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useReveal } from '../../hooks/useMotion.js';

/**
 * Research context and evaluation status.
 *
 * THE RULE FOR THIS SECTION (audit Section 10.3, R6-R12):
 *
 * No numeric performance figure appears here — not as a placeholder, not in a
 * mockup, not as "lorem ipsum statistics". Placeholder numbers have a way of
 * surviving into screenshots, and a screenshot of a fabricated RAGAS score is
 * indistinguishable from a fabricated research result.
 *
 * When no evaluation has been run, this renders an EMPTY STATE that says so.
 * When real runs exist, it reports what was actually recorded and nothing more.
 *
 * Objectives are stated in the thesis's own future tense, because none of them
 * has been achieved yet.
 */
const OBJECTIVES = [
  {
    icon: FlaskConical,
    text:
      'To integrate a Random Forest classifier into the Retrieval-Augmented Generation pipeline to estimate real-time faculty availability from temporal schedule data.',
  },
  {
    icon: Target,
    text:
      'To evaluate and compare the standard and Enhanced RAG architectures in terms of Response Time and RAGAS metrics: Context Precision, Context Recall, Faithfulness and Answer Relevancy.',
  },
  {
    icon: BookOpen,
    text:
      'To deploy the Enhanced RAG architecture within the web-based ISU-GeoBot system to provide context-aware navigation and privacy-compliant availability information.',
  },
  {
    icon: Users,
    text:
      'To evaluate the functional accuracy and reliability of the system’s availability estimates through ground-truth validation by selected faculty members.',
  },
];

export default function Research() {
  const [status, setStatus] = useState(null);
  const [leftRef, leftIn] = useReveal();
  const [rightRef, rightIn] = useReveal({ threshold: 0.05 });

  useEffect(() => {
    api.evalStatus().then(setStatus).catch(() => setStatus({ hasResults: false }));
  }, []);

  return (
    <section id="research" className="border-t border-white/10 bg-ink-900/40 py-20 sm:py-24">
      <div className="container-x">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
          <div ref={leftRef} className={`reveal ${leftIn ? 'is-in' : ''}`}>
            <p className="eyebrow">The study</p>
            <h2 className="h-section mt-3">
              An Enhanced RAG architecture for faculty availability classification
            </h2>
            <p className="prose-muted mt-5">
              Standard retrieval-augmented generation grounds a language model in
              static documents. It has no way to answer a question whose answer
              changes by the hour. This study embeds a probabilistic classifier
              directly into the retrieval pipeline so that a real-time,
              privacy-masked signal becomes part of the context the model
              reasons over.
            </p>

            <dl className="mt-8 space-y-4 border-t border-white/10 pt-6 text-sm">
              {[
                ['Researchers', 'Michael Allan Almario · Christian Paul Simbulan'],
                ['Degree', 'BSCS — Data Mining Track'],
                ['College', 'Computing Studies, Information and Communication Technology'],
                ['Institution', 'Isabela State University — Echague Main Campus'],
                ['Design', 'Developmental Research Design'],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col gap-1 sm:flex-row sm:gap-4">
                  <dt className="w-32 shrink-0 text-ink-600">{k}</dt>
                  <dd className="text-ink-200">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div ref={rightRef} className="stagger">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-400">
              Objectives of the study
            </h3>
            <ol className="mt-4 space-y-3">
              {OBJECTIVES.map((o, i) => (
                <li key={i}
                    style={{ '--i': i }}
                    className={`reveal ${rightIn ? 'is-in' : ''} card card-hover flex gap-4 p-4 transition-transform duration-300 hover:translate-x-1`}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/10 ring-1 ring-brand-500/20">
                    <o.icon className="h-4 w-4 text-brand-400" strokeWidth={1.75} />
                  </span>
                  <p className="text-sm leading-relaxed text-ink-300">{o.text}</p>
                </li>
              ))}
            </ol>

            {/* Evaluation status — empty state until real runs exist. */}
            <div className="card mt-6 p-5">
              <h3 className="text-sm font-semibold text-white">Evaluation status</h3>

              {status?.hasResults ? (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-ink-300">
                    {status.scoredResults} scored result
                    {status.scoredResults === 1 ? '' : 's'} recorded across{' '}
                    {status.runs?.length ?? 0} evaluation run
                    {status.runs?.length === 1 ? '' : 's'}.
                  </p>
                  <p className="text-xs leading-relaxed text-ink-600">
                    Comparative RAGAS scores and faculty validation results are
                    reported in the thesis document, computed from these runs.
                  </p>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-white/15 bg-ink-950/50 p-5 text-center">
                  <p className="text-sm font-medium text-ink-300">
                    No evaluation results yet
                  </p>
                  <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-ink-600">
                    RAGAS scores, classification accuracy and faculty validation
                    figures will appear here only after real evaluation runs have
                    been completed against real institutional data and recorded.
                    Nothing on this page is a projected or illustrative figure.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

---

# 6. Interactive Campus Workspace

### `web/src/components/app/Workspace.jsx`
```javascript
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapIcon, MessageSquare } from 'lucide-react';
import { api } from '../../lib/api.js';
import Nav from '../shared/Nav.jsx';
import DemoBanner from '../shared/DemoBanner.jsx';
import CampusMap from './CampusMap.jsx';
import ChatInterface from './ChatInterface.jsx';

/**
 * Split-pane workspace: interactive map on the left, assistant on the right.
 *
 * Map/chat synchronisation works off the RETRIEVED CONTEXT, not a second
 * lookup: when the assistant grounds an answer in a POI place-card, the server
 * returns that poiId and the map flies to it. The map therefore follows what
 * actually grounded the answer rather than a parallel keyword guess that could
 * disagree with the text on screen.
 *
 * On mobile the panes become tabs. Thesis §1.3 claims cross-device
 * accessibility, and that is a claim you should be able to demonstrate on a
 * phone in the defense room.
 */
export default function Workspace() {
  const [params, setParams] = useSearchParams();
  const [pois, setPois] = useState([]);
  const [focusId, setFocusId] = useState(params.get('poi'));
  const [tab, setTab] = useState('chat');

  useEffect(() => {
    api.pois().then((d) => setPois(d.pois ?? [])).catch(() => setPois([]));
  }, []);

  function focus(id) {
    setFocusId(id);
    setParams(id ? { poi: id } : {}, { replace: true });
    setTab('map');
  }

  return (
    <div className="flex h-screen flex-col bg-ink-950">
      <Nav />
      <DemoBanner />

      {/* mobile tab switch */}
      <div className="flex border-b border-white/10 md:hidden">
        {[
          { key: 'chat', label: 'Assistant', icon: MessageSquare },
          { key: 'map', label: 'Campus Map', icon: MapIcon },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-b-2 border-brand-500 text-white'
                : 'text-ink-500 hover:text-ink-200'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 md:grid-cols-[1.15fr_1fr]">
        <div
          className={`min-h-0 border-white/10 md:border-r ${
            tab === 'map' ? 'block' : 'hidden md:block'
          }`}
        >
          <CampusMap pois={pois} focusId={focusId} onSelect={setFocusId} />
        </div>

        <div className={`min-h-0 ${tab === 'chat' ? 'block' : 'hidden md:block'}`}>
          <ChatInterface onPoiFocus={focus} />
        </div>
      </div>
    </div>
  );
}
```

---

### `web/src/components/app/ChatInterface.jsx`
```javascript
import { useEffect, useRef, useState } from 'react';
import { Check, Compass, Copy, FileText, Send, ShieldAlert } from 'lucide-react';
import { api } from '../../lib/api.js';
import StatusChip from '../shared/StatusChip.jsx';

const SUGGESTIONS = [
  'Where is the College of Computing Studies?',
  'Where is the Registrar’s Office?',
  'What are the enrollment requirements?',
  'When does the semester end?',
];

export default function ChatInterface({ onPoiFocus }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      answer:
        'Hi — I’m ISU-GeoBot. Ask me how to find a building or office on the Echague Main Campus, or about university announcements, calendars and requirements. I can also give a generalized availability estimate for faculty members who have consented to take part in this study.',
      intro: true,
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  async function send(text) {
    const query = (text ?? input).trim();
    if (!query || busy) return;

    setMessages((m) => [...m, { role: 'user', answer: query }]);
    setInput('');
    setBusy(true);

    try {
      const res = await api.chat(query);
      setMessages((m) => [...m, { role: 'assistant', ...res }]);
      if (res.poiFocus?.poiId) onPoiFocus?.(res.poiFocus.poiId);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          error: true,
          answer:
            err.status === 429
              ? 'That’s a lot of questions in a short time. Please wait a moment before asking again.'
              : err.status === 503
              ? 'A required service is unavailable right now. Faculty availability estimates need the classifier to be trained and the language model endpoint to be reachable.'
              : 'Something went wrong handling that question. Please try again.',
        },
      ]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  async function copy(text, idx) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1600);
    } catch { /* clipboard unavailable */ }
  }

  return (
    <div className="flex h-full flex-col bg-ink-950">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-3.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500/15 ring-1 ring-brand-500/30">
          <Compass className="h-4 w-4 text-brand-400" strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-sm font-semibold text-white">Campus Assistant</p>
          <p className="text-[11px] text-ink-600">Enhanced RAG · grounded in university documents</p>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-500 px-4 py-2.5 text-sm font-medium text-ink-950">
                {m.answer}
              </div>
            </div>
          ) : (
            <div key={i} className="animate-fade-up">
              <div
                className={`max-w-[92%] rounded-2xl rounded-bl-md border px-4 py-3 ${
                  m.error
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-white/10 bg-ink-900'
                }`}
              >
                {m.error && (
                  <ShieldAlert className="mb-2 h-4 w-4 text-amber-400" />
                )}

                {m.status && (
                  <div className="mb-3">
                    <StatusChip
                      code={m.status.code}
                      label={m.status.label}
                      asOf={m.status.asOf}
                    />
                  </div>
                )}

                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-200">
                  {m.answer}
                </p>

                {m.clarification?.options?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.clarification.options.map((o) => (
                      <button
                        key={o.facultyId}
                        onClick={() => send(`Is ${o.fullName} available right now?`)}
                        className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-ink-200 transition-colors hover:border-brand-500/40 hover:text-white"
                      >
                        {o.fullName}
                        {o.department ? ` — ${o.department}` : ''}
                      </button>
                    ))}
                  </div>
                )}

                {m.sources?.length > 0 && (
                  <div className="mt-3 border-t border-white/10 pt-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-600">
                      Sources
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {m.sources.map((s, j) => (
                        <li key={j} className="flex items-center gap-1.5 text-xs text-ink-500">
                          <FileText className="h-3 w-3 shrink-0" />
                          {s.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!m.intro && !m.error && (
                  <button
                    onClick={() => copy(m.answer, i)}
                    className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] text-ink-600 transition-colors hover:text-ink-300"
                  >
                    {copiedIdx === i ? (
                      <><Check className="h-3 w-3" /> Copied</>
                    ) : (
                      <><Copy className="h-3 w-3" /> Copy</>
                    )}
                  </button>
                )}
              </div>
            </div>
          ),
        )}

        {busy && (
          <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-white/10 bg-ink-900 px-4 py-3.5 w-fit">
            {[0, 150, 300].map((d) => (
              <span
                key={d}
                className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-brand-400"
                style={{ animationDelay: `${d}ms` }}
              />
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 px-5 pb-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-ink-400 transition-colors hover:border-brand-500/40 hover:text-white"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-white/10 p-4">
        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="flex items-end gap-2"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a building, an office, or a faculty member…"
            aria-label="Ask ISU-GeoBot"
            maxLength={500}
            className="flex-1 rounded-xl border border-white/10 bg-ink-900 px-4 py-3 text-sm text-white placeholder:text-ink-600 focus:border-brand-500/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Send"
            className="btn-primary !px-3.5 !py-3"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>

        {/*
          Audit §4.3 and F-25. This disclaimer is a privacy control, not
          boilerplate: it tells the user that a status is an estimate rather
          than an observation, and that location is deliberately not available.
        */}
        <p className="mt-2.5 text-[11px] leading-relaxed text-ink-600">
          Availability is a schedule-derived <strong className="text-ink-500">estimate</strong>,
          not a confirmed observation. ISU-GeoBot does not track or disclose the
          physical location of faculty members. Research prototype — responses
          may be incomplete.
        </p>
      </div>
    </div>
  );
}
```

---

### `web/src/components/app/CampusMap.jsx`
```javascript
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Layers, Search, X } from 'lucide-react';
import { CAMPUS_CENTER, CAMPUS_ZOOM, POI_CATEGORIES } from '../../lib/constants.js';

/**
 * Interactive campus map (thesis §3.5.1).
 *
 * Coordinates are relational and come from GET /api/map/pois. The same
 * locations also exist in the retrieval corpus as generated place-cards, so a
 * navigation question is answered by the same pipeline as everything else —
 * the dual representation described in the architecture section.
 */

const TYPE_COLOR = {
  college: '#10B981',
  administrative: '#38BDF8',
  laboratory: '#A78BFA',
  library: '#FBBF24',
  facility: '#F472B6',
  landmark: '#94A3B8',
  other: '#94A3B8',
};

function markerIcon(type, active) {
  const color = TYPE_COLOR[type] ?? TYPE_COLOR.other;
  const size = active ? 40 : 30;
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size + 6],
    html: `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
           style="filter:drop-shadow(0 3px 6px rgba(0,0,0,.55));${active ? 'animation:pulseSoft 2s ease-in-out infinite' : ''}">
        <path d="M12 22s7-6.2 7-12A7 7 0 1 0 5 10c0 5.8 7 12 7 12Z"
              fill="${color}" stroke="#020617" stroke-width="1.4"/>
        <circle cx="12" cy="10" r="2.6" fill="#020617"/>
      </svg>`,
  });
}

/** Pans the map when the assistant references a location (brief §3B). */
function FocusController({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 18, { duration: 0.9 });
  }, [target, map]);
  return null;
}

export default function CampusMap({ pois, focusId, onSelect }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pois.filter(
      (p) =>
        (category === 'all' || p.type === category) &&
        (!q ||
          p.name.toLowerCase().includes(q) ||
          p.department?.toLowerCase().includes(q) ||
          p.buildingFunction?.toLowerCase().includes(q)),
    );
  }, [pois, query, category]);

  const focus = useMemo(() => pois.find((p) => p.id === focusId), [pois, focusId]);

  const categories = useMemo(
    () => POI_CATEGORIES.filter((c) => c.key === 'all' || pois.some((p) => p.type === c.key)),
    [pois],
  );

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={focus ? [focus.lat, focus.lng] : CAMPUS_CENTER}
        zoom={CAMPUS_ZOOM}
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <FocusController target={focus} />

        {filtered.map((poi) => (
          <Marker
            key={poi.id}
            position={[poi.lat, poi.lng]}
            icon={markerIcon(poi.type, poi.id === focusId)}
            eventHandlers={{ click: () => onSelect?.(poi.id) }}
          >
            <Popup>
              <div className="min-w-[190px] p-1">
                <p className="text-sm font-semibold text-white">{poi.name}</p>
                {poi.department && (
                  <p className="mt-0.5 text-xs text-brand-400">{poi.department}</p>
                )}
                {poi.buildingFunction && (
                  <p className="mt-1.5 text-xs text-ink-300">{poi.buildingFunction}</p>
                )}
                {poi.isSynthetic && (
                  <p className="mt-2 text-[11px] text-amber-400">
                    Placeholder coordinates — pending GPS survey
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* search + filters overlay */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[400] p-3">
        <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search buildings, offices, departments"
              aria-label="Search campus locations"
              className="w-full rounded-xl border border-white/10 bg-ink-900/90 py-2.5 pl-9 pr-9 text-sm text-white placeholder:text-ink-600 shadow-xl backdrop-blur focus:border-brand-500/50 focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            aria-label="Toggle filters"
            aria-expanded={showFilters}
            className={`rounded-xl border p-2.5 shadow-xl backdrop-blur transition-colors ${
              showFilters || category !== 'all'
                ? 'border-brand-500/40 bg-brand-500/15 text-brand-300'
                : 'border-white/10 bg-ink-900/90 text-ink-300 hover:text-white'
            }`}
          >
            <Layers className="h-4 w-4" />
          </button>
        </div>

        {showFilters && (
          <div className="pointer-events-auto mx-auto mt-2 flex max-w-md flex-wrap gap-1.5 rounded-xl border border-white/10 bg-ink-900/90 p-2 shadow-xl backdrop-blur">
            {categories.map((c) => (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  category === c.key
                    ? 'bg-brand-500/20 text-brand-300'
                    : 'text-ink-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 z-[400]">
        <span className="rounded-lg border border-white/10 bg-ink-900/90 px-2.5 py-1.5 text-[11px] text-ink-400 backdrop-blur">
          {filtered.length} of {pois.length} locations
        </span>
      </div>
    </div>
  );
}
```

---

# 7. Admin & Operational Portals

### `web/src/components/admin/LocationManager.jsx`
```javascript
import { useCallback, useEffect, useState } from 'react';
import {
  Building2, Check, Loader2, MapPin, Plus, RefreshCw, Save, Settings2, X,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { currentSession, signOut } from '../../lib/supabase.js';
import Nav from '../shared/Nav.jsx';
import DemoBanner from '../shared/DemoBanner.jsx';
import PortalLogin from '../shared/PortalLogin.jsx';

/**
 * Campus Location Manager.
 *
 * When a new building is finished, someone has to be able to put it on the map
 * without editing SQL. This is that surface.
 *
 * The important behaviour is not the form — it is what happens on submit. A
 * campus location has a dual representation: coordinates drive the Leaflet map,
 * and a generated place-card is embedded so navigation questions retrieve it.
 * Saving here does both in one operation, so a new building is answerable by
 * the assistant immediately rather than after someone remembers to re-run the
 * ingestion script. A map pin the chatbot has never heard of is worse than no
 * pin at all.
 *
 * TWO FIELDS THAT LOOK LIKE PAPERWORK AND ARE NOT:
 *
 *   Data origin    'placeholder' vs 'real ISU data'. The evaluation harness
 *                  refuses to run while any placeholder row exists. Getting
 *                  this wrong does not corrupt a result — it stops the run.
 *   Survey method  §3.4.1(a) specifies GPS survey verified against physical
 *                  landmarks. A coordinate typed off a floor plan is not
 *                  survey data, and recording which is which means the
 *                  methodology stays reportable.
 */

const POI_TYPES = [
  ['college', 'College / academic building'],
  ['administrative', 'Administrative office'],
  ['laboratory', 'Laboratory'],
  ['library', 'Library'],
  ['facility', 'Facility'],
  ['landmark', 'Landmark'],
  ['other', 'Other'],
];

const SURVEY_METHODS = [
  ['gps_survey', 'On-site GPS survey', 'Walked and verified against a landmark'],
  ['floor_plan', 'From a floor plan', 'Read off an official campus map'],
  ['estimated', 'Estimated', 'Approximate — not survey data'],
  ['unknown', 'Not recorded', ''],
];

const EMPTY = {
  name: '', poiType: 'college', lat: '', lng: '',
  buildingFunction: '', departmentId: '', description: '',
  isFeatured: false, surveyMethod: 'gps_survey', dataOrigin: 'real', note: '',
};

export default function LocationManager() {
  const [session, setSession] = useState(undefined);
  const [pois, setPois] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => { currentSession().then((s) => setSession(s ?? null)); }, []);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [p, d] = await Promise.all([
        api.adminPois(session.access_token),
        api.adminDepartments(session.access_token),
      ]);
      setPois(p.pois ?? []);
      setDepartments(d.departments ?? []);
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function startEdit(poi) {
    setEditingId(poi.id);
    setForm({
      name: poi.name, poiType: poi.poi_type,
      lat: String(poi.lat), lng: String(poi.lng),
      buildingFunction: poi.building_function ?? '',
      departmentId: poi.department_id ?? '',
      description: poi.description ?? '',
      isFeatured: Boolean(poi.is_featured),
      surveyMethod: poi.survey_method ?? 'unknown',
      dataOrigin: poi.data_origin, note: '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancel() { setEditingId(null); setForm(EMPTY); setMsg(null); }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const payload = {
      name: form.name.trim(),
      poiType: form.poiType,
      lat: Number(form.lat),
      lng: Number(form.lng),
      buildingFunction: form.buildingFunction.trim() || null,
      departmentId: form.departmentId || null,
      description: form.description.trim() || null,
      isFeatured: form.isFeatured,
      surveyMethod: form.surveyMethod,
      dataOrigin: form.dataOrigin,
      note: form.note.trim() || undefined,
    };
    try {
      const res = editingId
        ? await api.adminUpdatePoi(session.access_token, editingId, payload)
        : await api.adminCreatePoi(session.access_token, payload);
      setMsg({
        kind: 'ok',
        text: res.message
          ?? `Saved.${res.reindexed ? ` Place-card re-embedded (${res.indexed} chunk${res.indexed === 1 ? '' : 's'}).` : ''}`,
      });
      cancel();
      await load();
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  if (session === undefined) return null;

  if (!session) {
    return (
      <div className="min-h-screen bg-ink-950">
        <Nav />
        <DemoBanner />
        <PortalLogin
          icon={Settings2}
          title="Campus Location Manager"
          description="For researchers and campus administrators. Add or correct buildings, offices and points of interest on the ISU-GeoBot map."
          onSession={setSession}
        />
      </div>
    );
  }

  const placeholderCount = pois.filter((p) => p.data_origin === 'synthetic').length;

  return (
    <div className="min-h-screen bg-ink-950">
      <Nav />
      <DemoBanner />
      <main className="container-x py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <MapPin className="h-5 w-5 text-brand-400" strokeWidth={1.75} />
              <h1 className="text-xl font-bold text-white">Campus Locations</h1>
            </div>
            <p className="prose-muted mt-1.5 max-w-2xl text-sm">
              Saving a location updates the map <em>and</em> regenerates its
              place-card in the retrieval corpus, so the assistant can answer
              about it straight away.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} disabled={loading} className="btn-ghost !px-3 !py-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={async () => { await signOut(); setSession(null); }}
              className="btn-ghost !px-3 !py-2 text-sm"
            >
              Sign out
            </button>
          </div>
        </div>

        {placeholderCount > 0 && (
          <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <p className="text-xs leading-relaxed text-amber-200/90">
              <strong className="text-amber-300">{placeholderCount} placeholder location
              {placeholderCount === 1 ? '' : 's'}.</strong>{' '}
              These are marked <code className="font-mono">[DEMO]</code> everywhere they
              appear, and the evaluation harness will refuse to run until every
              one is replaced with surveyed coordinates.
            </p>
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          {/* form */}
          <form onSubmit={submit} className="card h-fit p-6 lg:sticky lg:top-24">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                {editingId
                  ? <><Save className="h-4 w-4 text-brand-400" /> Edit location</>
                  : <><Plus className="h-4 w-4 text-brand-400" /> Add a new location</>}
              </h2>
              {editingId && (
                <button type="button" onClick={cancel}
                        className="text-xs text-ink-500 hover:text-white">
                  Cancel
                </button>
              )}
            </div>

            <div className="mt-5 space-y-4">
              <Field label="Building or office name" required>
                <input value={form.name} onChange={(e) => set('name', e.target.value)}
                       required minLength={2} maxLength={160} className={inputCls}
                       placeholder="e.g. Innovation and Research Center" />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Type" required>
                  <select value={form.poiType} onChange={(e) => set('poiType', e.target.value)}
                          className={inputCls}>
                    {POI_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </Field>
                <Field label="Department (optional)">
                  <select value={form.departmentId}
                          onChange={(e) => set('departmentId', e.target.value)}
                          className={inputCls}>
                    <option value="">None</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Latitude" required>
                  <input type="number" step="0.000001" min={-90} max={90}
                         value={form.lat} onChange={(e) => set('lat', e.target.value)}
                         required className={inputCls} placeholder="16.7102" />
                </Field>
                <Field label="Longitude" required>
                  <input type="number" step="0.000001" min={-180} max={180}
                         value={form.lng} onChange={(e) => set('lng', e.target.value)}
                         required className={inputCls} placeholder="121.6751" />
                </Field>
              </div>
              <p className="-mt-1 text-[11px] leading-relaxed text-ink-600">
                Stand at the building entrance and read the coordinates from a
                phone GPS, then check the pin against a landmark before saving.
              </p>

              <Field label="Primary function">
                <input value={form.buildingFunction}
                       onChange={(e) => set('buildingFunction', e.target.value)}
                       maxLength={200} className={inputCls}
                       placeholder="e.g. Research laboratories and innovation hub" />
              </Field>

              <Field label="Description">
                <textarea value={form.description}
                          onChange={(e) => set('description', e.target.value)}
                          rows={3} maxLength={1000} className={inputCls}
                          placeholder="What is inside, who it serves, anything a student would want to know." />
                <p className="mt-1.5 text-[11px] leading-relaxed text-ink-600">
                  This text is embedded into the retrieval corpus, so it is what
                  the assistant will draw on. Describe the <em>place</em> — do not
                  list which faculty sit there.
                </p>
              </Field>

              <Field label="How was the coordinate obtained?" required>
                <div className="space-y-1.5">
                  {SURVEY_METHODS.map(([v, l, hint]) => (
                    <label key={v}
                           className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                             form.surveyMethod === v
                               ? 'border-brand-500/50 bg-brand-500/10 text-white'
                               : 'border-white/10 text-ink-300 hover:border-white/25'
                           }`}>
                      <input type="radio" name="survey" value={v}
                             checked={form.surveyMethod === v}
                             onChange={(e) => set('surveyMethod', e.target.value)}
                             className="mt-0.5 accent-brand-500" />
                      <span>
                        {l}
                        {hint && <span className="block text-[11px] text-ink-600">{hint}</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </Field>

              {/* The field that decides whether an evaluation can run. */}
              <Field label="Data origin" required>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['real', 'Real ISU data', 'Surveyed and verified'],
                    ['synthetic', 'Placeholder', 'Blocks evaluation runs'],
                  ].map(([v, l, hint]) => (
                    <button key={v} type="button" onClick={() => set('dataOrigin', v)}
                            className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                              form.dataOrigin === v
                                ? v === 'real'
                                : 'border-amber-500/50 bg-amber-500/10 text-amber-200'
                            }`}>
                      {l}
                      <span className="block text-[11px] opacity-70">{hint}</span>
                    </button>
                  ))}
                </div>
              </Field>

              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-300">
                <input type="checkbox" checked={form.isFeatured}
                       onChange={(e) => set('isFeatured', e.target.checked)}
                       className="accent-brand-500" />
                Feature this location on the public homepage
              </label>

              <Field label="Change note (recorded in the audit trail)">
                <input value={form.note} onChange={(e) => set('note', e.target.value)}
                       maxLength={280} className={inputCls}
                       placeholder="e.g. Building completed August 2026" />
              </Field>
            </div>

            <button type="submit" disabled={busy} className="btn-primary mt-6 w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {editingId ? 'Save changes' : 'Add location'}
            </button>

            {msg && (
              <p className={`mt-3 rounded-lg border px-3 py-2 text-xs leading-relaxed ${
                msg.kind === 'ok'
                  ? 'border-brand-500/30 bg-brand-500/5 text-brand-300'
                  : 'border-red-500/30 bg-red-500/5 text-red-300'
              }`}>
                {msg.text}
              </p>
            )}
          </form>

          {/* list */}
          <div>
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-white">
                On the map ({pois.length})
              </h2>
            </div>

            <div className="mt-4 space-y-2">
              {pois.map((p) => (
                <div key={p.id} className="card card-hover flex items-start justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-white">{p.name}</p>
                      {p.data_origin === 'synthetic' && (
                        <span className="chip border-amber-500/30 bg-amber-500/10 text-amber-300">
                          placeholder
                        </span>
                      )}
                      {p.survey_method === 'estimated' && (
                        <span className="chip border-white/15 bg-white/5 text-ink-400">
                          estimated position
                        </span>
                      )}
                      {p.is_published === false && (
                        <span className="chip border-white/15 bg-white/5 text-ink-500">
                          unpublished
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-ink-600">
                      {Number(p.lat).toFixed(5)}, {Number(p.lng).toFixed(5)}
                      {p.department?.name ? ` · ${p.department.name}` : ''}
                    </p>
                  </div>
                  <button onClick={() => startEdit(p)}
                          className="btn-ghost shrink-0 !px-3 !py-1.5 text-xs">
                    Edit
                  </button>
                </div>
              ))}

              {!loading && pois.length === 0 && (
                <div className="card p-10 text-center">
                  <Building2 className="mx-auto h-7 w-7 text-ink-600" strokeWidth={1.5} />
                  <p className="mt-3 text-sm text-ink-400">
                    No campus locations yet. Add the first one on the left.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const inputCls =
  'w-full rounded-xl border border-white/10 bg-ink-950 px-3.5 py-2.5 text-sm ' +
  'text-white placeholder:text-ink-600 focus:border-brand-500/50 focus:outline-none';

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink-400">
        {label}{required && <span className="text-brand-400"> *</span>}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
```

---

### `web/src/components/guard/GuardDashboard.jsx`
```javascript
import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2, HelpCircle, Loader2, LogIn, LogOut, RefreshCw, Search, ShieldCheck,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { currentSession, signOut } from '../../lib/supabase.js';
import Nav from '../shared/Nav.jsx';
import DemoBanner from '../shared/DemoBanner.jsx';
import PortalLogin from '../shared/PortalLogin.jsx';

/**
 * Security Presence Dashboard (thesis §3.5).
 *
 * The thesis specifies this module in two clauses and one function call. Every
 * interface decision below is ours, and the honest framing at defense is "the
 * thesis specifies the capability; we designed the interface".
 *
 * TWO THINGS THIS UI DOES THAT A NAIVE ONE WOULD NOT:
 *
 * 1. It renders THREE presence states, and "Unknown" is shown as unknown —
 *    never collapsed into "off campus". That distinction is the difference
 *    between the classifier running and the classifier never running at all
 *    (audit F-07).
 *
 * 2. Corrections are appended, never edited. The log is immutable at the
 *    database level, which is what makes it usable as research evidence.
 */

const STATE_UI = {
  confirmed_on_campus: {
    label: 'On campus',
    tone: 'border-brand-500/40 bg-brand-500/10 text-brand-300',
    dot: 'bg-brand-400',
  },
  confirmed_off_campus: {
    label: 'Departed',
    tone: 'border-ink-600 bg-ink-800 text-ink-300',
    dot: 'bg-ink-400',
  },
  unknown: {
    label: 'No log today',
    tone: 'border-amber-500/30 bg-amber-500/5 text-amber-300/90',
    dot: 'bg-amber-400',
  },
};

export default function GuardDashboard() {
  const [session, setSession] = useState(undefined);
  const [roster, setRoster] = useState([]);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { currentSession().then((s) => setSession(s ?? null)); }, []);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const d = await api.guardRoster(session.access_token);
      setRoster(d.roster ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  async function logEvent(facultyId, eventType) {
    setBusyId(facultyId);
    setError(null);
    try {
      await api.guardLog(session.access_token, { facultyId, eventType });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (session === undefined) return null;

  if (!session) {
    return (
      <div className="min-h-screen bg-ink-950">
        <Nav />
        <DemoBanner />
        <PortalLogin
          icon={ShieldCheck}
          title="Security Presence Dashboard"
          description="For authorised campus security personnel. Record faculty arrivals and departures for the current day."
          onSession={setSession}
        />
      </div>
    );
  }

  const shown = roster.filter((r) =>
    r.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-ink-950">
      <Nav />
      <DemoBanner />
      <main className="container-x py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-5 w-5 text-brand-400" strokeWidth={1.75} />
              <h1 className="text-xl font-bold text-white">Presence Dashboard</h1>
            </div>
            <p className="prose-muted mt-1.5 text-sm">
              Entries are append-only and scoped to today. To correct a mistake,
              record the opposite event — nothing is edited or deleted.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} disabled={loading} className="btn-ghost !py-2 !px-3">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={async () => { await signOut(); setSession(null); }}
              className="btn-ghost !py-2 !px-3 text-sm"
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="relative mt-6 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search faculty"
            aria-label="Search faculty"
            className="w-full rounded-xl border border-white/10 bg-ink-900 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-ink-600 focus:border-brand-500/50 focus:outline-none"
          />
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="mt-5 space-y-2">
          {shown.map((r) => {
            const ui = STATE_UI[r.presenceState] ?? STATE_UI.unknown;
            const busy = busyId === r.facultyId;
            return (
              <div
                key={r.facultyId}
                className="card flex flex-wrap items-center justify-between gap-4 p-4"
              >
                <div className="min-w-0">
                  <p className="font-medium text-white">{r.name}</p>
                  <p className="text-xs text-ink-500">{r.department ?? '—'}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className={`chip ${ui.tone}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${ui.dot}`} />
                    {ui.label}
                    {r.lastEventAt && (
                      <span className="opacity-60">
                        {' '}
                        {new Date(r.lastEventAt).toLocaleTimeString([], {
                          hour: 'numeric', minute: '2-digit',
                        })}
                      </span>
                    )}
                  </span>

                  <div className="flex gap-2">
                    <button
                      onClick={() => logEvent(r.facultyId, 'arrival')}
                      disabled={busy}
                      className="btn-ghost !py-2 !px-3 text-xs"
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <LogIn className="h-3.5 w-3.5" />}
                      Arrival
                    </button>
                    <button
                      onClick={() => logEvent(r.facultyId, 'departure')}
                      disabled={busy}
                      className="btn-ghost !py-2 !px-3 text-xs"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Departure
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {!loading && shown.length === 0 && (
            <div className="card p-10 text-center">
              <CheckCircle2 className="mx-auto h-7 w-7 text-ink-600" strokeWidth={1.5} />
              <p className="mt-3 text-sm text-ink-400">
                {roster.length === 0
                  ? 'No consented faculty on the roster yet.'
                  : 'No faculty match that search.'}
              </p>
            </div>
          )}
        </div>

        {/* The tri-state rule, explained to the person operating it. */}
        <div className="card mt-8 flex gap-3 p-5">
          <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
          <div className="text-xs leading-relaxed text-ink-500">
            <p className="font-medium text-ink-300">Why &ldquo;No log today&rdquo; is its own state</p>
            <p className="mt-1.5">
              A faculty member with no entry has not been observed either way —
              that is different from having been observed leaving. Only a
              recorded <em>departure</em> makes the assistant report Unavailable
              directly. Without a log, the availability estimate comes from the
              classifier, as designed.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
```

---

### `web/src/components/validate/ValidationChecklist.jsx`
```javascript
import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, Loader2, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api.js';
import { currentSession, signOut } from '../../lib/supabase.js';
import { STATUS } from '../../lib/constants.js';
import Nav from '../shared/Nav.jsx';
import DemoBanner from '../shared/DemoBanner.jsx';
import PortalLogin from '../shared/PortalLogin.jsx';
import StatusChip from '../shared/StatusChip.jsx';
import PrivacyControls from './PrivacyControls.jsx';

/**
 * Faculty Functional Validation (thesis §3.8.2, §3.9).
 *
 * WHY THIS IS IN-SYSTEM RATHER THAN ON PAPER (audit C14).
 *
 * The thesis describes a "structured validation checklist" and does not say
 * where it lives. Paper is thesis-sufficient and free. In-system capture is
 * stronger evidence for one specific reason: the system records its OWN
 * prediction automatically, at the moment of the query, so a validator cannot
 * misremember or mis-transcribe what it said. That removes a transcription
 * error attack on the study's headline accuracy number.
 *
 * "PARTIALLY CORRECT" (audit C15 / F-08). §3.8.2 defines a three-level
 * correctness scale, but §3.9 asks for a confusion matrix, which needs
 * (predicted, actual) pairs — "partially correct" has no cell. It is captured
 * here and EXCLUDED from the matrix by a generated column in the database,
 * reported separately. That treatment is decided before validators start, not
 * after seeing the data.
 */
export default function ValidationChecklist() {
  const [session, setSession] = useState(undefined);
  const [ctx, setCtx] = useState(null);
  const [entries, setEntries] = useState([]);
  const [actual, setActual] = useState('');
  const [correctness, setCorrectness] = useState('correct');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => { currentSession().then((s) => setSession(s ?? null)); }, []);

  const refresh = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    setMsg(null);
    try {
      const [c, e] = await Promise.all([
        api.validateContext(session.access_token),
        api.validateEntries(session.access_token),
      ]);
      setCtx(c);
      setEntries(e.entries ?? []);
      setActual('');
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }, [session]);

  useEffect(() => { refresh(); }, [refresh]);

  async function submit(e) {
    e.preventDefault();
    if (!ctx?.systemStatus || !actual) return;
    setBusy(true);
    try {
      await api.validateSubmit(session.access_token, {
        systemStatus: ctx.systemStatus,
        actualStatus: actual,
        correctness,
        overrideApplied: ctx.overrideApplied,
        notes: notes || undefined,
      });
      setNotes('');
      setMsg({ kind: 'ok', text: 'Recorded. Thank you.' });
      await refresh();
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  if (session === undefined) return null;

  if (!session) {
    return (
      <div className="min-h-screen bg-ink-950">
        <Nav />
        <DemoBanner />
        <PortalLogin
          icon={ClipboardCheck}
          title="Faculty Validation Portal"
          description="For faculty members participating in the functional validation of ISU-GeoBot. Record whether the system's estimate matched your actual status."
          onSession={setSession}
        />
      </div>
    );
  }

  const correct = entries.filter((e) => e.correctness === 'correct').length;
  const partial = entries.filter((e) => e.correctness === 'partially_correct').length;

  return (
    <div className="min-h-screen bg-ink-950">
      <Nav />
      <DemoBanner />
      <main className="container-x max-w-4xl py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <ClipboardCheck className="h-5 w-5 text-brand-400" strokeWidth={1.75} />
              <h1 className="text-xl font-bold text-white">Validation Checklist</h1>
            </div>
            <p className="prose-muted mt-1.5 text-sm">
              {ctx?.faculty?.name
                ? `Signed in as ${ctx.faculty.name}.`
                : 'Loading your record…'}{' '}
              Record an entry at different times of day and across different
              scenarios.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={refresh} disabled={busy} className="btn-ghost !py-2 !px-3">
              <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={async () => { await signOut(); setSession(null); }}
              className="btn-ghost !py-2 !px-3 text-sm"
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {/* The system's own prediction, captured automatically. */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-white">
              What ISU-GeoBot estimates right now
            </h2>
            {ctx?.systemStatus ? (
              <div className="mt-4">
                <StatusChip
                  code={ctx.systemStatus}
                  label={ctx.systemStatusLabel}
                  asOf={ctx.estimatedAt}
                />
                {ctx.overrideApplied && (
                  <p className="mt-3 rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-xs text-ink-500">
                    This estimate came from a security presence log rather than
                    the classifier. It is recorded separately so it does not
                    distort the classifier&rsquo;s accuracy figures.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-white/15 p-5 text-center text-sm text-ink-500">
                No estimate available. The classifier may not be trained yet.
              </p>
            )}
          </div>

          {/* Ground truth. */}
          <form onSubmit={submit} className="card p-5 lg:row-span-2">
            <h2 className="text-sm font-semibold text-white">Your actual status</h2>

            <div className="mt-3 space-y-2">
              {(ctx?.statusOptions ?? []).map((o) => (
                <label
                  key={o.code}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${
                    actual === o.code
                      ? 'border-brand-500/50 bg-brand-500/10 text-white'
                      : 'border-white/10 text-ink-300 hover:border-white/25'
                  }`}
                >
                  <input
                    type="radio"
                    name="actual"
                    value={o.code}
                    checked={actual === o.code}
                    onChange={(e) => setActual(e.target.value)}
                    className="accent-brand-500"
                  />
                  {STATUS[o.code]?.label ?? o.display_label}
                </label>
              ))}
            </div>

            <fieldset className="mt-4">
              <legend className="text-xs font-medium text-ink-400">
                Was the estimate correct?
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  ['correct', 'Correct'],
                  ['partially_correct', 'Partially'],
                  ['incorrect', 'Incorrect'],
                ].map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCorrectness(v)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      correctness === v
                        ? 'border-brand-500/50 bg-brand-500/10 text-brand-300'
                        : 'border-white/10 text-ink-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes (e.g. meeting ran over, class was moved)"
              rows={2}
              maxLength={500}
              className="mt-4 w-full rounded-xl border border-white/10 bg-ink-950 px-3.5 py-2.5 text-sm text-white placeholder:text-ink-600 focus:border-brand-500/50 focus:outline-none"
            />

            <button
              type="submit"
              disabled={busy || !actual || !ctx?.systemStatus}
              className="btn-primary mt-4 w-full"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Record entry
            </button>

            {msg && (
              <p
                className={`mt-3 text-xs ${
                  msg.kind === 'ok' ? 'text-brand-400' : 'text-red-300'
                }`}
              >
                {msg.text}
              </p>
            )}
          </form>
        </div>

        {/* RA 10173 right to object, exercisable by the data subject. */}
        <PrivacyControls token={session.access_token} />

        {/* Personal history. Counts only — no accuracy rate is computed here. */}
        <div className="card mt-5 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">Your entries</h2>
            <p className="text-xs text-ink-600">
              {entries.length} recorded · {correct} correct · {partial} partial
            </p>
          </div>

          {entries.length === 0 ? (
            <p className="mt-4 text-sm text-ink-500">No entries yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-ink-600">
                    <th className="pb-2 pr-4 font-medium">Time</th>
                    <th className="pb-2 pr-4 font-medium">Estimated</th>
                    <th className="pb-2 pr-4 font-medium">Actual</th>
                    <th className="pb-2 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td className="py-2.5 pr-4 text-ink-500">
                        {new Date(e.queried_at).toLocaleString([], {
                          month: 'short', day: 'numeric',
                          hour: 'numeric', minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 pr-4">
                        <StatusChip code={e.system_status} compact />
                      </td>
                      <td className="py-2.5 pr-4">
                        <StatusChip code={e.actual_status} compact />
                      </td>
                      <td className="py-2.5 text-xs">
                        <span
                          className={
                            e.correctness === 'correct'
                              ? 'text-brand-400'
                              : e.correctness === 'incorrect'
                              ? 'text-red-300'
                              : 'text-amber-300'
                          }
                        >
                          {e.correctness.replace('_', ' ')}
                        </span>
                        {!e.include_in_matrix && (
                          <span className="ml-1.5 text-ink-600">(excl. matrix)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-4 border-t border-white/10 pt-3 text-[11px] leading-relaxed text-ink-600">
            Accuracy, per-category precision and recall, and the confusion matrix
            are computed from the complete validation dataset once the evaluation
            period ends. No accuracy figure is shown here, because a partial
            count is not a result.
          </p>
        </div>
      </main>
    </div>
  );
}
```

---

### `web/src/components/validate/PrivacyControls.jsx`
```javascript
import { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api.js';

/**
 * Faculty self-service privacy controls.
 *
 * WHY THIS EXISTS.
 *
 * The thesis obtains written informed consent once, before the evaluation
 * period (§3.10). Under RA 10173 a data subject also has an ongoing right to
 * object and to withdraw consent. A signature in a folder does not satisfy
 * that; a control the person can operate themselves does.
 *
 * So a faculty member can pause disclosure at any moment, without asking the
 * researchers and without leaving the study. The pause is enforced BEFORE the
 * classifier runs — their estimate is never computed, not computed and then
 * withheld — and the assistant's refusal is worded identically to "I don't
 * have information about that person", so exercising the right does not
 * advertise that it was exercised.
 *
 * At defense this is the answer to "what if a faculty member changes their
 * mind?", and it is a much better answer than "they can email us".
 */
export default function PrivacyControls({ token }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [showReason, setShowReason] = useState(false);
  const [msg, setMsg] = useState(null);

  async function load() {
    try {
      setData(await api.myFaculty(token));
    } catch {
      setData(null);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  async function toggle(visible) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.setMyVisibility(token, {
        visible,
        reason: visible ? undefined : (reason.trim() || undefined),
      });
      setMsg(res.message);
      setReason('');
      setShowReason(false);
      await load();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;

  const visible = data.faculty.availabilityVisible;

  return (
    <div className="card mt-5 p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-brand-400" strokeWidth={1.75} />
        <h2 className="text-sm font-semibold text-white">Your privacy controls</h2>
      </div>

      {/* State, stated plainly. */}
      <div className={`mt-4 rounded-xl border px-4 py-3.5 ${
        visible
          ? 'border-brand-500/30 bg-brand-500/[0.06]'
          : 'border-ink-600 bg-ink-800/60'
      }`}>
        <div className="flex items-start gap-3">
          {visible
            ? <Eye className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
            : <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />}
          <div className="min-w-0">
            <p className={`text-sm font-medium ${visible ? 'text-brand-200' : 'text-ink-200'}`}>
              {visible
                ? 'Your availability status is visible to signed-in campus users'
                : 'Availability disclosure is paused'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-400">
              {visible
                ? 'Students who are signed in can ask whether you are available. '
                  + 'They are shown one of three generalized statuses and never a '
                  + 'location.'
                : 'The system declines questions about your availability and does '
                  + 'not compute an estimate for you at all. Your participation in '
                  + 'the study is unaffected.'}
            </p>
            {!visible && data.faculty.pausedAt && (
              <p className="mt-2 font-mono text-[11px] text-ink-600">
                paused {new Date(data.faculty.pausedAt).toLocaleString()}
                {data.faculty.pauseReason ? ` · ${data.faculty.pauseReason}` : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      {visible ? (
        <div className="mt-4">
          {showReason ? (
            <div className="space-y-2">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={280}
                placeholder="Reason (optional, visible only to you and the researchers)"
                className="w-full rounded-xl border border-white/10 bg-ink-950 px-3.5 py-2.5 text-sm text-white placeholder:text-ink-600 focus:border-brand-500/50 focus:outline-none"
              />
              <div className="flex gap-2">
                <button onClick={() => toggle(false)} disabled={busy}
                        className="btn-ghost flex-1 !py-2 text-sm">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}
                  Pause disclosure
                </button>
                <button onClick={() => { setShowReason(false); setReason(''); }}
                        className="btn-ghost !py-2 !px-3 text-sm">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowReason(true)} className="btn-ghost w-full !py-2 text-sm">
              <EyeOff className="h-4 w-4" /> Pause availability disclosure
            </button>
          )}
        </div>
      ) : (
        <button onClick={() => toggle(true)} disabled={busy}
                className="btn-primary mt-4 w-full !py-2 text-sm">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
          Resume availability disclosure
        </button>
      )}

      {msg && <p className="mt-3 text-xs leading-relaxed text-brand-400">{msg}</p>}

      {/* Right to be informed: what the system actually holds. */}
      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-600">
          What the system holds about you
        </p>
        <dl className="mt-2.5 space-y-1.5 text-xs">
          {[
            ['Schedule blocks', `${data.dataHeld.scheduleBlocks} entries`],
            ['Identity in the model', data.dataHeld.identityInModel],
            ['Location data', data.dataHeld.locationStored],
            ['Consent recorded', data.faculty.consentDate ?? 'not recorded'],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-3">
              <dt className="w-36 shrink-0 text-ink-600">{k}</dt>
              <dd className="text-ink-300">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {data.history?.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-[11px] text-ink-600 hover:text-ink-400">
            Change history ({data.history.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {data.history.map((h, i) => (
              <li key={i} className="font-mono text-[11px] text-ink-600">
                {new Date(h.changed_at).toLocaleString()} —{' '}
                {h.visible ? 'resumed' : 'paused'}
                {h.reason ? ` (${h.reason})` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
```
