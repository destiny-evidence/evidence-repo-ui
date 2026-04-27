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

  return (
    <div class="comparison-row">
      {intervention && (
        <div class="comparison-row__condition">
          <h3 class="comparison-row__condition-label">Intervention</h3>
          <span class="comparison-row__condition-value">
            {intervention.name?.trim() || "—"}
          </span>
        </div>
      )}
      {intervention && control && <span class="comparison-row__vs">vs</span>}
      {control && (
        <div class="comparison-row__condition">
          <h3 class="comparison-row__condition-label">Control</h3>
          <span class="comparison-row__condition-value">
            {control.description?.trim() || "—"}
          </span>
        </div>
      )}
    </div>
  );
}
