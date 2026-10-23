import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
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

  test("shows the Visualise tab when the evidence-map flag is on", () => {
    mockUseCommunity.mockReturnValue(
      makeCommunity({ features: { evidenceMap: true } }),
    );
    renderShell();
    expect(screen.getByRole("link", { name: /visualise/i })).toBeInTheDocument();
  });

  test("hides the Visualise tab when the evidence-map flag is off", () => {
    mockUseCommunity.mockReturnValue(
      makeCommunity({ features: { evidenceMap: false } }),
    );
    renderShell();
    expect(screen.queryByRole("link", { name: /visualise/i })).toBeNull();
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

  test.each([
    [/^search$/i, "Search"],
    [/^visualise$/i, "Visualise"],
  ])("clicking the %s tab reports it", (pattern, name) => {
    mockUseCommunity.mockReturnValue(
      makeCommunity({ features: { evidenceMap: true } }),
    );
    renderShell();

    fireEvent.click(screen.getByRole("link", { name: pattern }));

    expect(window._paq).toEqual([
      ["trackEvent", "Navigation", "Tab Clicked", name, undefined],
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
