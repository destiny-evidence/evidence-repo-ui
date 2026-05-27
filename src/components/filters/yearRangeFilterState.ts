import { parseYear } from "@/utils/year";

// Raw input strings (not numbers) so a half-typed value like "20" doesn't
// roundtrip to undefined mid-edit and confuse the controlled inputs.
export interface YearRangeFilterState {
  readonly start: string;
  readonly end: string;
}

export type CommitResult =
  | { ok: true; startYear: number | undefined; endYear: number | undefined }
  | { ok: false; error: string };

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

// One-sided ranges are valid: the backend treats a missing start_year /
// end_year as "unbounded on that side". Only flag an input that's non-empty
// AND unparseable, or a two-sided range with start > end.
export function commit(state: YearRangeFilterState): CommitResult {
  const startTrim = state.start.trim();
  const endTrim = state.end.trim();
  if (startTrim !== "" && parseYear(startTrim) === undefined) {
    return { ok: false, error: "Start year must be a positive whole number." };
  }
  if (endTrim !== "" && parseYear(endTrim) === undefined) {
    return { ok: false, error: "End year must be a positive whole number." };
  }
  const startYear = parseYear(startTrim);
  const endYear = parseYear(endTrim);
  if (startYear !== undefined && endYear !== undefined && startYear > endYear) {
    return { ok: false, error: "Start year must not exceed end year." };
  }
  return { ok: true, startYear, endYear };
}

// Chip text for the collapsed FilterCard. Falls back to "" when the state is
// invalid so the chip doesn't display a misleading range.
export function summary(state: YearRangeFilterState): string {
  const result = commit(state);
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

export function isDirty(
  state: YearRangeFilterState,
  appliedStart: number | undefined,
  appliedEnd: number | undefined,
): boolean {
  const result = commit(state);
  if (!result.ok) return true;
  return result.startYear !== appliedStart || result.endYear !== appliedEnd;
}
