import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import "./FacetCombobox.css";

interface FacetComboboxProps {
  value: string;
  onChange: (next: string) => void;
  onCommit: () => void;
  options: string[];
  ariaLabel: string;
  placeholder?: string;
}

// Cap on listbox results so an O(n) scan of a 1000+ vocab doesn't render a
// 1000-row DOM. Filtering still examines every option; we just stop pushing.
const MAX_RESULTS = 100;

interface TokenRange {
  start: number;
  end: number;
}

// Splits `value` on " OR " separators and returns the [start, end] range of
// the token that contains `cursor`. Used to scope the typeahead filter to the
// current label only — typing in `Journal Article OR Tec|` should filter on
// `Tec`, not the whole string.
export function getTokenAtCursor(value: string, cursor: number): TokenRange {
  const sepRe = /\s+OR\s+/gi;
  const tokens: TokenRange[] = [];
  let prev = 0;
  let m: RegExpExecArray | null;
  while ((m = sepRe.exec(value)) !== null) {
    tokens.push({ start: prev, end: m.index });
    prev = m.index + m[0].length;
  }
  tokens.push({ start: prev, end: value.length });
  for (const t of tokens) {
    if (cursor >= t.start && cursor <= t.end) return t;
  }
  return tokens[tokens.length - 1];
}

function filterOptions(options: string[], token: string): string[] {
  const needle = token.trim().toLowerCase();
  if (needle === "") return options.slice(0, MAX_RESULTS);
  const out: string[] = [];
  for (const o of options) {
    if (o.toLowerCase().includes(needle)) {
      out.push(o);
      if (out.length >= MAX_RESULTS) break;
    }
  }
  return out;
}

export function FacetCombobox({
  value,
  onChange,
  onCommit,
  options,
  ariaLabel,
  placeholder,
}: FacetComboboxProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Pending cursor position to apply after a programmatic token-replace.
  // Set by selectOption; consumed in useLayoutEffect once the new value renders.
  const pendingCursorRef = useRef<number | null>(null);
  const [cursor, setCursor] = useState(value.length);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const tokenRange = getTokenAtCursor(value, cursor);
  const currentToken = value.slice(tokenRange.start, tokenRange.end);
  const filtered = useMemo(
    () => filterOptions(options, currentToken),
    [options, currentToken],
  );

  // Clamp highlight if the filtered list shrank under it.
  useEffect(() => {
    if (highlight >= filtered.length) setHighlight(-1);
  }, [filtered.length, highlight]);

  // Apply a pending cursor position after a token-replace re-render.
  useLayoutEffect(() => {
    if (pendingCursorRef.current !== null && inputRef.current) {
      const pos = pendingCursorRef.current;
      inputRef.current.setSelectionRange(pos, pos);
      setCursor(pos);
      pendingCursorRef.current = null;
    }
  });

  function selectOption(label: string) {
    const next = value.slice(0, tokenRange.start) + label + value.slice(tokenRange.end);
    pendingCursorRef.current = tokenRange.start + label.length;
    onChange(next);
    setHighlight(-1);
  }

  function readCursor() {
    const pos = inputRef.current?.selectionStart;
    if (pos !== null && pos !== undefined) setCursor(pos);
  }

  function closeAndCommit() {
    setOpen(false);
    setHighlight(-1);
    onCommit();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      if (filtered.length === 0) return;
      setHighlight((h) => (h + 1) % filtered.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      if (filtered.length === 0) return;
      setHighlight((h) => (h <= 0 ? filtered.length - 1 : h - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && highlight >= 0 && highlight < filtered.length) {
        selectOption(filtered[highlight]);
      } else {
        closeAndCommit();
      }
      return;
    }
    if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setHighlight(-1);
      }
      return;
    }
  }

  function handleBlur() {
    // Defer so a click on a listbox option (which preventDefaults on mousedown
    // to keep focus on the input) doesn't trigger a spurious close+commit.
    queueMicrotask(() => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(document.activeElement)) {
        closeAndCommit();
      }
    });
  }

  const listboxId = `${id}-listbox`;
  const activeOptionId =
    open && highlight >= 0 && highlight < filtered.length
      ? `${id}-option-${highlight}`
      : undefined;

  return (
    <div
      ref={wrapperRef}
      class="facet-combobox"
      role="combobox"
      aria-expanded={open}
      aria-owns={listboxId}
      aria-haspopup="listbox"
    >
      <input
        ref={inputRef}
        type="text"
        class="facet-combobox__input"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        placeholder={placeholder}
        value={value}
        onInput={(e) => {
          onChange((e.target as HTMLInputElement).value);
          readCursor();
          if (!open) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        onKeyUp={readCursor}
        onClick={readCursor}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
      />
      {open && (
        <ul id={listboxId} class="facet-combobox__listbox" role="listbox">
          {filtered.length === 0 ? (
            <li class="facet-combobox__empty">No matching concepts.</li>
          ) : (
            filtered.map((opt, i) => (
              <li
                key={opt}
                id={`${id}-option-${i}`}
                class="facet-combobox__option"
                role="option"
                aria-selected={i === highlight}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectOption(opt)}
                onMouseEnter={() => setHighlight(i)}
              >
                {opt}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
