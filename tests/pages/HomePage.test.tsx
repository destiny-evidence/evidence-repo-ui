import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/preact";
import { HomePage } from "@/pages/HomePage";
import { NotFoundPage } from "@/pages/NotFoundPage";

describe("HomePage", () => {
  test("signposts every listed community, and nothing else", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("link", { name: "HPV Vaccine Delivery" }),
    ).toHaveAttribute("href", "/hpv");
    expect(screen.getByRole("link", { name: "DESTINY" })).toHaveAttribute(
      "href",
      "/destiny",
    );
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});

describe("NotFoundPage", () => {
  test("offers the same community links alongside the not-found message", () => {
    render(<NotFoundPage />);
    expect(screen.getByText("Page not found")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link").map((a) => a.getAttribute("href")),
    ).toEqual(["/hpv", "/destiny"]);
  });
});
