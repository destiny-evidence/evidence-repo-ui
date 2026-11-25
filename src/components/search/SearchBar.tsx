import { useId } from "preact/hooks";
import { MagnifierIcon, WarningIcon } from "@/components/common/icons";
import type { QueryIssue } from "@/services/queryIssues";
import { SearchHint } from "./SearchHint";
import "./SearchBar.css";

interface SearchBarProps {
  draftQ: string;
  onDraftQChange: (q: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  issue: QueryIssue | null;
  onBlur: () => void;
}

export function SearchBar({
  draftQ,
  onDraftQChange,
  onSubmit,
  placeholder = "Search titles and abstracts",
  disabled = false,
  issue,
  onBlur,
}: SearchBarProps) {
  const hintId = useId();
  const issueId = useId();

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
            aria-describedby={issue ? `${hintId} ${issueId}` : hintId}
            aria-invalid={issue !== null}
            placeholder={placeholder}
            value={draftQ}
            onInput={(e) => onDraftQChange((e.target as HTMLInputElement).value)}
            onBlur={onBlur}
            disabled={disabled}
          />
          <button type="submit" class="search-btn" disabled={disabled}>
            Search
          </button>
        </div>
        <SearchHint id={hintId} class="search-bar-hint" />
        {issue && (
          <div id={issueId} class="search-bar-issue">
            <WarningIcon />
            <div>
              <p class="search-bar-issue__title">{issue.title}</p>
              <p class="search-bar-issue__body">{issue.body}</p>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
