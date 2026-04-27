import { useMemo } from "preact/hooks";
import { findSharedContext } from "@/services/findingGroups";
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
  const shared = useMemo(() => findSharedContext(findings), [findings]);

  if (findings.length === 0) return null;

  return (
    <div class={`findings-section${retracted ? " lg-retracted" : ""}`}>
      {shared && (
        <SharedContextBlock
          shared={shared}
          sampleSource={findings[0]}
          labels={labels}
          broader={broader}
          definitions={definitions}
        />
      )}
      {findings.map((finding, i) => (
        <FindingCard
          key={i}
          finding={finding}
          index={i + 1}
          isShared={shared !== null && i > 0}
          labels={labels}
          broader={broader}
          definitions={definitions}
        />
      ))}
    </div>
  );
}
