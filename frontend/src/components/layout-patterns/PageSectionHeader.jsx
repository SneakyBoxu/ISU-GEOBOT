import React from 'react';
/**
 * Section openers for the landing page.
 *
 * Left-aligned by default. Centred headings read as marketing; an editorial
 * page sets its headings on the same axis as the text they introduce, and
 * lets whitespace do the separating.
 */
export default function SectionHeader({
  eyebrow,
  title,
  children,
  align = 'left',
  className = '',
}) {
  const centred = align === 'center';
  return (
    <div className={`${centred ? 'mx-auto max-w-prose text-center' : 'max-w-prose'} ${className}`}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 className="mt-3 font-serif text-h2 text-fg">{title}</h2>
      {children && <p className="lede mt-4">{children}</p>}
    </div>
  );
}

