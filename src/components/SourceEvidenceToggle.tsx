import { useId, useState } from "preact/hooks";
import "./SourceEvidenceToggle.css";

export interface SourceEvidenceEntry {
  label: string;
  text: string;
}

interface SourceEvidenceToggleProps {
  entries: SourceEvidenceEntry[];
}

/**
 * Parse a leading "Page N:" or "p. N:" prefix from a supportingText string
 * into a separate page reference and remaining body.
 *
 * @internal Exported for testing only.
 */
export function splitPageRef(text: string): { page?: string; body: string } {
  const match = text.match(/^\s*(?:Page\s+(\d+)|p\.\s*(\d+))\s*:\s*/i);
  if (!match) return { body: text };
  const pageNum = match[1] ?? match[2];
  return { page: `p. ${pageNum}:`, body: text.slice(match[0].length) };
}

export function SourceEvidenceToggle({ entries }: SourceEvidenceToggleProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (entries.length === 0) return null;

  return (
    <div class="source-evidence">
      <button
        class="source-evidence__toggle"
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span class="source-evidence__arrow">{open ? "▾" : "▸"}</span>{" "}
        Source evidence
      </button>
      {open && (
        <div id={panelId} class="source-evidence__panel">
          {entries.map((entry, i) => {
            const { page, body } = splitPageRef(entry.text);
            return (
              <div class="source-evidence__entry" key={i}>
                <div class="source-evidence__section-label lg-label">{entry.label}</div>
                <p class="source-evidence__body">
                  {page && <span class="source-evidence__page">{page}</span>}
                  {page && " "}
                  {body}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
