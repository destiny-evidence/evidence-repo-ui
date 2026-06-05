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
  test("labels the axes, columns and rows from the supplied categories", () => {
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

  test("table view shows counts as text; empty intersections are blank and marked", () => {
    const { container } = renderGrid("table");
    expect(screen.getByText("12")).toBeInTheDocument();
    // Empty intersection: no number rendered, is-empty set, exactly one.
    const empties = container.querySelectorAll<HTMLElement>(
      ".evidence-map__cell.is-empty",
    );
    expect(empties.length).toBe(1);
    expect(empties[0].querySelector(".evidence-map__count")?.textContent).toBe(
      "",
    );
  });

  test("table view carries no tooltips; bubble view does", () => {
    const { container } = renderGrid("table");
    expect(container.querySelectorAll("[data-tooltip]").length).toBe(0);

    const bubble = renderGrid("bubble");
    expect(
      bubble.container.querySelectorAll("[data-tooltip]").length,
    ).toBeGreaterThan(0);
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

  test("cells are non-interactive without a click handler", () => {
    renderGrid("table");
    expect(
      screen.queryByRole("button", { name: /Literacy/ }),
    ).not.toBeInTheDocument();
  });

  test("with a handler, filled cells invoke onCellClick and empty cells stay inert", () => {
    const onCellClick = vi.fn();
    const { container } = renderGrid("table", onCellClick);

    const button = screen.getByText("8").closest("button");
    expect(button).not.toBeNull();
    fireEvent.click(button!);
    expect(onCellClick).toHaveBeenCalledWith(
      { key: "lvl:secondary", label: "Secondary" },
      { key: "thm:numeracy", label: "Numeracy" },
    );

    // The empty intersection stays inert.
    const empty = container.querySelector(".evidence-map__cell.is-empty");
    expect(empty?.querySelector("button")).toBeNull();
  });
});
