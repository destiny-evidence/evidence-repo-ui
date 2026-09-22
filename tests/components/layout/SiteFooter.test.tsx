import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/preact";
import { SiteFooter } from "@/components/layout/SiteFooter";

describe("SiteFooter", () => {
  test("links the privacy policy", () => {
    render(<SiteFooter />);
    expect(
      screen.getByRole("link", { name: "Privacy policy" }),
    ).toHaveAttribute("href", "/privacy");
  });

  test("carries the copyright line", () => {
    render(<SiteFooter />);
    expect(screen.getByText("© 2026")).toBeInTheDocument();
  });
});
