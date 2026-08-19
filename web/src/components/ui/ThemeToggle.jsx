import { useEffect, useRef, useState } from 'react';
import { Check, Circle, Monitor, Moon, Sun } from 'lucide-react';
import { THEMES, useTheme } from '../../lib/theme.jsx';

/**
 * Appearance control.
 *
 * A menu rather than a two-state switch, because there are three meaningful
 * choices — Light, Dark, and "follow the system" — and a toggle cannot express
 * the third. Following the system is worth keeping: it is how a person who has
 * set their laptop to dark at 9pm gets a dark page without ever finding this
 * control.
 */
const ICONS = { light: Sun, dark: Moon };
const LABELS = { light: 'Light', dark: 'Dark' };

export default function ThemeToggle({ className = '' }) {
  const { theme, setTheme, isExplicit } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const Current = ICONS[theme] ?? Sun;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Appearance: ${LABELS[theme] ?? 'Light'}${isExplicit ? '' : ' (following your system)'}. Change theme`}
        title="Appearance"
        className="btn-icon"
      >
        <Current className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Appearance"
          className="absolute right-0 top-full z-20 mt-1.5 w-64 animate-pop border border-line bg-surface-raised p-1 shadow-md"
        >
          {THEMES.map((t) => {
            const Icon = ICONS[t.value];
            const active = isExplicit && theme === t.value;
            return (
              <button
                key={t.value}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => { setTheme(t.value); setOpen(false); }}
                className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors duration-state hover:bg-bg-sunken"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-fg-muted" strokeWidth={1.75} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-meta font-medium text-fg">{t.label}</span>
                  <span className="mt-0.5 block text-label leading-snug text-fg-subtle">
                    {t.description}
                  </span>
                </span>
                {active
                  ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2} aria-hidden />
                  : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-line-strong" strokeWidth={1.5} aria-hidden />}
              </button>
            );
          })}

          <div className="mt-1 border-t border-line pt-1">
            <button
              role="menuitemradio"
              aria-checked={!isExplicit}
              onClick={() => { setTheme(null); setOpen(false); }}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors duration-state hover:bg-bg-sunken"
            >
              <Monitor className="h-4 w-4 shrink-0 text-fg-muted" strokeWidth={1.75} aria-hidden />
              <span className="flex-1 text-meta text-fg">Follow system</span>
              {!isExplicit && <Check className="h-4 w-4 text-accent" strokeWidth={2} aria-hidden />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
