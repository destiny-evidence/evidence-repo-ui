import { describe, test, expect } from "vitest";
import { bandLabel, heatBands, heatShade } from "@/services/geoHeatMap";

const ranges = (max: number) => heatBands(max).map((b) => [b.min, b.max, b.shade]);

describe("heatBands", () => {
  test("no bands without references", () => {
    expect(heatBands(0)).toEqual([]);
  });

  test("five log-spaced bands ending at the largest count", () => {
    expect(ranges(1234)).toEqual([
      [1, 4, 1],
      [5, 19, 2],
      [20, 49, 3],
      [50, 199, 4],
      [200, 1234, 5],
    ]);
    expect(ranges(100_000).map(([min]) => min)).toEqual([1, 10, 100, 1000, 10_000]);
  });

  test("small maxima get fewer bands that still reach the darkest shade", () => {
    expect(ranges(1)).toEqual([[1, 1, 5]]);
    expect(ranges(3)).toEqual([
      [1, 1, 1],
      [2, 3, 5],
    ]);
    expect(ranges(50)).toEqual([
      [1, 1, 1],
      [2, 4, 2],
      [5, 9, 3],
      [10, 19, 4],
      [20, 50, 5],
    ]);
  });
});

describe("heatShade", () => {
  const bands = heatBands(1234);

  test("zero and missing counts are unshaded", () => {
    expect(heatShade(0, bands)).toBe(0);
  });

  test("band edges are inclusive", () => {
    expect(heatShade(4, bands)).toBe(1);
    expect(heatShade(5, bands)).toBe(2);
    expect(heatShade(1234, bands)).toBe(5);
  });
});

describe("bandLabel", () => {
  test("ranges and single values", () => {
    expect(bandLabel({ min: 200, max: 1234, shade: 5 })).toBe("200–1,234");
    expect(bandLabel({ min: 1, max: 1, shade: 1 })).toBe("1");
  });
});
