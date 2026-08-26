import React from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

/**
 * One notification surface for information, success, warning and error.
 *
 * Every tone carries its own icon, so the meaning survives greyscale, colour
 * blindness and greyscale printing. An error states what happened and, where
 * we know it, what to do next — `action` exists so that is a first-class slot
 * rather than a sentence people forget to write.
 */
const TONES = {
  info: { cls: 'alert-info', Icon: Info, label: 'Information' },
  success: { cls: 'alert-success', Icon: CheckCircle2, label: 'Success' },
  warning: { cls: 'alert-warning', Icon: AlertTriangle, label: 'Warning' },
  error: { cls: 'alert-error', Icon: XCircle, label: 'Error' },
};

export default function Alert({ tone = 'info', title, children, action, className = '' }) {
  const { cls, Icon, label } = TONES[tone] ?? TONES.info;
  return (
    <div
      className={`${cls} ${className}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
      <div className="min-w-0 flex-1">
        <span className="sr-only">{label}: </span>
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={title ? 'mt-1 opacity-90' : 'opacity-90'}>{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}
