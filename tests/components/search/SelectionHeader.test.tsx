import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { SelectionHeader } from "@/components/search/SelectionHeader";

function setup(overrides: Partial<Parameters<typeof SelectionHeader>[0]> = {}) {
  const onToggle = vi.fn();
  render(
    <SelectionHeader
      checked={false}
      indeterminate={false}
      onToggle={onToggle}
      countLabel=""
      {...overrides}
    />,
  );
  const box = () => screen.getByRole("checkbox") as HTMLInputElement;
  return { onToggle, box };
}

describe("SelectionHeader", () => {
  test("shows a 'Select all' checkbox and no count when nothing is selected", () => {
    const { box } = setup({ countLabel: "" });
    expect(screen.queryByText(/selected/)).toBeNull();
    expect(box()).not.toBeChecked();
    expect(box().indeterminate).toBe(false);
    expect(box()).toHaveAccessibleName("Select all references");
  });

  test("is indeterminate for a partial selection and offers to deselect all", () => {
    const { box } = setup({ indeterminate: true, countLabel: "3 selected" });
    expect(box().indeterminate).toBe(true);
    // Clicking a partial selection clears it (Gmail-style), so it reads "Deselect all".
    expect(box()).toHaveAccessibleName("Deselect all references");
  });

  test("is checked and reads 'Deselect all' when everything is selected", () => {
    const { box } = setup({ checked: true, countLabel: "All 1,854 selected" });
    expect(box()).toBeChecked();
    expect(box().indeterminate).toBe(false);
    expect(box()).toHaveAccessibleName("Deselect all references");
  });

  test("toggles on click", () => {
    const { box, onToggle } = setup();
    fireEvent.click(box());
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
