import { useEffect, useRef, useState } from "preact/hooks";
import { track } from "@/analytics/matomo";
import { EnrichmentRequestModal } from "./EnrichmentRequestModal";
import "./EnrichmentRequest.css";

interface EnrichmentRequestPanelProps {
  referenceId: string;
  codedAnnotations: number;
}

/**
 * Fake-door entry point for requesting extended coding of a reference.
 */
export function EnrichmentRequestPanel({
  referenceId,
  codedAnnotations,
}: EnrichmentRequestPanelProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    track({
      category: "Enrichment",
      action: "Request Coding Shown",
      name: referenceId,
      value: codedAnnotations,
    });
  }, [referenceId]);

  function openModal() {
    track({
      category: "Enrichment",
      action: "Request Coding Clicked",
      name: referenceId,
      value: codedAnnotations,
    });
    setModalOpen(true);
  }

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
        onClick={openModal}
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
