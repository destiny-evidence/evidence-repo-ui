import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/preact";
import { ResultRow } from "@/components/search/ResultRow";
import type { Reference } from "@/types/models";

function makeRef(overrides: Partial<Reference> = {}): Reference {
  return {
    id: "ref-1",
    visibility: "public",
    identifiers: [{ identifier: "10.1000/abc", identifier_type: "doi" }],
    enhancements: [
      {
        id: "e1",
        reference_id: "ref-1",
        source: "openalex",
        visibility: "public",
        robot_version: null,
        derived_from: null,
        created_at: "2024-01-01",
        content: {
          enhancement_type: "bibliographic",
          authorship: [
            { display_name: "Smith, J.", orcid: null, position: "first" },
            { display_name: "Jones, K.", orcid: null, position: "last" },
          ],
          cited_by_count: 42,
          created_date: null,
          updated_date: null,
          publication_date: "2020-06-01",
          publication_year: 2020,
          publisher: null,
          title: "On phonics instruction",
          pagination: null,
          publication_venue: { display_name: "Journal of Education", venue_type: "journal" },
        },
      },
      {
        id: "e2",
        reference_id: "ref-1",
        source: "openalex",
        visibility: "public",
        robot_version: null,
        derived_from: null,
        created_at: "2024-01-02",
        content: {
          enhancement_type: "abstract",
          process: "openalex",
          abstract: "This is the abstract body text used for the snippet preview.",
        },
      },
    ],
    ...overrides,
  };
}

describe("ResultRow", () => {
  test("renders title, authors, venue, year", () => {
    render(<ResultRow communitySlug="esea" reference={makeRef()} />);
    expect(screen.getByText("On phonics instruction")).toBeInTheDocument();
    expect(screen.getByText(/Smith, J\./)).toBeInTheDocument();
    expect(screen.getByText(/Journal of Education/)).toBeInTheDocument();
    expect(screen.getByText(/2020/)).toBeInTheDocument();
  });

  test("renders abstract snippet", () => {
    render(<ResultRow communitySlug="esea" reference={makeRef()} />);
    expect(screen.getByText(/abstract body text/)).toBeInTheDocument();
  });

  test("primary content (title, authors, venue, abstract) is all wrapped in the row anchor", () => {
    render(<ResultRow communitySlug="esea" reference={makeRef()} />);
    const rowLink = screen.getByRole("link", { name: /on phonics instruction/i });
    expect(rowLink).toHaveAttribute("href", "/esea/references/ref-1");
    expect(rowLink).toContainElement(screen.getByText("On phonics instruction"));
    expect(rowLink).toContainElement(screen.getByText(/Smith, J\./));
    expect(rowLink).toContainElement(screen.getByText(/Journal of Education/));
    expect(rowLink).toContainElement(screen.getByText(/2020/));
    expect(rowLink).toContainElement(screen.getByText(/abstract body text/));
    // DOI is NOT inside the row anchor (would be invalid nested-interactive HTML).
    expect(rowLink.querySelector('a[href^="https://doi.org"]')).toBeNull();
  });

  test("row anchor carries the stretched-link class so CSS can extend its hit area", () => {
    const { container } = render(<ResultRow communitySlug="esea" reference={makeRef()} />);
    const link = container.querySelector(".row-link");
    expect(link).not.toBeNull();
    expect(link?.tagName).toBe("A");
  });

  test("DOI link is a sibling to the row anchor, with href = doi.org/<doi>", () => {
    render(<ResultRow communitySlug="esea" reference={makeRef()} />);
    const doi = screen.getByRole("link", { name: /^doi/i });
    expect(doi).toHaveAttribute("href", "https://doi.org/10.1000/abc");
    expect(doi).toHaveAttribute("target", "_blank");
  });

  test("DOI link is not rendered when no DOI identifier present", () => {
    const ref = makeRef({ identifiers: [] });
    render(<ResultRow communitySlug="esea" reference={ref} />);
    expect(screen.queryByRole("link", { name: /^doi/i })).toBeNull();
  });

  test("renders findings/estimates placeholder badges in right column", () => {
    const { container } = render(<ResultRow communitySlug="esea" reference={makeRef()} />);
    const nums = container.querySelectorAll(".stat-num");
    expect(nums).toHaveLength(2);
    expect(nums[0]).toHaveTextContent("—");
    expect(nums[1]).toHaveTextContent("—");
    expect(container.querySelector(".row-right")).toHaveTextContent(/findings/);
    expect(container.querySelector(".row-right")).toHaveTextContent(/estimates/);
  });

  test("does not render coding institution when no raw enhancement is present", () => {
    render(<ResultRow communitySlug="esea" reference={makeRef()} />);
    expect(screen.queryByTestId("coder-text")).toBeNull();
  });

  test("renders coding institution at the bottom of the right column", () => {
    const ref = makeRef({
      enhancements: [
        {
          id: "raw-1",
          reference_id: "ref-1",
          source: "eef-coder-v3",
          visibility: "public",
          robot_version: null,
          derived_from: null,
          created_at: "2024-01-01",
          content: { enhancement_type: "raw" },
        },
      ],
    });
    const { container } = render(
      <ResultRow communitySlug="esea" reference={ref} />,
    );
    const coder = screen.getByTestId("coder-text");
    expect(coder).toHaveTextContent("EEF");
    const right = container.querySelector(".row-right");
    expect(right?.lastElementChild).toBe(coder);
  });

  test("renders without throwing when bibliographic missing; row-anchor falls back to id", () => {
    const ref = makeRef({ enhancements: [] });
    render(<ResultRow communitySlug="esea" reference={ref} />);
    const rowLink = screen.getByRole("link", { name: /ref-1/i });
    expect(rowLink).toHaveAttribute("href", "/esea/references/ref-1");
  });
});
