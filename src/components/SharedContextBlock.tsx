import { ComparisonRow } from "./ComparisonRow";
import { InterventionDetails } from "./InterventionDetails";
import { ContextDetails } from "./ContextDetails";
import { SampleDetails } from "./SampleDetails";
import type { SharedContext } from "@/services/findingGroups";
import type { FindingData } from "@/types/investigation";
import "./ComparisonRow.css";
import "./InterventionDetails.css";
import "./SampleDetails.css";
import "./SharedContextBlock.css";

interface SharedContextBlockProps {
  shared: SharedContext;
  /** Finding to source sample-level data from (typically findings[0]). */
  sampleSource?: Pick<
    FindingData,
    "sampleSize" | "attrition" | "cost" | "groupDifferences" | "sampleFeatures"
  >;
  labels: Map<string, string>;
  broader: Map<string, string>;
  definitions?: Map<string, string>;
}

export function SharedContextBlock({
  shared,
  sampleSource,
  labels,
  broader,
  definitions,
}: SharedContextBlockProps) {
  const { intervention, control, context } = shared;

  return (
    <article class="shared-context lg-card">
      <h2 class="shared-context__header lg-kicker">Shared across all findings</h2>

      <ComparisonRow intervention={intervention} control={control} />

      <InterventionDetails
        intervention={intervention}
        labels={labels}
        broader={broader}
        definitions={definitions}
      />

      <hr class="shared-context__divider lg-divider" />

      <h3 class="shared-context__section-label lg-section-label">Context</h3>
      <ContextDetails
        context={context}
        labels={labels}
        broader={broader}
        definitions={definitions}
      />

      {sampleSource && (
        <>
          <h3 class="shared-context__section-label lg-section-label">Sample</h3>
          <SampleDetails
            finding={sampleSource}
            labels={labels}
            broader={broader}
            definitions={definitions}
          />
        </>
      )}
    </article>
  );
}
