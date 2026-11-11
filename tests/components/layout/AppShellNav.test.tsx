import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/preact";
import { AppShell } from "@/components/layout/AppShell";
import { AuthProvider } from "@/auth/AuthContext";
import { makeCommunity } from "../../fixtures";

// Inject the community so tab gating is tested against the flag itself, not
// against whichever real community currently has evidenceMap enabled.
const { mockUseCommunity } = vi.hoisted(() => ({ mockUseCommunity: vi.fn() }));
vi.mock("@/community/CommunityContext", () => ({
  useCommunity: mockUseCommunity,
}));

function renderShell() {
  return render(
    <AuthProvider>
      <AppShell>
        <div>child</div>
      </AppShell>
    </AuthProvider>,
  );
}

describe("AppShell Visualise tab", () => {
  beforeEach(() => mockUseCommunity.mockReset());

  test("hides the Visualise tab when the community has neither map", () => {
    mockUseCommunity.mockReturnValue(
      makeCommunity({ features: { evidenceMap: false } }),
    );
    renderShell();
    expect(screen.queryByRole("button", { name: "Visualise" })).toBeNull();
  });
});

describe("AppShell Visualise dropdown", () => {
  const bothViews = () =>
    makeCommunity({ features: { evidenceMap: true, geographicHeatMap: true } });
  const visualiseButton = () => screen.getByRole("button", { name: "Visualise" });
  const dropdown = () =>
    document.getElementById(visualiseButton().getAttribute("aria-controls")!)!;

  beforeEach(() => {
    mockUseCommunity.mockReset();
    history.replaceState(null, "", "/test");
    window._paq = [];
  });
  afterEach(() => {
    delete window._paq;
  });

  test.each([
    ["the evidence map", { evidenceMap: true, geographicHeatMap: true, countrySearchable: false }, "/test/visualise"],
    ["the heat map", { evidenceMap: false, geographicHeatMap: true }, "/test/visualise/geographic"],
  ])("is still a dropdown with only %s", (_name, features, href) => {
    mockUseCommunity.mockReturnValue(makeCommunity({ features }));
    renderShell();
    fireEvent.click(visualiseButton());
    expect(
      within(dropdown()).getAllByRole("link").map((a) => a.getAttribute("href")),
    ).toEqual([href]);
  });

  test("lists both views when both are enabled and reports the one chosen", () => {
    mockUseCommunity.mockReturnValue(bothViews());
    renderShell();
    fireEvent.click(visualiseButton());
    expect(visualiseButton()).toHaveAttribute("aria-expanded", "true");
    const links = within(dropdown()).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/test/visualise",
      "/test/visualise/geographic",
    ]);

    fireEvent.click(within(dropdown()).getByRole("link", { name: /geographic heat map/i }));
    expect(visualiseButton()).toHaveAttribute("aria-expanded", "false");
    expect(window._paq).toEqual([
      ["trackEvent", "Navigation", "Tab Clicked", "Geographic heat map", undefined],
    ]);
  });

  test("marks the tab active and the current view on the heat map route", () => {
    history.replaceState(null, "", "/test/visualise/geographic");
    mockUseCommunity.mockReturnValue(bothViews());
    renderShell();
    expect(visualiseButton()).toHaveClass("active");

    fireEvent.click(visualiseButton());
    expect(
      within(dropdown()).getByRole("link", { name: /geographic heat map/i }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(dropdown()).getByRole("link", { name: /evidence map/i }),
    ).not.toHaveAttribute("aria-current");
  });

  test("the narrow-screen menu lists the views flat", () => {
    mockUseCommunity.mockReturnValue(bothViews());
    renderShell();
    const flat = screen.getByRole("group", { name: "Visualise" });
    expect(within(flat).getAllByRole("link").map((a) => a.textContent)).toEqual([
      "Evidence map",
      "Geographic heat map",
    ]);
  });
});

describe("AppShell nav analytics", () => {
  beforeEach(() => {
    mockUseCommunity.mockReset();
    // A defined _paq is what analyticsEnabled() reads as "Matomo is loaded".
    window._paq = [];
  });
  afterEach(() => {
    delete window._paq;
  });

  test("clicking the Search tab reports it", () => {
    mockUseCommunity.mockReturnValue(
      makeCommunity({ features: { evidenceMap: true } }),
    );
    renderShell();

    fireEvent.click(screen.getByRole("link", { name: /^search$/i }));

    expect(window._paq).toEqual([
      ["trackEvent", "Navigation", "Tab Clicked", "Search", undefined],
    ]);
  });
});

describe("AppShell narrow-screen menu", () => {
  beforeEach(() => {
    mockUseCommunity.mockReset();
    mockUseCommunity.mockReturnValue(
      makeCommunity({
        externalResources: [
          { title: "Protocol", description: "The protocol", href: "https://x.test/p" },
        ],
      }),
    );
  });

  const menuButton = () => screen.getByRole("button", { name: "Menu" });

  test("the menu button opens the menu, and an outside click closes it", () => {
    renderShell();
    fireEvent.click(menuButton());
    expect(menuButton()).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByText("child"));
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
  });

  test("Escape closes the menu and returns focus to its button", () => {
    renderShell();
    fireEvent.click(menuButton());

    fireEvent.keyDown(document, { key: "Escape" });
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
    expect(menuButton()).toHaveFocus();
  });

  test("a link to the current path still closes the menu", () => {
    history.replaceState(null, "", "/test");
    renderShell();
    fireEvent.click(menuButton());

    fireEvent.click(screen.getByRole("link", { name: /^search$/i }));
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
  });
});
