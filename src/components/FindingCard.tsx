import { ComparisonRow } from "./ComparisonRow";
import { InterventionDetails } from "./InterventionDetails";
import { ContextDetails } from "./ContextDetails";
import { SampleDetails } from "./SampleDetails";
import { OutcomeDetails } from "./OutcomeDetails";
import type { FindingData } from "@/types/investigation";
import "./ComparisonRow.css";
import "./InterventionDetails.css";
import "./SampleDetails.css";
import "./OutcomeDetails.css";
import "./FindingCard.css";

interface FindingCardProps {
  finding: FindingData;
  index: number;
  /**
   * True when intervention/control/context are factored out into a shared
   * block above this card. The card then shows a back-reference instead of
   * its own intervention/context details. Sample-level data is *not* part of
   * this guarantee — it is always rendered per-finding.
   */
  isShared: boolean;
  labels: Map<string, string>;
  broader: Map<string, string>;
  definitions?: Map<string, string>;
}

function hasSampleData(finding: FindingData): boolean {
  return Boolean(
    finding.sampleSize ||
      finding.attrition ||
      finding.cost ||
      finding.groupDifferences ||
      (finding.sampleFeatures && finding.sampleFeatures.length > 0),
  );
}

export function FindingCard({
  finding,
  index,
  isShared,
  labels,
  broader,
  definitions,
}: FindingCardProps) {
  const { intervention, control, context, outcome } = finding;
  const showSample = hasSampleData(finding);

  return (
    <article class="finding-card lg-card">
      <h2 class="finding-card__header lg-kicker">Finding {index}</h2>

      {isShared ? (
        <div class="finding-card__shared-ref">
          &#8617; Same intervention, control, and context as above
        </div>
      ) : (
        <>
          <ComparisonRow intervention={intervention} control={control} />
          {intervention && (
            <InterventionDetails
              intervention={intervention}
              labels={labels}
              broader={broader}
              definitions={definitions}
            />
          )}
          {context && (
            <>
              <hr class="finding-card__divider lg-divider" />
              <h3 class="finding-card__section-label lg-section-label">
                Context
              </h3>
              <ContextDetails
                context={context}
                labels={labels}
                broader={broader}
                definitions={definitions}
              />
            </>
          )}
        </>
      )}

      {outcome && (
        <div class="finding-card__section">
          {!isShared && <hr class="finding-card__divider lg-divider" />}
          <h3 class="finding-card__section-label lg-section-label">Outcome</h3>
          <OutcomeDetails
            outcome={outcome}
            labels={labels}
            broader={broader}
            definitions={definitions}
          />
        </div>
      )}

      {showSample && (
        <div class="finding-card__section">
          <hr class="finding-card__divider lg-divider" />
          <h3 class="finding-card__section-label lg-section-label">Sample</h3>
          <SampleDetails
            finding={finding}
            labels={labels}
            broader={broader}
            definitions={definitions}
          />
        </div>
      )}
    </article>
  );
}
