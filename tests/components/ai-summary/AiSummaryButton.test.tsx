import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/preact";
import { AiSummaryButton } from "@/components/ai-summary/AiSummaryButton";

afterEach(cleanup);

describe("AiSummaryButton", () => {
  test("is enabled and clickable by default", () => {
    const onClick = vi.fn();
    const { container } = render(<AiSummaryButton onClick={onClick} />);
    const button = screen.getByRole("button", { name: /generate ai summary/i });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(container.querySelector("[data-tooltip]")).toBeNull();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("disables and surfaces the reason via the shared Tooltip", () => {
    const { container } = render(
      <AiSummaryButton
        onClick={vi.fn()}
        disabled
        disabledReason="AI summaries cover up to 50 references — refine your search."
      />,
    );
    const button = screen.getByRole("button", { name: /generate ai summary/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(
      container.querySelector("[data-tooltip]")?.getAttribute("data-tooltip"),
    ).toMatch(/up to 50 references/i);
  });
});
