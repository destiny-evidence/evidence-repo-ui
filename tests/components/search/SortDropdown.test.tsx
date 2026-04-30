import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { SortDropdown } from "@/components/search/SortDropdown";
import type { SortOption } from "@/services/searchParams";

describe("SortDropdown", () => {
  test("renders three options with correct labels", () => {
    render(<SortDropdown value={undefined} onChange={() => {}} />);
    const select = screen.getByLabelText(/sort/i) as HTMLSelectElement;
    const labels = Array.from(select.options).map((o) => o.textContent);
    expect(labels).toEqual([
      "Relevance",
      "Publication year (newest)",
      "Publication year (oldest)",
    ]);
  });

  test("selection reflects value=undefined as Relevance", () => {
    render(<SortDropdown value={undefined} onChange={() => {}} />);
    const select = screen.getByLabelText(/sort/i) as HTMLSelectElement;
    expect(select.value).toBe("");
  });

  test("selection reflects value=newest", () => {
    render(<SortDropdown value="newest" onChange={() => {}} />);
    const select = screen.getByLabelText(/sort/i) as HTMLSelectElement;
    expect(select.value).toBe("newest");
  });

  test("selection reflects value=oldest", () => {
    render(<SortDropdown value="oldest" onChange={() => {}} />);
    const select = screen.getByLabelText(/sort/i) as HTMLSelectElement;
    expect(select.value).toBe("oldest");
  });

  test("onChange fires with newest when newest selected", () => {
    const onChange = vi.fn<(next: SortOption | undefined) => void>();
    render(<SortDropdown value={undefined} onChange={onChange} />);
    const select = screen.getByLabelText(/sort/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "newest" } });
    expect(onChange).toHaveBeenCalledWith("newest");
  });

  test("onChange fires with oldest when oldest selected", () => {
    const onChange = vi.fn<(next: SortOption | undefined) => void>();
    render(<SortDropdown value="newest" onChange={onChange} />);
    const select = screen.getByLabelText(/sort/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "oldest" } });
    expect(onChange).toHaveBeenCalledWith("oldest");
  });

  test("onChange fires with undefined when Relevance selected (empty value)", () => {
    const onChange = vi.fn<(next: SortOption | undefined) => void>();
    render(<SortDropdown value="newest" onChange={onChange} />);
    const select = screen.getByLabelText(/sort/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  test("respects disabled prop", () => {
    render(<SortDropdown value={undefined} onChange={() => {}} disabled />);
    const select = screen.getByLabelText(/sort/i) as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });

  test("not disabled by default", () => {
    render(<SortDropdown value={undefined} onChange={() => {}} />);
    const select = screen.getByLabelText(/sort/i) as HTMLSelectElement;
    expect(select.disabled).toBe(false);
  });
});
