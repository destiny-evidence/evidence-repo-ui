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

  test("renders supplied abstract text without additional normalization", () => {
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
