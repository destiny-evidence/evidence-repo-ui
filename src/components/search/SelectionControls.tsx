import { useEffect, useRef } from "preact/hooks";
import type { MasterState } from "@/hooks/useReferenceSelection";
import "./SelectionControls.css";

interface SelectionControlsProps {
  master: MasterState;
  onMasterToggle: () => void;
  /** Disables the master checkbox (e.g. no results to select). */
  disabled?: boolean;
}

/** The per-page selection control in the meta bar (selects/deselects this page). */
export function SelectionControls({
  master,
  onMasterToggle,
  disabled = false,
}: SelectionControlsProps) {
  const boxRef = useRef<HTMLInputElement>(null);

  // `indeterminate` is a DOM property, not an attribute, so it can't be set in
  // JSX — reflect the "some selected" state onto the native checkbox here.
  useEffect(() => {
    if (boxRef.current) boxRef.current.indeterminate = master === "some";
  }, [master]);

  // When the whole page is selected, the checkbox deselects it.
  const label = master === "all" ? "Deselect this page" : "Select this page";

  return (
    <label class="sel-master-box">
      <input
        ref={boxRef}
        type="checkbox"
        class="sel-master"
        checked={master === "all"}
        disabled={disabled}
        aria-label={label}
        onChange={onMasterToggle}
      />
      <span class="sel-master-label">{label}</span>
    </label>
  );
}
