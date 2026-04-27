import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/preact";
import { SharedContextBlock } from "@/components/SharedContextBlock";
import type { SharedContext } from "@/services/findingGroups";

function makeShared(overrides: Partial<SharedContext> = {}): SharedContext {
  return {
    intervention: {
      id: "_:int",
      name: "Cooperative Learning",
      educationThemes: [
        { value: { uri: "u:1", label: "Literacy" } },
      ],
      descriptions: ["Students work in small groups"],
      duration: { value: 5 },
    },
    control: { id: "_:ctrl", description: "Business as usual" },
    context: {
      id: "_:ctx",
      educationLevels: [
        { value: { uri: "u:2", label: "Primary" } },
      ],
      settings: [
        { value: { uri: "u:3", label: "Formal" } },
      ],
      participants: [{ value: "Students" }],
    },
    ...overrides,
  };
}

function renderBlock(overrides?: Partial<SharedContext>) {
  return render(
    <SharedContextBlock
      shared={makeShared(overrides)}
      labels={new Map()}
      broader={new Map()}
    />,
  );
}

describe("SharedContextBlock", () => {
  test("renders header, intervention/control comparison, theme, description, and context", () => {
    renderBlock();
    // Header
    expect(screen.getByText("Shared across all findings")).toBeDefined();
    // Intervention vs control
    expect(screen.getByText("Cooperative Learning")).toBeDefined();
    expect(screen.getByText("Business as usual")).toBeDefined();
    expect(screen.getByText("vs")).toBeDefined();
    // Theme tag
    expect(screen.getByText("Literacy")).toBeDefined();
    // Intervention description
    expect(screen.getByText("Students work in small groups")).toBeDefined();
    // Context fields
    expect(screen.getByText("Primary")).toBeDefined();
    expect(screen.getByText("Formal")).toBeDefined();
    expect(screen.getByText("Students")).toBeDefined();
  });
});
