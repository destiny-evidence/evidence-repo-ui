import "./CIVisualization.css";

export type Significance = "pos" | "neg" | "ns";

interface CIVisualizationProps {
  pointEstimate?: number;
  ciLower?: number;
  ciUpper?: number;
  significance: Significance;
}

/**
 * Pick a symmetric axis [-axisMax, axisMax] that contains zero plus the data.
 * Returns five evenly-spaced ticks: [-axisMax, -axisMax/2, 0, axisMax/2, axisMax].
 */
function pickAxis(values: number[]): { axisMax: number; ticks: number[] } {
  const maxAbs = values.length === 0 ? 1 : Math.max(...values.map(Math.abs));
  const axisMax = Math.max(0.5, Math.ceil(maxAbs * 2) / 2);
  return {
    axisMax,
    ticks: [-axisMax, -axisMax / 2, 0, axisMax / 2, axisMax],
  };
}

function pct(value: number, axisMax: number): number {
  const clamped = Math.max(-axisMax, Math.min(axisMax, value));
  return ((clamped + axisMax) / (2 * axisMax)) * 100;
}

function formatTick(t: number): string {
  if (t === 0) return "0";
  const abs = Math.abs(t).toFixed(1);
  return t < 0 ? `−${abs}` : abs;
}

export function CIVisualization({
  pointEstimate,
  ciLower,
  ciUpper,
  significance,
}: CIVisualizationProps) {
  const present = [pointEstimate, ciLower, ciUpper].filter(
    (n): n is number => typeof n === "number",
  );
  if (present.length === 0) return null;

  const { axisMax, ticks } = pickAxis(present);
  const lo = ciLower ?? pointEstimate;
  const hi = ciUpper ?? pointEstimate;
  const hasCi = typeof ciLower === "number" && typeof ciUpper === "number";

  return (
    <div class={`ci-viz ci-viz--${significance}`}>
      <div class="ci-viz__inner">
        <div class="ci-viz__zero-label" style={{ left: `${pct(0, axisMax)}%` }}>
          0
        </div>
        <div class="ci-viz__track" />
        <div class="ci-viz__zero" style={{ left: `${pct(0, axisMax)}%` }} />
        {hasCi && lo !== undefined && hi !== undefined && (
          <div
            class="ci-viz__bar"
            style={{
              left: `${pct(lo, axisMax)}%`,
              width: `${pct(hi, axisMax) - pct(lo, axisMax)}%`,
            }}
          />
        )}
        {typeof pointEstimate === "number" && (
          <div
            class="ci-viz__dot"
            style={{ left: `${pct(pointEstimate, axisMax)}%` }}
          />
        )}
        <div class="ci-viz__scale" aria-hidden="true">
          {ticks.map((t) => (
            <span
              key={t}
              class="ci-viz__tick"
              style={{ left: `${pct(t, axisMax)}%` }}
            >
              {formatTick(t)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
