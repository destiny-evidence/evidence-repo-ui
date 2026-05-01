import { CIVisualization, type Significance } from "./CIVisualization";
import { ArmDataTable } from "./ArmDataTable";
import type {
  ArmData,
  ControlConditionData,
  EffectEstimateData,
  InterventionData,
} from "@/types/investigation";
import "./EffectEstimateCard.css";

interface EffectEstimateCardProps {
  estimate: EffectEstimateData;
  arms: ArmData[];
  intervention: InterventionData | null;
  control: ControlConditionData | null;
}

export function classifyEstimate(estimate: EffectEstimateData): Significance {
  const { ciLower, ciUpper } = estimate;
  if (typeof ciLower !== "number" || typeof ciUpper !== "number") return "ns";
  if (ciLower > 0 && ciUpper > 0) return "pos";
  if (ciLower < 0 && ciUpper < 0) return "neg";
  return "ns";
}

function fmt2(n: number): string {
  const fixed = Math.abs(n).toFixed(2);
  return n < 0 ? `−${fixed}` : fixed;
}

function fmt3(n: number): string {
  return n.toFixed(3);
}

function fmtCi(n: number): string {
  // CI text uses ASCII minus for clean bracket reading
  return n.toFixed(2);
}

export function EffectEstimateCard({
  estimate,
  arms,
  intervention,
  control,
}: EffectEstimateCardProps) {
  const significance = classifyEstimate(estimate);
  const {
    pointEstimate,
    standardError,
    ciLower,
    ciUpper,
    effectSizeMetric,
    baselineAdjusted,
    clusteringAdjusted,
  } = estimate;

  const metricLabel = effectSizeMetric?.label;
  const sourceLabel = estimate.estimateSource?.label;
  const showAdjustmentRow = baselineAdjusted === true;
  const showNotClustering = clusteringAdjusted === "no";
  const ciPrefix =
    typeof estimate.confidenceLevel === "number"
      ? `${Math.round(estimate.confidenceLevel * 100)}% CI`
      : "CI";

  return (
    <div class="ee-card">
      <h4 class="ee-card__label">Effect estimate</h4>

      <div class="ee-card__headline">
        {typeof pointEstimate === "number" ? (
          <span class={`ee-card__estimate ee-card__estimate--${significance}`}>
            {fmt2(pointEstimate)}
          </span>
        ) : (
          <span class="ee-card__estimate ee-card__estimate--ns">—</span>
        )}
        {metricLabel && <span class="ee-card__metric">{metricLabel}</span>}
        {typeof standardError === "number" && (
          <span class="ee-card__se">SE = {fmt3(standardError)}</span>
        )}
      </div>

      {typeof ciLower === "number" && typeof ciUpper === "number" && (
        <div class="ee-card__ci">
          {ciPrefix} <span class="ee-card__ci-bracket">[</span>
          {fmtCi(ciLower)}, {fmtCi(ciUpper)}
          <span class="ee-card__ci-bracket">]</span>
        </div>
      )}

      {sourceLabel && <p class="ee-card__source">{sourceLabel}</p>}

      <CIVisualization
        pointEstimate={pointEstimate}
        ciLower={ciLower}
        ciUpper={ciUpper}
        significance={significance}
      />

      {showAdjustmentRow && (
        <div class="ee-card__tags">
          <span class="ee-card__tag">Baseline adjusted</span>
        </div>
      )}

      {showNotClustering && (
        <p class="ee-card__not-clustering">Not clustering adjusted</p>
      )}

      <ArmDataTable arms={arms} intervention={intervention} control={control} />
    </div>
  );
}
