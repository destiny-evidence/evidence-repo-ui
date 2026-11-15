import { toQueryString, type SearchParams } from "@/services/searchParams";
import type { CommunityFeatures } from "@/types/models";

// The map has nothing to show without country facets.
export function heatMapEnabled(
  features: Pick<CommunityFeatures, "countrySearchable">,
): boolean {
  return features.countrySearchable;
}

export function heatMapPath(communitySlug: string): string {
  return `/${communitySlug}/visualise/geographic`;
}

export function heatMapQueryString(params: SearchParams): string {
  return toQueryString({ ...params, page: 1, sort: undefined });
}

export function buildHeatMapUrl(communitySlug: string, params: SearchParams): string {
  const qs = heatMapQueryString(params);
  return qs ? `${heatMapPath(communitySlug)}?${qs}` : heatMapPath(communitySlug);
}

export const HEAT_SHADES = 5;

export interface HeatBand {
  min: number;
  max: number;
  // 1 (lightest) to HEAT_SHADES (darkest).
  shade: number;
}

// 1, 2, 5, 10, 20, 50, …
function niceStep(index: number): number {
  return [1, 2, 5][index % 3] * 10 ** Math.floor(index / 3);
}

// Up to HEAT_SHADES bands from 1 to maxCount, with lower edges evenly spaced
// along the 1-2-5 sequence so the bands are roughly even on a log scale.
export function heatBands(maxCount: number): HeatBand[] {
  if (maxCount < 1) return [];
  let top = 0;
  while (niceStep(top + 1) <= maxCount) top++;

  const mins = [1];
  for (let i = 1; i < HEAT_SHADES; i++) {
    const min = niceStep(Math.round((top * i) / HEAT_SHADES));
    if (min > mins[mins.length - 1]) mins.push(min);
  }

  const n = mins.length;
  return mins.map((min, i) => ({
    min,
    max: i + 1 < n ? mins[i + 1] - 1 : maxCount,
    shade: n === 1 ? HEAT_SHADES : 1 + Math.round((i * (HEAT_SHADES - 1)) / (n - 1)),
  }));
}

// The shade for a count, or 0 for no references.
export function heatShade(count: number, bands: readonly HeatBand[]): number {
  if (count < 1) return 0;
  for (const band of bands) {
    if (count <= band.max) return band.shade;
  }
  return bands.length > 0 ? bands[bands.length - 1].shade : 0;
}

export function bandLabel(band: HeatBand): string {
  return band.min === band.max
    ? band.min.toLocaleString()
    : `${band.min.toLocaleString()}–${band.max.toLocaleString()}`;
}

// A country's share of the references on the map, rounded to a whole percent
// that never rounds to 0% or 100% unless it is.
export function formatShare(count: number, total: number): string | null {
  if (total <= 0) return null;
  const percent = (count / total) * 100;
  if (percent > 0 && percent < 1) return "<1%";
  if (percent > 99 && percent < 100) return ">99%";
  return `${Math.round(percent)}%`;
}

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface PopupPlacement {
  left: number;
  top: number;
  // Which side of the anchor the popup sits on, or null when neither fits.
  side: "left" | "right" | null;
  // The anchor's height within the popup, for its pointer.
  pointerTop: number;
}

// Beside the anchor, on the right unless only the left fits, and kept inside the frame.
export function placePopup(
  anchor: Point,
  popup: Size,
  frame: Size,
  gap: number,
): PopupPlacement {
  let side: PopupPlacement["side"] = "right";
  let left = anchor.x + gap;
  if (left + popup.width > frame.width) {
    side = "left";
    left = anchor.x - gap - popup.width;
  }
  if (left < 0) {
    side = null;
    left = clamp(anchor.x - popup.width / 2, 0, frame.width - popup.width);
  }
  const top = clamp(anchor.y - popup.height / 2, 0, frame.height - popup.height);
  return { left, top, side, pointerTop: anchor.y - top };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, Math.max(min, max)));
}
