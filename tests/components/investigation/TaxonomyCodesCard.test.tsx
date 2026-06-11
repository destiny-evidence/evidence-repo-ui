import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/preact";
import { TaxonomyCodesCard } from "@/components/investigation/TaxonomyCodesCard";
import type { TaxonomyGroup } from "@/services/taxonomyCodesUtils";

const topical: TaxonomyGroup = {
  schemeUri: "s:study",
  schemeLabel: "Study Design",
  isGeo: false,
  collapsedByDefault: false,
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
  collapsedByDefault: true,
  appliedCount: 2,
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
      collapsedByDefault: false,
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

  test("renders a geo group as a collapsed details with a count summary", () => {
    const { container } = render(<TaxonomyCodesCard groups={[geo]} />);
    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    expect(details!.open).toBe(false);
    expect(screen.getByText("Country (2)")).toBeInTheDocument();
    expect(screen.getByText("Kenya")).toBeInTheDocument();
  });

  test("shows the vocab-unavailable note when flagged", () => {
    render(<TaxonomyCodesCard groups={[topical]} vocabUnavailable />);
    expect(screen.getByRole("status").textContent).toMatch(
      /Vocabulary unavailable/,
    );
  });
});
