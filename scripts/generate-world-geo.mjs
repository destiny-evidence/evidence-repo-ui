// Builds src/data/world-geo.json from a pinned Natural Earth release.
//
//   npm run generate:geo
//
// Edit the constants below to change the source scale, simplification or
// dots, then regenerate and commit the output.

import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { geoCentroid } from "d3-geo";
import { topology } from "topojson-server";
import { presimplify, quantile, simplify } from "topojson-simplify";
import { quantize } from "topojson-client";

const NE_VERSION = "v5.1.2";
const SCALE = "50m";
// Share of the least significant points to drop (0 keeps every point).
const SIMPLIFY_QUANTILE = 0.3;
const QUANTIZE = 1e4;
// Countries whose largest landmass is narrower than this (in degrees), or that
// have no shape at all, are also drawn as a dot so they can be seen.
const TINY_DOTS = true;
const TINY_MAX_EXTENT_DEG = 1.5;
const DROP = new Set(["AQ"]);

const SHA256 = {
  "110m": {
    countries: "6866c877d39cba9c357620878839b336d569f8c662d3cfab4cb1dbe2d39c977f",
    tiny: "753c4b167361f0f1223091d52f98aaddfb9101529eef263cc094057e43228c40",
  },
  "50m": {
    countries: "3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb",
    tiny: "e44d2a67feed7fd0c74b4b2c0342ade1983c038e43e32acc461c82bfa6538009",
  },
};

const OUT = fileURLToPath(new URL("../src/data/world-geo.json", import.meta.url));
const BASE = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NE_VERSION}/geojson`;

async function fetchPinned(layer, file) {
  const res = await fetch(`${BASE}/${file}`);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  const text = await res.text();
  const digest = createHash("sha256").update(text).digest("hex");
  const expected = SHA256[SCALE]?.[layer];
  if (digest !== expected) {
    throw new Error(`${file}: sha256 ${digest} does not match the pinned ${expected}`);
  }
  return JSON.parse(text);
}

// Natural Earth marks shapes without an ISO code as "-99".
function isoCode(feature) {
  const code = feature.properties.ISO_A2_EH;
  return /^[A-Z]{2}$/.test(code) ? code : null;
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
  const byCode = new Map();
  const unkeyed = [];
  for (const f of source.features) {
    const code = isoCode(f);
    if (code && DROP.has(code)) continue;
    const polys = polygons(f.geometry);
    if (!code) unkeyed.push(polys);
    else byCode.set(code, [...(byCode.get(code) ?? []), ...polys]);
  }
  const feature = (id, polys) => ({
    type: "Feature",
    ...(id && { id }),
    properties: {},
    geometry: { type: "MultiPolygon", coordinates: polys },
  });
  return {
    byCode,
    features: [
      ...[...byCode].sort(([a], [b]) => a.localeCompare(b)).map(([code, polys]) => feature(code, polys)),
      ...unkeyed.map((polys) => feature(null, polys)),
    ],
  };
}

function dotFeatures(byCode, tinySource) {
  const points = new Map();
  for (const f of tinySource.features) {
    const code = isoCode(f);
    if (code && !points.has(code)) points.set(code, f.geometry.coordinates);
  }
  const codes = new Set([...points.keys(), ...byCode.keys()]);
  const dots = [];
  for (const code of [...codes].sort()) {
    if (DROP.has(code)) continue;
    const polys = byCode.get(code);
    const largest = polys && largestRing(polys);
    if (largest && largest.extent >= TINY_MAX_EXTENT_DEG) continue;
    const coordinates =
      points.get(code) ?? geoCentroid({ type: "Polygon", coordinates: [largest.ring] });
    dots.push({ type: "Feature", id: code, properties: {}, geometry: { type: "Point", coordinates } });
  }
  return dots;
}

function stripWeights(topo) {
  topo.arcs = topo.arcs.map((arc) => arc.map(([x, y]) => [x, y]));
  return topo;
}

const countriesSource = await fetchPinned("countries", `ne_${SCALE}_admin_0_countries.geojson`);
const { byCode, features } = countryFeatures(countriesSource);
const objects = { countries: { type: "FeatureCollection", features } };
if (TINY_DOTS) {
  const tinySource = await fetchPinned("tiny", `ne_${SCALE}_admin_0_tiny_countries.geojson`);
  objects.dots = { type: "FeatureCollection", features: dotFeatures(byCode, tinySource) };
}

let topo = topology(objects);
if (SIMPLIFY_QUANTILE > 0) {
  topo = presimplify(topo);
  topo = stripWeights(simplify(topo, quantile(topo, SIMPLIFY_QUANTILE)));
}
topo = quantize(topo, QUANTIZE);

await writeFile(OUT, JSON.stringify(topo));
console.log(
  `Wrote ${OUT}: ${features.length} shapes, ${objects.dots?.features.length ?? 0} dots`,
);
