import { parseYear } from "@/utils/year";

// Raw input strings (not numbers) so a half-typed value like "20" doesn't
// roundtrip to undefined mid-edit and confuse the controlled inputs.
export interface YearRangeFilterState {
  readonly start: string;
  readonly end: string;
}

// Per-field errors
export interface ValidationResult {
  ok: boolean;
  startYear: number | undefined;
  endYear: number | undefined;
  startError: string | null;
  endError: string | null;
  rangeError: string | null;
}

export function emptyYearRangeState(): YearRangeFilterState {
  return { start: "", end: "" };
}

function yearToInput(year: number | undefined): string {
  return year !== undefined ? String(year) : "";
}

export function yearRangeFromParams(
  startYear: number | undefined,
  endYear: number | undefined,
): YearRangeFilterState {
  return { start: yearToInput(startYear), end: yearToInput(endYear) };
}

// One-sided ranges are valid.
export function validate(state: YearRangeFilterState): ValidationResult {
  const startTrim = state.start.trim();
  const endTrim = state.end.trim();
  const startError =
    startTrim !== "" && !isFourDigitYear(startTrim)
      ? "Start year must be a 4-digit number."
      : null;
  const endError =
    endTrim !== "" && !isFourDigitYear(endTrim)
      ? "End year must be a 4-digit number."
      : null;
  const startYear = startError === null ? parseYear(startTrim) : undefined;
  const endYear = endError === null ? parseYear(endTrim) : undefined;
  const rangeError =
    startYear !== undefined && endYear !== undefined && startYear > endYear
      ? "Start year must not exceed end year."
      : null;
  return {
    ok: startError === null && endError === null && rangeError === null,
    startYear,
    endYear,
    startError,
    endError,
    rangeError,
  };
}

function isFourDigitYear(raw: string): boolean {
  return /^\d{4}$/.test(raw) && parseYear(raw) !== undefined;
}

// Chip text for the collapsed FilterCard. Falls back to "" when the state is
// invalid so the chip doesn't display a misleading range.
export function summary(state: YearRangeFilterState): string {
  const result = validate(state);
  if (!result.ok) return "";
  const { startYear, endYear } = result;
  if (startYear !== undefined && endYear !== undefined) return `${startYear}–${endYear}`;
  if (startYear !== undefined) return `from ${startYear}`;
  if (endYear !== undefined) return `to ${endYear}`;
  return "";
}

// Year range is binary for badge purposes: a one- or two-sided range counts
// as a single applied filter regardless of which bound(s) are set.
export function totalSelectedCount(
  startYear: number | undefined,
  endYear: number | undefined,
): number {
  return startYear !== undefined || endYear !== undefined ? 1 : 0;
}

// Empty or a 4-digit year — the only inputs we treat as "complete" for the
// purposes of the eager facet refetch. Partial input like "20" stays out so
// every keystroke doesn't trigger a request.
export function isYearInputReady(raw: string): boolean {
  const t = raw.trim();
  return t === "" || isFourDigitYear(t);
}

export function isDirty(
  state: YearRangeFilterState,
  appliedStart: number | undefined,
  appliedEnd: number | undefined,
): boolean {
  const result = validate(state);
  if (!result.ok) return true;
  return result.startYear !== appliedStart || result.endYear !== appliedEnd;
}
