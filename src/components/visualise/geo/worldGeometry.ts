import { geoEqualEarth, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Point, Polygon } from "geojson";
import world from "@/data/world-geo.json";

export interface CountryShape {
  // ISO alpha-2, or null for shapes Natural Earth gives no ISO code.
  countryCode: string | null;
  d: string;
  // Where a popup points: the centre of the country's largest landmass.
  anchor: { x: number; y: number };
}

export interface CountryDot {
  countryCode: string;
  x: number;
  y: number;
  // Width of the country's main landmass in viewBox units, or null when it has no shape.
  size: number | null;
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
  dots: GeometryCollection;
}>;

const equalEarth = () => geoEqualEarth().fitWidth(MAP_WIDTH, { type: "Sphere" });

// The globe is fitted to the full width and cut off a little below the land,
// with a straight edge where Antarctica would be to mirror the flat pole at the top.
export function buildWorldGeometry(topology: WorldTopology): WorldGeometry {
  const countries = feature(topology, topology.objects.countries) as FeatureCollection;
  const projection = equalEarth();
  const path = geoPath(projection);

  const [[, top]] = path.bounds({ type: "Sphere" });
  const [, [, landBottom]] = path.bounds(countries);
  const cut = landBottom + VERTICAL_PADDING;
  const y = top - VERTICAL_PADDING;
  const height = cut + VERTICAL_PADDING - y;

  const outline = geoPath(
    equalEarth().clipExtent([
      [-1, y],
      [MAP_WIDTH + 1, cut],
    ]),
  )({ type: "Sphere" });

  const shapes = countries.features.map((f) => ({
    geo: f,
    countryCode: f.id == null ? null : String(f.id),
    landmass: largestLandmass(f, path),
  }));
  const landmasses = new Map(
    shapes.flatMap((s) => (s.countryCode ? [[s.countryCode, s.landmass] as const] : [])),
  );

  const dots: CountryDot[] = [];
  const points = feature(topology, topology.objects.dots) as FeatureCollection<Point>;
  for (const f of points.features) {
    const xy = projection(f.geometry.coordinates as [number, number]);
    if (!xy) continue;
    const landmass = landmasses.get(String(f.id));
    let size: number | null = null;
    if (landmass) {
      const [[x0, y0], [x1, y1]] = path.bounds(landmass);
      size = Math.max(x1 - x0, y1 - y0);
    }
    dots.push({ countryCode: String(f.id), x: xy[0], y: xy[1], size });
  }

  return {
    viewBox: `0 ${y} ${MAP_WIDTH} ${height}`,
    outline: outline ?? "",
    countries: shapes.map(({ geo, countryCode, landmass }) => {
      const [x, y] = path.centroid(landmass);
      return { countryCode, d: path(geo) ?? "", anchor: { x, y } };
    }),
    borders: path(mesh(topology, topology.objects.countries, (a, b) => a !== b)) ?? "",
    dots,
  };
}

export function loadWorldGeometry(): WorldGeometry {
  return buildWorldGeometry(world as unknown as WorldTopology);
}

function largestLandmass(f: Feature, path: ReturnType<typeof geoPath>): Feature | Polygon {
  const g = f.geometry;
  let target: Feature | Polygon = f;
  if (g.type === "MultiPolygon") {
    let largest = -1;
    for (const coordinates of g.coordinates) {
      const polygon: Polygon = { type: "Polygon", coordinates };
      const area = path.area(polygon);
      if (area > largest) {
        largest = area;
        target = polygon;
      }
    }
  }
  return target;
}
