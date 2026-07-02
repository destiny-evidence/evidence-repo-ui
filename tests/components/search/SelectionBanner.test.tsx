import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { SelectionBanner } from "@/components/search/SelectionBanner";

describe("SelectionBanner", () => {
  test("renders nothing when there's no content", () => {
    const { container } = render(<SelectionBanner content={null} />);
    expect(container.firstChild).toBeNull();
  });

  test("shows the count and Clear, with no escalation when single-page", () => {
    const onClear = vi.fn();
    render(<SelectionBanner content={{ countLabel: "20 selected", onClear }} />);
    expect(screen.getByText("20 selected")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /select all/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  test("shows the escalation action and fires it", () => {
    const onAction = vi.fn();
    render(
      <SelectionBanner
        content={{
          countLabel: "20 selected",
          selectAll: { label: "Select all 1,854 references", onAction },
          onClear: () => {},
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Select all 1,854 references" }));
    expect(onAction).toHaveBeenCalledOnce();
  });
});
