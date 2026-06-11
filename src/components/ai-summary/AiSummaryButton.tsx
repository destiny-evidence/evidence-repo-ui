import "./ai-summary.css";

interface AiSummaryButtonProps {
  onClick: () => void;
}

/** "Generate AI summary" entry point shown above the results list. */
export function AiSummaryButton({ onClick }: AiSummaryButtonProps) {
  return (
    <div class="gen-row">
      <button type="button" class="gen-btn" onClick={onClick}>
        <span>Generate AI summary</span>
        <span class="ai-beta">BETA</span>
      </button>
    </div>
  );
}
