import { useEffect, useRef, useState } from "preact/hooks";
import { track } from "@/analytics/matomo";
import { useAuth } from "@/auth/AuthContext";
import { useCommunity } from "@/community/CommunityContext";
import { ENRICHMENT_FORM_URL } from "@/config";
import { recordDetailPath } from "@/services/navigation";
import { buildEnrichmentFormUrl } from "./enrichmentFormUrl";
import { EnrichmentRequestModal } from "./EnrichmentRequestModal";
import "./EnrichmentRequest.css";

interface EnrichmentRequestPanelProps {
  referenceId: string;
  codedAnnotations: number;
}

/**
 * Entry point for requesting extended coding of a reference. Where a request
 * form is configured the prompt links to it, prefilled with the record and the
 * user's details; until then it falls back to the fake door, which acknowledges
 * the click and records the interest.
 */
export function EnrichmentRequestPanel({
  referenceId,
  codedAnnotations,
}: EnrichmentRequestPanelProps) {
  const community = useCommunity();
  const { name, email } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const formUrl =
    ENRICHMENT_FORM_URL && community
      ? buildEnrichmentFormUrl(ENRICHMENT_FORM_URL, {
          referenceUrl:
            window.location.origin +
            recordDetailPath(community.slug, referenceId),
          name,
          email,
        })
      : undefined;

  useEffect(() => {
    track({
      category: "Enrichment",
      action: "Request Coding Shown",
      name: referenceId,
      value: codedAnnotations,
    });
  }, [referenceId]);

  const trackClick = () =>
    track({
      category: "Enrichment",
      action: "Request Coding Clicked",
      name: referenceId,
      value: codedAnnotations,
    });

  function openModal() {
    trackClick();
    setModalOpen(true);
  }

  return (
    <div class="enrichment-request">
      {formUrl ? (
        <>
          <div class="enrichment-request__prompt">
            <p class="enrichment-request__heading">Need more data?</p>
            <p class="enrichment-request__subheading">
              Our reviewers can go back to the full paper and extract more —
              outcomes, themes or effect estimates.
            </p>
          </div>
          {/* The prefill puts the user's name and email in the query string,
              which Matomo would otherwise record as an outlink URL.
              matomo_ignore drops this link from link tracking; it must be on
              the anchor itself.
              https://developer.matomo.org/guides/tracking-javascript-guide */}
          <a
            class="enrichment-request__button matomo_ignore"
            href={formUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Request more data (opens form in a new tab)"
            onClick={trackClick}
          >
            Request more data
          </a>
        </>
      ) : (
        <>
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
        </>
      )}
      {modalOpen && (
        <EnrichmentRequestModal
          onClose={() => setModalOpen(false)}
          returnFocusTo={triggerRef}
        />
      )}
    </div>
  );
}
