import { useId } from "preact/hooks";
import { ExternalLink } from "@/components/common/ExternalLink";
import { MagnifierIcon } from "@/components/common/icons";
import { SEARCH_HELP_URL } from "@/config";
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
  placeholder = "Search titles and abstracts",
  disabled = false,
}: SearchBarProps) {
  const hintId = useId();

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
            aria-describedby={hintId}
            placeholder={placeholder}
            value={draftQ}
            onInput={(e) => onDraftQChange((e.target as HTMLInputElement).value)}
            disabled={disabled}
          />
          <button type="submit" class="search-btn" disabled={disabled}>
            Search
          </button>
        </div>
        <p class="search-bar-hint">
          <span id={hintId}>
            <span class="search-bar-hint__label">Hint:</span> Boolean operators can
            be used to search
          </span>
          {SEARCH_HELP_URL && (
            <ExternalLink
              class="search-bar-hint__link"
              href={SEARCH_HELP_URL}
              event={{ category: "Search", action: "Help Opened" }}
            >
              Learn more
            </ExternalLink>
          )}
        </p>
      </div>
    </form>
  );
}
