import { MagnifierIcon } from "@/components/icons";
import "./SearchBar.css";

interface SearchBarProps {
  draftQ: string;
  draftStart: string;
  draftEnd: string;
  onDraftQChange: (q: string) => void;
  onDraftStartChange: (s: string) => void;
  onDraftEndChange: (e: string) => void;
  validationError: string | null;
  onSubmit: () => void;
  disabled?: boolean;
}

export function SearchBar({
  draftQ,
  draftStart,
  draftEnd,
  onDraftQChange,
  onDraftStartChange,
  onDraftEndChange,
  validationError,
  onSubmit,
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
            placeholder="Search the evidence"
            value={draftQ}
            onInput={(e) => onDraftQChange((e.target as HTMLInputElement).value)}
            disabled={disabled}
          />
          <button type="submit" class="search-btn" disabled={disabled}>
            Search
          </button>
        </div>
      </div>

      <div class="search-filters">
        <span class="search-filters__label">Year range:</span>
        <input
          type="text"
          name="start_year"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          placeholder="YYYY"
          aria-label="Start year"
          class="search-filters__year"
          value={draftStart}
          onInput={(e) => onDraftStartChange((e.target as HTMLInputElement).value)}
          disabled={disabled}
        />
        <span class="search-filters__sep" aria-hidden="true">—</span>
        <input
          type="text"
          name="end_year"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          placeholder="YYYY"
          aria-label="End year"
          class="search-filters__year"
          value={draftEnd}
          onInput={(e) => onDraftEndChange((e.target as HTMLInputElement).value)}
          disabled={disabled}
        />
      </div>

      {validationError && (
        <div class="search-bar__validation" role="alert">
          {validationError}
        </div>
      )}
    </form>
  );
}
