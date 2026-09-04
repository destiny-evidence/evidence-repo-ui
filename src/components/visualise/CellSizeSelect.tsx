import { useId } from "preact/hooks";
import type { CellSize } from "@/services/evidenceMap";
import "./CellSizeSelect.css";

interface CellSizeSelectProps {
  value: CellSize;
  onChange: (size: CellSize) => void;
}

// Ordered smallest to largest: the <select> reads as a scale, not a menu.
const OPTIONS: { value: CellSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "xlarge", label: "Extra large" },
];

/** Toolbar control stepping the map's column width, row height and bubble scale. */
export function CellSizeSelect({ value, onChange }: CellSizeSelectProps) {
  const id = useId();
  return (
    <div class="cell-size-select">
      <label class="cell-size-select__label lg-label" for={id}>
        Cell size
      </label>
      <select
        id={id}
        class="cell-size-select__select"
        value={value}
        onChange={(e) => onChange((e.target as HTMLSelectElement).value as CellSize)}
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
