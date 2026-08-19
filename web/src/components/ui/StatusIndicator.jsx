import { CheckCircle2, GraduationCap, MinusCircle } from 'lucide-react';

/**
 * Faculty availability, presented.
 *
 * THREE RULES, all from the thesis rather than from taste:
 *
 * 1. Never colour alone. Each state has a distinct icon and a distinct label,
 *    so it survives greyscale printing, colour blindness and the Monochrome
 *    theme — where these tokens resolve to ink with no hue whatsoever.
 * 2. Always marked as an estimate. The status is schedule-derived, not
 *    observed, and a reader who takes it as fact has been told something more
 *    precise than the system knows.
 * 3. Never a number. No probability, no percentage, no confidence badge —
 *    those imply a precision the study does not measure and would create an
 *    evaluation obligation the thesis never planned for.
 */
export const STATUS_META = {
  available_consultation: {
    label: 'Available for Consultation',
    icon: CheckCircle2,
    tone: 'border-success/35 bg-success-subtle text-success',
    weight: 'font-semibold',
  },
  in_scheduled_class: {
    label: 'In Scheduled Class / Lecture',
    icon: GraduationCap,
    tone: 'border-warning/35 bg-warning-subtle text-warning',
    weight: 'font-medium',
  },
  unavailable_off_schedule: {
    label: 'Unavailable / Off-Schedule',
    icon: MinusCircle,
    tone: 'border-line-strong bg-bg-sunken text-fg-muted',
    weight: 'font-normal',
  },
};

export default function StatusIndicator({
  code,
  label,
  asOf,
  variant = 'block',
  className = '',
}) {
  const meta = STATUS_META[code];
  if (!meta) return null;
  const Icon = meta.icon;
  const text = label ?? meta.label;
  const time = asOf
    ? new Date(asOf).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;

  if (variant === 'inline') {
    return (
      <span className={`indicator ${meta.tone} ${meta.weight} ${className}`}>
        <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        {text}
      </span>
    );
  }

  return (
    <div className={`border px-4 py-3 ${meta.tone} ${className}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-[1.125rem] w-[1.125rem] shrink-0" strokeWidth={1.9} aria-hidden />
        <div className="min-w-0">
          <p className={`text-body ${meta.weight}`}>{text}</p>
          <p className="mt-0.5 text-meta opacity-80">
            Estimated{time ? ` at ${time}` : ''} from schedule data &mdash; not a
            confirmed observation
          </p>
        </div>
      </div>
    </div>
  );
}
