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
  hasInvestigation: true,
  vocabUnavailable: false,
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

    // The link's textContent is now "doi:10.1234/test.2024" + decorative
    // icon, so query by accessible name (aria-label) instead of exact text.
    const link = screen.getByRole("link", {
      name: /DOI: 10\.1234\/test\.2024/i,
    });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe(
      "https://doi.org/10.1234/test.2024",
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link).toHaveTextContent(/doi:/);
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
    expect(card?.classList.contains("lg-retracted")).toBe(true);
  });

  test("hides kicker and divider when no investigation data", () => {
    const { container } = render(
      <InvestigationCard
        {...DEFAULT_PROPS}
        hasInvestigation={false}
        documentType={undefined}
      />,
    );

    expect(screen.queryByText("Investigation")).toBeNull();
    expect(container.querySelector(".investigation-card__divider")).toBeNull();
  });

  test("shows vocab unavailable message on resolution failure", () => {
    render(
      <InvestigationCard
        {...DEFAULT_PROPS}
        documentType={undefined}
        vocabUnavailable={true}
      />,
    );

    expect(
      screen.getByText(/Vocabulary unavailable/),
    ).toBeDefined();
  });

  test("renders 'Coded by X' below the doc type when provided", () => {
    render(<InvestigationCard {...DEFAULT_PROPS} codingInstitution="ESEA" />);
    expect(screen.getByTestId("investigation-coder-text")).toHaveTextContent(
      "Coded by ESEA",
    );
  });

  test("does not render coding institution when null", () => {
    render(<InvestigationCard {...DEFAULT_PROPS} codingInstitution={null} />);
    expect(screen.queryByTestId("investigation-coder-text")).toBeNull();
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
        hasInvestigation={false}
        vocabUnavailable={false}
      />,
    );

    expect(screen.queryByText("Investigation")).toBeNull();
    expect(container.querySelector(".investigation-card__title")).toBeNull();
    expect(container.querySelector(".investigation-card__authors")).toBeNull();
    expect(container.querySelector(".investigation-card__venue")).toBeNull();
    expect(container.querySelector(".investigation-card__doi")).toBeNull();
    expect(container.querySelector(".tag-group")).toBeNull();
  });
});
