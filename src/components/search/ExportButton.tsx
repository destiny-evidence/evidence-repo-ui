import { useId } from "preact/hooks";
import { Tooltip } from "@/components/shared/Tooltip";
import type { ExportStatus } from "@/hooks/useSearchExport";
import "./ExportButton.css";

interface ExportButtonProps {
  disabled: boolean;
  status: ExportStatus;
  onClick: () => void;
  tooltip?: string;
}

function labelFor(status: ExportStatus): string {
  switch (status) {
    case "requesting":
    case "polling":
      return "Preparing…";
    case "downloading":
      return "Downloading…";
    default:
      return "Export to Excel";
  }
}

export function ExportButton({
  disabled,
  status,
  onClick,
  tooltip,
}: ExportButtonProps) {
  const tooltipId = useId();
  const label = labelFor(status);
  // aria-disabled (rather than native disabled) keeps the button in the tab
  // order so keyboard / screen-reader users can focus it, hear the reason
  // it's unavailable via aria-describedby, and move on. Click is guarded.
  return (
    <Tooltip text={tooltip}>
      <button
        type="button"
        class="export-button"
        onClick={disabled ? undefined : onClick}
        aria-disabled={disabled ? "true" : undefined}
        aria-describedby={tooltip ? tooltipId : undefined}
      >
        {label}
      </button>
      {tooltip && (
        <span id={tooltipId} class="visually-hidden">
          {tooltip}
        </span>
      )}
    </Tooltip>
  );
}
