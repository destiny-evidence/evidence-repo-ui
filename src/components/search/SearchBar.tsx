import { useState, useEffect } from "preact/hooks";
import "./SearchBar.css";

interface SearchBarProps {
  q: string;
  startYear: number | undefined;
  endYear: number | undefined;
  onSubmit: (q: string, startYear: number | undefined, endYear: number | undefined) => void;
  disabled?: boolean;
}

function parseYear(raw: string): number | undefined {
  // Strict decimal only — matches parseSearchParams' rule so URL state and
  // form input agree on what a valid year is. Rejects "2e3", "0x10", "2.5", etc.
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const n = Number(trimmed);
  return n > 0 ? n : undefined;
}

export function SearchBar({ q, startYear, endYear, onSubmit, disabled = false }: SearchBarProps) {
  const [draftQ, setDraftQ] = useState(q);
  const [draftStart, setDraftStart] = useState(startYear !== undefined ? String(startYear) : "");
  const [draftEnd, setDraftEnd] = useState(endYear !== undefined ? String(endYear) : "");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => { setDraftQ(q); }, [q]);
  useEffect(() => { setDraftStart(startYear !== undefined ? String(startYear) : ""); }, [startYear]);
  useEffect(() => { setDraftEnd(endYear !== undefined ? String(endYear) : ""); }, [endYear]);

  function handleSubmit(e?: Event) {
    e?.preventDefault();
    const s = parseYear(draftStart);
    const en = parseYear(draftEnd);
    if (s !== undefined && en !== undefined && s > en) {
      setValidationError("Start year must not exceed end year.");
      return;
    }
    setValidationError(null);
    onSubmit(draftQ.trim(), s, en);
  }

  return (
    <form class="search-bar" onSubmit={handleSubmit} role="search" noValidate>
      <input
        type="search"
        class="search-bar__input"
        aria-label="Search query"
        placeholder="Search the evidence"
        value={draftQ}
        onInput={(e) => setDraftQ((e.target as HTMLInputElement).value)}
        disabled={disabled}
      />
      <label class="search-bar__year-label">
        <span class="search-bar__year-caption">Start year</span>
        <input
          type="text"
          name="start_year"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          placeholder="YYYY"
          class="search-bar__year"
          value={draftStart}
          onInput={(e) => {
            setDraftStart((e.target as HTMLInputElement).value);
            setValidationError(null);
          }}
          disabled={disabled}
        />
      </label>
      <label class="search-bar__year-label">
        <span class="search-bar__year-caption">End year</span>
        <input
          type="text"
          name="end_year"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          placeholder="YYYY"
          class="search-bar__year"
          value={draftEnd}
          onInput={(e) => {
            setDraftEnd((e.target as HTMLInputElement).value);
            setValidationError(null);
          }}
          disabled={disabled}
        />
      </label>
      <button type="submit" class="search-bar__submit" disabled={disabled}>
        Search
      </button>
      {validationError && (
        <div class="search-bar__validation" role="alert">
          {validationError}
        </div>
      )}
    </form>
  );
}
