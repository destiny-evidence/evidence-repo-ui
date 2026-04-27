import { describe, test, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import {
  SourceEvidenceToggle,
  splitPageRef,
} from "@/components/SourceEvidenceToggle";

describe("splitPageRef", () => {
  test("parses 'Page N:' prefix", () => {
    expect(splitPageRef("Page 8: 47 students were selected.")).toEqual({
      page: "p. 8:",
      body: "47 students were selected.",
    });
  });

  test("parses 'p. N:' prefix (already-canonical form)", () => {
    expect(splitPageRef("p. 12: Fidelity was monitored.")).toEqual({
      page: "p. 12:",
      body: "Fidelity was monitored.",
    });
  });

  test("is case-insensitive and handles extra whitespace", () => {
    expect(splitPageRef("  page  4 :  Some text.")).toEqual({
      page: "p. 4:",
      body: "Some text.",
    });
  });

  test("returns body unchanged when no page prefix", () => {
    expect(splitPageRef("Just some supporting text.")).toEqual({
      body: "Just some supporting text.",
    });
  });

  test("does not match a number that isn't followed by a colon", () => {
    expect(splitPageRef("Page 4 was great")).toEqual({
      body: "Page 4 was great",
    });
  });

  test("does not match an inline page reference mid-text", () => {
    expect(splitPageRef("As shown on Page 4: things happened.")).toEqual({
      body: "As shown on Page 4: things happened.",
    });
  });
});

describe("SourceEvidenceToggle", () => {
  test("renders nothing when there are no entries", () => {
    const { container } = render(<SourceEvidenceToggle entries={[]} />);
    expect(container.innerHTML).toBe("");
  });

  test("starts collapsed and toggles open on click", () => {
    render(
      <SourceEvidenceToggle
        entries={[{ label: "Size", text: "Page 8: 47 students." }]}
      />,
    );
    const button = screen.getByRole("button", { name: /Source evidence/ });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText(/47 students/)).toBeNull();

    fireEvent.click(button);

    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/47 students/)).toBeDefined();
    expect(screen.getByText("p. 8:")).toBeDefined();
    expect(screen.getByText("Size")).toBeDefined();
  });

  test("collapses again on second click", () => {
    render(
      <SourceEvidenceToggle entries={[{ label: "Size", text: "47 students" }]} />,
    );
    const button = screen.getByRole("button", { name: /Source evidence/ });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText(/47 students/)).toBeNull();
  });

  test("links button aria-controls to the panel id", () => {
    render(
      <SourceEvidenceToggle entries={[{ label: "Size", text: "47 students" }]} />,
    );
    const button = screen.getByRole("button", { name: /Source evidence/ });
    fireEvent.click(button);
    const controlsId = button.getAttribute("aria-controls");
    expect(controlsId).toBeTruthy();
    expect(document.getElementById(controlsId!)).not.toBeNull();
  });

  test("renders multiple entries with their labels", () => {
    render(
      <SourceEvidenceToggle
        entries={[
          { label: "Size", text: "Page 8: 47 students." },
          { label: "Attrition", text: "Page 8: 3 students dropped out." },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Source evidence/ }));
    expect(screen.getByText("Size")).toBeDefined();
    expect(screen.getByText("Attrition")).toBeDefined();
    expect(screen.getByText(/47 students/)).toBeDefined();
    expect(screen.getByText(/3 students dropped out/)).toBeDefined();
  });
});
