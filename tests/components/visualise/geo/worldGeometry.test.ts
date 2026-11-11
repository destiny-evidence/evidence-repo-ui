import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { geoArea, geoEqualEarth } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { FeatureCollection } from "geojson";
import world from "@/data/world-geo.json";
import { loadWorldGeometry, MAP_WIDTH } from "@/components/visualise/geo/worldGeometry";

// Guards the committed output of scripts/generate-world-geo.mjs.
describe("world geometry", () => {
  const geometry = loadWorldGeometry();
  const countryCodes = geometry.countries.map((c) => c.countryCode);
  const keyed = countryCodes.filter((c): c is string => c !== null);
  const dotCountryCodes = geometry.dots.map((d) => d.countryCode);

  test("one shape per ISO alpha-2 countryCode", () => {
    expect(keyed.every((c) => /^[A-Z]{2}$/.test(c))).toBe(true);
    expect(new Set(keyed).size).toBe(keyed.length);
  });

  test("countries Natural Earth only countryCodes in ISO_A2_EH resolve", () => {
    expect(keyed).toEqual(expect.arrayContaining(["FR", "NO", "XK"]));
  });

  test("Antarctica is dropped and uncoded shapes are kept", () => {
    expect(keyed).not.toContain("AQ");
    expect(countryCodes.filter((c) => c === null).length).toBeGreaterThan(0);
  });

  test("small countries get dots and large ones don't", () => {
    expect(dotCountryCodes).toEqual(expect.arrayContaining(["SG", "HK", "MT", "GI"]));
    expect(dotCountryCodes).not.toContain("GB");
    expect(dotCountryCodes).not.toContain("AU");
  });

  test("no shape is wound inside out", () => {
    const topo = world as unknown as Topology<{ countries: GeometryCollection }>;
    const countries = feature(topo, topo.objects.countries) as FeatureCollection;
    const largest = Math.max(...countries.features.map((f) => geoArea(f)));
    // Russia is about 3% of the sphere (4π steradians).
    expect(largest).toBeLessThan(Math.PI);
  });

  test("dots carry the size of their country's main landmass, or none without a shape", () => {
    const size = (countryCode: string) =>
      geometry.dots.find((d) => d.countryCode === countryCode)!.size;
    // Luxembourg is about 0.8° across, a little under 2 units at this width.
    expect(size("LU")).toBeGreaterThan(1.5);
    expect(size("LU")).toBeLessThan(2.5);
    expect(size("GI")).toBeNull();
  });

  test("every shape and dot is drawn", () => {
    expect(geometry.countries.every((c) => c.d.length > 0)).toBe(true);
    expect(geometry.dots.every((d) => Number.isFinite(d.x) && Number.isFinite(d.y))).toBe(true);
    expect(geometry.viewBox.split(" ")[2]).toBe("960");
  });

  test("anchors sit on a country's main landmass, not between its parts", () => {
    const projection = geoEqualEarth().fitWidth(MAP_WIDTH, { type: "Sphere" });
    const near = (countryCode: string, lonLat: [number, number]) => {
      const { anchor } = geometry.countries.find((c) => c.countryCode === countryCode)!;
      const [x, y] = projection(lonLat)!;
      expect(Math.hypot(anchor.x - x, anchor.y - y)).toBeLessThan(15);
    };
    // The US without Alaska and Hawaii, and France without French Guiana.
    near("US", [-98, 39]);
    near("FR", [2.5, 46.5]);
  });

  test("the frame's aspect ratio in the CSS matches the viewBox", () => {
    const [, , width, height] = geometry.viewBox.split(" ").map(Number);
    // Read from disk because Vitest blanks CSS imports, even with ?raw.
    const css = readFileSync(
      resolve(__dirname, "../../../../src/components/visualise/GeographicHeatMap.css"),
      "utf8",
    );
    const match = css.match(/aspect-ratio:\s*([\d.]+)\s*\/\s*([\d.]+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1]) / Number(match![2])).toBeCloseTo(width / height, 2);
  });

  test("the outline is cut off with a visible edge above the bottom of the view", () => {
    const [, y, , height] = geometry.viewBox.split(" ").map(Number);
    const ys = [...geometry.outline.matchAll(/-?[\d.]+,(-?[\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.max(...ys)).toBeLessThan(y + height);
  });
});
