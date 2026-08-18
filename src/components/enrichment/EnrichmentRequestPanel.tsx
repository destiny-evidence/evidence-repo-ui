import { useEffect } from "preact/hooks";
import { track } from "@/analytics/matomo";
import { useAuth } from "@/auth/AuthContext";
import { useCommunity } from "@/community/CommunityContext";
import { ENRICHMENT_FORM_URL } from "@/config";
import { buildEnrichmentFormUrl, referenceUrl } from "./enrichmentFormUrl";
import "./EnrichmentRequest.css";

interface EnrichmentRequestPanelProps {
  referenceId: string;
  codedAnnotations: number;
}

/**
 * Entry point for requesting extended coding of a reference, which the user
 * completes on a Google Form prefilled with the record and their details.
 */
export function EnrichmentRequestPanel({
  referenceId,
  codedAnnotations,
}: EnrichmentRequestPanelProps) {
  const community = useCommunity();
  const { name, email } = useAuth();

  const formUrl =
    ENRICHMENT_FORM_URL && community
      ? buildEnrichmentFormUrl(ENRICHMENT_FORM_URL, {
          referenceUrl: referenceUrl(
            window.location.origin,
            community.slug,
            referenceId,
          ),
          name,
          email,
        })
      : undefined;

  useEffect(() => {
    if (!formUrl) return;
    track({
      category: "Enrichment",
      action: "Request Coding Shown",
      name: referenceId,
      value: codedAnnotations,
    });
  }, [referenceId, !formUrl]);

  if (!formUrl) return null;

  return (
    <div class="enrichment-request">
      <div class="enrichment-request__prompt">
        <p class="enrichment-request__heading">Need more data?</p>
        <p class="enrichment-request__subheading">
          Our reviewers can go back to the full paper and extract more -
          outcomes, themes or effect estimates.
        </p>
      </div>
      <a
        class="enrichment-request__button"
        href={formUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Request more data (opens form in a new tab)"
        onClick={() =>
          track({
            category: "Enrichment",
            action: "Request Coding Clicked",
            name: referenceId,
            value: codedAnnotations,
          })
        }
      >
        Request more data
      </a>
    </div>
  );
}
