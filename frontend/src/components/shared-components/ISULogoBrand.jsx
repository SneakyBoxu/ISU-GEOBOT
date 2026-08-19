import { Link } from 'react-router-dom';

/**
 * The mark: a survey benchmark. Two crossed sight lines and a centre point —
 * the symbol stamped on a control point when a site is actually surveyed.
 * It says wayfinding and measurement rather than "AI assistant", and it draws
 * from the same hairline vocabulary as the rest of the interface.
 */
export function Mark({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.25" opacity=".38" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="12" cy="12" r="1.35" fill="currentColor" />
      <path d="M12 .9v5.2M12 17.9v5.2M.9 12h5.2M17.9 12h5.2"
            stroke="currentColor" strokeWidth="1.25" strokeLinecap="square" />
    </svg>
  );
}

export default function Brand({ className = '' }) {
  return (
    <Link
      to="/"
      className={`group -mx-1 flex min-h-[2.75rem] items-center gap-2.5 px-1 ${className}`}
      aria-label="ISU-GeoBot, home"
    >
      <span className="text-accent"><Mark /></span>
      <span className="whitespace-nowrap font-serif text-[1.0625rem] font-semibold tracking-[-0.01em] text-fg">
        ISU-GeoBot
      </span>
    </Link>
  );
}
