import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/preact";
import { InvestigationCard } from "@/components/investigation/InvestigationCard";

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
  abstract: null,
  publicationYear: 2024,
  documentTypes: [
    {
      value: {
        uri: "https://vocab.esea.education/C00008",
        label: "Journal Article",
      },
    },
  ],
  studyDesigns: [],
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

  test("renders abstract inside the card after the DOI", () => {
    const { container } = render(
      <InvestigationCard
        {...DEFAULT_PROPS}
        abstract={{
          enhancement_type: "abstract",
          process: "uninverted",
          abstract: "This abstract belongs in the card.",
        }}
      />,
    );

    const card = container.querySelector(".investigation-card");
    const doi = card?.querySelector(".investigation-card__doi");
    const abstract = card?.querySelector(".abstract-section");
    const divider = card?.querySelector(".investigation-card__divider");
    expect(card).toContainElement(abstract as HTMLElement);
    expect(
      doi!.compareDocumentPosition(abstract as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      abstract!.compareDocumentPosition(divider as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("This abstract belongs in the card.")).toBeDefined();
  });

  test("renders document type tag", () => {
    render(<InvestigationCard {...DEFAULT_PROPS} />);
    expect(screen.getByText("Doc Type")).toBeDefined();
    expect(screen.getByText("Journal Article")).toBeDefined();
  });

  test("renders multiple document type tags", () => {
    render(
      <InvestigationCard
        {...DEFAULT_PROPS}
        documentTypes={[
          {
            value: {
              uri: "https://vocab.esea.education/C00008",
              label: "Journal Article",
            },
          },
          {
            value: { uri: "https://vocab.esea.education/C9", label: "Report" },
          },
        ]}
      />,
    );
    expect(screen.getByText("Journal Article")).toBeDefined();
    expect(screen.getByText("Report")).toBeDefined();
  });

  test("renders a Study Design tag group, one tag per design", () => {
    render(
      <InvestigationCard
        {...DEFAULT_PROPS}
        studyDesigns={[
          { value: { uri: "https://vocab.esea.education/C1", label: "RCT" } },
          {
            value: {
              uri: "https://vocab.esea.education/C2",
              label: "Quasi-experimental",
            },
          },
        ]}
      />,
    );
    expect(screen.getByText("Study Design")).toBeDefined();
    expect(screen.getByText("RCT")).toBeDefined();
    expect(screen.getByText("Quasi-experimental")).toBeDefined();
  });

  test("renders no Study Design group when there are no study designs", () => {
    render(<InvestigationCard {...DEFAULT_PROPS} />);
    expect(screen.queryByText("Study Design")).toBeNull();
  });

  test("renders no divider when doc type and study design are both empty", () => {
    const { container } = render(
      <InvestigationCard {...DEFAULT_PROPS} documentTypes={[]} studyDesigns={[]} />,
    );
    expect(container.querySelector(".investigation-card__divider")).toBeNull();
    expect(container.querySelector(".tag-group")).toBeNull();
  });

  test("dedupes repeated concept URIs in doc type and study design tags", () => {
    render(
      <InvestigationCard
        {...DEFAULT_PROPS}
        documentTypes={[
          { value: { uri: "u:ja", label: "Journal Article" } },
          { value: { uri: "u:ja", label: "Journal Article" } },
        ]}
        studyDesigns={[
          { value: { uri: "u:qed", label: "Quasi-experimental study" } },
          { value: { uri: "u:rct", label: "Randomised Controlled Trial" } },
          { value: { uri: "u:qed", label: "Quasi-experimental study" } },
          { value: { uri: "u:rct", label: "Randomised Controlled Trial" } },
          { value: { uri: "u:rct", label: "Randomised Controlled Trial" } },
        ]}
      />,
    );
    expect(screen.getAllByText("Journal Article")).toHaveLength(1);
    expect(screen.getAllByText("Quasi-experimental study")).toHaveLength(1);
    expect(screen.getAllByText("Randomised Controlled Trial")).toHaveLength(1);
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
        documentTypes={[]}
      />,
    );

    expect(screen.queryByText("Investigation")).toBeNull();
    expect(container.querySelector(".investigation-card__divider")).toBeNull();
  });

  test("shows vocab unavailable message on resolution failure", () => {
    render(
      <InvestigationCard
        {...DEFAULT_PROPS}
        documentTypes={[]}
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

  test("renders the footer slot last inside the card", () => {
    const { container } = render(
      <InvestigationCard
        {...DEFAULT_PROPS}
        codingInstitution="ESEA"
        footer={<p data-testid="card-footer">Footer slot</p>}
      />,
    );

    const card = container.querySelector(".investigation-card");
    const footer = screen.getByTestId("card-footer");
    const coder = screen.getByTestId("investigation-coder-text");
    expect(card).toContainElement(footer);
    expect(
      coder.compareDocumentPosition(footer) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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
        documentTypes={[]}
        studyDesigns={[]}
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
