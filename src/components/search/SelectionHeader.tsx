import { useEffect, useRef } from "preact/hooks";
import { Tooltip } from "@/components/common/Tooltip";
import "./SelectionHeader.css";

interface SelectionHeaderProps {
  /** Everything matching the search is selected (checkbox checked). */
  checked: boolean;
  /** A subset is selected (checkbox indeterminate). */
  indeterminate: boolean;
  /** Select all references, or deselect all when anything is selected. */
  onToggle: () => void;
  /** e.g. "20 selected" or "All 1,854 selected"; empty when nothing is selected. */
  countLabel: string;
  disabled?: boolean;
}

/**
 * Top-left table control: a tri-state checkbox that selects/deselects every
 * matching reference (tooltip "Select all" / "Deselect all"), with the running
 * selected count beside it.
 */
export function SelectionHeader({
  checked,
  indeterminate,
  onToggle,
  countLabel,
  disabled = false,
}: SelectionHeaderProps) {
  const boxRef = useRef<HTMLInputElement>(null);

  // `indeterminate` has no HTML attribute, so it can't be set in JSX.
  useEffect(() => {
    if (boxRef.current) boxRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  // Clicking clears whenever anything is selected, so the affordance reads
  // "Deselect all" in both the checked and indeterminate states.
  const label = checked || indeterminate ? "Deselect all" : "Select all";

  return (
    <div class="sel-header">
      <Tooltip text={label}>
        <input
          ref={boxRef}
          type="checkbox"
          class="ui-checkbox"
          checked={checked}
          disabled={disabled}
          aria-label={`${label} references`}
          onChange={onToggle}
        />
      </Tooltip>
      {countLabel && (
        <span class="sel-header__count" role="status" aria-live="polite">
          {countLabel}
        </span>
      )}
    </div>
  );
}
