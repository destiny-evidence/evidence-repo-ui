import { useEffect, useId, useRef } from "preact/hooks";
import type { RefObject } from "preact";

interface EnrichmentRequestModalProps {
  onClose: () => void;
  /**
   * Focused when the modal closes. 
   */
  returnFocusTo: RefObject<HTMLElement>;
}

/** Fake-door acknowledgement. */
export function EnrichmentRequestModal({
  onClose,
  returnFocusTo,
}: EnrichmentRequestModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
    return () => returnFocusTo.current?.focus();
  }, [returnFocusTo]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div class="enrichment-modal" role="presentation">
      <div class="enrichment-modal__backdrop" aria-hidden="true" />
      <div
        ref={panelRef}
        class="enrichment-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header class="enrichment-modal__header">
          <h2 id={titleId} class="enrichment-modal__title">
            Request additional coding
          </h2>
          <button
            type="button"
            class="enrichment-modal__dismiss"
            aria-label="Close"
            title="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </header>

        <p class="enrichment-modal__body">
          This feature is currently under consideration. Thank you for
          expressing your interest — it helps us prioritise future development.
        </p>

        <footer class="enrichment-modal__footer">
          <button
            type="button"
            class="enrichment-modal__close"
            onClick={onClose}
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
