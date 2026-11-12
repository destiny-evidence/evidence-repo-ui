// Builds src/data/world-geo.json from a pinned Natural Earth release.
//
//   npm run generate:geo

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { geoCentroid } from "d3-geo";
import { topology } from "topojson-server";
import { presimplify, quantile, simplify } from "topojson-simplify";
import { quantize } from "topojson-client";

// The v5.1.2 tag, pinned by commit so the files can't change under us.
const NE_COMMIT = "f1890d9f152c896d250a77557a5751a93d494776";
// Share of the least significant points to drop.
const SIMPLIFY_QUANTILE = 0.3;
const QUANTIZE = 1e4;
// Countries whose largest landmass is narrower than this (in degrees), or that
// have no shape at all, also get a dot so they can be seen.
const TINY_MAX_EXTENT_DEG = 1.5;
const DROPPED = "AQ";

const OUT = fileURLToPath(new URL("../src/data/world-geo.json", import.meta.url));
const BASE = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NE_COMMIT}/geojson`;

async function fetchLayer(file) {
  const res = await fetch(`${BASE}/${file}`);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  return res.json();
}

// Natural Earth marks shapes without an ISO code as "-99".
function isoCode(feature) {
  const countryCode = feature.properties.ISO_A2_EH;
  return /^[A-Z]{2}$/.test(countryCode) ? countryCode : null;
}

function polygons(geometry) {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

function largestRing(polys) {
  let best = null;
  for (const poly of polys) {
    const [minX, minY, maxX, maxY] = ringBounds(poly[0]);
    const area = (maxX - minX) * (maxY - minY);
    if (!best || area > best.area) best = { ring: poly[0], area, extent: Math.max(maxX - minX, maxY - minY) };
  }
  return best;
}

function ringBounds(ring) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return [minX, minY, maxX, maxY];
}

// One feature per code: Natural Earth splits some countries (e.g. AU) into
// several features. Shapes without a code stay separate.
function countryFeatures(source) {
  const byCountryCode = new Map();
  const unkeyed = [];
  for (const f of source.features) {
    const countryCode = isoCode(f);
    if (countryCode === DROPPED) continue;
    const polys = polygons(f.geometry);
    if (!countryCode) unkeyed.push(polys);
    else byCountryCode.set(countryCode, [...(byCountryCode.get(countryCode) ?? []), ...polys]);
  }
  const feature = (id, polys) => ({
    type: "Feature",
    ...(id && { id }),
    properties: {},
    geometry: { type: "MultiPolygon", coordinates: polys },
  });
  return {
    byCountryCode,
    features: [
      ...[...byCountryCode].sort(([a], [b]) => a.localeCompare(b)).map(([countryCode, polys]) => feature(countryCode, polys)),
      ...unkeyed.map((polys) => feature(null, polys)),
    ],
  };
}

function dotFeatures(byCountryCode, tinySource) {
  const points = new Map();
  for (const f of tinySource.features) {
    const countryCode = isoCode(f);
    if (countryCode && !points.has(countryCode)) points.set(countryCode, f.geometry.coordinates);
  }
  const countryCodes = new Set([...points.keys(), ...byCountryCode.keys()]);
  const dots = [];
  for (const countryCode of [...countryCodes].sort()) {
    if (countryCode === DROPPED) continue;
    const polys = byCountryCode.get(countryCode);
    const largest = polys && largestRing(polys);
    if (largest && largest.extent >= TINY_MAX_EXTENT_DEG) continue;
    const coordinates =
      points.get(countryCode) ?? geoCentroid({ type: "Polygon", coordinates: [largest.ring] });
    dots.push({ type: "Feature", id: countryCode, properties: {}, geometry: { type: "Point", coordinates } });
  }
  return dots;
}

function stripWeights(topo) {
  topo.arcs = topo.arcs.map((arc) => arc.map(([x, y]) => [x, y]));
  return topo;
}

const { byCountryCode, features } = countryFeatures(await fetchLayer("ne_50m_admin_0_countries.geojson"));
const dots = dotFeatures(byCountryCode, await fetchLayer("ne_50m_admin_0_tiny_countries.geojson"));

let topo = presimplify(
  topology({
    countries: { type: "FeatureCollection", features },
    dots: { type: "FeatureCollection", features: dots },
  }),
);
topo = stripWeights(simplify(topo, quantile(topo, SIMPLIFY_QUANTILE)));
topo = quantize(topo, QUANTIZE);

await writeFile(OUT, JSON.stringify(topo));
console.log(`Wrote ${OUT}: ${features.length} shapes, ${dots.length} dots`);
