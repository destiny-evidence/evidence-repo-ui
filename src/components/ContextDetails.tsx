import { TagGroup } from "./TagGroup";
import { SourceEvidenceToggle } from "./SourceEvidenceToggle";
import { evidenceFrom } from "@/services/sourceEvidence";
import { conceptsToTags } from "@/services/conceptLabels";
import type { ContextData } from "@/types/investigation";

interface ContextDetailsProps {
  context: ContextData;
  labels: Map<string, string>;
  broader: Map<string, string>;
}

function collectEvidence(context: ContextData) {
  return [
    ...evidenceFrom("Level", context.educationLevels),
    ...evidenceFrom("Setting", context.settings),
    ...evidenceFrom("Participants", context.participants),
    ...evidenceFrom("Country", context.countries),
  ];
}

export function ContextDetails({ context, labels, broader }: ContextDetailsProps) {
  const levelTags = conceptsToTags(context.educationLevels, labels, broader);
  const settingTags = conceptsToTags(context.settings, labels, broader);
  const participantTags = context.participants?.map((p) => p.value) ?? [];
  const evidenceEntries = collectEvidence(context);

  return (
    <>
      <div class="context-details__grid lg-field-grid">
        {levelTags.length > 0 && <TagGroup label="Level" tags={levelTags} />}
        {settingTags.length > 0 && <TagGroup label="Setting" tags={settingTags} />}
        {participantTags.length > 0 && (
          <TagGroup label="Participants" tags={participantTags} />
        )}
        {context.countries && context.countries.length > 0 && (
          <div class="context-details__field lg-field">
            <span class="context-details__field-label lg-label">Country</span>
            <span>{context.countries.map((c) => c.value).join(", ")}</span>
          </div>
        )}
        {context.countryLevel1 && (
          <div class="context-details__field lg-field">
            <span class="context-details__field-label lg-label">Region</span>
            <span>{context.countryLevel1.value}</span>
          </div>
        )}
      </div>
      <SourceEvidenceToggle entries={evidenceEntries} />
    </>
  );
}
