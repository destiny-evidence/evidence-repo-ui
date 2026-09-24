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

  test("dates the copyright from the year it is given", () => {
    render(<SiteFooter now={new Date("2027-03-01")} />);
    expect(screen.getByText("© 2027")).toBeInTheDocument();
  });

  test("falls back to the current year", () => {
    render(<SiteFooter />);
    expect(
      screen.getByText(`© ${new Date().getFullYear()}`),
    ).toBeInTheDocument();
  });
});
