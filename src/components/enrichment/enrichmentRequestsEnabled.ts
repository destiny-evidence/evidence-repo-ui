import type { Community } from "@/types/models";
import type { FindingData, InvestigationData } from "@/types/investigation";

const ESEA_SLUG = "esea";

// At or above this many annotations a record counts as already coded.
const SUFFICIENTLY_CODED = 20;

const lengths = (...groups: (readonly unknown[] | undefined)[]): number =>
  groups.reduce((total, group) => total + (group?.length ?? 0), 0);

function countFindingAnnotations(finding: FindingData): number {
  const { intervention, context, outcome } = finding;
  return lengths(
    finding.sampleSizes,
    finding.attritions,
    finding.costs,
    finding.groupDifferences,
    finding.sampleFeatures,
    intervention?.educationThemes,
    intervention?.durations,
    intervention?.implementerTypes,
    intervention?.implementationFidelities,
    intervention?.implementationNames,
    intervention?.implementationDescriptions,
    intervention?.funderInterventions,
    context?.educationLevels,
    context?.settings,
    context?.countries,
    context?.countryLevel1s,
    context?.participants,
    outcome?.outcomes,
  );
}

/**
 * How many coded annotations a record carries, across both the investigation
 * and its findings.
 */
export function countCodedAnnotations(
  investigation: InvestigationData | null,
): number {
  if (!investigation) return 0;
  return (
    lengths(
      investigation.documentTypes,
      investigation.studyDesigns,
      investigation.appliedConcepts,
    ) + investigation.findings.reduce((t, f) => t + countFindingAnnotations(f), 0)
  );
}

export function hasFindingWithoutEstimates(
  investigation: InvestigationData | null,
): boolean {
  return Boolean(
    investigation?.findings.some((f) => !f.effectEstimates?.length),
  );
}

/**
 * Whether to offer the fake-door enrichment request for a record.
 */
export function enrichmentRequestsEnabled(
  community: Community | null,
  investigation: InvestigationData | null,
): boolean {
  if (community?.slug !== ESEA_SLUG) return false;
  return (
    countCodedAnnotations(investigation) < SUFFICIENTLY_CODED ||
    hasFindingWithoutEstimates(investigation)
  );
}
