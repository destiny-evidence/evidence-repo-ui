import { Select, type SelectOption } from "@/components/common/Select";
import { parseSort, type SortOption } from "@/services/searchParams";

interface SortDropdownProps {
  value: SortOption | undefined;
  onChange: (next: SortOption | undefined) => void;
  disabled?: boolean;
}

// Relevance is the absent sort, so it carries the empty value.
const OPTIONS: SelectOption<string>[] = [
  { value: "", label: "Sort: Relevance" },
  { value: "newest", label: "Sort: Publication year (newest)" },
  { value: "oldest", label: "Sort: Publication year (oldest)" },
];

export function SortDropdown({ value, onChange, disabled = false }: SortDropdownProps) {
  return (
    <Select
      label="Sort results"
      labelHidden
      options={OPTIONS}
      value={value ?? ""}
      onChange={(next) => onChange(parseSort(next))}
      disabled={disabled}
    />
  );
}
