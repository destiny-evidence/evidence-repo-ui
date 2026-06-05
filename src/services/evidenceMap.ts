import type { CrossFacetCell, EvidenceMapAxis } from "@/types/models";
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
    return { title: COUNTRIES_AXIS_TITLE, categories: [], labelFor: countryName };
  }
  // Scheme URIs are full IRIs after parsing, so this matches directly.
  const scheme = schemes?.find((s) => s.uri === axis.schemeUri);
  return {
    title: scheme ? schemeDisplayLabel(scheme.label) : localName(axis.schemeUri),
    categories: scheme ? flattenScheme(scheme) : [],
    labelFor: (value) => labels?.get(value) ?? value,
  };
}

// The backend treats every concept in a scheme as a sibling regardless of depth.
function flattenScheme(scheme: ConceptScheme): AxisCategory[] {
  const out: AxisCategory[] = [];
  const walk = (concepts: readonly Concept[]) => {
    for (const concept of concepts) {
      out.push({ key: concept.uri, label: concept.label });
      if (concept.narrower) walk(concept.narrower);
    }
  };
  walk(scheme.topConcepts);
  return out;
}

function mergeCategories(axis: AxisInput, cellKeys: Set<string>): AxisCategory[] {
  const byKey = new Map<string, AxisCategory>();
  for (const category of axis.categories) byKey.set(category.key, category);
  for (const key of cellKeys) {
    if (!byKey.has(key)) byKey.set(key, { key, label: axis.labelFor(key) });
  }
  return [...byKey.values()].sort(
    (a, b) => a.label.localeCompare(b.label) || a.key.localeCompare(b.key),
  );
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
