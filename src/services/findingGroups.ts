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

export function groupFindings(findings: FindingData[]): FindingGroup {
  if (findings.length < 2) {
    return { shared: null, findings };
  }

  const first = findings[0];
  const firstIntId = first.intervention?.id ?? first.interventionRef;
  const firstCtrlId = first.control?.id ?? first.controlRef;
  const firstCtxId = first.context?.id ?? first.contextRef;

  if (!firstIntId || !firstCtrlId || !firstCtxId) {
    return { shared: null, findings };
  }

  const allShare = findings.every(
    (f) =>
      (f.intervention?.id ?? f.interventionRef) === firstIntId &&
      (f.control?.id ?? f.controlRef) === firstCtrlId &&
      (f.context?.id ?? f.contextRef) === firstCtxId,
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
