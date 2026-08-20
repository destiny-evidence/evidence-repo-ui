import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";

// FEEDBACK_FORM_URL is read at module load, so the URL has to be in place
// before FeedbackFAB is imported.
vi.mock("@/config", () => ({
  FEEDBACK_FORM_URL: "https://forms.example/feedback",
}));

import { FeedbackFAB } from "@/components/feedback/FeedbackFAB";

beforeEach(() => {
  // A defined _paq is what analyticsEnabled() reads as "Matomo is loaded".
  window._paq = [];
});

afterEach(() => {
  delete window._paq;
});

describe("FeedbackFAB", () => {
  test("clicking it reports the FAB click", () => {
    render(<FeedbackFAB />);
    fireEvent.click(screen.getByRole("link", { name: /send feedback/i }));

    expect(window._paq).toEqual([
      ["trackEvent", "Feedback", "FAB Clicked", undefined, undefined],
    ]);
  });
});
