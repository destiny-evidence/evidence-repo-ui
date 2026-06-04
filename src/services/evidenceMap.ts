import type { CrossFacetCell, EvidenceMapAxis } from "@/types/models";
import {
  schemeDisplayLabel,
  type Concept,
  type ConceptScheme,
} from "@/services/vocabulary/vocabularyService";
import { countryName } from "@/utils/country";

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

// Last path/fragment/CURIE segment — a title fallback for a scheme the
// vocabulary doesn't carry.
function localName(uri: string): string {
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
 * Resolve an axis to its title, categories, and per-value label function. As in
 * the filter panel, a scheme's title comes from its vocabulary label; a country
 * axis expands ISO codes via `Intl`.
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
 * Radius (px) for a bubble of `count`, scaled so **area** is proportional to the
 * count (r ∝ √count). 0 for non-positive counts; positive counts clamp up to
 * `minRadius` so the smallest stay visible.
 */
export function bubbleRadius(
  count: number,
  maxCount: number,
  minRadius: number,
  maxRadius: number,
): number {
  if (count <= 0 || maxCount <= 0) return 0;
  return Math.max(minRadius, maxRadius * Math.sqrt(count / maxCount));
}

/** Ascending legend ticks, always ending at `maxCount`; [] when maxCount ≤ 0. */
export function legendTicks(maxCount: number): number[] {
  if (maxCount <= 0) return [];
  if (maxCount <= 3) return Array.from({ length: maxCount }, (_, i) => i + 1);
  const low = Math.max(1, Math.round(maxCount / 5));
  const mid = Math.round(maxCount / 2);
  return [...new Set([low, mid, maxCount])].sort((a, b) => a - b);
}
