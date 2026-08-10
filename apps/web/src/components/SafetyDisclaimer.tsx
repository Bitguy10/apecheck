import { BUY_SAFETY_DISCLAIMER } from '@apecheck/core';

/**
 * Persistent, non-dismissible safety line rendered near every buy button.
 * Copy is a non-negotiable product requirement.
 */
export function SafetyDisclaimer({ className = '' }: { className?: string }) {
  return (
    <p
      className={`flex items-start gap-2 rounded-md border border-warning-amber/30 bg-warning-amber/5 px-3 py-2 text-xs leading-snug text-warning-amber ${className}`}
      role="note"
    >
      <span aria-hidden>⚠️</span>
      <span>{BUY_SAFETY_DISCLAIMER}</span>
    </p>
  );
}
