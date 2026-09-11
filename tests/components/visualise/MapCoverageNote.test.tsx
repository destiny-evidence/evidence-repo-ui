import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/preact";
import { MapCoverageNote } from "@/components/visualise/MapCoverageNote";
import type { CrossFacetTotals } from "@/types/models";

const HEADING_ID = "map-heading";

function makeTotals(
  mapped: number,
  search: number,
  searchIsLowerBound = false,
): CrossFacetTotals {
  return {
    search: { count: search, is_lower_bound: searchIsLowerBound },
    mapped: { count: mapped, is_lower_bound: false },
  };
}

function renderNote(totals: CrossFacetTotals, countNoun = "investigations") {
  return render(
    <MapCoverageNote
      totals={totals}
      countNoun={countNoun}
      returnFocusTo={HEADING_ID}
    />,
  );
}

const explanation = /only investigations that have been coded/i;

describe("MapCoverageNote", () => {
  test("explains the shortfall when fewer references are plotted than match", () => {
    renderNote(makeTotals(199, 120152));

    expect(screen.getByText(explanation).textContent).toContain(
      "search results and filter counts may be larger",
    );
  });

  test("takes the community's noun", () => {
    renderNote(makeTotals(3, 40), "references");

    expect(
      screen.getByText(/only references that have been coded/i),
    ).toBeInTheDocument();
  });

  test("says nothing when every matching reference is plotted", () => {
    const { container } = renderNote(makeTotals(199, 199));

    expect(container).toBeEmptyDOMElement();
  });

  test("still explains when the match total is only a lower bound", () => {
    renderNote(makeTotals(199, 199, true));

    expect(screen.getByText(explanation)).toBeInTheDocument();
  });

  test("dismissing removes it", () => {
    const { container } = renderNote(makeTotals(199, 120152));

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(container).toBeEmptyDOMElement();
  });

  test("a dismissal is remembered the next time the map is opened", () => {
    renderNote(makeTotals(199, 120152));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    cleanup();

    const { container } = renderNote(makeTotals(199, 120152));

    expect(container).toBeEmptyDOMElement();
  });

  test("hands focus to the named element when dismissed", () => {
    const heading = document.createElement("h1");
    heading.id = HEADING_ID;
    heading.tabIndex = -1;
    document.body.append(heading);

    renderNote(makeTotals(199, 120152));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(document.activeElement).toBe(heading);
    heading.remove();
  });

  test("shows, and closes cleanly, when storage is blocked", () => {
    const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    const onError = vi.fn();
    window.addEventListener("error", onError);

    const { container } = renderNote(makeTotals(199, 120152));
    expect(screen.getByText(explanation)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    window.removeEventListener("error", onError);

    expect(container).toBeEmptyDOMElement();
    // The refused write must not surface as an uncaught error either.
    expect(onError).not.toHaveBeenCalled();
    // Guard against the storage never having been blocked in the first place.
    expect(read).toHaveBeenCalled();
    expect(write).toHaveBeenCalled();
    read.mockRestore();
    write.mockRestore();
  });
});
