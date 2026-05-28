import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { SearchBar } from "@/components/search/SearchBar";

function renderBar(overrides: Partial<Parameters<typeof SearchBar>[0]> = {}) {
  const props = {
    draftQ: "",
    onDraftQChange: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
  render(<SearchBar {...props} />);
  return props;
}

describe("SearchBar", () => {
  test("renders the draft query value from props", () => {
    renderBar({ draftQ: "phonics" });
    expect(screen.getByRole("searchbox")).toHaveValue("phonics");
  });

  test("typing in the query field calls onDraftQChange", () => {
    const props = renderBar();
    fireEvent.input(screen.getByRole("searchbox"), { target: { value: "phonics" } });
    expect(props.onDraftQChange).toHaveBeenCalledWith("phonics");
  });

  test("submit button calls onSubmit", () => {
    const props = renderBar({ draftQ: "phonics" });
    fireEvent.click(screen.getByRole("button", { name: /search/i }));
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  test("submitting the form (Enter) calls onSubmit exactly once", () => {
    const onSubmit = vi.fn();
    renderBar({ onSubmit });
    fireEvent.submit(document.querySelector("form")!);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  test("disabled prop disables the input and submit", () => {
    renderBar({ disabled: true });
    expect(screen.getByRole("searchbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: /search/i })).toBeDisabled();
  });
});
