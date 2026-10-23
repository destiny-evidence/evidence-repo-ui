import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";

// FEEDBACK_FORM_URL is read at module load, so the URL has to be in place
// before FeedbackLink is imported.
vi.mock("@/config", () => ({
  FEEDBACK_FORM_URL: "https://forms.example/feedback",
}));

import { FeedbackLink } from "@/components/feedback/FeedbackLink";

beforeEach(() => {
  // A defined _paq is what analyticsEnabled() reads as "Matomo is loaded".
  window._paq = [];
});

afterEach(() => {
  delete window._paq;
});

describe("FeedbackLink", () => {
  test("clicking it reports the nav click", () => {
    render(<FeedbackLink />);
    fireEvent.click(screen.getByRole("link", { name: /send feedback/i }));

    expect(window._paq).toEqual([
      ["trackEvent", "Feedback", "Nav Clicked", undefined, undefined],
    ]);
  });
});
