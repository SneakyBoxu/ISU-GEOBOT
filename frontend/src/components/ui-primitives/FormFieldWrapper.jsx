import React, { useId } from 'react';

/**
 * Label, control, hint, error — in that order, wired together.
 *
 * The label is always a real <label> bound by id, and the hint and error are
 * referenced by aria-describedby, so a screen reader announces the whole
 * field rather than an anonymous text box. Placeholder text is never the
 * label; a field whose label vanishes the moment you type is not labelled.
 */
export default function Field({
  label,
  hint,
  error,
  required,
  children,
  className = '',
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
        {required && <span className="text-accent" aria-hidden> *</span>}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      <div className="mt-1.5">
        {children({ id, describedBy, invalid: Boolean(error), required })}
      </div>
      {hint && !error && <p id={hintId} className="field-hint">{hint}</p>}
      {error && <p id={errId} className="field-error" role="alert">{error}</p>}
    </div>
  );
}
