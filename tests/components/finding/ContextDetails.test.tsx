import { describe, test, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { ContextDetails } from "@/components/finding/ContextDetails";
import type { ContextData } from "@/types/investigation";

function renderContext(context: ContextData) {
  return render(
    <ContextDetails context={context} labels={new Map()} broader={new Map()} />,
  );
}

describe("ContextDetails", () => {
  test("joins multiple regions into a single comma-separated Region field", () => {
    renderContext({
      id: "_:ctx",
      countryLevel1s: [{ value: "California" }, { value: "Texas" }],
    });
    expect(screen.getByText("Region")).toBeDefined();
    expect(screen.getByText("California, Texas")).toBeDefined();
  });

  test("renders a lone region value", () => {
    renderContext({
      id: "_:ctx",
      countryLevel1s: [{ value: "California" }],
    });
    expect(screen.getByText("California")).toBeDefined();
  });

  test("surfaces region supporting text in the Source evidence toggle", () => {
    const { container } = renderContext({
      id: "_:ctx",
      countryLevel1s: [
        { value: "California", supportingText: "Study sites were in California" },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: /Source evidence/ }));
    const evidenceLabels = [
      ...container.querySelectorAll(".source-evidence__section-label"),
    ].map((e) => e.textContent ?? "");
    expect(evidenceLabels).toContain("Region");
    expect(screen.getByText("Study sites were in California")).toBeDefined();
  });
});
