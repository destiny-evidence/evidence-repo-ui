import { useEffect, useId, useRef, useState } from "preact/hooks";
import { useDismiss } from "@/hooks/useDismiss";
import { ChevronDownIcon } from "@/components/common/icons";
import "@/components/search/ExportMenu.css";
import "./MapScopeMenus.css";

interface MapSourceMenuProps {
  query: string;
  // A query or filters narrow the map, so mapping the whole repository is a change.
  scoped: boolean;
  countNoun: string;
  // Resolves to how many results a query would map under the current filters.
  countMatches: (query: string) => Promise<number>;
  onApply: (query: string) => void;
  onMapRepository: () => void;
}

type Status = "idle" | "checking" | "empty" | "error";

/**
 * The search a map is drawn from, editable in place. Update map checks the new
 * query has matches before applying it.
 */
export function MapSourceMenu({
  query,
  scoped,
  countNoun,
  countMatches,
  onApply,
  onMapRepository,
}: MapSourceMenuProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(query);
  const [status, setStatus] = useState<Status>("idle");
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  // Bumped on every close, so a check still in flight knows it was cancelled.
  const attempt = useRef(0);
  const panelId = useId();
  const fieldId = useId();
  const hintId = useId();

  useDismiss(open, setOpen, containerRef, buttonRef);

  useEffect(() => {
    if (!open) attempt.current++;
    const field = fieldRef.current;
    if (!open || !field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }, [open]);

  function toggle() {
    if (!open) {
      setDraft(query);
      setStatus("idle");
    }
    setOpen(!open);
  }

  // Close onto the trigger, since the focused field goes with the panel.
  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  async function submit() {
    if (status === "checking") return;
    const next = draft.trim();
    if (next === query) {
      close();
      return;
    }
    const current = attempt.current;
    setStatus("checking");
    let count: number;
    try {
      count = await countMatches(next);
    } catch {
      if (current === attempt.current) setStatus("error");
      return;
    }
    if (current !== attempt.current) return;
    if (count === 0) {
      setStatus("empty");
      return;
    }
    close();
    onApply(next);
  }

  return (
    <div class="export-menu map-scope-menu" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        class="export-button map-source-button"
        aria-expanded={open ? "true" : "false"}
        aria-controls={panelId}
        onClick={toggle}
      >
        <span class="map-source-button__label">
          {query ? "Search" : "Source"}
        </span>
        <span class="map-source-button__value">
          {query ? `“${query}”` : "Whole repository"}
        </span>
        <span
          class={`export-button__caret${open ? " is-open" : ""}`}
          aria-hidden="true"
        >
          <ChevronDownIcon size={12} />
        </span>
      </button>

      {open && (
        <div
          class="export-menu__panel map-scope-menu__panel"
          id={panelId}
          role="group"
          aria-label="Map source"
        >
          <label class="export-menu__label" for={fieldId}>
            Search to map
          </label>
          <textarea
            ref={fieldRef}
            id={fieldId}
            class="map-source-menu__field"
            rows={2}
            value={draft}
            placeholder="Leave empty to map the whole repository"
            aria-describedby={hintId}
            onInput={(e) => {
              setDraft((e.target as HTMLTextAreaElement).value);
              setStatus("idle");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.isComposing) {
                e.preventDefault();
                void submit();
              }
            }}
          />
          <p class="map-source-menu__hint" id={hintId}>
            Enter to update · Boolean operators supported
          </p>
          {status === "empty" && (
            <p class="map-source-menu__error" role="alert">
              No {countNoun} match. Try a broader query or remove a filter.
            </p>
          )}
          {status === "error" && (
            <p class="map-source-menu__error" role="alert">
              Couldn’t check the search. Try again.
            </p>
          )}
          <div class="map-scope-menu__footer">
            {draft && (
              <button
                type="button"
                class="map-scope-menu__link"
                onClick={() => {
                  setDraft("");
                  setStatus("idle");
                }}
              >
                Clear
              </button>
            )}
            {scoped && (
              <button
                type="button"
                class="map-scope-menu__link"
                onClick={() => {
                  close();
                  onMapRepository();
                }}
              >
                Map whole repository
              </button>
            )}
            <button
              type="button"
              class="export-menu__action map-scope-menu__primary"
              disabled={status === "checking"}
              onClick={() => void submit()}
            >
              {status === "checking" ? "Checking…" : "Update map"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
