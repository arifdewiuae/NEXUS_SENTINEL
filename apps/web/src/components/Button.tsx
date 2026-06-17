import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost';

/** Shared neon-terminal styling: rounded, uppercase, mono, with a green focus ring. */
const BASE =
  'rounded-sm font-mono uppercase transition focus:outline-none focus-visible:ring-1 focus-visible:ring-mx-green disabled:cursor-not-allowed disabled:opacity-40';

const VARIANT: Record<Variant, string> = {
  // Filled, glowing — the primary action (verify, run replay).
  primary:
    'border border-mx-green/70 bg-mx-green/10 font-bold text-mx-green-bright mx-glow hover:bg-mx-green/20',
  // Outline that lights up on hover — secondary actions (samples, replay rows).
  ghost:
    'border border-mx-green/30 font-semibold text-mx-text/80 hover:border-mx-green/80 hover:text-mx-green-bright hover:mx-glow',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

/**
 * The one neon button in the app. Callers set spacing/size/tracking via
 * `className`; the primitive owns colour, variant, and focus behaviour so the
 * terminal palette lives in exactly one place.
 */
export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  return <button type={type} className={`${BASE} ${VARIANT[variant]} ${className}`} {...props} />;
}
