/**
 * Shape-of-the-content placeholders.
 *
 * A spinner says "something is happening". A skeleton says "a table with four
 * rows is arriving", which is the difference between waiting and not knowing.
 * Always aria-hidden with a live-region message beside it, so assistive tech
 * gets the sentence and not forty empty rectangles.
 */
export function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}


export function SkeletonRows({ rows = 4, className = '' }) {
  return (
    <div className={className} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line py-3.5">
          <div className="skeleton h-4 w-1/3" />
          <div className="skeleton h-4 w-1/5" />
          <div className="skeleton ml-auto h-7 w-20" />
        </div>
      ))}
    </div>
  );
}

