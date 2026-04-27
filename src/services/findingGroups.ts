import type {
  FindingData,
  InterventionData,
  ControlConditionData,
  ContextData,
} from "@/types/investigation";

export interface SharedContext {
  intervention: InterventionData;
  control: ControlConditionData;
  context: ContextData;
}

export interface FindingGroup {
  shared: SharedContext | null;
  findings: FindingData[];
}

function getInterventionId(f: FindingData): string | undefined {
  return f.intervention?.id ?? f.interventionRef;
}

function getControlId(f: FindingData): string | undefined {
  return f.control?.id ?? f.controlRef;
}

function getContextId(f: FindingData): string | undefined {
  return f.context?.id ?? f.contextRef;
}

export function groupFindings(findings: FindingData[]): FindingGroup {
  if (findings.length < 2) {
    return { shared: null, findings };
  }

  const firstIntId = getInterventionId(findings[0]);
  const firstCtrlId = getControlId(findings[0]);
  const firstCtxId = getContextId(findings[0]);

  if (!firstIntId || !firstCtrlId || !firstCtxId) {
    return { shared: null, findings };
  }

  const allShare = findings.every(
    (f) =>
      getInterventionId(f) === firstIntId &&
      getControlId(f) === firstCtrlId &&
      getContextId(f) === firstCtxId,
  );

  if (!allShare) {
    return { shared: null, findings };
  }

  // Find the first finding that has the full objects (not just refs)
  const withIntervention = findings.find((f) => f.intervention !== null);
  const withControl = findings.find((f) => f.control !== null);
  const withContext = findings.find((f) => f.context !== null);

  if (
    !withIntervention?.intervention ||
    !withControl?.control ||
    !withContext?.context
  ) {
    return { shared: null, findings };
  }

  return {
    shared: {
      intervention: withIntervention.intervention,
      control: withControl.control,
      context: withContext.context,
    },
    findings,
  };
}
