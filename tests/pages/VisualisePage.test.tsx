import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/preact";
import { VisualisePage } from "@/pages/VisualisePage";
import { makeCommunity } from "../fixtures";

// Inject the community directly so the flag-gating behaviour is tested
// independently of which real community happens to have evidenceMap enabled.
const { mockUseCommunity } = vi.hoisted(() => ({ mockUseCommunity: vi.fn() }));
vi.mock("@/community/CommunityContext", () => ({
  useCommunity: mockUseCommunity,
}));

describe("VisualisePage", () => {
  beforeEach(() => mockUseCommunity.mockReset());

  test("renders the map placeholder when the evidence-map flag is on", () => {
    mockUseCommunity.mockReturnValue(
      makeCommunity({ features: { evidenceMap: true } }),
    );
    render(<VisualisePage />);
    expect(
      screen.getByRole("heading", { name: /evidence map/i }),
    ).toBeInTheDocument();
  });

  test("renders not found when the evidence-map flag is off", () => {
    mockUseCommunity.mockReturnValue(
      makeCommunity({ features: { evidenceMap: false } }),
    );
    render(<VisualisePage />);
    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });

  test("renders not found when there is no community", () => {
    mockUseCommunity.mockReturnValue(null);
    render(<VisualisePage />);
    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });
});
