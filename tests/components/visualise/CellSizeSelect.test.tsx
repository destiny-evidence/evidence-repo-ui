import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { CellSizeSelect } from "@/components/visualise/CellSizeSelect";

describe("CellSizeSelect", () => {
  test("offers the four steps, smallest first, with the current one selected", () => {
    render(<CellSizeSelect value="large" onChange={vi.fn()} />);

    const select = screen.getByLabelText("Cell size") as HTMLSelectElement;
    expect([...select.options].map((option) => option.textContent)).toEqual([
      "Small",
      "Medium",
      "Large",
      "Extra large",
    ]);
    expect(select.value).toBe("large");
  });

  test("reports the chosen step", () => {
    const onChange = vi.fn();
    render(<CellSizeSelect value="medium" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Cell size"), {
      target: { value: "xlarge" },
    });
    expect(onChange).toHaveBeenCalledWith("xlarge");
  });
});
