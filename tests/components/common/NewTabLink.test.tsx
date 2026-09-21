import { describe, test, expect, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { NewTabLink } from "@/components/common/NewTabLink";

afterEach(() => {
  delete window._paq;
});

describe("NewTabLink", () => {
  test("opens in a new tab with safe rel", () => {
    render(<NewTabLink href="https://example.org/doc">Read the doc</NewTabLink>);
    const link = screen.getByRole("link", { name: /Read the doc/ });
    expect(link.getAttribute("href")).toBe("https://example.org/doc");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  test("reports the given event on click", () => {
    // A defined _paq is what analyticsEnabled() reads as "Matomo is loaded".
    window._paq = [];
    render(
      <NewTabLink
        href="https://example.org/doc"
        event={{ category: "Resources", action: "Link Clicked", name: "Doc" }}
      >
        Read the doc
      </NewTabLink>,
    );
    fireEvent.click(screen.getByRole("link", { name: /Read the doc/ }));

    expect(window._paq).toEqual([
      ["trackEvent", "Resources", "Link Clicked", "Doc", undefined],
    ]);
  });

  test("reports nothing when no event is given", () => {
    window._paq = [];
    render(<NewTabLink href="https://example.org/doc">Read the doc</NewTabLink>);
    fireEvent.click(screen.getByRole("link", { name: /Read the doc/ }));

    expect(window._paq).toEqual([]);
  });
});
