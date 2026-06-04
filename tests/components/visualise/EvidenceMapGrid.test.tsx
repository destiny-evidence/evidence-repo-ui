import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { EvidenceMapGrid } from "@/components/visualise/EvidenceMapGrid";
import type { AxisCategory } from "@/services/evidenceMap";

const rows: AxisCategory[] = [
  { key: "lvl:primary", label: "Primary" },
  { key: "lvl:secondary", label: "Secondary" },
];
const columns: AxisCategory[] = [
  { key: "thm:literacy", label: "Literacy" },
  { key: "thm:numeracy", label: "Numeracy" },
];

// Primary×Numeracy is intentionally absent — an empty intersection.
const COUNTS = new Map<string, number>([
  ["lvl:primary|thm:literacy", 12],
  ["lvl:secondary|thm:literacy", 4],
  ["lvl:secondary|thm:numeracy", 8],
]);
const getCount = (r: string, c: string) => COUNTS.get(`${r}|${c}`);

function renderGrid(
  view: "bubble" | "table",
  onCellClick?: (row: AxisCategory, column: AxisCategory) => void,
) {
  return render(
    <EvidenceMapGrid
      rows={rows}
      columns={columns}
      getCount={getCount}
      maxCount={12}
      view={view}
      countNoun="investigations"
      rowAxisLabel="Education level"
      columnAxisLabel="Education theme"
      onCellClick={onCellClick}
    />,
  );
}

describe("EvidenceMapGrid", () => {
  test("labels axes, columns and rows from the supplied categories", () => {
    renderGrid("table");
    expect(screen.getByText("Education level")).toBeInTheDocument();
    expect(screen.getByText("Education theme")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Literacy" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("rowheader", { name: "Primary" }),
    ).toBeInTheDocument();
  });

  test("table view shows counts as text and leaves empty cells blank", () => {
    renderGrid("table");
    expect(
      screen.getByTitle("Primary · Literacy: 12 investigations").textContent,
    ).toBe("12");
    // Empty intersection: tooltip reports 0, cell renders no number.
    const empty = screen.getByTitle("Primary · Numeracy: 0 investigations");
    expect(empty.textContent).toBe("");
  });

  test("bubble view draws a sized bubble per filled cell, a dashed marker for empties, plus a legend", () => {
    const { container } = renderGrid("bubble");
    const filled = container.querySelectorAll(
      ".evidence-map__table .evidence-map__cell .evidence-map__bubble:not(.evidence-map__bubble--empty)",
    );
    const empties = container.querySelectorAll(
      ".evidence-map__table .evidence-map__cell .evidence-map__bubble--empty",
    );
    expect(filled.length).toBe(3); // 4 cells, 1 empty
    expect(empties.length).toBe(1);
    expect(container.querySelector(".evidence-map__legend")).not.toBeNull();
  });

  test("exposes the full column label via the header title for long headers", () => {
    renderGrid("table");
    const header = screen.getByRole("columnheader", { name: "Literacy" });
    expect(header).toHaveAttribute("title", "Literacy");
  });

  test("shows the total in the corner when supplied", () => {
    render(
      <EvidenceMapGrid
        rows={rows}
        columns={columns}
        getCount={getCount}
        maxCount={12}
        view="table"
        countNoun="investigations"
        rowAxisLabel="Education level"
        columnAxisLabel="Education theme"
        total="247"
      />,
    );
    expect(screen.getByText("247")).toBeInTheDocument();
  });

  test("marks empty intersections with the is-empty modifier", () => {
    const { container } = renderGrid("table");
    const empty = screen
      .getByTitle("Primary · Numeracy: 0 investigations")
      .closest(".evidence-map__cell");
    expect(empty?.classList.contains("is-empty")).toBe(true);
    expect(container.querySelectorAll(".evidence-map__cell.is-empty").length).toBe(
      1,
    );
  });

  test("cells are non-interactive when no click handler is supplied", () => {
    renderGrid("table");
    expect(
      screen.queryByRole("button", { name: /Literacy/ }),
    ).not.toBeInTheDocument();
  });

  test("invokes onCellClick with the row and column for a filled cell", () => {
    const onCellClick = vi.fn();
    renderGrid("table", onCellClick);
    const button = screen.getByTitle("Secondary · Numeracy: 8 investigations");
    expect(button.tagName).toBe("BUTTON");
    fireEvent.click(button);
    expect(onCellClick).toHaveBeenCalledWith(
      { key: "lvl:secondary", label: "Secondary" },
      { key: "thm:numeracy", label: "Numeracy" },
    );
  });

  test("does not make empty cells clickable even with a handler", () => {
    const onCellClick = vi.fn();
    renderGrid("table", onCellClick);
    const empty = screen.getByTitle("Primary · Numeracy: 0 investigations");
    expect(empty.tagName).not.toBe("BUTTON");
  });
});
