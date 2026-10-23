import type {
  InterventionData,
  ControlConditionData,
} from "@/types/investigation";
import "./ComparisonRow.css";

interface ComparisonRowProps {
  intervention: InterventionData | null;
  control: ControlConditionData | null;
}

/**
 * Three-column layout: Intervention | "vs" | Control. Used by both
 * SharedContextBlock and FindingCard (inline) so they share styling.
 * Renders nothing when both sides are absent.
 */
export function ComparisonRow({ intervention, control }: ComparisonRowProps) {
  if (!intervention && !control) return null;

  const interventionText =
    intervention?.name?.trim() || intervention?.descriptions?.[0]?.trim();

  return (
    <div class="comparison-row">
      {intervention && (
        <div class="comparison-row__condition">
          <h3 class="comparison-row__condition-label lg-section-label">Intervention</h3>
          <span
            class="comparison-row__condition-value comparison-row__condition-value--clamped"
            title={interventionText}
          >
            {interventionText || "—"}
          </span>
        </div>
      )}
      {intervention && control && <span class="comparison-row__vs">vs</span>}
      {control && (
        <div class="comparison-row__condition">
          <h3 class="comparison-row__condition-label lg-section-label">Control</h3>
          <span class="comparison-row__condition-value">
            {control.description?.trim() || "—"}
          </span>
        </div>
      )}
    </div>
  );
}
