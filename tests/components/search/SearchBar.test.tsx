import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { SearchBar } from "@/components/search/SearchBar";

describe("SearchBar", () => {
  test("renders initial values from props", () => {
    render(
      <SearchBar
        q="phonics"
        startYear={2010}
        endYear={2024}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByRole("searchbox")).toHaveValue("phonics");
    expect(screen.getByLabelText(/start year/i)).toHaveValue("2010");
    expect(screen.getByLabelText(/end year/i)).toHaveValue("2024");
  });

  test("submit via button calls onSubmit with draft values", () => {
    const onSubmit = vi.fn();
    render(<SearchBar q="" startYear={undefined} endYear={undefined} onSubmit={onSubmit} />);
    fireEvent.input(screen.getByRole("searchbox"), { target: { value: "phonics" } });
    fireEvent.input(screen.getByLabelText(/start year/i), { target: { value: "2010" } });
    fireEvent.click(screen.getByRole("button", { name: /search/i }));
    expect(onSubmit).toHaveBeenCalledWith("phonics", 2010, undefined);
  });

  test("Enter inside the input submits the form exactly once", () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <SearchBar q="" startYear={undefined} endYear={undefined} onSubmit={onSubmit} />,
    );
    const input = screen.getByRole("searchbox");
    fireEvent.input(input, { target: { value: "phonics" } });
    fireEvent.submit(container.querySelector("form")!);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("phonics", undefined, undefined);
  });

  test("empty year inputs pass undefined, not NaN", () => {
    const onSubmit = vi.fn();
    render(<SearchBar q="x" startYear={undefined} endYear={undefined} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: /search/i }));
    expect(onSubmit).toHaveBeenCalledWith("x", undefined, undefined);
  });

  test("startYear > endYear blocks submit and shows validation", () => {
    const onSubmit = vi.fn();
    render(<SearchBar q="x" startYear={undefined} endYear={undefined} onSubmit={onSubmit} />);
    fireEvent.input(screen.getByLabelText(/start year/i), { target: { value: "2024" } });
    fireEvent.input(screen.getByLabelText(/end year/i), { target: { value: "2010" } });
    fireEvent.click(screen.getByRole("button", { name: /search/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/start year must not exceed end year/i);
  });

  test("resyncs when props change externally (back/forward)", () => {
    const { rerender } = render(
      <SearchBar q="a" startYear={undefined} endYear={undefined} onSubmit={() => {}} />,
    );
    expect(screen.getByRole("searchbox")).toHaveValue("a");
    rerender(<SearchBar q="b" startYear={2020} endYear={undefined} onSubmit={() => {}} />);
    expect(screen.getByRole("searchbox")).toHaveValue("b");
    expect(screen.getByLabelText(/start year/i)).toHaveValue("2020");
  });

  test("typing does not trigger onSubmit (draft-local)", () => {
    const onSubmit = vi.fn();
    render(<SearchBar q="" startYear={undefined} endYear={undefined} onSubmit={onSubmit} />);
    fireEvent.input(screen.getByRole("searchbox"), { target: { value: "phonics" } });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("validation error clears when user edits either year field", () => {
    const onSubmit = vi.fn();
    render(<SearchBar q="x" startYear={undefined} endYear={undefined} onSubmit={onSubmit} />);
    fireEvent.input(screen.getByLabelText(/start year/i), { target: { value: "2024" } });
    fireEvent.input(screen.getByLabelText(/end year/i), { target: { value: "2010" } });
    fireEvent.click(screen.getByRole("button", { name: /search/i }));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.input(screen.getByLabelText(/start year/i), { target: { value: "2000" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test.each([
    { label: "scientific notation", raw: "2e3" },
    { label: "hex notation",        raw: "0x10" },
    { label: "fractional",          raw: "2.5" },
    { label: "alpha",               raw: "abc" },
  ])("year input '$raw' ($label) is rejected and submits as undefined", ({ raw }) => {
    const onSubmit = vi.fn();
    render(<SearchBar q="x" startYear={undefined} endYear={undefined} onSubmit={onSubmit} />);
    fireEvent.input(screen.getByLabelText(/start year/i), { target: { value: raw } });
    fireEvent.click(screen.getByRole("button", { name: /search/i }));
    expect(onSubmit).toHaveBeenCalledWith("x", undefined, undefined);
  });

  test("year input with surrounding whitespace is trimmed and accepted", () => {
    const onSubmit = vi.fn();
    render(<SearchBar q="x" startYear={undefined} endYear={undefined} onSubmit={onSubmit} />);
    fireEvent.input(screen.getByLabelText(/start year/i), { target: { value: "  2010  " } });
    fireEvent.click(screen.getByRole("button", { name: /search/i }));
    expect(onSubmit).toHaveBeenCalledWith("x", 2010, undefined);
  });
});
