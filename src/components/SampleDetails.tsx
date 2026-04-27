import { TagGroup } from "./TagGroup";
import { SourceEvidenceToggle } from "./SourceEvidenceToggle";
import { evidenceFrom } from "@/services/sourceEvidence";
import { conceptsToTags } from "@/services/conceptLabels";
import type { FindingData } from "@/types/investigation";

type SampleFields = Pick<
  FindingData,
  "sampleSize" | "attrition" | "cost" | "groupDifferences" | "sampleFeatures"
>;

interface SampleDetailsProps {
  finding: SampleFields;
  labels: Map<string, string>;
  broader: Map<string, string>;
}

function collectEvidence(finding: SampleFields) {
  return [
    ...evidenceFrom("Size", finding.sampleSize),
    ...evidenceFrom("Attrition", finding.attrition),
    ...evidenceFrom("Cost", finding.cost),
    ...evidenceFrom("Group differences", finding.groupDifferences),
    ...evidenceFrom("Features", finding.sampleFeatures),
  ];
}

export function SampleDetails({ finding, labels, broader }: SampleDetailsProps) {
  const featureTags = conceptsToTags(finding.sampleFeatures, labels, broader);
  const evidenceEntries = collectEvidence(finding);

  const hasAny =
    finding.sampleSize ||
    finding.attrition ||
    finding.cost ||
    finding.groupDifferences ||
    featureTags.length > 0;
  if (!hasAny) return null;

  return (
    <>
      <div class="sample-details__grid lg-field-grid">
        {finding.sampleSize && (
          <div class="sample-details__field lg-field">
            <span class="sample-details__field-label lg-label">Size</span>
            <span class="sample-details__field-value">
              {finding.sampleSize.value}
            </span>
          </div>
        )}
        {featureTags.length > 0 && (
          <TagGroup label="Features" tags={featureTags} />
        )}
        {finding.attrition && (
          <div class="sample-details__field lg-field">
            <span class="sample-details__field-label lg-label">Attrition</span>
            <span class="sample-details__field-value">
              {finding.attrition.value}
            </span>
          </div>
        )}
        {finding.cost && (
          <div class="sample-details__field lg-field">
            <span class="sample-details__field-label lg-label">Cost</span>
            <span>{finding.cost.value}</span>
          </div>
        )}
        {finding.groupDifferences && (
          <div class="sample-details__field sample-details__field--wide lg-field">
            <span class="sample-details__field-label lg-label">Group differences</span>
            <span>{finding.groupDifferences.value}</span>
          </div>
        )}
      </div>
      <SourceEvidenceToggle entries={evidenceEntries} />
    </>
  );
}
