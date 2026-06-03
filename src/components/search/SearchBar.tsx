import { MagnifierIcon } from "@/components/icons";
import "./SearchBar.css";

interface SearchBarProps {
  draftQ: string;
  onDraftQChange: (q: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export function SearchBar({
  draftQ,
  onDraftQChange,
  onSubmit,
  placeholder = "Search the evidence",
  disabled = false,
}: SearchBarProps) {
  function handleSubmit(e?: Event) {
    e?.preventDefault();
    onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} role="search" noValidate>
      <div class="search-bar-wrapper">
        <div class="search-bar">
          <span class="search-icon" aria-hidden="true">
            <MagnifierIcon />
          </span>
          <input
            type="search"
            aria-label="Search query"
            placeholder={placeholder}
            value={draftQ}
            onInput={(e) => onDraftQChange((e.target as HTMLInputElement).value)}
            disabled={disabled}
          />
          <button type="submit" class="search-btn" disabled={disabled}>
            Search
          </button>
        </div>
      </div>
    </form>
  );
}
