import { Tooltip } from "@/components/common/Tooltip";
import "./ai-summary.css";

interface AiSummaryButtonProps {
  onClick: () => void;
  disabled?: boolean;
  /** Shown as a tooltip explaining why the button is disabled. */
  disabledReason?: string;
}

/** "Generate AI summary" entry point in the search results meta bar. */
export function AiSummaryButton({
  onClick,
  disabled = false,
  disabledReason,
}: AiSummaryButtonProps) {
  const button = (
    <button type="button" class="gen-btn" onClick={onClick} disabled={disabled}>
      <span>Generate AI summary</span>
      <span class="ai-beta">BETA</span>
    </button>
  );
  // Tooltip wrapper lives outside the disabled button so the bubble still
  // appears on hover (disabled buttons don't receive pointer events).
  return disabled && disabledReason ? (
    <Tooltip text={disabledReason}>{button}</Tooltip>
  ) : (
    button
  );
}
