import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { SearchBar } from "@/components/search/SearchBar";

function renderBar(overrides: Partial<Parameters<typeof SearchBar>[0]> = {}) {
  const props = {
    draftQ: "",
    draftStart: "",
    draftEnd: "",
    onDraftQChange: vi.fn(),
    onDraftStartChange: vi.fn(),
    onDraftEndChange: vi.fn(),
    validationError: null,
    onSubmit: vi.fn(),
    ...overrides,
  };
  render(<SearchBar {...props} />);
  return props;
}

describe("SearchBar", () => {
  test("renders draft values from props", () => {
    renderBar({ draftQ: "phonics", draftStart: "2010", draftEnd: "2024" });
    expect(screen.getByRole("searchbox")).toHaveValue("phonics");
    expect(screen.getByLabelText(/start year/i)).toHaveValue("2010");
    expect(screen.getByLabelText(/end year/i)).toHaveValue("2024");
  });

  test("typing in the query field calls onDraftQChange", () => {
    const props = renderBar();
    fireEvent.input(screen.getByRole("searchbox"), { target: { value: "phonics" } });
    expect(props.onDraftQChange).toHaveBeenCalledWith("phonics");
  });

  test("typing in the year fields calls the matching draft callback", () => {
    const props = renderBar();
    fireEvent.input(screen.getByLabelText(/start year/i), { target: { value: "2010" } });
    expect(props.onDraftStartChange).toHaveBeenCalledWith("2010");
    fireEvent.input(screen.getByLabelText(/end year/i), { target: { value: "2024" } });
    expect(props.onDraftEndChange).toHaveBeenCalledWith("2024");
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

  test("renders the validationError prop as an alert", () => {
    renderBar({ validationError: "Start year must not exceed end year." });
    expect(screen.getByRole("alert")).toHaveTextContent(/start year must not exceed end year/i);
  });

  test("disabled prop disables inputs and submit", () => {
    renderBar({ disabled: true });
    expect(screen.getByRole("searchbox")).toBeDisabled();
    expect(screen.getByLabelText(/start year/i)).toBeDisabled();
    expect(screen.getByLabelText(/end year/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: /search/i })).toBeDisabled();
  });
});
