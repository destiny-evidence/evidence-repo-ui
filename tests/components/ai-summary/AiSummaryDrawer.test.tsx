import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/preact";

vi.mock("@/config", () => ({
  AI_SUMMARY_FLAG_FORM_URL: "https://forms.example/flag",
}));

import { AiSummaryDrawer } from "@/components/ai-summary/AiSummaryDrawer";
import type { UseAiSummaryResult } from "@/hooks/useAiSummary";
import { MOCK_SUMMARY } from "@/services/summariserMock";

const context = {
  terms: ["Afghanistan", "Cost-effectiveness"],
  count: { count: 15, is_lower_bound: false },
  countNoun: "references",
};

function makeAi(overrides: Partial<UseAiSummaryResult> = {}): UseAiSummaryResult {
  return {
    status: "done",
    minimized: false,
    result: MOCK_SUMMARY,
    errorMessage: null,
    context,
    originUrl: "/test-community?q=afghanistan",
    drawerOpen: true,
    generate: vi.fn(),
    open: vi.fn(),
    runInBackground: vi.fn(),
    dismiss: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  // jsdom doesn't implement scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
  cleanup();
});

describe("AiSummaryDrawer", () => {
  test("is not rendered when the drawer is closed", () => {
    const { container } = render(
      <AiSummaryDrawer ai={makeAi({ drawerOpen: false })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  test("renders the result: prose, context chips, and claims", () => {
    render(<AiSummaryDrawer ai={makeAi()} />);

    expect(screen.getByText(/highly cost-effective at national coverage/i)).toBeDefined();
    expect(screen.getByText("Afghanistan")).toBeDefined();
    expect(screen.getByText("15 references")).toBeDefined();
    // One numbered claim per claim in the summary.
    expect(document.querySelectorAll(".ai-claim").length).toBe(
      MOCK_SUMMARY.summary.claims.length,
    );
  });

  test("omits the contradictions section when there are none", () => {
    const ai = makeAi({
      result: {
        ...MOCK_SUMMARY,
        summary: { ...MOCK_SUMMARY.summary, contradictions: [] },
      },
    });
    render(<AiSummaryDrawer ai={ai} />);
    expect(screen.queryByText(/where papers disagree/i)).toBeNull();
    expect(document.querySelector(".ai-contradiction")).toBeNull();
  });

  test("renders contradictions with their description and backing quotes", () => {
    const ai = makeAi({
      result: {
        ...MOCK_SUMMARY,
        summary: {
          ...MOCK_SUMMARY.summary,
          contradictions: [
            {
              contradiction:
                "Papers disagree on whether catch-up campaigns are cost-effective.",
              quotes: [
                {
                  quote: "Catch-up vaccination remained cost-effective.",
                  paper: "anwari-2019",
                  page: 12,
                  terms: [2],
                },
                {
                  quote: "Catch-up offered poor value for money.",
                  paper: "canfell-2020",
                  terms: [2],
                },
              ],
            },
          ],
        },
      },
    });
    render(<AiSummaryDrawer ai={ai} />);

    expect(screen.getByText(/where papers disagree/i)).toBeDefined();
    expect(document.querySelectorAll(".ai-contradiction").length).toBe(1);
    expect(
      screen.getByText(/disagree on whether catch-up campaigns/i),
    ).toBeDefined();
    expect(screen.getByText(/remained cost-effective/i)).toBeDefined();
    expect(screen.getByText(/poor value for money/i)).toBeDefined();
    // The page number surfaces only for the quote that carries one.
    expect(screen.getByText("p. 12")).toBeDefined();
  });

  test("clicking a footnote scrolls to and flashes its claim", () => {
    const { container } = render(
      <AiSummaryDrawer ai={makeAi()} />,
    );
    const firstFootnote = container.querySelector(".ai-fn") as HTMLElement;
    fireEvent.click(firstFootnote);

    const claim = document.getElementById("aiClaim-1");
    expect(claim).not.toBeNull();
    expect((claim as HTMLElement).scrollIntoView).toHaveBeenCalled();
    expect(claim?.classList.contains("is-flash")).toBe(true);
  });

  test("coverage note reports usable references and lists those left out", () => {
    const ai = makeAi({
      result: {
        ...MOCK_SUMMARY,
        papers: MOCK_SUMMARY.papers, // 5 summarised
        skipped_references: [
          { reference_id: "r1", reason: "no_full_text" },
          { reference_id: "r2", reason: "no_full_text" },
        ],
        extraction_errors: [{ paper: "x", error: "unreadable" }],
      },
    });
    render(<AiSummaryDrawer ai={ai} />);
    // 5 summarised + 2 no-full-text + 1 unreadable = 8 total.
    const note = screen.getByText(/Based on 5 of 8 references/i);
    expect(note.textContent).toMatch(/2 had no full text available/i);
    expect(note.textContent).toMatch(/1 couldn't be read/i);
  });

  test("coverage note reads cleanly at full coverage", () => {
    const ai = makeAi({
      result: { ...MOCK_SUMMARY, skipped_references: [], extraction_errors: [] },
    });
    render(<AiSummaryDrawer ai={ai} />);
    expect(screen.getByText(/Based on 5 references\./i)).toBeDefined();
  });

  test("flag link points at the configured form and opens in a new tab", () => {
    render(<AiSummaryDrawer ai={makeAi()} />);
    const link = screen.getByRole("link", { name: /flag this summary/i });
    expect(link.getAttribute("href")).toBe("https://forms.example/flag");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  test("does not offer the flag link in the error state", () => {
    render(
      <AiSummaryDrawer
        ai={makeAi({ status: "error", result: null, errorMessage: "boom" })}
       
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("boom");
    expect(screen.queryByRole("link", { name: /flag this summary/i })).toBeNull();
  });

  test("shows a loading state with Cancel and Run in background while generating", () => {
    render(
      <AiSummaryDrawer ai={makeAi({ status: "generating", result: null })} />,
    );
    expect(screen.getByText(/summarising 15 references/i)).toBeDefined();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Run in background" })).toBeDefined();
  });

  test("Run in background invokes the hook action", () => {
    const ai = makeAi({ status: "generating", result: null });
    render(<AiSummaryDrawer ai={ai} />);
    fireEvent.click(screen.getByRole("button", { name: "Run in background" }));
    expect(ai.runInBackground).toHaveBeenCalledTimes(1);
  });

  test("closing while generating backgrounds the job rather than aborting it", () => {
    const ai = makeAi({ status: "generating", result: null });
    render(<AiSummaryDrawer ai={ai} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(ai.runInBackground).toHaveBeenCalledTimes(1);
    expect(ai.dismiss).not.toHaveBeenCalled();
  });

  test("explicit Cancel while generating aborts the job", () => {
    const ai = makeAi({ status: "generating", result: null });
    render(<AiSummaryDrawer ai={ai} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(ai.dismiss).toHaveBeenCalledTimes(1);
    expect(ai.runInBackground).not.toHaveBeenCalled();
  });

  test("closing a finished summary dismisses it", () => {
    const ai = makeAi();
    render(<AiSummaryDrawer ai={ai} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(ai.dismiss).toHaveBeenCalledTimes(1);
    expect(ai.runInBackground).not.toHaveBeenCalled();
  });
});
