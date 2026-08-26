import React from 'react';
import { FlaskConical } from 'lucide-react';

/**
 * What every chart renders until real measurements exist.
 *
 * Audit R6-R12. This is the component that makes fabrication structurally
 * awkward: a chart with no data cannot fall back to sample numbers, because
 * the no-data path renders an explanation instead. There is no `placeholder`
 * prop and no default dataset anywhere in this directory.
 */
export default function PendingState({ title = 'Evaluation pending', children, className = '' }) {
  return (
    <div className={`border border-dashed border-line-strong px-5 py-8 text-center ${className}`}>
      <FlaskConical className="mx-auto h-5 w-5 text-fg-subtle" strokeWidth={1.5} aria-hidden />
      <p className="mt-2.5 text-meta font-medium text-fg">{title}</p>
      {children && (
        <p className="mx-auto mt-2 max-w-prose text-label leading-relaxed text-fg-muted">
          {children}
        </p>
      )}
    </div>
  );
}
