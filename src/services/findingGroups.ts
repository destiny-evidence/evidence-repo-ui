import type {
  FindingData,
  InterventionData,
  ControlConditionData,
  ContextData,
  OutcomeData,
} from "@/types/investigation";

export interface SharedContext {
  intervention: InterventionData;
  control: ControlConditionData;
  context: ContextData;
}

export function hasSampleData(finding: FindingData): boolean {
  return Boolean(
    finding.sampleSizes?.length ||
      finding.attritions?.length ||
      finding.costs?.length ||
      finding.groupDifferences?.length ||
      (finding.sampleFeatures && finding.sampleFeatures.length > 0),
  );
}

export function hasOutcomeContent(outcome: OutcomeData | null): boolean {
  return Boolean(
    outcome &&
      ((outcome.outcomes && outcome.outcomes.length > 0) ||
        outcome.name ||
        outcome.description),
  );
}

export function isFindingRenderable(finding: FindingData): boolean {
  return Boolean(
    finding.intervention ||
      finding.control ||
      finding.context ||
      (finding.effectEstimates && finding.effectEstimates.length > 0) ||
      hasOutcomeContent(finding.outcome) ||
      hasSampleData(finding),
  );
}

/**
 * Determine whether all findings reference the same intervention/control/context
 * (via either inline `@id` or a blank-node string ref). Returns the shared
 * context to hoist into a "Shared across all findings" block, or null when
 * findings differ or when the referenced full objects aren't available.
 */
export function findSharedContext(
  findings: FindingData[],
): SharedContext | null {
  if (findings.length < 2) return null;

  const first = findings[0];
  const firstIntId = first.intervention?.id ?? first.interventionRef;
  const firstCtrlId = first.control?.id ?? first.controlRef;
  const firstCtxId = first.context?.id ?? first.contextRef;

  if (!firstIntId || !firstCtrlId || !firstCtxId) return null;

  const allShare = findings.every(
    (f) =>
      (f.intervention?.id ?? f.interventionRef) === firstIntId &&
      (f.control?.id ?? f.controlRef) === firstCtrlId &&
      (f.context?.id ?? f.contextRef) === firstCtxId,
  );
  if (!allShare) return null;

  // Find the first finding that has the full objects (not just refs).
  const withIntervention = findings.find((f) => f.intervention !== null);
  const withControl = findings.find((f) => f.control !== null);
  const withContext = findings.find((f) => f.context !== null);

  if (
    !withIntervention?.intervention ||
    !withControl?.control ||
    !withContext?.context
  ) {
    return null;
  }

  return {
    intervention: withIntervention.intervention,
    control: withControl.control,
    context: withContext.context,
  };
}
