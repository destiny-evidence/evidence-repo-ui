import { useId } from "preact/hooks";
import "./Select.css";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface SelectProps<T extends string> {
  /** Accessible name; also the visible label unless `labelHidden`. */
  label: string;
  labelHidden?: boolean;
  /** Decorative glyph before the label text, kept out of the accessible name. */
  labelIcon?: string;
  /** "inline" puts the label beside the field, "stacked" above it. */
  layout?: "inline" | "stacked";
  options: readonly SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

/**
 * A native <select> with the chevron drawn by CSS.
 */
export function Select<T extends string>({
  label,
  labelHidden = false,
  labelIcon,
  layout = "inline",
  options,
  value,
  onChange,
  disabled = false,
}: SelectProps<T>) {
  const id = useId();
  return (
    <span class={`select select--${layout}`}>
      {!labelHidden && (
        <span class="select__label lg-label">
          {labelIcon && (
            <span class="select__label-icon" aria-hidden="true">
              {labelIcon}
            </span>
          )}
          <label for={id}>{label}</label>
        </span>
      )}
      <span class="select__control">
        <select
          id={id}
          class="select__field"
          aria-label={labelHidden ? label : undefined}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange((e.target as HTMLSelectElement).value as T)}
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
      </span>
    </span>
  );
}
