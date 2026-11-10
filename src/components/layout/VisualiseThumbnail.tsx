export type VisualiseKind = "evidence-map" | "heat-map";

// [diameter px, shade] for each dot, row by row.
const DOTS: [number, number][] = [
  [14, 5], [6, 3], [10, 4], [4, 2], [11, 4],
  [5, 2], [13, 5], [3, 1], [8, 3], [6, 2],
];

// Rough continents, shaded like the heat map.
const LANDMASSES: [string, number][] = [
  ["M6 9 L22 5 L32 8 L30 14 L24 18 L20 24 L16 22 L12 15 L6 13 Z", 4],
  ["M31 3 L37 2 L37 6 L33 7 Z", 0],
  ["M22 26 L30 27 L33 32 L28 42 L25 45 L24 36 L21 30 Z", 2],
  ["M42 8 L50 6 L54 9 L50 14 L44 15 L41 12 Z", 3],
  ["M41 18 L52 16 L58 22 L56 32 L50 40 L47 38 L46 28 L40 23 Z", 3],
  ["M54 6 L70 4 L84 8 L82 14 L74 18 L68 20 L64 19 L58 21 L54 16 Z", 5],
  ["M60 21 L66 20 L63 27 Z", 4],
  ["M70 32 L80 31 L82 38 L74 40 L70 37 Z", 1],
];

export function VisualiseThumbnail({ kind }: { kind: VisualiseKind }) {
  return (
    <span class="visualise-thumbnail" aria-hidden="true">
      {kind === "evidence-map" ? (
        <span class="visualise-thumbnail__dots">
          {DOTS.map(([size, shade], i) => (
            <span
              key={i}
              class="visualise-thumbnail__dot"
              data-shade={shade}
              style={{ width: `${size}px`, height: `${size}px` }}
            />
          ))}
        </span>
      ) : (
        <svg class="visualise-thumbnail__map" viewBox="0 0 88 48">
          {LANDMASSES.map(([d, shade]) => (
            <path key={d} d={d} data-shade={shade} />
          ))}
        </svg>
      )}
    </span>
  );
}
