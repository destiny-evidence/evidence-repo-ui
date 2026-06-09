import "./ai-summary.css";

interface AiSummaryButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

/** "Generate AI summary" entry point shown above the results list. */
export function AiSummaryButton({ onClick, disabled }: AiSummaryButtonProps) {
  return (
    <div class="gen-row">
      <button
        type="button"
        class="gen-btn"
        onClick={onClick}
        disabled={disabled}
      >
        <span>Generate AI summary</span>
        <span class="ai-beta">BETA</span>
      </button>
    </div>
  );
}
