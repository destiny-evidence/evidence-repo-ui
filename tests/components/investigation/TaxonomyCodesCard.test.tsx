import { describe, test, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { TaxonomyCodesCard } from "@/components/investigation/TaxonomyCodesCard";
import type { TaxonomyGroup } from "@/services/taxonomyCodesUtils";

const topical: TaxonomyGroup = {
  schemeUri: "s:study",
  schemeLabel: "Study Design",
  isGeo: false,
  rolledUp: false,
  appliedCount: 1,
  nodes: [
    {
      uri: "q",
      label: "Quantitative",
      applied: false,
      children: [{ uri: "rct", label: "RCT", applied: true, children: [] }],
    },
  ],
};
const geo: TaxonomyGroup = {
  schemeUri: "s:country",
  schemeLabel: "Country",
  isGeo: true,
  rolledUp: false,
  appliedCount: 2,
  nodes: [
    { uri: "ke", label: "Kenya", applied: true, children: [] },
    { uri: "ug", label: "Uganda", applied: true, children: [] },
  ],
};
const flooded: TaxonomyGroup = {
  schemeUri: "s:country",
  schemeLabel: "Country",
  isGeo: true,
  rolledUp: true,
  appliedCount: 24,
  nodes: [
    { uri: "ke", label: "Kenya", applied: true, children: [] },
    { uri: "ug", label: "Uganda", applied: true, children: [] },
  ],
};

describe("TaxonomyCodesCard", () => {
  test("returns null when there are no groups", () => {
    const { container } = render(<TaxonomyCodesCard groups={[]} />);
    expect(container.firstChild).toBeNull();
  });

  test("renders the lg-card chrome, card title, and a topical scheme heading + tag", () => {
    const { container } = render(<TaxonomyCodesCard groups={[topical]} />);
    expect(
      container.querySelector("article.taxonomy-codes-card.lg-card"),
    ).not.toBeNull();
    expect(
      screen.getByRole("heading", { name: "Taxonomy codes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Study Design" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Quantitative")).toBeInTheDocument(); // sub-heading
    expect(screen.getByText("RCT")).toBeInTheDocument(); // applied tag
  });

  test("renders applied descendants of an applied node (does not drop them)", () => {
    const nested: TaxonomyGroup = {
      schemeUri: "s:study",
      schemeLabel: "Study Design",
      isGeo: false,
      rolledUp: false,
      appliedCount: 2,
      nodes: [
        {
          uri: "q",
          label: "Quantitative",
          applied: false,
          children: [
            {
              uri: "rct",
              label: "RCT",
              applied: true,
              children: [
                { uri: "crct", label: "Cluster RCT", applied: true, children: [] },
              ],
            },
          ],
        },
      ],
    };
    render(<TaxonomyCodesCard groups={[nested]} />);
    expect(screen.getByText("Quantitative")).toBeInTheDocument(); // ancestor sub-heading
    expect(screen.getByText("RCT")).toBeInTheDocument(); // applied parent
    expect(screen.getByText("Cluster RCT")).toBeInTheDocument(); // applied child, not dropped
  });

  test("renders a geo group expanded (no <details>) listing its members", () => {
    const { container } = render(<TaxonomyCodesCard groups={[geo]} />);
    expect(container.querySelector("details")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Country" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Kenya")).toBeInTheDocument();
    expect(screen.getByText("Uganda")).toBeInTheDocument();
  });

  test("collapses a flooded group by default: a 'Multiple … (count)' toggle, members in a hidden panel", () => {
    const { container } = render(<TaxonomyCodesCard groups={[flooded]} />);
    expect(
      screen.getByRole("heading", { name: "Country" }),
    ).toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: /Multiple countries/ });
    expect(toggle.textContent).toMatch(/Multiple countries \(24\)/);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    const panel = container.querySelector<HTMLElement>(
      ".taxonomy-codes-card__rollup-panel",
    );
    expect(panel?.hidden).toBe(true);
  });

  test("expands a flooded group on click, revealing its members", () => {
    const { container } = render(<TaxonomyCodesCard groups={[flooded]} />);
    const toggle = screen.getByRole("button", { name: /Multiple countries/ });
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const panel = container.querySelector<HTMLElement>(
      ".taxonomy-codes-card__rollup-panel",
    );
    expect(panel?.hidden).toBe(false);
    expect(screen.getByText("Kenya")).toBeInTheDocument();
    expect(screen.getByText("Uganda")).toBeInTheDocument();
  });

  test("collapses a flooded group again on a second click", () => {
    const { container } = render(<TaxonomyCodesCard groups={[flooded]} />);
    const toggle = screen.getByRole("button", { name: /Multiple countries/ });
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    const panel = container.querySelector<HTMLElement>(
      ".taxonomy-codes-card__rollup-panel",
    );
    expect(panel?.hidden).toBe(true);
  });

  test("the rollup toggle's aria-controls points at a panel present in the DOM while collapsed", () => {
    render(<TaxonomyCodesCard groups={[flooded]} />);
    const toggle = screen.getByRole("button", { name: /Multiple countries/ });
    const controlsId = toggle.getAttribute("aria-controls");
    expect(controlsId).toBeTruthy();
    expect(document.getElementById(controlsId!)).not.toBeNull();
  });

  test("rolls a flooded topical scheme up too (geo-agnostic), pluralizing its label with a count", () => {
    const floodedTopical: TaxonomyGroup = {
      schemeUri: "s:outcome",
      schemeLabel: "Outcome",
      isGeo: false,
      rolledUp: true,
      appliedCount: 15,
      nodes: [{ uri: "x", label: "Some outcome", applied: true, children: [] }],
    };
    render(<TaxonomyCodesCard groups={[floodedTopical]} />);
    const toggle = screen.getByRole("button", { name: /Multiple outcomes/ });
    expect(toggle.textContent).toMatch(/Multiple outcomes \(15\)/);
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Some outcome")).toBeInTheDocument();
  });

  test("shows the vocab-unavailable note when flagged", () => {
    render(<TaxonomyCodesCard groups={[topical]} vocabUnavailable />);
    expect(screen.getByRole("status").textContent).toMatch(
      /Vocabulary unavailable/,
    );
  });
});
