import { describe, test, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/preact";
import { PrivacyPage } from "@/pages/PrivacyPage";

describe("PrivacyPage", () => {
  test("opens at the top rather than at the scroll position it was reached from", () => {
    const scrollTo = vi.spyOn(window, "scrollTo");
    render(<PrivacyPage />);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    scrollTo.mockRestore();
  });

  test("moves keyboard focus to the title, not leaving it on the footer link", () => {
    render(<PrivacyPage />);
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { level: 1, name: "Privacy Policy" }),
    );
  });

  test("renders the legal-basis grid as a table, one row per purpose", () => {
    render(<PrivacyPage />);
    const table = screen.getByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((th) => th.textContent),
    ).toEqual(["Purpose", "Data used", "Legal basis (GDPR)"]);
    // Six purposes, plus the header row.
    expect(within(table).getAllByRole("row")).toHaveLength(7);
  });

  test("opens the company website in a new tab", () => {
    render(<PrivacyPage />);
    const link = screen.getByRole("link", { name: /www\.futureevidence\.org/ });
    expect(link).toHaveAttribute("href", "https://www.futureevidence.org");
    expect(link).toHaveAttribute("target", "_blank");
  });

  test("offers the privacy officer's address as a mail link", () => {
    render(<PrivacyPage />);
    for (const link of screen.getAllByRole("link", {
      name: "privacy@futureevidence.org",
    })) {
      expect(link).toHaveAttribute("href", "mailto:privacy@futureevidence.org");
    }
  });
});
