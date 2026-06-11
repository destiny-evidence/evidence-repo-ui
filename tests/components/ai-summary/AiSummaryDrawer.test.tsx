import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/preact";

vi.mock("@/config", () => ({
  AI_SUMMARY_FLAG_FORM_URL: "https://forms.example/flag",
}));

import { AiSummaryDrawer } from "@/components/ai-summary/AiSummaryDrawer";
import type { UseAiSummaryResult } from "@/hooks/useAiSummary";
import { MOCK_SUMMARY } from "@/services/summariserMock";

function makeAi(overrides: Partial<UseAiSummaryResult> = {}): UseAiSummaryResult {
  return {
    status: "done",
    minimized: false,
    result: MOCK_SUMMARY,
    errorMessage: null,
    drawerOpen: true,
    generate: vi.fn(),
    open: vi.fn(),
    runInBackground: vi.fn(),
    dismiss: vi.fn(),
    ...overrides,
  };
}

const context = {
  terms: ["Afghanistan", "Cost-effectiveness"],
  count: { count: 15, is_lower_bound: false },
};

beforeEach(() => {
  // jsdom doesn't implement scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
  cleanup();
});

describe("AiSummaryDrawer", () => {
  test("is not rendered when the drawer is closed", () => {
    const { container } = render(
      <AiSummaryDrawer ai={makeAi({ drawerOpen: false })} context={context} />,
    );
    expect(container.firstChild).toBeNull();
  });

  test("renders the result: prose, context chips, and claims", () => {
    render(<AiSummaryDrawer ai={makeAi()} context={context} />);

    expect(screen.getByText(/highly cost-effective at national coverage/i)).toBeDefined();
    expect(screen.getByText("Afghanistan")).toBeDefined();
    expect(screen.getByText("15 results")).toBeDefined();
    // One numbered claim per claim in the summary.
    expect(document.querySelectorAll(".ai-claim").length).toBe(
      MOCK_SUMMARY.summary.claims.length,
    );
  });

  test("clicking a footnote scrolls to and flashes its claim", () => {
    const { container } = render(
      <AiSummaryDrawer ai={makeAi()} context={context} />,
    );
    const firstFootnote = container.querySelector(".ai-fn") as HTMLElement;
    fireEvent.click(firstFootnote);

    const claim = document.getElementById("aiClaim-1");
    expect(claim).not.toBeNull();
    expect((claim as HTMLElement).scrollIntoView).toHaveBeenCalled();
    expect(claim?.classList.contains("is-flash")).toBe(true);
  });

  test("surfaces a note when some papers couldn't be read", () => {
    const ai = makeAi({
      result: {
        ...MOCK_SUMMARY,
        extraction_errors: [{ paper: "x", error: "unreadable" }],
      },
    });
    render(<AiSummaryDrawer ai={ai} context={context} />);
    expect(screen.getByText(/1 paper couldn't be read/i)).toBeDefined();
  });

  test("flag link points at the configured form and opens in a new tab", () => {
    render(<AiSummaryDrawer ai={makeAi()} context={context} />);
    const link = screen.getByRole("link", { name: /flag this summary/i });
    expect(link.getAttribute("href")).toBe("https://forms.example/flag");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  test("does not offer the flag link in the error state", () => {
    render(
      <AiSummaryDrawer
        ai={makeAi({ status: "error", result: null, errorMessage: "boom" })}
        context={context}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("boom");
    expect(screen.queryByRole("link", { name: /flag this summary/i })).toBeNull();
  });

  test("shows a loading state with Cancel and Run in background while generating", () => {
    render(
      <AiSummaryDrawer ai={makeAi({ status: "generating", result: null })} context={context} />,
    );
    expect(screen.getByText(/summarising 15 papers/i)).toBeDefined();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Run in background" })).toBeDefined();
  });

  test("Run in background invokes the hook action", () => {
    const ai = makeAi({ status: "generating", result: null });
    render(<AiSummaryDrawer ai={ai} context={context} />);
    fireEvent.click(screen.getByRole("button", { name: "Run in background" }));
    expect(ai.runInBackground).toHaveBeenCalledTimes(1);
  });

  test("closing while generating backgrounds the job rather than aborting it", () => {
    const ai = makeAi({ status: "generating", result: null });
    render(<AiSummaryDrawer ai={ai} context={context} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(ai.runInBackground).toHaveBeenCalledTimes(1);
    expect(ai.dismiss).not.toHaveBeenCalled();
  });

  test("explicit Cancel while generating aborts the job", () => {
    const ai = makeAi({ status: "generating", result: null });
    render(<AiSummaryDrawer ai={ai} context={context} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(ai.dismiss).toHaveBeenCalledTimes(1);
    expect(ai.runInBackground).not.toHaveBeenCalled();
  });

  test("closing a finished summary dismisses it", () => {
    const ai = makeAi();
    render(<AiSummaryDrawer ai={ai} context={context} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(ai.dismiss).toHaveBeenCalledTimes(1);
    expect(ai.runInBackground).not.toHaveBeenCalled();
  });
});
