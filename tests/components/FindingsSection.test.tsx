import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/preact";
import { FindingsSection } from "@/components/FindingsSection";
import type { FindingData } from "@/types/investigation";

function makeFinding(overrides: Partial<FindingData> = {}): FindingData {
  return {
    intervention: { id: "_:int", name: "Intervention" },
    interventionRef: "_:int",
    control: { id: "_:ctrl", description: "Control" },
    controlRef: "_:ctrl",
    context: { id: "_:ctx" },
    contextRef: "_:ctx",
    outcome: { name: "Outcome", outcomes: [] },
    ...overrides,
  };
}

function renderSection(findings: FindingData[]) {
  return render(
    <FindingsSection
      findings={findings}
      labels={new Map()}
      broader={new Map()}
    />,
  );
}

describe("FindingsSection", () => {
  test("renders nothing for empty findings", () => {
    const { container } = renderSection([]);
    expect(container.innerHTML).toBe("");
  });

  test("renders finding cards without shared block for single finding", () => {
    renderSection([makeFinding()]);
    expect(screen.getByText("Finding 1")).toBeDefined();
    expect(screen.queryByText("Shared across all findings")).toBeNull();
  });

  test("hoists shared context and shows back-reference on every card", () => {
    const { container } = renderSection([
      makeFinding(),
      makeFinding({ intervention: null, control: null, context: null }),
    ]);
    expect(screen.getByText("Shared across all findings")).toBeDefined();
    expect(screen.getByText("Finding 1")).toBeDefined();
    expect(screen.getByText("Finding 2")).toBeDefined();
    // Both finding cards must show the back-reference. Neither should render
    // intervention/control/context inline — that lives in the shared block.
    expect(container.querySelectorAll(".finding-card__shared-ref").length).toBe(2);
    expect(container.querySelector(".finding-card .comparison-row")).toBeNull();
  });

  test("renders without shared block when interventions differ", () => {
    renderSection([
      makeFinding(),
      makeFinding({
        intervention: { id: "_:other", name: "Other" },
        interventionRef: "_:other",
      }),
    ]);
    expect(screen.queryByText("Shared across all findings")).toBeNull();
    expect(screen.getByText("Finding 1")).toBeDefined();
    expect(screen.getByText("Finding 2")).toBeDefined();
  });
});
