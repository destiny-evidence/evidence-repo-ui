import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { RefineButton } from "@/components/search/RefineButton";

describe("RefineButton", () => {
  test("renders the Refine label", () => {
    render(<RefineButton count={0} onClick={() => {}} />);
    expect(screen.getByRole("button", { name: /Refine/ })).toBeDefined();
  });

  test("no badge node when count is zero", () => {
    const { container } = render(<RefineButton count={0} onClick={() => {}} />);
    expect(container.querySelector(".refine-btn__count")).toBeNull();
  });

  test("renders a badge with the count when greater than zero", () => {
    const { container } = render(<RefineButton count={3} onClick={() => {}} />);
    const badge = container.querySelector(".refine-btn__count");
    expect(badge?.textContent).toBe("3");
  });

  test("clicking fires onClick when enabled", () => {
    const onClick = vi.fn();
    render(<RefineButton count={0} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: /Refine/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("applies the disabled attribute when disabled", () => {
    render(<RefineButton count={0} disabled onClick={() => {}} />);
    const btn = screen.getByRole("button", { name: /Refine/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  test("wraps the button in a Tooltip when disabled with a reason", () => {
    const { container } = render(
      <RefineButton
        count={0}
        disabled
        disabledReason="Loading filters…"
        onClick={() => {}}
      />,
    );
    const tooltip = container.querySelector(".tooltip");
    expect(tooltip).not.toBeNull();
    expect(tooltip?.getAttribute("data-tooltip")).toBe("Loading filters…");
  });

  test("no Tooltip wrapper when enabled, even if reason is provided", () => {
    const { container } = render(
      <RefineButton
        count={0}
        disabledReason="should be ignored"
        onClick={() => {}}
      />,
    );
    expect(container.querySelector(".tooltip")).toBeNull();
  });

  test("no Tooltip wrapper when disabled without a reason", () => {
    const { container } = render(
      <RefineButton count={0} disabled onClick={() => {}} />,
    );
    expect(container.querySelector(".tooltip")).toBeNull();
  });
});
