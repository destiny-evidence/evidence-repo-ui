import { validate, type YearRangeFilterState } from "./yearRangeFilterState";
import "./YearRangeFilter.css";

interface YearRangeFilterProps {
  state: YearRangeFilterState;
  onChange: (next: YearRangeFilterState) => void;
}

export function YearRangeFilter({ state, onChange }: YearRangeFilterProps) {
  const result = validate(state);
  const error = result.ok ? null : result.error;

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
          aria-invalid={error !== null}
          class="year-range-filter__year"
          value={state.start}
          onInput={(e) =>
            onChange({ ...state, start: (e.target as HTMLInputElement).value })
          }
        />
        <span class="year-range-filter__sep" aria-hidden="true">—</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          placeholder="YYYY"
          aria-label="End year"
          aria-invalid={error !== null}
          class="year-range-filter__year"
          value={state.end}
          onInput={(e) =>
            onChange({ ...state, end: (e.target as HTMLInputElement).value })
          }
        />
      </div>
      {error && (
        <div class="year-range-filter__error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
