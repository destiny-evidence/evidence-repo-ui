import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/preact";
import { SampleDetails } from "@/components/finding/SampleDetails";
import type { FindingData } from "@/types/investigation";

type SampleFields = Pick<
  FindingData,
  "sampleSizes" | "attritions" | "costs" | "groupDifferences" | "sampleFeatures"
>;

function renderSample(finding: SampleFields) {
  return render(
    <SampleDetails finding={finding} labels={new Map()} broader={new Map()} />,
  );
}

describe("SampleDetails", () => {
  test("joins each multi-valued scalar into a single field", () => {
    renderSample({
      sampleSizes: [{ value: 42 }, { value: 59 }],
      attritions: [{ value: 8 }, { value: 15 }],
      costs: [{ value: "Reported" }, { value: "Not reported" }],
      groupDifferences: [{ value: "Comparable" }, { value: "Age imbalance" }],
    });
    expect(screen.getByText("42; 59")).toBeDefined();
    expect(screen.getByText("8; 15")).toBeDefined();
    expect(screen.getByText("Reported; Not reported")).toBeDefined();
    expect(screen.getByText("Comparable; Age imbalance")).toBeDefined();
  });

  test("renders a lone value without a separator", () => {
    const { container } = renderSample({ sampleSizes: [{ value: 42 }] });
    expect(screen.getByText("42")).toBeDefined();
    expect(container.textContent).not.toContain(";");
  });

  test("renders nothing when there is no sample data", () => {
    const { container } = renderSample({});
    expect(container.firstChild).toBeNull();
  });
});
