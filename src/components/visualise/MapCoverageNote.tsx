import { useState } from "preact/hooks";
import type { CrossFacetTotals } from "@/types/models";
import { WarningIcon } from "../common/icons";
import "./MapCoverageNote.css";

// Per browser tab, not per browser: this explains a recurring surprise rather
// than recording an acknowledgement, so it should return on a later visit.
const DISMISSED_KEY = "evidence-map-coverage-note-dismissed";

// Blocked storage (private windows, blocked site data) must not suppress the
// note, so an unreadable dismissal counts as no dismissal.
function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  try {
    sessionStorage.setItem(DISMISSED_KEY, "true");
  } catch {
    // Dismissal then lasts only for this page view.
  }
}

interface MapCoverageNoteProps {
  totals: CrossFacetTotals;
  countNoun: string;
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
  returnFocusTo,
}: MapCoverageNoteProps) {
  const [dismissed, setDismissed] = useState(readDismissed);

  // Equal totals mean everything matching is plotted, so nothing needs
  // explaining; a floor rather than an exact match total may still hide a gap.
  const hasShortfall =
    totals.mapped.count < totals.search.count || totals.search.is_lower_bound;
  if (!hasShortfall || dismissed) return null;

  function handleDismiss() {
    setDismissed(true);
    writeDismissed();
    document.getElementById(returnFocusTo)?.focus();
  }

  return (
    <p class="map-coverage-note">
      <WarningIcon />
      <span class="map-coverage-note__text">
        <strong class="map-coverage-note__lead">
          Some {countNoun} aren’t on the map.
        </strong>{" "}
        Only those coded against both axes can be placed - the rest are in your
        search results.
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
