import { useState } from "preact/hooks";
import { validate, type YearRangeFilterState } from "./yearRangeFilterState";
import "./YearRangeFilter.css";

interface YearRangeFilterProps {
  state: YearRangeFilterState;
  onChange: (next: YearRangeFilterState) => void;
}

export function YearRangeFilter({ state, onChange }: YearRangeFilterProps) {
  // Hide a field's error while that field is focused so the user isn't
  // yelled at mid-typing. Other fields' errors stay visible. Range errors
  // require both fields unfocused so they don't flash while either is
  // being edited.
  const [startFocused, setStartFocused] = useState(false);
  const [endFocused, setEndFocused] = useState(false);

  const result = validate(state);
  const showStartError = !startFocused ? result.startError : null;
  const showEndError = !endFocused ? result.endError : null;
  const showRangeError =
    !startFocused && !endFocused ? result.rangeError : null;
  const visibleError = showStartError || showEndError || showRangeError;

  return (
    <div class="year-range-filter">
      <div class="year-range-filter__row">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          placeholder="YYYY"
          aria-label="Start year"
          aria-invalid={showStartError !== null}
          class="year-range-filter__year"
          value={state.start}
          onInput={(e) =>
            onChange({ ...state, start: (e.target as HTMLInputElement).value })
          }
          onFocus={() => setStartFocused(true)}
          onBlur={() => setStartFocused(false)}
        />
        <span class="year-range-filter__sep" aria-hidden="true">—</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          placeholder="YYYY"
          aria-label="End year"
          aria-invalid={showEndError !== null}
          class="year-range-filter__year"
          value={state.end}
          onInput={(e) =>
            onChange({ ...state, end: (e.target as HTMLInputElement).value })
          }
          onFocus={() => setEndFocused(true)}
          onBlur={() => setEndFocused(false)}
        />
      </div>
      {visibleError && (
        <div class="year-range-filter__error" role="alert">
          {visibleError}
        </div>
      )}
    </div>
  );
}
