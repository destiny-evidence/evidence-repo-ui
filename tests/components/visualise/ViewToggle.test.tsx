import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { ViewToggle } from "@/components/visualise/ViewToggle";

describe("ViewToggle", () => {
  test("renders both options with the active one pressed", () => {
    render(<ViewToggle value="bubble" onChange={() => {}} />);
    const bubble = screen.getByRole("button", { name: "Bubble" });
    const table = screen.getByRole("button", { name: "Table" });
    expect(bubble).toHaveAttribute("aria-pressed", "true");
    expect(table).toHaveAttribute("aria-pressed", "false");
  });

  test("emits the selected view on click", () => {
    const onChange = vi.fn();
    render(<ViewToggle value="bubble" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Table" }));
    expect(onChange).toHaveBeenCalledWith("table");
  });
});
