import type { SortOption } from "@/services/searchParams";
import "./SortDropdown.css";

interface SortDropdownProps {
  value: SortOption | undefined;
  onChange: (next: SortOption | undefined) => void;
  disabled?: boolean;
}

// Native <select> for free keyboard nav, screen-reader semantics, and the
// mobile native picker. Empty string value (option label "Relevance") maps
// to undefined so the URL stays clean (no `sort` param) for the default.
export function SortDropdown({ value, onChange, disabled = false }: SortDropdownProps) {
  function handleChange(e: Event) {
    const raw = (e.target as HTMLSelectElement).value;
    onChange(raw === "newest" || raw === "oldest" ? raw : undefined);
  }

  return (
    <span class="sort-dropdown">
      <select
        class="sort-dropdown__select"
        aria-label="Sort results"
        value={value ?? ""}
        onChange={handleChange}
        disabled={disabled}
      >
        <option value="">Relevance</option>
        <option value="newest">Publication year (newest)</option>
        <option value="oldest">Publication year (oldest)</option>
      </select>
    </span>
  );
}
