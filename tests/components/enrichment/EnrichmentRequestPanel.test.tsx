import { describe, test, expect, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
} from "@testing-library/preact";
import { EnrichmentRequestPanel } from "@/components/enrichment/EnrichmentRequestPanel";

afterEach(() => {
  cleanup();
  delete window._paq;
});

const REFERENCE_ID = "019a4c8f-3d21-7c6e-9b4a-1f2e5d7c8a90";

// A defined _paq is what analyticsEnabled() reads as "Matomo is loaded".
const mockAnalytics = () => (window._paq = []);
const trackedEvents = () =>
  (window._paq ?? []).filter((cmd) => cmd[0] === "trackEvent");

const openModal = () =>
  fireEvent.click(
    screen.getByRole("button", { name: "Request additional coding" }),
  );

// The ✕ and the footer button share the accessible name "Close", so scope
// queries to the region rather than matching on the name.
const region = (suffix: string) =>
  document.querySelector(`.enrichment-modal__${suffix}`) as HTMLElement;
const header = () => region("header");
const footer = () => region("footer");

describe("EnrichmentRequestPanel", () => {
  test("directs the user to request additional coding in the case of missing data.", () => {
    render(<EnrichmentRequestPanel referenceId={REFERENCE_ID} />);

    expect(screen.getByText("Missing data elements?")).toBeDefined();
    expect(
      screen.getByText("Request extended ESEA annotation for this record."),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Request additional coding" }),
    ).toBeDefined();
  });

  test("shows no modal until the button is clicked", () => {
    render(<EnrichmentRequestPanel referenceId={REFERENCE_ID} />);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("opens a modal explaining the feature is under consideration", () => {
    render(<EnrichmentRequestPanel referenceId={REFERENCE_ID} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Request additional coding" }),
    );

    const dialog = screen.getByRole("dialog", {
      name: "Request additional coding",
    });
    expect(dialog).toHaveTextContent(
      "This feature is currently under consideration. Thank you for expressing your interest — it helps us prioritise future development.",
    );
  });

  test.each([
    ["the header dismiss control", () => within(header()).getByRole("button")],
    ["the footer close button", () => within(footer()).getByRole("button")],
  ])("closes the modal from %s", (_name, closeControl) => {
    render(<EnrichmentRequestPanel referenceId={REFERENCE_ID} />);
    openModal();

    fireEvent.click(closeControl());

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("closes the modal on Escape", () => {
    render(<EnrichmentRequestPanel referenceId={REFERENCE_ID} />);
    openModal();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("moves focus into the modal and back to the trigger on close", () => {
    render(<EnrichmentRequestPanel referenceId={REFERENCE_ID} />);
    const trigger = screen.getByRole("button", {
      name: "Request additional coding",
    });

    fireEvent.click(trigger);
    expect(document.activeElement).toBe(screen.getByRole("dialog"));

    fireEvent.click(within(footer()).getByRole("button"));
    expect(document.activeElement).toBe(trigger);
  });

  test("tracks a click event carrying the reference id", () => {
    mockAnalytics();
    render(<EnrichmentRequestPanel referenceId={REFERENCE_ID} />);

    openModal();

    expect(trackedEvents()).toContainEqual([
      "trackEvent",
      "Enrichment",
      "Request Coding Clicked",
      REFERENCE_ID,
      undefined,
    ]);
  });

  test("tracks one shown event per reference, not per render", () => {
    const OTHER_REFERENCE_ID = "019a4c90-7b12-7e3f-8c05-6d4a2b9f1e77";
    const shownEvents = () =>
      trackedEvents().filter((cmd) => cmd[2] === "Request Coding Shown");
    mockAnalytics();

    const { rerender } = render(
      <EnrichmentRequestPanel referenceId={REFERENCE_ID} />,
    );
    expect(shownEvents()).toEqual([
      ["trackEvent", "Enrichment", "Request Coding Shown", REFERENCE_ID, undefined],
    ]);

    // Re-rendering the same reference is not a new impression.
    rerender(<EnrichmentRequestPanel referenceId={REFERENCE_ID} />);
    expect(shownEvents()).toHaveLength(1);

    rerender(<EnrichmentRequestPanel referenceId={OTHER_REFERENCE_ID} />);
    expect(shownEvents()).toHaveLength(2);
    expect(shownEvents()[1]![3]).toBe(OTHER_REFERENCE_ID);
  });
});