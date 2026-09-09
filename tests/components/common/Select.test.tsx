import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { Select, type SelectOption } from "@/components/common/Select";

const OPTIONS: SelectOption<string>[] = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
];

describe("Select", () => {
  test("renders the options in order with the current one selected", () => {
    render(
      <Select label="Letter" options={OPTIONS} value="b" onChange={vi.fn()} />,
    );

    const select = screen.getByLabelText("Letter") as HTMLSelectElement;
    expect([...select.options].map((option) => option.textContent)).toEqual([
      "Alpha",
      "Beta",
    ]);
    expect(select.value).toBe("b");
  });

  test("reports the chosen value", () => {
    const onChange = vi.fn();
    render(
      <Select label="Letter" options={OPTIONS} value="a" onChange={onChange} />,
    );

    fireEvent.change(screen.getByLabelText("Letter"), {
      target: { value: "b" },
    });
    expect(onChange).toHaveBeenCalledWith("b");
  });

  test("labelHidden keeps the accessible name without rendering the label", () => {
    render(
      <Select
        label="Letter"
        labelHidden
        options={OPTIONS}
        value="a"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Letter")).toBeInTheDocument();
    expect(screen.queryByText("Letter")).toBeNull();
  });

  test("the label icon stays out of the accessible name", () => {
    render(
      <Select
        label="Rows (y)"
        labelIcon="↕"
        options={OPTIONS}
        value="a"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Rows (y)")).toBeInTheDocument();
  });

  test("marks a disabled option", () => {
    render(
      <Select
        label="Letter"
        options={[OPTIONS[0], { ...OPTIONS[1], disabled: true }]}
        value="a"
        onChange={vi.fn()}
      />,
    );

    const select = screen.getByLabelText("Letter") as HTMLSelectElement;
    expect(select.options[0].disabled).toBe(false);
    expect(select.options[1].disabled).toBe(true);
  });

  test("disables the field", () => {
    render(
      <Select
        label="Letter"
        options={OPTIONS}
        value="a"
        onChange={vi.fn()}
        disabled
      />,
    );

    expect((screen.getByLabelText("Letter") as HTMLSelectElement).disabled).toBe(
      true,
    );
  });
});
