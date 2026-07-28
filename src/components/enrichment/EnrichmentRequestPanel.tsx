import { useRef, useState } from "preact/hooks";
import { EnrichmentRequestModal } from "./EnrichmentRequestModal";
import "./EnrichmentRequest.css";

interface EnrichmentRequestPanelProps {
  referenceId: string;
}

/**
 * Fake-door entry point for requesting extended coding of a reference.
 */
export function EnrichmentRequestPanel(_props: EnrichmentRequestPanelProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div class="enrichment-request">
      <div class="enrichment-request__prompt">
        <p class="enrichment-request__heading">Missing data elements?</p>
        <p class="enrichment-request__subheading">
          Request extended ESEA annotation for this record.
        </p>
      </div>
      <button
        ref={triggerRef}
        type="button"
        class="enrichment-request__button"
        onClick={() => setModalOpen(true)}
      >
        Request additional coding
      </button>
      {modalOpen && (
        <EnrichmentRequestModal
          onClose={() => setModalOpen(false)}
          returnFocusTo={triggerRef}
        />
      )}
    </div>
  );
}
