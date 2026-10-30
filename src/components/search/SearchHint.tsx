import { NewTabLink } from "@/components/common/NewTabLink";
import { SEARCH_HELP_URL } from "@/config";
import "./SearchHint.css";

interface SearchHintProps {
  /** On the hint text only, for the field's aria-describedby. */
  id: string;
  class: string;
}

/** The query syntax hint and help link shown under a search field. */
export function SearchHint({ id, class: className }: SearchHintProps) {
  return (
    <p class={`search-hint ${className}`}>
      <span id={id}>
        <span class="search-hint__label">Hint:</span> Boolean operators can be
        used to search
      </span>
      {SEARCH_HELP_URL && (
        <NewTabLink
          class="search-hint__link"
          href={SEARCH_HELP_URL}
          event={{ category: "Search", action: "Help Opened" }}
        >
          Learn more about search
        </NewTabLink>
      )}
    </p>
  );
}
