import { useEffect, useRef, useState } from "preact/hooks";
import { track } from "@/analytics/matomo";
import type { MapCategory } from "@/analytics/events";
import { PANEL_FILTERS_HEADING_ID } from "./MapConfigPanel";

const PANEL_OPEN_KEY = "evidence-map-panel-open";

function initialPanelOpen(): boolean {
  try {
    const stored = localStorage.getItem(PANEL_OPEN_KEY);
    if (stored !== null) return stored === "true";
  } catch {
    // Storage blocked: fall through to the screen-size default.
  }
  return !window.matchMedia("(max-width: 1440px)").matches;
}

// The docked side panel's open state, shared by the visualise pages, and the
// focus handoff between the panel's Hide button and the rail that replaces it.
export function useMapPanel(category: MapCategory) {
  const [panelOpen, setPanelOpen] = useState(initialPanelOpen);
  const railRef = useRef<HTMLButtonElement>(null);
  const hideRef = useRef<HTMLButtonElement>(null);
  const panelToggled = useRef(false);
  const focusPanelFilters = useRef(false);

  // Flag the docked panel on <body> so .app-main can go full-bleed (see
  // VisualisePage.css).
  useEffect(() => {
    document.body.classList.add("visualise-has-panel");
    return () => document.body.classList.remove("visualise-has-panel");
  }, []);

  function togglePanel(open: boolean) {
    track({ category, action: "Panel Toggled", name: open ? "open" : "hidden" });
    panelToggled.current = true;
    setPanelOpen(open);
    try {
      localStorage.setItem(PANEL_OPEN_KEY, String(open));
    } catch {
      // Storage blocked: the choice lasts this visit only.
    }
  }

  // Move focus to the control that replaced the one just clicked, which unmounted
  // (the rail) or hid (the Hide button).
  useEffect(() => {
    if (!panelToggled.current) return;
    if (panelOpen && focusPanelFilters.current) {
      focusPanelFilters.current = false;
      focusFiltersHeading();
      return;
    }
    (panelOpen ? hideRef : railRef).current?.focus();
  }, [panelOpen]);

  // The heading is missing while the vocabulary loads, so fall back to Hide.
  function focusFiltersHeading() {
    (document.getElementById(PANEL_FILTERS_HEADING_ID) ?? hideRef.current)?.focus();
  }

  function editFilters() {
    if (panelOpen) {
      focusFiltersHeading();
      return;
    }
    focusPanelFilters.current = true;
    togglePanel(true);
  }

  return { panelOpen, togglePanel, editFilters, railRef, hideRef };
}
