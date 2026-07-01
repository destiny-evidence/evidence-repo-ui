import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { SelectionControls } from "@/components/search/SelectionControls";

function setup(overrides: Partial<Parameters<typeof SelectionControls>[0]> = {}) {
  const onMasterToggle = vi.fn();
  const view = render(
    <SelectionControls master="none" onMasterToggle={onMasterToggle} {...overrides} />,
  );
  const master = () => screen.getByRole("checkbox") as HTMLInputElement;
  return { onMasterToggle, master, ...view };
}

describe("SelectionControls", () => {
  test("master checkbox reflects tri-state (none / indeterminate / all)", () => {
    const { master, rerender } = setup({ master: "none" });
    expect(master()).not.toBeChecked();
    expect(master().indeterminate).toBe(false);

    rerender(<SelectionControls master="some" onMasterToggle={() => {}} />);
    expect(master().indeterminate).toBe(true);

    rerender(<SelectionControls master="all" onMasterToggle={() => {}} />);
    expect(master()).toBeChecked();
    expect(master().indeterminate).toBe(false);
  });

  test("shows the 'Select this page' label and toggles on click", () => {
    const { master, onMasterToggle } = setup();
    expect(screen.getByText("Select this page")).toBeTruthy();
    fireEvent.click(master());
    expect(onMasterToggle).toHaveBeenCalledOnce();
  });

  test("label becomes 'Deselect this page' when the whole page is selected", () => {
    setup({ master: "all" });
    expect(screen.getByText("Deselect this page")).toBeTruthy();
    expect(screen.queryByText("Select this page")).toBeNull();
  });

  test("master checkbox can be disabled", () => {
    const { master } = setup({ disabled: true });
    expect(master()).toBeDisabled();
  });
});
