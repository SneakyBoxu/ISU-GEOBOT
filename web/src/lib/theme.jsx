import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Appearance control.
 *
 * Two themes: `light` (default) and `mono`. Both are light-ground, so a
 * `prefers-color-scheme: dark` signal has no target here and is deliberately
 * ignored — pretending dark-mode preference means "monochrome" would be a
 * guess, not a preference.
 *
 * What IS honoured is `prefers-contrast: more`. Monochrome is the higher
 * contrast theme (pure black on white, no hue), so that mapping is a real
 * accessibility inference rather than a convenient one. It applies only until
 * the user makes an explicit choice; after that their choice wins permanently.
 *
 * The same resolution logic runs as an inline script in index.html so the
 * theme is correct before first paint. If this changes, that must too.
 */

const STORAGE_KEY = 'geobot.theme';

export const THEMES = [
  {
    value: 'light',
    label: 'Light',
    description: 'Warm paper ground with an institutional green accent.',
  },
  {
    value: 'mono',
    label: 'Monochrome',
    description: 'Black, white and grayscale. Availability status uses no colour at all.',
  },
];

const ThemeContext = createContext(null);

function systemPreferred() {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-contrast: more)').matches ? 'mono' : 'light';
}

function stored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'mono' ? v : null;
  } catch {
    return null;
  }
}

export function ThemeProvider({ children }) {
  // `explicit` is null until the user picks one; that is what lets the system
  // preference keep applying, and what makes "Reset to system" meaningful.
  const [explicit, setExplicit] = useState(stored);
  const [system, setSystem] = useState(systemPreferred);

  const theme = explicit ?? system;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-contrast: more)');
    const onChange = () => setSystem(mq.matches ? 'mono' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    // Keep the browser chrome in step with the page ground.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'mono' ? '#FCFCFC' : '#FBFAF8');
  }, [theme]);

  const setTheme = useCallback((next) => {
    setExplicit(next);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, next);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* private browsing — the choice still applies for this session */
    }
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      isExplicit: explicit !== null,
      resetToSystem: () => setTheme(null),
    }),
    [theme, setTheme, explicit],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
