import { TagGroup } from "../common/TagGroup";
import { SourceEvidenceToggle } from "./SourceEvidenceToggle";
import { evidenceFrom } from "@/services/sourceEvidence";
import { conceptsToTags } from "@/services/conceptLabels";
import { countryName } from "@/utils/country";
import type { ContextData } from "@/types/investigation";

interface ContextDetailsProps {
  context: ContextData;
  labels: Map<string, string>;
  broader: Map<string, string>;
  definitions?: Map<string, string>;
}

function collectEvidence(context: ContextData) {
  return [
    ...evidenceFrom("Level", context.educationLevels),
    ...evidenceFrom("Setting", context.settings),
    ...evidenceFrom("Participants", context.participants),
    ...evidenceFrom("Country", context.countries),
    ...evidenceFrom("Region", context.countryLevel1s),
  ];
}

export function ContextDetails({
  context,
  labels,
  broader,
  definitions,
}: ContextDetailsProps) {
  const levelTags = conceptsToTags(
    context.educationLevels,
    labels,
    broader,
    definitions,
  );
  const settingTags = conceptsToTags(
    context.settings,
    labels,
    broader,
    definitions,
  );
  const participantTags = context.participants?.map((p) => p.value) ?? [];
  const evidenceEntries = collectEvidence(context);

  return (
    <>
      <div class="lg-field-grid">
        {levelTags.length > 0 && <TagGroup label="Level" tags={levelTags} />}
        {settingTags.length > 0 && <TagGroup label="Setting" tags={settingTags} />}
        {participantTags.length > 0 && (
          <TagGroup label="Participants" tags={participantTags} />
        )}
        {context.countries && context.countries.length > 0 && (
          <div class="lg-field">
            <span class="lg-label">Country</span>
            <span>{context.countries.map((c) => countryName(c.value)).join(", ")}</span>
          </div>
        )}
        {context.countryLevel1s && context.countryLevel1s.length > 0 && (
          <div class="lg-field">
            <span class="lg-label">Region</span>
            <span>{context.countryLevel1s.map((r) => r.value).join(", ")}</span>
          </div>
        )}
      </div>
      <SourceEvidenceToggle entries={evidenceEntries} />
    </>
  );
}
