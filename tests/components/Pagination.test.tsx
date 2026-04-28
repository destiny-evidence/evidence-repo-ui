import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { Pagination } from "@/components/Pagination";

describe("Pagination", () => {
  test("renders numbered buttons for small totals", () => {
    render(<Pagination currentPage={1} totalPages={3} onPageChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Page 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 3" })).toBeInTheDocument();
  });

  test("near-start (currentPage=1, totalPages=12) shows 1 2 3 … 12", () => {
    render(<Pagination currentPage={1} totalPages={12} onPageChange={() => {}} />);
    for (const n of [1, 2, 3, 12]) {
      expect(screen.getByRole("button", { name: `Page ${n}` })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: "Page 4" })).toBeNull();
    expect(screen.getByText("…")).toBeInTheDocument();
  });

  test("near-end (currentPage=12, totalPages=12) shows 1 … 10 11 12", () => {
    render(<Pagination currentPage={12} totalPages={12} onPageChange={() => {}} />);
    for (const n of [1, 10, 11, 12]) {
      expect(screen.getByRole("button", { name: `Page ${n}` })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: "Page 9" })).toBeNull();
    expect(screen.getByText("…")).toBeInTheDocument();
  });

  test("middle (currentPage=5, totalPages=12) shows 1 … 4 5 6 … 12", () => {
    render(<Pagination currentPage={5} totalPages={12} onPageChange={() => {}} />);
    for (const n of [1, 4, 5, 6, 12]) {
      expect(screen.getByRole("button", { name: `Page ${n}` })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: "Page 3" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Page 7" })).toBeNull();
    // Two ellipses — one on each side
    const ellipses = screen.getAllByText("…");
    expect(ellipses).toHaveLength(2);
  });

  test("marks current page active", () => {
    render(<Pagination currentPage={3} totalPages={5} onPageChange={() => {}} />);
    const active = screen.getByRole("button", { name: "Page 3" });
    expect(active.getAttribute("aria-current")).toBe("page");
    expect(active.className).toContain("active");
  });

  test("Prev disabled on page 1", () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
  });

  test("Next disabled on last page", () => {
    render(<Pagination currentPage={5} totalPages={5} onPageChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  test("onPageChange fires with clicked page", () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={1} totalPages={5} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Page 3" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  test("Prev clicks previous page", () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={4} totalPages={5} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  test("Next clicks next page", () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={2} totalPages={5} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  test("all buttons disabled when disabled prop is true", () => {
    render(<Pagination currentPage={2} totalPages={5} onPageChange={() => {}} disabled />);
    const buttons = screen.getAllByRole("button");
    buttons.forEach((b) => expect(b).toBeDisabled());
  });

  test("renders nothing when totalPages <= 1", () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  test.each([
    { label: "Infinity",   value: Infinity },
    { label: "NaN",        value: NaN },
    { label: "fractional", value: 5.5 },
    { label: "negative",   value: -3 },
  ])("renders nothing when totalPages is $label (no infinite loop, no degenerate DOM)", ({ value }) => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={value} onPageChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
