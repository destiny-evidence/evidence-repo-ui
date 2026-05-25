import { Tooltip } from "@/components/Tooltip";
import "./RefineButton.css";

interface RefineButtonProps {
  count: number;
  disabled?: boolean;
  disabledReason?: string;
  onClick: () => void;
}

export function RefineButton({
  count,
  disabled = false,
  disabledReason,
  onClick,
}: RefineButtonProps) {
  const button = (
    <button
      type="button"
      class="refine-btn"
      onClick={onClick}
      disabled={disabled}
    >
      Refine
      {count > 0 && <span class="refine-btn__count">{count}</span>}
    </button>
  );
  // Tooltip wrapper lives outside the disabled <button> so the bubble still
  // appears on hover even though the disabled button itself can't receive
  // pointer/focus events in all browsers.
  return disabled && disabledReason
    ? <Tooltip text={disabledReason}>{button}</Tooltip>
    : button;
}
