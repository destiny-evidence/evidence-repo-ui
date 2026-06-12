import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/preact";
import { TaxonomyCodesCard } from "@/components/investigation/TaxonomyCodesCard";
import type { TaxonomyGroup } from "@/services/taxonomyCodesUtils";

const topical: TaxonomyGroup = {
  schemeUri: "s:study",
  schemeLabel: "Study Design",
  isGeo: false,
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
    expect(screen.getByText("Quantitative")).toBeInTheDocument(); // breadcrumb parent
    expect(screen.getByText("RCT")).toBeInTheDocument(); // applied tag
  });

  test("renders nested concepts inline as breadcrumbs, not indented sub-headings", () => {
    const nested: TaxonomyGroup = {
      schemeUri: "s:study",
      schemeLabel: "Study Design",
      isGeo: false,
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
    const { container } = render(<TaxonomyCodesCard groups={[nested]} />);
    // hierarchy is inlined like the findings cards: no indented sub-heading blocks
    expect(container.querySelector(".taxonomy-codes-card__subgroup")).toBeNull();
    expect(container.querySelector(".taxonomy-codes-card__subheading")).toBeNull();
    // each coded concept is a pill carrying its immediate ancestor as a breadcrumb
    const tags = [...container.querySelectorAll(".tag-group__tag")].map(
      (t) => t.textContent,
    );
    expect(tags).toContain("Quantitative › RCT"); // non-applied ancestor as breadcrumb
    expect(tags).toContain("RCT › Cluster RCT"); // applied child not dropped
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

  test("lists every member of a large group, with no roll-up toggle", () => {
    const labels = Array.from({ length: 12 }, (_, i) => `Country ${i}`);
    const largeGeo: TaxonomyGroup = {
      schemeUri: "s:country",
      schemeLabel: "Country",
      isGeo: true,
      nodes: labels.map((label, i) => ({
        uri: `c${i}`,
        label,
        applied: true,
        children: [],
      })),
    };
    render(<TaxonomyCodesCard groups={[largeGeo]} />);
    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("shows the vocab-unavailable note when flagged", () => {
    render(<TaxonomyCodesCard groups={[topical]} vocabUnavailable />);
    expect(screen.getByRole("status").textContent).toMatch(
      /Vocabulary unavailable/,
    );
  });
});
