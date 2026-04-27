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
  isShared: boolean;
  labels: Map<string, string>;
  broader: Map<string, string>;
}

export function FindingCard({
  finding,
  index,
  isShared,
  labels,
  broader,
}: FindingCardProps) {
  const { intervention, control, context, outcome } = finding;

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
          />
        </div>
      )}

      {!isShared && (
        <div class="finding-card__section">
          <h3 class="finding-card__section-label lg-section-label">Sample</h3>
          <SampleDetails finding={finding} labels={labels} broader={broader} />
        </div>
      )}
    </article>
  );
}
