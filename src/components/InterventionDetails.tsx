import { TagGroup } from "./TagGroup";
import {
  SourceEvidenceToggle,
  type SourceEvidenceEntry,
} from "./SourceEvidenceToggle";
import { LabeledField } from "./LabeledField";
import { conceptsToTags, toHierarchicalTag } from "@/services/conceptLabels";
import { evidenceFrom } from "@/services/sourceEvidence";
import type { InterventionData } from "@/types/investigation";
import "./LabeledField.css";

interface InterventionDetailsProps {
  intervention: InterventionData;
  labels: Map<string, string>;
  broader: Map<string, string>;
  definitions?: Map<string, string>;
}

function themeEvidence(intervention: InterventionData): SourceEvidenceEntry[] {
  const themes = intervention.educationThemes ?? [];
  const multiple = themes.length > 1;
  return themes
    .filter((t) => t.supportingText)
    .map((t) => ({
      label: multiple ? `Theme: ${t.value.label ?? t.value.uri}` : "Theme",
      text: t.supportingText ?? "",
    }));
}

function collectEvidence(intervention: InterventionData): SourceEvidenceEntry[] {
  return [
    ...themeEvidence(intervention),
    ...evidenceFrom("Implementer", intervention.implementerType),
    ...evidenceFrom("Fidelity", intervention.implementationFidelity),
    ...evidenceFrom("Name", intervention.implementationName),
    ...evidenceFrom("Description", intervention.implementationDescriptions),
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

      {intervention.implementerType && (
        <div class="labeled-field">
          <TagGroup
            label="Implementer"
            tags={[
              toHierarchicalTag(
                intervention.implementerType.value,
                labels,
                broader,
                definitions,
              ),
            ]}
          />
        </div>
      )}

      {intervention.implementationFidelity && (
        <div class="labeled-field">
          <TagGroup
            label="Fidelity"
            tags={[
              toHierarchicalTag(
                intervention.implementationFidelity.value,
                labels,
                broader,
                definitions,
              ),
            ]}
          />
        </div>
      )}

      {intervention.implementationName && (
        <LabeledField label="Name">
          {intervention.implementationName.value}
        </LabeledField>
      )}

      {intervention.implementationDescriptions?.map((d, i) => (
        <LabeledField key={`impl-desc-${i}`} label="Description">
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
