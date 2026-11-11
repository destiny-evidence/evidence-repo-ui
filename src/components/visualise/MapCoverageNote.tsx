import { useState } from "preact/hooks";
import type { CrossFacetTotals } from "@/types/models";
import { WarningIcon } from "../common/icons";
import "./MapCoverageNote.css";

// Per browser tab, not per browser: this explains a recurring surprise rather
// than recording an acknowledgement, so it should return on a later visit.
// Blocked storage (private windows, blocked site data) must not suppress the
// note, so an unreadable dismissal counts as no dismissal.
function readDismissed(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function writeDismissed(key: string): void {
  try {
    sessionStorage.setItem(key, "true");
  } catch {
    // Dismissal then lasts only for this page view.
  }
}

interface MapCoverageNoteProps {
  totals: CrossFacetTotals;
  countNoun: string;
  // Why the rest can't be placed, after the "Some … aren't on the map." lead.
  detail: string;
  // Where the dismissal is remembered, so each map's note is closed separately.
  storageKey: string;
  /** Element id focus lands on after closing, so the tab order is not lost. */
  returnFocusTo: string;
}

/**
 * Explains why the map plots fewer references than the search and filter counts
 * report, shown only while that shortfall exists and until the reader closes it.
 */
export function MapCoverageNote({
  totals,
  countNoun,
  detail,
  storageKey,
  returnFocusTo,
}: MapCoverageNoteProps) {
  const [dismissed, setDismissed] = useState(() => readDismissed(storageKey));

  // Equal totals mean everything matching is plotted, so nothing needs
  // explaining; a floor rather than an exact match total may still hide a gap.
  const hasShortfall =
    totals.mapped.count < totals.search.count || totals.search.is_lower_bound;
  if (!hasShortfall || dismissed) return null;

  function handleDismiss() {
    setDismissed(true);
    writeDismissed(storageKey);
    document.getElementById(returnFocusTo)?.focus();
  }

  return (
    <p class="map-coverage-note">
      <WarningIcon />
      <span class="map-coverage-note__text">
        <strong class="map-coverage-note__lead">
          Some {countNoun} aren’t on the map.
        </strong>{" "}
        {detail}
      </span>
      <button
        type="button"
        class="map-coverage-note__dismiss"
        aria-label="Close"
        title="Close"
        onClick={handleDismiss}
      >
        ✕
      </button>
    </p>
  );
}
