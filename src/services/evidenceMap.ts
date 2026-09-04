import type {
  CrossFacetCell,
  EvidenceMapAxes,
  EvidenceMapAxis,
  EvidenceMapRenderLimits,
} from "@/types/models";
import type { SearchParams } from "@/services/searchParams";
import {
  compareLabels,
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
  // The concept's SKOS definition, when the vocabulary carries one. Surfaced in
  // the row/column header tooltip so a reader can see the scope of that axis
  // value. Absent for countries and for cell-only keys the axis doesn't enumerate.
  definition?: string;
}

export interface AxisConcept {
  category: AxisCategory;
  depth: number;
  narrower: AxisConcept[];
}

export interface EvidenceMapModel {
  rows: AxisCategory[];
  columns: AxisCategory[];
  // undefined ⇒ empty intersection; the backend omits zero-count cells.
  getCount(rowKey: string, columnKey: string): number | undefined;
  maxCount: number;
}

export function exceedsEvidenceMapRenderLimits(
  rowCount: number,
  columnCount: number,
  limits: EvidenceMapRenderLimits,
): boolean {
  return rowCount * columnCount > limits.maxCells;
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
  // Present for a resolved scheme; absent for countries and unknown schemes.
  tree?: AxisConcept[];
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
  const tree = scheme ? buildConceptTree(scheme) : undefined;
  return {
    title: scheme
      ? schemeDisplayLabel(scheme.label)
      : localName(axis.schemeUri),
    categories: tree ? flattenTree(tree) : [],
    tree,
    labelFor: (value) => labels?.get(value) ?? value,
  };
}

// Build one ordered tree, skipping concepts already reached through another path.
export function buildConceptTree(scheme: ConceptScheme): AxisConcept[] {
  const seen = new Set<string>();
  const walk = (
    concepts: readonly Concept[],
    depth: number,
  ): AxisConcept[] => {
    const nodes: AxisConcept[] = [];
    for (const concept of concepts) {
      if (seen.has(concept.uri)) continue;
      seen.add(concept.uri);
      nodes.push({
        category: {
          key: concept.uri,
          label: concept.label,
          definition: concept.definition,
        },
        depth,
        narrower: walk(concept.narrower ?? [], depth + 1),
      });
    }
    return nodes;
  };
  return walk(scheme.topConcepts, 0);
}

export interface VisibleAxisCategory extends AxisCategory {
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
}

export interface AxisBandCell extends VisibleAxisCategory {
  // Visible leaves covered along the grid axis.
  span: number;
  // Header tiers covered across the grid axis.
  tierSpan: number;
  // Set only while expanded; lets the grid move focus onto the revealed band.
  firstChildKey?: string;
}

export interface AxisBands {
  maxDepth: number;
  // Column-oriented cells grouped from shallowest to deepest tier.
  tiers: AxisBandCell[][];
  // Terminal categories used for grid cells and count lookup.
  leaves: AxisCategory[];
  // Row-oriented cells grouped by their matching terminal category.
  rail: AxisBandCell[][];
}

export function defaultExpandedKeys(
  tree: readonly AxisConcept[],
): Set<string> {
  return new Set(
    tree
      .filter((node) => node.narrower.length > 0)
      .map((node) => node.category.key),
  );
}

export function visibleTreeCategories(
  tree: readonly AxisConcept[],
  expandedKeys: ReadonlySet<string>,
): VisibleAxisCategory[] {
  const categories: VisibleAxisCategory[] = [];
  const walk = (nodes: readonly AxisConcept[]) => {
    for (const node of nodes) {
      const hasChildren = node.narrower.length > 0;
      const expanded = hasChildren && expandedKeys.has(node.category.key);
      categories.push({
        ...node.category,
        depth: node.depth,
        hasChildren,
        expanded,
      });
      if (expanded) walk(node.narrower);
    }
  };
  walk(tree);
  return categories;
}

// Derive column tiers and the row rail together so sibling offsets stay aligned.
export function buildAxisBands(
  tree: readonly AxisConcept[],
  expandedKeys: ReadonlySet<string>,
): AxisBands {
  if (tree.length === 0) {
    return { maxDepth: 0, tiers: [], leaves: [], rail: [] };
  }

  const visible = visibleTreeCategories(tree, expandedKeys);
  const maxDepth = visible.reduce(
    (deepest, category) => Math.max(deepest, category.depth),
    0,
  );
  const tiers: AxisBandCell[][] = Array.from(
    { length: maxDepth + 1 },
    () => [],
  );
  const leaves: AxisCategory[] = [];
  const rail: AxisBandCell[][] = [];

  const walk = (nodes: readonly AxisConcept[]) => {
    for (const node of nodes) {
      const hasChildren = node.narrower.length > 0;
      const expanded = hasChildren && expandedKeys.has(node.category.key);
      const cell: AxisBandCell = {
        ...node.category,
        depth: node.depth,
        hasChildren,
        expanded,
        span: 1,
        tierSpan: expanded ? 1 : maxDepth - node.depth + 1,
        firstChildKey: expanded ? node.narrower[0].category.key : undefined,
      };
      tiers[node.depth].push(cell);

      if (expanded) {
        const firstLeaf = rail.length;
        walk(node.narrower);
        cell.span = rail.length - firstLeaf;
        rail[firstLeaf].unshift(cell);
      } else {
        leaves.push(node.category);
        rail.push([cell]);
      }
    }
  };
  walk(tree);
  return { maxDepth, tiers, leaves, rail };
}

// Hidden descendants must not return through the model's cell-only fallback.
export function restrictCellsToLeaves(
  cells: readonly CrossFacetCell[],
  rowLeafKeys: ReadonlySet<string> | null,
  columnLeafKeys: ReadonlySet<string> | null,
): readonly CrossFacetCell[] {
  if (!rowLeafKeys && !columnLeafKeys) return cells;
  return cells.filter(({ axes: [rowKey, columnKey] }) => {
    if (rowLeafKeys && !rowLeafKeys.has(rowKey)) return false;
    if (columnLeafKeys && !columnLeafKeys.has(columnKey)) return false;
    return true;
  });
}

// Flatten the tree in depth-first order so parents remain beside descendants.
function flattenTree(tree: readonly AxisConcept[]): AxisCategory[] {
  const out: AxisCategory[] = [];
  const walk = (nodes: readonly AxisConcept[]) => {
    for (const node of nodes) {
      out.push(node.category);
      walk(node.narrower);
    }
  };
  walk(tree);
  return out;
}

// Axis categories keep their given order — a scheme's hierarchy, or the empty
// list for a countries axis. Cell-only keys the axis doesn't enumerate trail
// them, alphabetized; a countries axis (no categories) is thus fully alphabetical.
function mergeCategories(
  axis: AxisInput,
  cellKeys: Set<string>,
): AxisCategory[] {
  const known = new Set(axis.categories.map((c) => c.key));
  const extras: AxisCategory[] = [];
  for (const key of cellKeys) {
    if (!known.has(key)) extras.push({ key, label: axis.labelFor(key) });
  }
  extras.sort((a, b) => compareLabels({ label: a.label, uri: a.key }, { label: b.label, uri: b.key }));
  return [...axis.categories, ...extras];
}

export type CellSize = "small" | "medium" | "large" | "xlarge";

export interface CellSizeMetrics {
  // Column width floor and ceiling: the floor keeps short labels from cramping,
  // the ceiling lets a long word widen its column rather than break mid-word.
  minColumnWidth: number;
  maxColumnWidth: number;
  // Row height, and so the height of one nested column-header tier — the sticky
  // offsets are multiples of it.
  cellHeight: number;
  // Width of one nested row-header tier.
  railWidth: number;
  minRadius: number;
  maxRadius: number;
}

/**
 * Grid geometry per cell-size step. The bubble range scales with the row so a
 * larger cell reads as a larger map rather than as more whitespace; `medium` is
 * the default and holds the geometry the map had before the control existed.
 */
export const CELL_SIZES: Record<CellSize, CellSizeMetrics> = {
  small: {
    minColumnWidth: 96,
    maxColumnWidth: 132,
    cellHeight: 48,
    railWidth: 128,
    minRadius: 6,
    maxRadius: 15,
  },
  medium: {
    minColumnWidth: 132,
    maxColumnWidth: 180,
    cellHeight: 64,
    railWidth: 160,
    minRadius: 9,
    maxRadius: 22,
  },
  large: {
    minColumnWidth: 168,
    maxColumnWidth: 228,
    cellHeight: 80,
    railWidth: 192,
    minRadius: 12,
    maxRadius: 29,
  },
  xlarge: {
    minColumnWidth: 204,
    maxColumnWidth: 276,
    cellHeight: 96,
    railWidth: 224,
    minRadius: 15,
    maxRadius: 36,
  },
};

export const DEFAULT_CELL_SIZE: CellSize = "medium";

/**
 * Radius (px) for a bubble of `count`, on a logarithmic ramp from `minRadius`
 * at the smallest count (1) to `maxRadius` at `maxCount`. Every 10× step in
 * count claims an equal slice of the radius range, so "ten times as many" reads
 * the same anywhere on the scale. Counts here span 1 to hundreds of thousands,
 * where an area-proportional ramp leaves everything below ~10³ within a pixel
 * of the floor. Size therefore ranks rather than measures; the in-bubble number
 * carries the exact value.
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
  // count ≥ 1 ⇒ fraction ≥ 0, so this never falls below minRadius; the clamp
  // guards a count passed above the maximum.
  const fraction = Math.min(1, Math.log(count) / Math.log(maxCount));
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

const MAX_LEGEND_TICKS = 5;

/**
 * Legend ticks for the logarithmic ramp: the floor (1), the powers of ten below
 * the maximum, and the maximum — the ramp's own breakpoints, each an equal step
 * up the radius range. Lists every value for tiny maxima; [] when maxCount ≤ 0.
 */
export function legendTicks(maxCount: number): number[] {
  if (maxCount <= 0) return [];
  if (maxCount <= 3) return Array.from({ length: maxCount }, (_, i) => i + 1);
  // A power within 2× of the maximum is dropped: its bubble is all but the same
  // size, so the two swatches would read as one. Where more powers remain than
  // fit the row, keep those nearest the maximum — the low end is anchored by 1.
  const powers: number[] = [];
  for (let power = 10; power * 2 <= maxCount; power *= 10) powers.push(power);
  return [1, ...powers.slice(-(MAX_LEGEND_TICKS - 2)), maxCount];
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
