import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/preact";
import { TagGroup } from "@/components/TagGroup";

describe("TagGroup", () => {
  test("renders label and tags", () => {
    render(<TagGroup label="DOC TYPE" tags={["Journal Article"]} />);
    expect(screen.getByText("DOC TYPE")).toBeDefined();
    expect(screen.getByText("Journal Article")).toBeDefined();
  });

  test("renders multiple tags", () => {
    render(<TagGroup label="LEVEL" tags={["Primary", "Secondary"]} />);
    expect(screen.getByText("Primary")).toBeDefined();
    expect(screen.getByText("Secondary")).toBeDefined();
  });

  test("filters out undefined tags", () => {
    const { container } = render(
      <TagGroup label="THEME" tags={[undefined, "Reading", undefined]} />,
    );
    const tags = container.querySelectorAll(".tag-group__tag");
    expect(tags).toHaveLength(1);
    expect(tags[0].textContent).toBe("Reading");
  });

  test("returns null when all tags are empty", () => {
    const { container } = render(
      <TagGroup label="THEME" tags={[undefined, undefined]} />,
    );
    expect(container.innerHTML).toBe("");
  });

  test("renders hierarchical tag with parent prefix", () => {
    render(
      <TagGroup
        label="THEME"
        tags={[{ parent: "School Organization", label: "Tracking of Students" }]}
      />,
    );
    expect(screen.getByText("School Organization")).toBeDefined();
    expect(screen.getByText("Tracking of Students")).toBeDefined();
  });

  test("renders hierarchical tag without parent as plain child", () => {
    const { container } = render(
      <TagGroup label="THEME" tags={[{ label: "Just a label" }]} />,
    );
    expect(screen.getByText("Just a label")).toBeDefined();
    expect(container.querySelector(".tag-group__tag-parent")).toBeNull();
  });
});
