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

describe("FindingCard", () => {
  test("renders finding header", () => {
    render(<FindingCard finding={makeFinding()} index={1} isShared={false} labels={new Map()} broader={new Map()} />);
    expect(screen.getByText("Finding 1")).toBeDefined();
  });

  test("shows shared reference when isShared is true", () => {
    render(<FindingCard finding={makeFinding()} index={1} isShared={true} labels={new Map()} broader={new Map()} />);
    expect(
      screen.getByText(
        /Same intervention, control, and context as above/,
      ),
    ).toBeDefined();
  });

  test("shows intervention and control side by side", () => {
    render(<FindingCard finding={makeFinding()} index={1} isShared={false} labels={new Map()} broader={new Map()} />);
    expect(screen.getByText("Test Intervention")).toBeDefined();
    expect(screen.getByText("Business as usual")).toBeDefined();
    expect(screen.getByText("vs")).toBeDefined();
  });

  test("renders theme tags and duration", () => {
    render(<FindingCard finding={makeFinding()} index={1} isShared={false} labels={new Map()} broader={new Map()} />);
    expect(screen.getByText("Cooperative Learning")).toBeDefined();
    expect(screen.getByText("5")).toBeDefined();
  });

  test("renders intervention description", () => {
    render(<FindingCard finding={makeFinding()} index={1} isShared={false} labels={new Map()} broader={new Map()} />);
    expect(screen.getByText("Students work in small groups")).toBeDefined();
  });

  test("renders outcome tags", () => {
    render(<FindingCard finding={makeFinding()} index={1} isShared={false} labels={new Map()} broader={new Map()} />);
    expect(screen.getByText("Basic Skills")).toBeDefined();
  });

  test("renders context with level and setting", () => {
    render(<FindingCard finding={makeFinding()} index={1} isShared={false} labels={new Map()} broader={new Map()} />);
    expect(screen.getByText("Primary")).toBeDefined();
    expect(screen.getByText("Formal")).toBeDefined();
  });

  test("renders sample size", () => {
    render(<FindingCard finding={makeFinding()} index={1} isShared={false} labels={new Map()} broader={new Map()} />);
    expect(screen.getByText("50")).toBeDefined();
  });
});
