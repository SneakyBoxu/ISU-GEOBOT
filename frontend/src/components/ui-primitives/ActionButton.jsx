import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * The single button in the product.
 *
 * Six variants, because "make it a filled green button" is how a UI ends up
 * with nine competing primary actions on one screen. The variant carries the
 * hierarchy; the colour follows from it.
 *
 *   primary      the one action this screen exists for
 *   secondary    a real alternative, equally legitimate
 *   tertiary     low-emphasis, tinted
 *   text         inline, reads as prose
 *   destructive  removes or supersedes something
 *   icon         square, always needs `aria-label`
 *
 * `loading` keeps the label mounted and swaps only the leading glyph, so the
 * button does not change width mid-click and shift everything beside it.
 */
const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  tertiary: 'btn-tertiary',
  text: 'btn-text',
  destructive: 'btn-destructive',
  icon: 'btn-icon',
};

const SIZES = { sm: 'btn-sm', md: '', lg: 'btn-lg' };

const Button = forwardRef(function Button(
  {
    as: Tag = 'button',
    variant = 'secondary',
    size = 'md',
    loading = false,
    icon: Icon,
    iconRight: IconRight,
    className = '',
    children,
    disabled,
    ...rest
  },
  ref,
) {
  const cls = [VARIANTS[variant] ?? VARIANTS.secondary, SIZES[size] ?? '', className]
    .filter(Boolean).join(' ');

  return (
    <Tag
      ref={ref}
      className={cls}
      disabled={Tag === 'button' ? disabled || loading : undefined}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : Icon ? (
        <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      ) : null}
      {children}
      {IconRight && !loading && (
        <IconRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      )}
    </Tag>
  );
});

export default Button;
