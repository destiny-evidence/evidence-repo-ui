import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/preact";
import { InvestigationCard } from "@/components/InvestigationCard";

const DEFAULT_PROPS = {
  title: "Effects of peer tutoring on listening comprehension",
  authors: [
    { display_name: "Smith, J.", orcid: null, position: "first" as const },
    { display_name: "Jones, K.", orcid: null, position: "last" as const },
  ],
  venue: { display_name: "Journal of Education", venue_type: "journal" as const },
  pagination: {
    volume: "42",
    issue: "3",
    first_page: "100",
    last_page: "115",
  },
  doi: "10.1234/test.2024",
  publicationYear: 2024,
  documentType: {
    value: {
      uri: "https://vocab.esea.education/C00008",
      label: "Journal Article",
    },
  },
  isRetracted: false,
};

describe("InvestigationCard", () => {
  test("renders title, authors, venue, DOI", () => {
    render(<InvestigationCard {...DEFAULT_PROPS} />);

    expect(screen.getByText("Investigation")).toBeDefined();
    expect(
      screen.getByText(
        "Effects of peer tutoring on listening comprehension",
      ),
    ).toBeDefined();
    expect(screen.getByText("Smith, J., Jones, K. (2024)")).toBeDefined();
    expect(
      screen.getByText("Journal of Education, 42(3), 100–115"),
    ).toBeDefined();
  });

  test("DOI links to doi.org", () => {
    render(<InvestigationCard {...DEFAULT_PROPS} />);

    const link = screen.getByText("10.1234/test.2024");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe(
      "https://doi.org/10.1234/test.2024",
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  test("renders document type tag", () => {
    render(<InvestigationCard {...DEFAULT_PROPS} />);
    expect(screen.getByText("Doc Type")).toBeDefined();
    expect(screen.getByText("Journal Article")).toBeDefined();
  });

  test("shows retracted banner when isRetracted is true", () => {
    render(<InvestigationCard {...DEFAULT_PROPS} isRetracted={true} />);

    expect(
      screen.getByText(
        /This investigation has been retracted/,
      ),
    ).toBeDefined();
  });

  test("applies retracted opacity class", () => {
    const { container } = render(
      <InvestigationCard {...DEFAULT_PROPS} isRetracted={true} />,
    );
    const card = container.querySelector(".investigation-card");
    expect(card?.classList.contains("investigation-card--retracted")).toBe(
      true,
    );
  });

  test("renders gracefully with missing optional fields", () => {
    const { container } = render(
      <InvestigationCard
        title={null}
        authors={null}
        venue={null}
        pagination={null}
        doi={null}
        publicationYear={null}
        documentType={undefined}
        isRetracted={false}
      />,
    );

    expect(screen.getByText("Investigation")).toBeDefined();
    expect(container.querySelector(".investigation-card__title")).toBeNull();
    expect(container.querySelector(".investigation-card__authors")).toBeNull();
    expect(container.querySelector(".investigation-card__venue")).toBeNull();
    expect(container.querySelector(".investigation-card__doi")).toBeNull();
    expect(container.querySelector(".tag-group")).toBeNull();
  });
});
