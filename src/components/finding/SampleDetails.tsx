import { TagGroup } from "../common/TagGroup";
import { SourceEvidenceToggle } from "./SourceEvidenceToggle";
import { evidenceFrom } from "@/services/sourceEvidence";
import { conceptsToTags } from "@/services/conceptLabels";
import type { FindingData } from "@/types/investigation";

type SampleFields = Pick<
  FindingData,
  "sampleSizes" | "attritions" | "costs" | "groupDifferences" | "sampleFeatures"
>;

interface SampleDetailsProps {
  finding: SampleFields;
  labels: Map<string, string>;
  broader: Map<string, string>;
  definitions?: Map<string, string>;
}

function collectEvidence(finding: SampleFields) {
  return [
    ...evidenceFrom("Size", finding.sampleSizes),
    ...evidenceFrom("Attrition", finding.attritions),
    ...evidenceFrom("Cost", finding.costs),
    ...evidenceFrom("Group differences", finding.groupDifferences),
    ...evidenceFrom("Features", finding.sampleFeatures),
  ];
}

export function SampleDetails({
  finding,
  labels,
  broader,
  definitions,
}: SampleDetailsProps) {
  const featureTags = conceptsToTags(
    finding.sampleFeatures,
    labels,
    broader,
    definitions,
  );
  const evidenceEntries = collectEvidence(finding);

  const hasAny =
    finding.sampleSizes?.length ||
    finding.attritions?.length ||
    finding.costs?.length ||
    finding.groupDifferences?.length ||
    featureTags.length > 0;
  if (!hasAny) return null;

  return (
    <>
      <div class="sample-details__grid lg-field-grid">
        {finding.sampleSizes && finding.sampleSizes.length > 0 && (
          <div class="sample-details__field lg-field">
            <span class="sample-details__field-label lg-label">Size</span>
            <span>{finding.sampleSizes.map((s) => s.value).join("; ")}</span>
          </div>
        )}
        {featureTags.length > 0 && (
          <TagGroup label="Features" tags={featureTags} />
        )}
        {finding.attritions && finding.attritions.length > 0 && (
          <div class="sample-details__field lg-field">
            <span class="sample-details__field-label lg-label">Attrition</span>
            <span>{finding.attritions.map((a) => a.value).join("; ")}</span>
          </div>
        )}
        {finding.costs && finding.costs.length > 0 && (
          <div class="sample-details__field lg-field">
            <span class="sample-details__field-label lg-label">Cost</span>
            <span>{finding.costs.map((c) => c.value).join("; ")}</span>
          </div>
        )}
        {finding.groupDifferences && finding.groupDifferences.length > 0 && (
          <div class="sample-details__field sample-details__field--wide lg-field">
            <span class="sample-details__field-label lg-label">Group differences</span>
            <span>{finding.groupDifferences.map((g) => g.value).join("; ")}</span>
          </div>
        )}
      </div>
      <SourceEvidenceToggle entries={evidenceEntries} />
    </>
  );
}
