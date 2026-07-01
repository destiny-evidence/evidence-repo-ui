import { useEffect, useId, useRef, useState } from "preact/hooks";
import { ChevronDownIcon } from "@/components/common/icons";
import { Tooltip } from "@/components/common/Tooltip";
import type { ExportFormat, ExportStatus } from "@/hooks/useSearchExport";
import "./ExportMenu.css";

interface ExportMenuProps {
  /** Gates the whole control (no results, over cap, or a run in progress). */
  disabled: boolean;
  status: ExportStatus;
  onExport: (format: ExportFormat) => void;
  /** Why export is unavailable; shown as a tooltip on the disabled trigger. */
  disabledReason?: string;
}

const FORMATS: { value: ExportFormat; name: string; ext: string }[] = [
  { value: "reference-list", name: "Reference list", ext: ".pdf" },
  { value: "ris", name: "RIS", ext: ".ris" },
  { value: "excel", name: "Excel spreadsheet", ext: ".xlsx" },
];

function busyLabel(status: ExportStatus): string | null {
  switch (status) {
    case "requesting":
    case "polling":
      return "Preparing…";
    case "downloading":
      return "Downloading…";
    default:
      return null;
  }
}

/**
 * Export entry point: a trigger button with a dropdown to pick the format
 * (Reference list PDF / RIS / Excel) before exporting. When disabled it mirrors
 * the old single button — a tooltip-explained, non-opening trigger — so the menu
 * only opens once an export is actually possible. Click-outside / Escape /
 * aria-expanded handling follows ResourcesMenu.
 */
export function ExportMenu({
  disabled,
  status,
  onExport,
  disabledReason,
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("reference-list");
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const radioName = useId();

  const busy = busyLabel(status);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Collapse the panel if the control becomes unavailable while open.
  useEffect(() => {
    if (disabled && open) setOpen(false);
  }, [disabled, open]);

  function handleExport() {
    onExport(format);
    setOpen(false);
  }

  return (
    <div class="export-menu" ref={containerRef}>
      <Tooltip text={disabled ? disabledReason : undefined}>
        <button
          ref={buttonRef}
          type="button"
          class="export-button"
          aria-expanded={open ? "true" : "false"}
          aria-controls={panelId}
          aria-disabled={disabled ? "true" : undefined}
          aria-busy={busy ? "true" : undefined}
          onClick={disabled ? undefined : () => setOpen((v) => !v)}
        >
          {busy ?? "Export"}
          <span class={`export-button__caret${open ? " is-open" : ""}`} aria-hidden="true">
            <ChevronDownIcon size={12} />
          </span>
        </button>
      </Tooltip>

      <div
        class="export-menu__panel"
        id={panelId}
        role="group"
        aria-label="Export format"
        hidden={!open}
      >
        <p class="export-menu__label">Format</p>
        {FORMATS.map((f) => (
          <label key={f.value} class="export-menu__option">
            <input
              type="radio"
              name={radioName}
              value={f.value}
              checked={format === f.value}
              onChange={() => setFormat(f.value)}
            />
            <span class="export-menu__option-name">{f.name}</span>
            <span class="export-menu__ext">{f.ext}</span>
          </label>
        ))}

        <button type="button" class="export-menu__action" onClick={handleExport}>
          Export
        </button>
      </div>
    </div>
  );
}
