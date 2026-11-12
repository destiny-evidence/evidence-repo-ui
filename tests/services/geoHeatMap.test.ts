import { describe, test, expect } from "vitest";
import {
  bandLabel,
  formatShare,
  fromFrame,
  heatBands,
  heatShade,
  inFrame,
  needsDot,
  NO_ZOOM,
  placePopup,
  toFrame,
} from "@/services/geoHeatMap";

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

describe("formatShare", () => {
  test("rounds to a whole percent, never to 0% or 100% unless it is", () => {
    expect(formatShare(25, 200)).toBe("13%");
    expect(formatShare(1, 1000)).toBe("<1%");
    expect(formatShare(199, 200)).toBe(">99%");
    expect(formatShare(200, 200)).toBe("100%");
  });

  test("no share without a total", () => {
    expect(formatShare(5, 0)).toBeNull();
  });
});

describe("placePopup", () => {
  const popup = { width: 240, height: 140 };
  const frame = { width: 900, height: 420 };

  test("sits to the right of the anchor, centred on it", () => {
    expect(placePopup({ x: 300, y: 200 }, popup, frame, 12)).toEqual({
      left: 312,
      top: 130,
      side: "right",
      pointerTop: 70,
    });
  });

  test("flips left when the right would overflow", () => {
    expect(placePopup({ x: 800, y: 200 }, popup, frame, 12)).toMatchObject({
      left: 548,
      side: "left",
    });
  });

  test("stays inside the frame vertically, keeping the pointer on the anchor", () => {
    expect(placePopup({ x: 300, y: 20 }, popup, frame, 12)).toMatchObject({ top: 0, pointerTop: 20 });
    expect(placePopup({ x: 300, y: 410 }, popup, frame, 12)).toMatchObject({ top: 280, pointerTop: 130 });
  });

  test("centres over the anchor without a side when neither side fits", () => {
    expect(placePopup({ x: 200, y: 200 }, popup, { width: 400, height: 420 }, 12)).toMatchObject({
      left: 80,
      side: null,
    });
  });
});

describe("toFrame", () => {
  const viewBox = { x: 0, y: 10, width: 960, height: 440 };
  const frame = { width: 480, height: 220 };

  test("scales the viewBox to the frame", () => {
    expect(toFrame({ x: 480, y: 230 }, viewBox, NO_ZOOM, frame)).toEqual({ x: 240, y: 110 });
  });

  test("applies the zoom before scaling", () => {
    expect(toFrame({ x: 100, y: 50 }, viewBox, { k: 2, x: -100, y: -20 }, frame)).toEqual({
      x: 50,
      y: 35,
    });
  });

  test("fromFrame finds the map point under a pixel", () => {
    const zoom = { k: 2, x: -100, y: -20 };
    expect(fromFrame({ x: 50, y: 35 }, viewBox, zoom, frame)).toEqual({ x: 100, y: 50 });
  });

  test("points panned past an edge fall outside the frame", () => {
    const point = toFrame({ x: 10, y: 230 }, viewBox, { k: 4, x: -1440, y: -660 }, frame);
    expect(inFrame(point, frame)).toBe(false);
    expect(inFrame({ x: 480, y: 0 }, frame)).toBe(true);
  });
});

describe("needsDot", () => {
  test("a country without a shape always has one", () => {
    expect(needsDot(null, 100)).toBe(true);
  });

  test("a shape gives way once it's 20px across on screen", () => {
    expect(needsDot(4, 4.9)).toBe(true);
    expect(needsDot(4, 5)).toBe(false);
  });
});
