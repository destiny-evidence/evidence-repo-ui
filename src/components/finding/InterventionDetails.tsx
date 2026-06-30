import { TagGroup } from "../common/TagGroup";
import {
  SourceEvidenceToggle,
  type SourceEvidenceEntry,
} from "./SourceEvidenceToggle";
import { LabeledField } from "../common/LabeledField";
import { conceptsToTags } from "@/services/conceptLabels";
import { evidenceFrom } from "@/services/sourceEvidence";
import type {
  CodedAnnotation,
  InterventionData,
  ResolvedConcept,
} from "@/types/investigation";
import "../common/LabeledField.css";

interface InterventionDetailsProps {
  intervention: InterventionData;
  labels: Map<string, string>;
  broader: Map<string, string>;
  definitions?: Map<string, string>;
}

function conceptEvidence(
  label: string,
  annotations: CodedAnnotation<ResolvedConcept>[] | undefined,
): SourceEvidenceEntry[] {
  const all = annotations ?? [];
  const multiple = all.length > 1;
  return all
    .filter((a) => a.supportingText)
    .map((a) => ({
      label: multiple ? `${label}: ${a.value.label ?? a.value.uri}` : label,
      text: a.supportingText ?? "",
    }));
}

function collectEvidence(intervention: InterventionData): SourceEvidenceEntry[] {
  return [
    ...conceptEvidence("Theme", intervention.educationThemes),
    ...conceptEvidence("Implementer", intervention.implementerTypes),
    ...conceptEvidence(
      "Implementation fidelity",
      intervention.implementationFidelities,
    ),
    ...evidenceFrom("Implementation name", intervention.implementationName),
    ...evidenceFrom(
      "Implementation description",
      intervention.implementationDescriptions,
    ),
    ...evidenceFrom("Funder", intervention.funderIntervention),
    ...evidenceFrom("Duration", intervention.duration),
  ];
}

export function InterventionDetails({
  intervention,
  labels,
  broader,
  definitions,
}: InterventionDetailsProps) {
  const themeTags = conceptsToTags(
    intervention.educationThemes,
    labels,
    broader,
    definitions,
  );
  const implementerTags = conceptsToTags(
    intervention.implementerTypes,
    labels,
    broader,
    definitions,
  );
  const fidelityTags = conceptsToTags(
    intervention.implementationFidelities,
    labels,
    broader,
    definitions,
  );
  const evidenceEntries = collectEvidence(intervention);

  return (
    <>
      {themeTags.length > 0 && <TagGroup label="Theme" tags={themeTags} />}

      {intervention.descriptions && intervention.descriptions.length > 0 && (
        <>
          <h4 class="intervention-details__desc-label lg-label">
            Intervention description
          </h4>
          {intervention.descriptions.map((d, i) => (
            <blockquote
              key={`desc-${i}`}
              class="intervention-details__description"
            >
              {d}
            </blockquote>
          ))}
        </>
      )}

      {implementerTags.length > 0 && (
        <div class="labeled-field">
          <TagGroup label="Implementer" tags={implementerTags} />
        </div>
      )}

      {fidelityTags.length > 0 && (
        <div class="labeled-field">
          <TagGroup label="Implementation fidelity" tags={fidelityTags} />
        </div>
      )}

      {intervention.implementationName && (
        <LabeledField label="Implementation name">
          {intervention.implementationName.value}
        </LabeledField>
      )}

      {intervention.implementationDescriptions?.map((d, i) => (
        <LabeledField key={`impl-desc-${i}`} label="Implementation description">
          {d.value}
        </LabeledField>
      ))}

      {intervention.funderIntervention && (
        <LabeledField label="Funder">
          {intervention.funderIntervention.value}
        </LabeledField>
      )}

      {intervention.duration && (
        <LabeledField label="Duration">
          {intervention.duration.value}
        </LabeledField>
      )}

      <SourceEvidenceToggle entries={evidenceEntries} />
    </>
  );
}
