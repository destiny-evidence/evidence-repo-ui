import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/preact";
import { AiSummaryButton } from "@/components/ai-summary/AiSummaryButton";

afterEach(cleanup);

describe("AiSummaryButton", () => {
  test("is enabled and clickable by default", () => {
    const onClick = vi.fn();
    render(<AiSummaryButton onClick={onClick} />);
    const button = screen.getByRole("button", { name: /generate ai summary/i });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(button.getAttribute("title")).toBeNull();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("disables and surfaces the reason as a tooltip", () => {
    render(
      <AiSummaryButton
        onClick={vi.fn()}
        disabled
        disabledReason="AI summaries cover up to 50 references — refine your search."
      />,
    );
    const button = screen.getByRole("button", { name: /generate ai summary/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute("title")).toMatch(/up to 50 references/i);
  });
});
