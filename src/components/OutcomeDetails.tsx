import { TagGroup } from "./TagGroup";
import { SourceEvidenceToggle } from "./SourceEvidenceToggle";
import { LabeledField } from "./LabeledField";
import { conceptsToTags } from "@/services/conceptLabels";
import type { OutcomeData } from "@/types/investigation";
import "./LabeledField.css";
import "./OutcomeDetails.css";

interface OutcomeDetailsProps {
  outcome: OutcomeData;
  labels: Map<string, string>;
  broader: Map<string, string>;
  definitions?: Map<string, string>;
}

function collectEvidence(outcome: OutcomeData) {
  // Each outcome carries its own concept label, so we label evidence per
  // outcome rather than using a single shared section name.
  return (outcome.outcomes ?? [])
    .filter((o) => o.supportingText)
    .map((o) => ({
      label: o.value.label ?? "Outcome",
      text: o.supportingText ?? "",
    }));
}

export function OutcomeDetails({
  outcome,
  labels,
  broader,
  definitions,
}: OutcomeDetailsProps) {
  const tags = conceptsToTags(outcome.outcomes, labels, broader, definitions);
  const evidence = collectEvidence(outcome);

  return (
    <>
      {tags.length > 0 && <TagGroup tags={tags} />}
      {outcome.name && <LabeledField label="Measure">{outcome.name}</LabeledField>}
      {outcome.description && (
        <p class="outcome-details__measure-desc">{outcome.description}</p>
      )}
      <SourceEvidenceToggle entries={evidence} />
    </>
  );
}
