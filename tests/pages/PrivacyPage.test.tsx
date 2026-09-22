import { describe, test, expect } from "vitest";
import { render, screen, within } from "@testing-library/preact";
import { PrivacyPage } from "@/pages/PrivacyPage";

describe("PrivacyPage", () => {
  test("states the effective and last-updated dates", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/Effective date: 22 September 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Last updated: 22 September 2026/)).toBeInTheDocument();
  });

  test("carries every numbered section of the policy, in order", () => {
    render(<PrivacyPage />);
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
    ).toEqual([
      "1. Who we are",
      "2. What data we collect",
      "3. How we collect data",
      "4. Why we use this data (purposes and legal basis)",
      "5. Who we share data with",
      "6. International data transfers",
      "7. Data retention",
      "8. User rights (GDPR)",
      "9. Cookies and similar technologies",
      "10. Security",
      "11. Children",
      "12. Changes to this policy",
      "13. Contact",
    ]);
  });

  test("breaks section 2 into its four collection categories", () => {
    render(<PrivacyPage />);
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
    ).toEqual([
      "2.1 Account data",
      "2.2 Usage and analytics data",
      "2.3 Feedback form data",
      "2.4 Data we do not currently collect",
    ]);
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

  test("offers the privacy officer's address as a mail link", () => {
    render(<PrivacyPage />);
    for (const link of screen.getAllByRole("link", {
      name: "privacy@futureevidence.org",
    })) {
      expect(link).toHaveAttribute("href", "mailto:privacy@futureevidence.org");
    }
  });
});
