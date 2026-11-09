import { useEffect, useMemo, useState } from "preact/hooks";
import type { WorldGeometry } from "./geo/worldGeometry";
import {
  bandLabel,
  heatBands,
  heatShade,
  type HeatBand,
} from "@/services/geoHeatMap";
import { countryName } from "@/utils/country";
import { Spinner } from "@/components/common/Spinner";
import "./GeographicHeatMap.css";

const DOT_RADIUS = 2.5;

// Loaded on first use so d3-geo and the shapes stay out of the main bundle.
let loaded: WorldGeometry | null = null;
function loadGeometry(): Promise<WorldGeometry> {
  return import("./geo/worldGeometry").then(
    (m) => (loaded = m.loadWorldGeometry()),
  );
}

export interface GeographicHeatMapProps {
  // Reference counts keyed by ISO alpha-2 code; undefined until they first load.
  counts: ReadonlyMap<string, number> | undefined;
  label: string;
  countNoun: string;
}

export function GeographicHeatMap({
  counts,
  label,
  countNoun,
}: GeographicHeatMapProps) {
  const [geometry, setGeometry] = useState(loaded);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (geometry) return;
    let cancelled = false;
    loadGeometry().then(
      (g) => !cancelled && setGeometry(g),
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <figure class="geo-heat-map">
        <div class="geo-heat-map__frame">
          <p class="geo-heat-map__status" role="alert">
            Couldn’t load the map.
          </p>
        </div>
      </figure>
    );
  }

  // Waits for both shapes and counts so the map doesn't draw empty and then fill.
  if (!geometry || !counts) {
    return (
      <figure class="geo-heat-map">
        <div class="geo-heat-map__frame">
          <p class="geo-heat-map__status" role="status">
            <Spinner size={20} />
            Loading map…
          </p>
        </div>
      </figure>
    );
  }

  return (
    <HeatMap
      geometry={geometry}
      counts={counts}
      label={label}
      countNoun={countNoun}
    />
  );
}

function HeatMap({
  geometry,
  counts,
  label,
  countNoun,
}: GeographicHeatMapProps & {
  geometry: WorldGeometry;
  counts: ReadonlyMap<string, number>;
}) {
  const bands = useMemo(
    () => heatBands(Math.max(0, ...counts.values())),
    [counts],
  );
  // Exclude dots for countries with no references
  const dots = useMemo(
    () => geometry.dots.filter((d) => (counts.get(d.code) ?? 0) > 0),
    [geometry, counts],
  );
  const dotCodes = useMemo(() => new Set(dots.map((d) => d.code)), [dots]);

  const countryLabel = (code: string) => {
    const count = counts.get(code) ?? 0;
    return `${countryName(code)}: ${count > 0 ? count.toLocaleString() : "no"} ${countNoun}`;
  };
  const shade = (code: string) => heatShade(counts.get(code) ?? 0, bands);

  return (
    <figure class="geo-heat-map is-loaded">
      <div class="geo-heat-map__frame">
        <svg
          class="geo-heat-map__svg"
          viewBox={geometry.viewBox}
          role="group"
          aria-label={label}
        >
          <g>
            <path
              class="geo-heat-map__outline"
              d={geometry.outline}
              aria-hidden="true"
            />
            {geometry.countries.map(({ code, d }, i) =>
              code && !dotCodes.has(code) ? (
                <path
                  key={code}
                  class="geo-heat-map__country"
                  d={d}
                  data-shade={shade(code)}
                  role="img"
                  aria-label={countryLabel(code)}
                />
              ) : (
                <path
                  key={code ?? `unkeyed-${i}`}
                  class="geo-heat-map__country"
                  d={d}
                  data-shade={code ? shade(code) : 0}
                  aria-hidden="true"
                />
              ),
            )}
            <path
              class="geo-heat-map__borders"
              d={geometry.borders}
              aria-hidden="true"
            />
            {dots.map(({ code, x, y }) => (
              <circle
                key={code}
                class="geo-heat-map__dot"
                cx={x}
                cy={y}
                r={DOT_RADIUS}
                data-shade={shade(code)}
                role="img"
                aria-label={countryLabel(code)}
              />
            ))}
          </g>
        </svg>
      </div>
      <HeatMapLegend bands={bands} countNoun={countNoun} />
    </figure>
  );
}

function HeatMapLegend({
  bands,
  countNoun,
}: {
  bands: HeatBand[];
  countNoun: string;
}) {
  return (
    <figcaption class="geo-heat-map__legend">
      <span class="geo-heat-map__legend-label lg-label">{countNoun}</span>
      {[
        { shade: 0, label: "0" },
        ...bands.map((b) => ({ shade: b.shade, label: bandLabel(b) })),
      ].map(({ shade, label }) => (
        <span key={shade} class="geo-heat-map__legend-item">
          <span
            class="geo-heat-map__swatch"
            data-shade={shade}
            aria-hidden="true"
          />
          {label}
        </span>
      ))}
    </figcaption>
  );
}
