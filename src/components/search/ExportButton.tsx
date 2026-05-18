import { Tooltip } from "@/components/Tooltip";
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
  // Tooltip wraps the button so :hover fires on the wrapper rather than the
  // disabled <button>, which Firefox doesn't route hover events to.
  return (
    <Tooltip text={tooltip}>
      <button
        type="button"
        class="export-button"
        onClick={onClick}
        disabled={disabled}
        aria-label={labelFor(status)}
      >
        {labelFor(status)}
      </button>
    </Tooltip>
  );
}
