import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/preact";
import { FindingCard } from "@/components/FindingCard";
import type { FindingData } from "@/types/investigation";

function makeFinding(overrides: Partial<FindingData> = {}): FindingData {
  return {
    intervention: {
      id: "_:int",
      name: "Test Intervention",
      educationThemes: [
        { value: { uri: "u:theme", label: "Cooperative Learning" } },
      ],
      descriptions: ["Students work in small groups"],
      duration: { value: 5, supportingText: "5 weeks" },
    },
    interventionRef: "_:int",
    control: { id: "_:ctrl", description: "Business as usual" },
    controlRef: "_:ctrl",
    context: {
      id: "_:ctx",
      educationLevels: [
        { value: { uri: "u:1", label: "Primary" } },
      ],
      settings: [{ value: { uri: "u:3", label: "Formal" } }],
    },
    contextRef: "_:ctx",
    outcome: {
      name: "Math test",
      outcomes: [{ value: { uri: "u:2", label: "Basic Skills" } }],
    },
    sampleSize: { value: 50 },
    ...overrides,
  };
}

function renderCard(opts: { finding?: Partial<FindingData>; isShared?: boolean } = {}) {
  return render(
    <FindingCard
      finding={makeFinding(opts.finding)}
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
});
