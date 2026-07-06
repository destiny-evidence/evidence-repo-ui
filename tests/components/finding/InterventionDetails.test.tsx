import { describe, test, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { InterventionDetails } from "@/components/finding/InterventionDetails";
import type {
  CodedAnnotation,
  InterventionData,
  ResolvedConcept,
} from "@/types/investigation";

function concept(
  uri: string,
  label: string,
  supportingText?: string,
): CodedAnnotation<ResolvedConcept> {
  return {
    value: { uri, label },
    ...(supportingText ? { supportingText } : {}),
  };
}

function makeIntervention(
  overrides: Partial<InterventionData> = {},
): InterventionData {
  return {
    id: "_:int",
    implementerTypes: [],
    implementationFidelities: [],
    ...overrides,
  };
}

function renderDetails(intervention: InterventionData) {
  return render(
    <InterventionDetails
      intervention={intervention}
      labels={new Map()}
      broader={new Map()}
    />,
  );
}

function evidenceLabels(container: Element): string[] {
  return [...container.querySelectorAll(".source-evidence__section-label")].map(
    (e) => e.textContent ?? "",
  );
}

describe("InterventionDetails", () => {
  test("renders a single implementer type tag", () => {
    renderDetails(
      makeIntervention({ implementerTypes: [concept("u:teacher", "Teacher")] }),
    );
    expect(screen.getByText("Implementer")).toBeDefined();
    expect(screen.getByText("Teacher")).toBeDefined();
  });

  test("renders a tag per implementer type when there are several", () => {
    renderDetails(
      makeIntervention({
        implementerTypes: [
          concept("u:teacher", "Teacher"),
          concept("u:ta", "Teaching Assistant"),
        ],
      }),
    );
    expect(screen.getByText("Teacher")).toBeDefined();
    expect(screen.getByText("Teaching Assistant")).toBeDefined();
  });

  test("renders a single implementation fidelity tag", () => {
    renderDetails(
      makeIntervention({
        implementationFidelities: [concept("u:high", "High fidelity")],
      }),
    );
    expect(screen.getByText("Implementation fidelity")).toBeDefined();
    expect(screen.getByText("High fidelity")).toBeDefined();
  });

  test("renders a tag per implementation fidelity when there are several", () => {
    renderDetails(
      makeIntervention({
        implementationFidelities: [
          concept("u:high", "High fidelity"),
          concept("u:partial", "Partial fidelity"),
        ],
      }),
    );
    expect(screen.getByText("High fidelity")).toBeDefined();
    expect(screen.getByText("Partial fidelity")).toBeDefined();
  });

  test("disambiguates multiple implementer evidence entries by label", () => {
    const { container } = renderDetails(
      makeIntervention({
        implementerTypes: [
          concept("u:teacher", "Teacher", "Delivered by classroom teachers"),
          concept(
            "u:ta",
            "Teaching Assistant",
            "Supported by teaching assistants",
          ),
        ],
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Source evidence/ }));
    const labels = evidenceLabels(container);
    expect(labels).toContain("Implementer: Teacher");
    expect(labels).toContain("Implementer: Teaching Assistant");
  });

  test("uses a plain label for a single implementer evidence entry", () => {
    const { container } = renderDetails(
      makeIntervention({
        implementerTypes: [
          concept("u:teacher", "Teacher", "Delivered by classroom teachers"),
        ],
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Source evidence/ }));
    expect(evidenceLabels(container)).toEqual(["Implementer"]);
  });

  test("joins multiple durations into a single Duration field", () => {
    renderDetails(makeIntervention({ durations: [{ value: 6 }, { value: 12 }] }));
    expect(screen.getByText("Duration")).toBeDefined();
    expect(screen.getByText("6; 12")).toBeDefined();
  });

  test("joins multiple implementation names and funders each into one field", () => {
    renderDetails(
      makeIntervention({
        implementationNames: [{ value: "Programme A" }, { value: "Programme B" }],
        funderInterventions: [{ value: "Wellcome" }, { value: "Nuffield" }],
      }),
    );
    expect(screen.getByText("Programme A; Programme B")).toBeDefined();
    expect(screen.getByText("Wellcome; Nuffield")).toBeDefined();
  });
});
