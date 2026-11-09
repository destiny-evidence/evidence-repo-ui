import { geoEqualEarth, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Point } from "geojson";
import world from "@/data/world-geo.json";

export interface CountryShape {
  // ISO alpha-2, or null for shapes Natural Earth gives no ISO code.
  code: string | null;
  d: string;
}

export interface CountryDot {
  code: string;
  x: number;
  y: number;
}

export interface WorldGeometry {
  viewBox: string;
  outline: string;
  countries: CountryShape[];
  borders: string;
  dots: CountryDot[];
}

export const MAP_WIDTH = 960;
const VERTICAL_PADDING = 8;

type WorldTopology = Topology<{
  countries: GeometryCollection;
  dots?: GeometryCollection;
}>;

// The globe is fitted to the full width and cropped vertically to the land,
// so the outline's southern arc runs off the bottom edge.
export function buildWorldGeometry(topology: WorldTopology): WorldGeometry {
  const countries = feature(topology, topology.objects.countries) as FeatureCollection;
  const projection = geoEqualEarth().fitWidth(MAP_WIDTH, { type: "Sphere" });
  const path = geoPath(projection);

  const [[, top]] = path.bounds({ type: "Sphere" });
  const [, [, landBottom]] = path.bounds(countries);
  const y = top - VERTICAL_PADDING;
  const height = landBottom + VERTICAL_PADDING - y;

  const dots: CountryDot[] = [];
  if (topology.objects.dots) {
    const points = feature(topology, topology.objects.dots) as FeatureCollection<Point>;
    for (const f of points.features) {
      const xy = projection(f.geometry.coordinates as [number, number]);
      if (xy) dots.push({ code: String(f.id), x: xy[0], y: xy[1] });
    }
  }

  return {
    viewBox: `0 ${y} ${MAP_WIDTH} ${height}`,
    outline: path({ type: "Sphere" }) ?? "",
    countries: countries.features.map((f: Feature) => ({
      code: f.id == null ? null : String(f.id),
      d: path(f) ?? "",
    })),
    borders: path(mesh(topology, topology.objects.countries, (a, b) => a !== b)) ?? "",
    dots,
  };
}

let cached: WorldGeometry | null = null;

export function loadWorldGeometry(): WorldGeometry {
  cached ??= buildWorldGeometry(world as unknown as WorldTopology);
  return cached;
}
