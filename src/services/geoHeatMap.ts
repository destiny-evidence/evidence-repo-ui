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
