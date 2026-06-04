import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/preact";
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
