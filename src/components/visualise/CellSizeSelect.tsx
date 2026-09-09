import { Select, type SelectOption } from "@/components/common/Select";
import type { CellSize } from "@/services/evidenceMap";

interface CellSizeSelectProps {
  value: CellSize;
  onChange: (size: CellSize) => void;
}

const OPTIONS: SelectOption<CellSize>[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "xlarge", label: "Extra large" },
];

/** Toolbar control stepping the map's column width, row height and bubble scale. */
export function CellSizeSelect({ value, onChange }: CellSizeSelectProps) {
  return (
    <Select
      label="Cell size"
      options={OPTIONS}
      value={value}
      onChange={onChange}
    />
  );
}
