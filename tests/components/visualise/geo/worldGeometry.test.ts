import { describe, test, expect } from "vitest";
import { geoArea } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { FeatureCollection } from "geojson";
import world from "@/data/world-geo.json";
import { loadWorldGeometry } from "@/components/visualise/geo/worldGeometry";

// Guards the committed output of scripts/generate-world-geo.mjs.
describe("world geometry", () => {
  const geometry = loadWorldGeometry();
  const codes = geometry.countries.map((c) => c.code);
  const keyed = codes.filter((c): c is string => c !== null);
  const dotCodes = geometry.dots.map((d) => d.code);

  test("one shape per ISO alpha-2 code", () => {
    expect(keyed.every((c) => /^[A-Z]{2}$/.test(c))).toBe(true);
    expect(new Set(keyed).size).toBe(keyed.length);
  });

  test("countries Natural Earth only codes in ISO_A2_EH resolve", () => {
    expect(keyed).toEqual(expect.arrayContaining(["FR", "NO", "XK"]));
  });

  test("Antarctica is dropped and uncoded shapes are kept", () => {
    expect(keyed).not.toContain("AQ");
    expect(codes.filter((c) => c === null).length).toBeGreaterThan(0);
  });

  test("small countries get dots and large ones don't", () => {
    expect(dotCodes).toEqual(expect.arrayContaining(["SG", "HK", "MT", "GI"]));
    expect(dotCodes).not.toContain("GB");
    expect(dotCodes).not.toContain("AU");
  });

  test("no shape is wound inside out", () => {
    const topo = world as unknown as Topology<{ countries: GeometryCollection }>;
    const countries = feature(topo, topo.objects.countries) as FeatureCollection;
    const largest = Math.max(...countries.features.map((f) => geoArea(f)));
    // Russia is about 3% of the sphere (4π steradians).
    expect(largest).toBeLessThan(Math.PI);
  });

  test("every shape and dot is drawn", () => {
    expect(geometry.countries.every((c) => c.d.length > 0)).toBe(true);
    expect(geometry.dots.every((d) => Number.isFinite(d.x) && Number.isFinite(d.y))).toBe(true);
    expect(geometry.viewBox.split(" ")[2]).toBe("960");
  });

  test("the outline is cut off with a visible edge above the bottom of the view", () => {
    const [, y, , height] = geometry.viewBox.split(" ").map(Number);
    const ys = [...geometry.outline.matchAll(/-?[\d.]+,(-?[\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.max(...ys)).toBeLessThan(y + height);
  });
});
