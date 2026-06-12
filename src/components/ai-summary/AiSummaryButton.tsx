import "./ai-summary.css";

interface AiSummaryButtonProps {
  onClick: () => void;
  disabled?: boolean;
  /** Tooltip explaining why the button is disabled. */
  disabledReason?: string;
}

/** "Generate AI summary" entry point shown above the results list. */
export function AiSummaryButton({
  onClick,
  disabled = false,
  disabledReason,
}: AiSummaryButtonProps) {
  return (
    <div class="gen-row">
      <button
        type="button"
        class="gen-btn"
        onClick={onClick}
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
      >
        <span>Generate AI summary</span>
        <span class="ai-beta">BETA</span>
      </button>
    </div>
  );
}
