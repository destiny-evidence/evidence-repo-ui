import type { ComponentChildren } from "preact";
import "./LabeledField.css";

interface LabeledFieldProps {
  label: string;
  children: ComponentChildren;
}

/**
 * Renders an inline "LABEL value" row used throughout the finding card sections
 * (Name, Description, Country, Size, Measure, etc.).
 */
export function LabeledField({ label, children }: LabeledFieldProps) {
  return (
    <p class="labeled-field">
      <span class="labeled-field__label lg-label">{label}</span> {children}
    </p>
  );
}
