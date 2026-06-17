import "./Spinner.css";

interface SpinnerProps {
  /** Diameter in px. Defaults to 24. */
  size?: number;
  /** Extra class for layout (e.g. margins) in the host context. */
  class?: string;
}

/**
 * Animated rotating ring used to indicate an in-progress wait. Sizes via the
 * --spinner-size CSS var; respects prefers-reduced-motion.
 */
export function Spinner({ size, class: className }: SpinnerProps) {
  return (
    <span
      class={`spinner${className ? ` ${className}` : ""}`}
      aria-hidden="true"
      style={size ? { "--spinner-size": `${size}px` } : undefined}
    />
  );
}
