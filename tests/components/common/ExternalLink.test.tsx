import { describe, test, expect, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { ExternalLink } from "@/components/common/ExternalLink";

afterEach(() => {
  delete window._paq;
});

describe("ExternalLink", () => {
  test("opens in a new tab with safe rel", () => {
    render(<ExternalLink href="https://example.org/doc">Read the doc</ExternalLink>);
    const link = screen.getByRole("link", { name: /Read the doc/ });
    expect(link.getAttribute("href")).toBe("https://example.org/doc");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  test("reports the given event on click", () => {
    // A defined _paq is what analyticsEnabled() reads as "Matomo is loaded".
    window._paq = [];
    render(
      <ExternalLink
        href="https://example.org/doc"
        event={{ category: "Resources", action: "Link Clicked", name: "Doc" }}
      >
        Read the doc
      </ExternalLink>,
    );
    fireEvent.click(screen.getByRole("link", { name: /Read the doc/ }));

    expect(window._paq).toEqual([
      ["trackEvent", "Resources", "Link Clicked", "Doc", undefined],
    ]);
  });

  test("reports nothing when no event is given", () => {
    window._paq = [];
    render(<ExternalLink href="https://example.org/doc">Read the doc</ExternalLink>);
    fireEvent.click(screen.getByRole("link", { name: /Read the doc/ }));

    expect(window._paq).toEqual([]);
  });
});
