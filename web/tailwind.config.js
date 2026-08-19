/**
 * ISU-GeoBot — Tailwind configuration.
 *
 * Every colour resolves to a CSS custom property, so a component names a ROLE
 * (`bg-surface`, `text-fg-muted`, `border-line`) and never a hue. Swapping the
 * accent, or adding a third theme, touches tokens.css only.
 *
 * The `rgb(var(--x) / <alpha-value>)` form is what keeps Tailwind's opacity
 * modifiers working — `bg-accent/10` and `border-line/60` both resolve
 * correctly against the active theme.
 */
const c = (v) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: c('--bg'), sunken: c('--bg-sunken') },
        surface: { DEFAULT: c('--surface'), raised: c('--surface-raised') },
        fg: {
          DEFAULT: c('--fg'),
          muted: c('--fg-muted'),
          subtle: c('--fg-subtle'),
          inverse: c('--fg-inverse'),
        },
        line: { DEFAULT: c('--line'), strong: c('--line-strong') },
        accent: {
          DEFAULT: c('--accent'),
          hover: c('--accent-hover'),
          subtle: c('--accent-subtle'),
          contrast: c('--accent-contrast'),
        },
        success: { DEFAULT: c('--success'), subtle: c('--success-subtle') },
        warning: { DEFAULT: c('--warning'), subtle: c('--warning-subtle') },
        error: { DEFAULT: c('--error'), subtle: c('--error-subtle') },
        info: { DEFAULT: c('--info'), subtle: c('--info-subtle') },
        focus: c('--focus'),
      },

      fontFamily: {
        // Display and section headings only.
        serif: ['"Source Serif 4"', 'ui-serif', 'Georgia', 'serif'],
        // Everything else: UI, body, forms, navigation, dashboards.
        sans: ['Inter', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        // Coordinates, identifiers, model versions, timestamps. Nothing else.
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },

      // Editorial scale. Sizes are paired with their line-height and tracking
      // so a heading cannot be used without its metrics.
      fontSize: {
        display: ['3.5rem', { lineHeight: '1.02', letterSpacing: '-0.02em' }],
        h1: ['2.5rem', { lineHeight: '1.08', letterSpacing: '-0.018em' }],
        h2: ['1.875rem', { lineHeight: '1.16', letterSpacing: '-0.014em' }],
        h3: ['1.3125rem', { lineHeight: '1.30', letterSpacing: '-0.008em' }],
        'body-lg': ['1.0625rem', { lineHeight: '1.65' }],
        body: ['0.96875rem', { lineHeight: '1.65' }],
        meta: ['0.84375rem', { lineHeight: '1.5' }],
        label: ['0.78125rem', { lineHeight: '1.4', letterSpacing: '0.005em' }],
        data: ['0.8125rem', { lineHeight: '1.5' }],
      },

      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        pill: 'var(--radius-pill)',
      },

      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        none: 'none',
      },

      transitionTimingFunction: {
        in: 'var(--ease-in)',
        out: 'var(--ease-out)',
      },
      transitionDuration: {
        state: 'var(--dur-state)',
        menu: 'var(--dur-menu)',
        dialog: 'var(--dur-dialog)',
      },

      maxWidth: {
        measure: '68ch',   // comfortable reading measure for body prose
        prose: '46rem',
      },

      keyframes: {
        // The only two keyframes in the system. Both opacity-and-transform,
        // both short. Anything needing more than this is decoration.
        enter: {
          from: { opacity: '0', transform: 'translate3d(0, 12px, 0)' },
          to: { opacity: '1', transform: 'none' },
        },
        pop: {
          from: { opacity: '0', transform: 'translate3d(0, -4px, 0)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        enter: 'enter 400ms var(--ease-in) both',
        pop: 'pop var(--dur-menu) var(--ease-in) both',
      },
    },
  },
  plugins: [],
};
