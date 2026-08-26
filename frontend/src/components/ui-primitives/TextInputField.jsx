import React, { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export const Input = forwardRef(function Input(
  { invalid, className = '', ...rest }, ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`input ${className}`}
      {...rest}
    />
  );
});

/**
 * Password with a visibility toggle.
 *
 * The toggle is a real button with an aria-label that states what it will do,
 * not what state it is in — "Show password" is an instruction; "Password
 * hidden" would leave a screen-reader user guessing what activating it does.
 */
export const PasswordInput = forwardRef(function PasswordInput(
  { invalid, className = '', ...rest }, ref,
) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        ref={ref}
        type={shown ? 'text' : 'password'}
        aria-invalid={invalid || undefined}
        className={`input pr-11 ${className}`}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded text-fg-subtle transition-colors duration-state hover:text-fg"
      >
        {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});

export const Textarea = forwardRef(function Textarea(
  { invalid, className = '', ...rest }, ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`input resize-y ${className}`}
      {...rest}
    />
  );
});

export const Select = forwardRef(function Select(
  { invalid, className = '', children, ...rest }, ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`input appearance-none bg-[length:1rem] bg-[right_0.6rem_center] bg-no-repeat pr-9 ${className}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%236E727A' stroke-width='1.5'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E\")",
      }}
      {...rest}
    >
      {children}
    </select>
  );
});
