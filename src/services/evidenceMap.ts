import type {
  CrossFacetCell,
  EvidenceMapAxes,
  EvidenceMapAxis,
} from "@/types/models";
import type { SearchParams } from "@/services/searchParams";
import {
  schemeDisplayLabel,
  type Concept,
  type ConceptScheme,
} from "@/services/vocabulary/vocabularyService";
import { countryName } from "@/utils/country";
import { AXIS_COUNTRIES } from "@/services/crossFacets";

// The token written to / read from the URL (and a <select> value) for an axis.
export function axisToken(axis: EvidenceMapAxis): string {
  return axis.kind === "countries" ? AXIS_COUNTRIES : axis.schemeUri;
}

export function parseAxis(token: string): EvidenceMapAxis {
  return token === AXIS_COUNTRIES
    ? { kind: "countries" }
    : { kind: "scheme", schemeUri: token };
}

export interface AxisCategory {
  key: string;
  label: string;
}

export interface EvidenceMapModel {
  rows: AxisCategory[];
  columns: AxisCategory[];
  // undefined ⇒ empty intersection; the backend omits zero-count cells.
  getCount(rowKey: string, columnKey: string): number | undefined;
  maxCount: number;
}

type AxisInput = Pick<ResolvedAxis, "categories" | "labelFor">;

/**
 * Rows and columns are the union of each axis's categories (so zero-hit values
 * still render) with any keys seen only in the cells (so data is never dropped).
 * Counts and the maximum come from the cells.
 */
export function buildEvidenceMapModel(
  cells: readonly CrossFacetCell[],
  rowAxis: AxisInput,
  columnAxis: AxisInput,
): EvidenceMapModel {
  const rowKeys = new Set<string>();
  const columnKeys = new Set<string>();
  const counts = new Map<string, Map<string, number>>();
  let maxCount = 0;

  for (const cell of cells) {
    const [rowKey, columnKey] = cell.axes;
    rowKeys.add(rowKey);
    columnKeys.add(columnKey);
    let row = counts.get(rowKey);
    if (!row) counts.set(rowKey, (row = new Map()));
    // Summed defensively; the endpoint emits one cell per pair.
    const next = (row.get(columnKey) ?? 0) + cell.count;
    row.set(columnKey, next);
    if (next > maxCount) maxCount = next;
  }

  return {
    rows: mergeCategories(rowAxis, rowKeys),
    columns: mergeCategories(columnAxis, columnKeys),
    getCount: (rowKey, columnKey) => counts.get(rowKey)?.get(columnKey),
    maxCount,
  };
}

// Last path/fragment/CURIE segment — a label fallback for a scheme the
// vocabulary doesn't carry.
export function localName(uri: string): string {
  return uri.split(/[/#:]/).filter(Boolean).pop() ?? uri;
}

const COUNTRIES_AXIS_TITLE = "Countries";

export interface ResolvedAxis {
  title: string;
  // Every value the axis can take (a scheme's concepts), so the grid renders
  // zero-hit rows/columns. Empty for a countries axis ⇒ derived from the cells.
  categories: AxisCategory[];
  labelFor: (value: string) => string;
}

/**
 * Resolve an axis to its title, categories, and per-value label function.
 */
export function resolveMapAxis(
  axis: EvidenceMapAxis,
  schemes: readonly ConceptScheme[] | null,
  labels: ReadonlyMap<string, string> | null,
): ResolvedAxis {
  if (axis.kind === "countries") {
    return {
      title: COUNTRIES_AXIS_TITLE,
      categories: [],
      labelFor: countryName,
    };
  }
  // Scheme URIs are full URIs after parsing, so this matches directly.
  const scheme = schemes?.find((s) => s.uri === axis.schemeUri);
  return {
    title: scheme
      ? schemeDisplayLabel(scheme.label)
      : localName(axis.schemeUri),
    categories: scheme ? flattenScheme(scheme) : [],
    labelFor: (value) => labels?.get(value) ?? value,
  };
}

// Flatten the scheme to a depth-first preorder list: each concept immediately
// followed by its descendants, so a parent and its children sit adjacent in the
// grid (#148). Siblings at every level are alphabetized by label.
function flattenScheme(scheme: ConceptScheme): AxisCategory[] {
  const out: AxisCategory[] = [];
  const walk = (concepts: readonly Concept[]) => {
    for (const concept of [...concepts].sort(byLabelThenKey)) {
      out.push({ key: concept.uri, label: concept.label });
      if (concept.narrower) walk(concept.narrower);
    }
  };
  walk(scheme.topConcepts);
  return out;
}

const byLabelThenKey = (
  a: { label: string; uri?: string; key?: string },
  b: { label: string; uri?: string; key?: string },
): number =>
  a.label.localeCompare(b.label) ||
  (a.uri ?? a.key ?? "").localeCompare(b.uri ?? b.key ?? "");

// Axis categories keep their given order — a scheme's hierarchy (#148), or the
// empty list for a countries axis. Cell-only keys the axis doesn't enumerate
// trail them, alphabetized; a countries axis (no categories) is thus fully
// alphabetical.
function mergeCategories(
  axis: AxisInput,
  cellKeys: Set<string>,
): AxisCategory[] {
  const known = new Set(axis.categories.map((c) => c.key));
  const extras: AxisCategory[] = [];
  for (const key of cellKeys) {
    if (!known.has(key)) extras.push({ key, label: axis.labelFor(key) });
  }
  extras.sort(byLabelThenKey);
  return [...axis.categories, ...extras];
}

/**
 * Radius (px) for a bubble of `count`, on a square-root ramp from `minRadius`
 * at the smallest count (1) to `maxRadius` at `maxCount`, interpolating on
 * √count. Anchoring the floor at 1 keeps differences across the lower half visible
 * while staying close to area-proportional. The in-bubble number carries the
 * exact value.
 */
export function bubbleRadius(
  count: number,
  maxCount: number,
  minRadius: number,
  maxRadius: number,
): number {
  if (count <= 0 || maxCount <= 0) return 0;
  // One distinct count in play ⇒ no range to map; show it at full size.
  if (maxCount <= 1) return maxRadius;
  // count ≥ 1 ⇒ fraction ≥ 0, so this never falls below minRadius.
  const fraction = (Math.sqrt(count) - 1) / (Math.sqrt(maxCount) - 1);
  return minRadius + (maxRadius - minRadius) * fraction;
}

const compactFormatter = new Intl.NumberFormat(undefined, {
  notation: "compact",
});

/**
 * Compact bubble label (e.g. 1.2K, 12K, 1M) so a count's width stays bounded as
 * the magnitude grows — otherwise a 5-digit number needs a near-maximum bubble
 * just to fit, and size stops reading as scale. Counts below 1000 render as-is;
 * the exact value lives in the tooltip and the table.
 */
export function formatCompact(count: number): string {
  return compactFormatter.format(count);
}

/**
 * Legend ticks for the square-root ramp: the floor (1), the maximum, and the
 * count whose bubble sits visually halfway between them (where √count is the
 * midpoint of √1..√maxCount). Lists every value for tiny maxima; [] when
 * maxCount ≤ 0.
 */
export function legendTicks(maxCount: number): number[] {
  if (maxCount <= 0) return [];
  if (maxCount <= 3) return Array.from({ length: maxCount }, (_, i) => i + 1);
  const mid = Math.round(((1 + Math.sqrt(maxCount)) / 2) ** 2);
  return [1, mid, maxCount];
}

/**
 * Search params for the cell at (row, column): the map's current filters plus
 * both axis values applied as filters (see applyAxisFilter). Page resets to 1
 * since the result set changes.
 */
export function cellSearchParams(
  base: SearchParams,
  axes: EvidenceMapAxes,
  row: AxisCategory,
  column: AxisCategory,
): SearchParams {
  let next = base;
  for (const [axis, category] of [
    [axes.row, row],
    [axes.column, column],
  ] as const) {
    next = applyAxisFilter(next, axis, category);
  }
  return { ...next, page: 1 };
}

/**
 * Search params for a single axis header: the map's current filters plus that
 * one axis value applied as a filter. Powers the clickable row/column headers,
 * which deep-link into Search filtered by just that category.
 */
export function axisSearchParams(
  base: SearchParams,
  axis: EvidenceMapAxis,
  category: AxisCategory,
): SearchParams {
  return { ...applyAxisFilter(base, axis, category), page: 1 };
}

// Applies one axis value as a filter: a scheme axis contributes a single-concept
// filter group (AND'd with any existing groups, mirroring the cross-facet
// query); a countries axis contributes a country code.
function applyAxisFilter(
  base: SearchParams,
  axis: EvidenceMapAxis,
  category: AxisCategory,
): SearchParams {
  if (axis.kind === "countries") {
    if (base.countryCodes.includes(category.key)) return base;
    return { ...base, countryCodes: [...base.countryCodes, category.key] };
  }
  return { ...base, conceptFilters: [...base.conceptFilters, [category.key]] };
}

// history.state key set when a cell deep-links into Search; its value is the
// canonical map URL to return to. State (not a URL param) so a shared/bookmarked
// search link — where the recipient never came from a map — shows no back link.
const BACK_TO_VISUALISE = "backToVisualise";

export function backToVisualiseState(mapUrl: string): Record<string, string> {
  return { [BACK_TO_VISUALISE]: mapUrl };
}

// Reads the return URL out of an opaque history.state, or null if absent.
export function backToVisualiseUrl(state: unknown): string | null {
  if (state && typeof state === "object" && BACK_TO_VISUALISE in state) {
    const url = (state as Record<string, unknown>)[BACK_TO_VISUALISE];
    if (typeof url === "string") return url;
  }
  return null;
}
