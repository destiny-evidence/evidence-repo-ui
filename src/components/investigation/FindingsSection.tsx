import { useMemo } from "preact/hooks";
import { findSharedContext, isFindingRenderable } from "@/services/findingGroups";
import { SharedContextBlock } from "./SharedContextBlock";
import { FindingCard } from "../finding/FindingCard";
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
  const renderable = useMemo(
    () => findings.filter(isFindingRenderable),
    [findings],
  );
  const shared = useMemo(() => findSharedContext(renderable), [renderable]);

  if (renderable.length === 0) return null;

  return (
    <div class={`findings-section${retracted ? " lg-retracted" : ""}`}>
      {shared && (
        <SharedContextBlock
          shared={shared}
          labels={labels}
          broader={broader}
          definitions={definitions}
        />
      )}
      {renderable.map((finding, i) => (
        <FindingCard
          key={`${finding.outcome?.name ?? "finding"}-${i}`}
          finding={finding}
          index={i + 1}
          isShared={shared !== null}
          labels={labels}
          broader={broader}
          definitions={definitions}
        />
      ))}
    </div>
  );
}
