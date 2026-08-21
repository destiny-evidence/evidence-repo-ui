import { describe, test, expect, afterEach, beforeEach, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
} from "@testing-library/preact";
import { AuthProvider } from "@/auth/AuthContext";
import { CommunityProvider } from "@/community/CommunityContext";
import { EnrichmentRequestPanel } from "@/components/enrichment/EnrichmentRequestPanel";

const TEMPLATE =
  "https://forms.test/viewform?usp=pp_url&entry.1={referenceUrl}&entry.2={name}&entry.3={email}";

let formTemplate: string | undefined;

vi.mock("@/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/config")>()),
  get ENRICHMENT_FORM_URL() {
    return formTemplate;
  },
}));

beforeEach(() => {
  formTemplate = TEMPLATE;
  history.replaceState(null, "", "/esea");
});

afterEach(() => {
  cleanup();
  delete window._paq;
});

const REFERENCE_ID = "019a4c8f-3d21-7c6e-9b4a-1f2e5d7c8a90";
const CODED_ANNOTATIONS = 7;

const panel = (
  referenceId = REFERENCE_ID,
  codedAnnotations = CODED_ANNOTATIONS,
) => (
  <AuthProvider>
    <CommunityProvider>
      <EnrichmentRequestPanel
        referenceId={referenceId}
        codedAnnotations={codedAnnotations}
      />
    </CommunityProvider>
  </AuthProvider>
);

// A defined _paq is what analyticsEnabled() reads as "Matomo is loaded".
const mockAnalytics = () => (window._paq = []);
const trackedEvents = () =>
  (window._paq ?? []).filter((cmd) => cmd[0] === "trackEvent");

const requestLink = () =>
  screen.getByRole("link", { name: /Request more data/ });

describe("EnrichmentRequestPanel", () => {
  test("offers to have the record coded further with the form copy", () => {
    render(panel());

    expect(screen.getByText("Need more data?")).toBeDefined();
    expect(
      screen.getByText(
        "Our reviewers can go back to the full paper and extract more — outcomes, themes or effect estimates.",
      ),
    ).toBeDefined();
  });

  test("opens the request form in a new tab", () => {
    render(panel());

    expect(requestLink()).toHaveAttribute("target", "_blank");
    expect(requestLink()).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("prefills the form with the record and the signed-in user", () => {
    render(panel());

    const params = new URL(requestLink().getAttribute("href")!).searchParams;
    expect(params.get("entry.1")).toBe(
      `${window.location.origin}/esea/references/${REFERENCE_ID}`,
    );
    expect(params.get("entry.2")).toBe("Test User");
    expect(params.get("entry.3")).toBe("test.user@example.org");
  });

  // Asserts our half of the contract only: the tracker skips anchors whose
  // class matches /(^| )(piwik|matomo)[_-]ignore( |$)/, and matomo.js is never
  // loaded here, so the skip itself can only be confirmed against a real
  // instance.
  test("keeps the prefilled href out of Matomo link tracking", () => {
    render(panel());

    expect(requestLink().className).toMatch(
      /(^| )(piwik|matomo)[_-]ignore( |$)/,
    );
  });

  test("tracks a click event carrying the reference id and coding depth", () => {
    mockAnalytics();
    render(panel());

    fireEvent.click(requestLink());

    expect(trackedEvents()).toContainEqual([
      "trackEvent",
      "Enrichment",
      "Request Coding Clicked",
      REFERENCE_ID,
      CODED_ANNOTATIONS,
    ]);
  });

  test("tracks one shown event per reference, not per render", () => {
    const OTHER_REFERENCE_ID = "019a4c90-7b12-7e3f-8c05-6d4a2b9f1e77";
    const shownEvents = () =>
      trackedEvents().filter((cmd) => cmd[2] === "Request Coding Shown");
    mockAnalytics();

    const { rerender } = render(panel());
    expect(shownEvents()).toEqual([
      [
        "trackEvent",
        "Enrichment",
        "Request Coding Shown",
        REFERENCE_ID,
        CODED_ANNOTATIONS,
      ],
    ]);

    // Re-rendering the same reference is not a new impression.
    rerender(panel());
    expect(shownEvents()).toHaveLength(1);

    rerender(panel(OTHER_REFERENCE_ID, 3));
    expect(shownEvents()).toHaveLength(2);
    expect(shownEvents()[1]).toEqual([
      "trackEvent",
      "Enrichment",
      "Request Coding Shown",
      OTHER_REFERENCE_ID,
      3,
    ]);
  });

  describe("fake door", () => {
    const requestButton = () =>
      screen.getByRole("button", { name: "Request additional coding" });

    // The ✕ and the footer button share the accessible name "Close", so scope
    // queries to the region rather than matching on the name.
    const region = (suffix: string) =>
      document.querySelector(`.enrichment-modal__${suffix}`) as HTMLElement;

    const openModal = () => fireEvent.click(requestButton());

    beforeEach(() => {
      formTemplate = undefined;
    });

    test.each([
      ["unset", undefined],
      ["unparseable", "not-a-url"],
      ["not https", "javascript:alert(1)"],
    ])("stands in when the form URL is %s", (_label, template) => {
      formTemplate = template;

      render(panel());

      expect(requestButton()).toBeDefined();
      expect(
        screen.queryByRole("link", { name: /Request more data/ }),
      ).toBeNull();
    });

    // Deliberately the pre-form wording: it promises less than the form copy
    // does, which is all the fake door can honour.
    test("keeps its original prompt", () => {
      render(panel());

      expect(screen.getByText("Missing data elements?")).toBeDefined();
      expect(
        screen.getByText("Request extended ESEA annotation for this record."),
      ).toBeDefined();
    });

    test("shows no modal until the button is clicked", () => {
      render(panel());

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    test("opens a modal explaining the feature is under consideration", () => {
      render(panel());
      openModal();

      const dialog = screen.getByRole("dialog", {
        name: "Request additional coding",
      });
      expect(dialog).toHaveTextContent(
        "This feature is currently under consideration. Thank you for expressing your interest — it helps us prioritise future development.",
      );
    });

    test.each([
      ["the header dismiss control", "header"],
      ["the footer close button", "footer"],
    ])("closes the modal from %s", (_name, suffix) => {
      render(panel());
      openModal();

      fireEvent.click(within(region(suffix)).getByRole("button"));

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    test("closes the modal on Escape", () => {
      render(panel());
      openModal();

      fireEvent.keyDown(window, { key: "Escape" });

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    test("moves focus into the modal and back to the trigger on close", () => {
      render(panel());
      const trigger = requestButton();

      fireEvent.click(trigger);
      expect(document.activeElement).toBe(screen.getByRole("dialog"));

      fireEvent.click(within(region("footer")).getByRole("button"));
      expect(document.activeElement).toBe(trigger);
    });

    // Capturing interest is the only reason the fallback exists, so assert the
    // impression here too and not just on the form path.
    test("reports the impression as the form does", () => {
      mockAnalytics();

      render(panel());

      expect(trackedEvents()).toContainEqual([
        "trackEvent",
        "Enrichment",
        "Request Coding Shown",
        REFERENCE_ID,
        CODED_ANNOTATIONS,
      ]);
    });

    test("reports the click as the form link does", () => {
      mockAnalytics();
      render(panel());

      openModal();

      expect(trackedEvents()).toContainEqual([
        "trackEvent",
        "Enrichment",
        "Request Coding Clicked",
        REFERENCE_ID,
        CODED_ANNOTATIONS,
      ]);
    });
  });
});
