import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/preact";
import { AbstractSection } from "@/components/AbstractSection";
import type { AbstractContentEnhancement } from "@/types/models";

function makeAbstract(
  text: string,
  process = "uninverted",
): AbstractContentEnhancement {
  return { enhancement_type: "abstract", process, abstract: text };
}

describe("AbstractSection", () => {
  test.each([
    ["null", null],
    ["empty", makeAbstract("")],
    ["whitespace-only", makeAbstract("   \n\t  ")],
  ])("renders nothing for %s abstract", (_label, abstract) => {
    const { container } = render(<AbstractSection abstract={abstract} />);
    expect(container.firstChild).toBeNull();
  });

  test("renders nothing for the OpenAlex :unav sentinel (W6946467789 regression)", () => {
    const { container } = render(
      <AbstractSection abstract={makeAbstract(":unav")} />,
    );
    expect(container.firstChild).toBeNull();
  });

  test("renders the Abstract heading and body text when given a valid abstract", () => {
    render(
      <AbstractSection abstract={makeAbstract("This is the body of the abstract.")} />,
    );
    expect(screen.getByRole("heading", { name: "Abstract" })).toBeInTheDocument();
    expect(screen.getByText("This is the body of the abstract.")).toBeInTheDocument();
  });

  test("decodes HTML entities before rendering (integration with decodeHtmlEntities)", () => {
    render(
      <AbstractSection
        abstract={makeAbstract("Adjusted OR=2.07 for &gt;8 hours of screen time.")}
      />,
    );
    expect(
      screen.getByText("Adjusted OR=2.07 for >8 hours of screen time."),
    ).toBeInTheDocument();
  });

  test("strips leading 'Abstract' section label from body (EEF EPPI ingestor artefact, ~1.5% of corpus)", () => {
    render(
      <AbstractSection
        abstract={makeAbstract("Abstract This paper aims to investigate.")}
      />,
    );
    expect(
      screen.getByText("This paper aims to investigate."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Abstract This/)).toBeNull();
  });

  test("does not strip 'Abstract' when used as a real English word at the start of the body", () => {
    // Case-sensitive guard: only the literal capitalised label "Abstract\s+"
    // is stripped, so abstracts that happen to start with the word as a
    // noun/adjective ("abstract algebra", "ABSTRACT") pass through unaltered.
    render(
      <AbstractSection
        abstract={makeAbstract("abstract reasoning improves problem-solving.")}
      />,
    );
    expect(
      screen.getByText("abstract reasoning improves problem-solving."),
    ).toBeInTheDocument();
  });
});
