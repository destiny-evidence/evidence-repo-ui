import { useMemo } from "preact/hooks";
import { groupFindings } from "@/services/findingGroups";
import { SharedContextBlock } from "./SharedContextBlock";
import { FindingCard } from "./FindingCard";
import type { FindingData } from "@/types/investigation";
import "./FindingsSection.css";

interface FindingsSectionProps {
  findings: FindingData[];
  labels: Map<string, string>;
  broader: Map<string, string>;
  definitions?: Map<string, string>;
  retracted?: boolean;
}

export function FindingsSection({
  findings,
  labels,
  broader,
  definitions,
  retracted,
}: FindingsSectionProps) {
  const group = useMemo(() => groupFindings(findings), [findings]);

  if (findings.length === 0) return null;

  return (
    <div
      class={`findings-section${retracted ? " findings-section--retracted" : ""}`}
    >
      {group.shared && (
        <SharedContextBlock
          shared={group.shared}
          sampleSource={group.findings[0]}
          labels={labels}
          broader={broader}
          definitions={definitions}
        />
      )}
      {group.findings.map((finding, i) => (
        <FindingCard
          key={i}
          finding={finding}
          index={i + 1}
          isShared={group.shared !== null && i > 0}
          labels={labels}
          broader={broader}
          definitions={definitions}
        />
      ))}
    </div>
  );
}
