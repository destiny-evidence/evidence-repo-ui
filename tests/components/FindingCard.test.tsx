import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/preact";
import { FindingCard } from "@/components/FindingCard";
import type { FindingData } from "@/types/investigation";
import { makeArm, makeEffectEstimate, makeRichFinding } from "../fixtures";

function renderCard(opts: { finding?: Partial<FindingData>; isShared?: boolean } = {}) {
  return render(
    <FindingCard
      finding={makeRichFinding(opts.finding)}
      index={1}
      isShared={opts.isShared ?? false}
      labels={new Map()}
      broader={new Map()}
    />,
  );
}

describe("FindingCard", () => {
  test("renders all sections of a default finding", () => {
    renderCard();
    // Header
    expect(screen.getByText("Finding 1")).toBeDefined();
    // Intervention vs control comparison
    expect(screen.getByText("Test Intervention")).toBeDefined();
    expect(screen.getByText("Business as usual")).toBeDefined();
    expect(screen.getByText("vs")).toBeDefined();
    // Theme + description + duration
    expect(screen.getByText("Cooperative Learning")).toBeDefined();
    expect(screen.getByText("Students work in small groups")).toBeDefined();
    expect(screen.getByText("5")).toBeDefined();
    // Context
    expect(screen.getByText("Primary")).toBeDefined();
    expect(screen.getByText("Formal")).toBeDefined();
    // Outcome
    expect(screen.getByText("Basic Skills")).toBeDefined();
    // Sample
    expect(screen.getByText("50")).toBeDefined();
  });

  test("shows back-reference when isShared is true", () => {
    renderCard({ isShared: true });
    expect(
      screen.getByText(/Same intervention, control, and context as above/),
    ).toBeDefined();
  });

  test("renders effect estimate inset and arm rows when provided", () => {
    renderCard({
      finding: {
        effectEstimates: [
          makeEffectEstimate({ derivedFromIds: ["_:armI", "_:armC"] }),
        ],
        arms: [
          makeArm({ id: "_:armI", conditionRef: "_:int", n: 222 }),
          makeArm({ id: "_:armC", conditionRef: "_:ctrl", n: 222 }),
        ],
      },
    });
    expect(screen.getByText("0.33")).toBeDefined();
    expect(screen.getByText("Hedges' g")).toBeDefined();
    // "Test Intervention" appears in both ComparisonRow and the arm table.
    // "Control" appears as the ComparisonRow label and the arm row name.
    expect(screen.getAllByText("Test Intervention").length).toBe(2);
    expect(screen.getAllByText("Control").length).toBe(2);
  });
});
