/**
 * Every empty state answers three questions: what is missing, why, and what
 * to do next. A blank panel answers none of them, and in a research system an
 * unexplained empty panel is worse than nothing — it reads as a failure rather
 * than as "this has not been measured yet".
 */
export default function EmptyState({ icon: Icon, title, children, action, className = '' }) {
  return (
    <div className={`border border-dashed border-line-strong px-6 py-10 text-center ${className}`}>
      {Icon && (
        <Icon className="mx-auto h-6 w-6 text-fg-subtle" strokeWidth={1.5} aria-hidden />
      )}
      <p className="mt-3 text-body font-medium text-fg">{title}</p>
      {children && (
        <div className="mx-auto mt-2 max-w-prose text-meta leading-relaxed text-fg-muted">
          {children}
        </div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
