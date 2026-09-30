import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/preact";
import { AppShell } from "@/components/layout/AppShell";
import { AuthProvider } from "@/auth/AuthContext";
import { navigate } from "@/services/navigation";
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

describe("AppShell tabs carry the search", () => {
  const SCOPE =
    "q=mental+health&concept=https%3A%2F%2Fvocab.test%2FA%2FC1&country=KE&start_year=2015";

  beforeEach(() => {
    mockUseCommunity
      .mockReset()
      .mockReturnValue(makeCommunity({ slug: "esea", features: { evidenceMap: true } }));
  });
  afterEach(() => history.replaceState(null, "", "/"));

  const href = (name: RegExp) => screen.getByRole("link", { name }).getAttribute("href");

  test("on Search, both tabs carry the search but not its sort or page", () => {
    history.replaceState(null, "", `/esea?${SCOPE}&sort=newest&page=2`);
    renderShell();
    expect(href(/^visualise$/i)).toBe(`/esea/visualise?${SCOPE}`);
    expect(href(/^search$/i)).toBe(`/esea?${SCOPE}`);
  });

  test("on Visualise, both tabs carry the search but not the axes", () => {
    history.replaceState(null, "", `/esea/visualise?${SCOPE}&row=a&column=b`);
    renderShell();
    expect(href(/^search$/i)).toBe(`/esea?${SCOPE}`);
    expect(href(/^visualise$/i)).toBe(`/esea/visualise?${SCOPE}`);
  });

  test("on a record page both tabs are plain", () => {
    history.replaceState(null, "", `/esea/references/r1?${SCOPE}`);
    renderShell();
    expect(href(/^search$/i)).toBe("/esea");
    expect(href(/^visualise$/i)).toBe("/esea/visualise");
  });

  test("the brand link stays plain", () => {
    history.replaceState(null, "", `/esea?${SCOPE}`);
    renderShell();
    expect(href(/evidence repository/i)).toBe("/esea");
  });

  test("follows a new search without remounting", () => {
    history.replaceState(null, "", "/esea");
    renderShell();
    act(() => navigate("/esea?q=phonics"));
    expect(href(/^visualise$/i)).toBe("/esea/visualise?q=phonics");
  });
});

describe("AppShell tabs and the community's default years", () => {
  beforeEach(() => {
    mockUseCommunity.mockReset().mockReturnValue(
      makeCommunity({
        slug: "esea",
        searchDefaults: { endYear: 2030 },
        features: { evidenceMap: true },
      }),
    );
  });
  afterEach(() => history.replaceState(null, "", "/"));

  const href = (name: RegExp) => screen.getByRole("link", { name }).getAttribute("href");

  test("from the map, a cleared default year stays cleared", () => {
    history.replaceState(null, "", "/esea/visualise?q=x&row=a&column=b");
    renderShell();
    expect(href(/^search$/i)).toBe("/esea?q=x");
    expect(href(/^visualise$/i)).toBe("/esea/visualise?q=x");
  });
});
