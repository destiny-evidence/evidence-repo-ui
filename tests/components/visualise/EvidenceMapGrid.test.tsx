import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { EvidenceMapGrid } from "@/components/visualise/EvidenceMapGrid";
import {
  buildAxisBands,
  buildConceptTree,
  type AxisBands,
  type AxisCategory,
} from "@/services/evidenceMap";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";

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

  function firstCellTooltip(container: Element): string | null | undefined {
    return container
      .querySelector(".evidence-map__cell:not(.is-empty) [data-tooltip]")
      ?.getAttribute("data-tooltip");
  }

  test("without a click handler: table cells carry no tooltip, bubble cells show just the count", () => {
    const table = renderGrid("table");
    expect(table.container.querySelectorAll("[data-tooltip]").length).toBe(0);

    const bubble = renderGrid("bubble");
    expect(firstCellTooltip(bubble.container)).toBe("12 investigations");
  });

  test("with a handler: the bubble tooltip leads with the count then the action; the table tooltip is the action only", () => {
    const bubble = renderGrid("bubble", vi.fn());
    expect(firstCellTooltip(bubble.container)).toBe(
      "12 investigations\nClick to view matching investigations",
    );

    const table = renderGrid("table", vi.fn());
    expect(firstCellTooltip(table.container)).toBe(
      "Click to view matching investigations",
    );
    // Empty cells stay inert in both views — no action tooltip.
    expect(
      table.container.querySelector(".evidence-map__cell.is-empty [data-tooltip]"),
    ).toBeNull();
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

  test("headers are plain text without header click handlers", () => {
    renderGrid("table");
    expect(
      screen.queryByRole("button", { name: /view matching/ }),
    ).not.toBeInTheDocument();
  });

  test("with header handlers, clicking a column or row header deep-links by that axis", () => {
    const onRowClick = vi.fn();
    const onColumnClick = vi.fn();
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
        onRowClick={onRowClick}
        onColumnClick={onColumnClick}
      />,
    );

    const columnButton = screen.getByRole("button", {
      name: "Literacy: view matching investigations.",
    });
    fireEvent.click(columnButton);
    expect(onColumnClick).toHaveBeenCalledWith({
      key: "thm:literacy",
      label: "Literacy",
    });

    // Hovering shows the action tooltip for sighted users; leaving hides it.
    // The tooltip's hover handlers live on the .tooltip wrapper around the button.
    const columnTip = columnButton.closest(".tooltip")!;
    fireEvent.mouseEnter(columnTip);
    expect(
      screen.getByText("Click to view matching investigations"),
    ).toBeInTheDocument();
    fireEvent.mouseLeave(columnTip);
    expect(
      screen.queryByText("Click to view matching investigations"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Secondary: view matching investigations.",
      }),
    );
    expect(onRowClick).toHaveBeenCalledWith({
      key: "lvl:secondary",
      label: "Secondary",
    });
  });

  const definedColumns: AxisCategory[] = [
    { key: "thm:literacy", label: "Literacy", definition: "Reading and writing" },
    { key: "thm:numeracy", label: "Numeracy" },
  ];

  function headerTooltipFor(container: Element, label: string): string | null {
    const labelSpan = Array.from(
      container.querySelectorAll(".evidence-map__col-head-label"),
    ).find((el) => el.textContent === label);
    return labelSpan?.closest(".tooltip")?.getAttribute("data-tooltip") ?? null;
  }

  test("a clickable header leads its tooltip with the concept definition, then the action", () => {
    const { container } = render(
      <EvidenceMapGrid
        rows={rows}
        columns={definedColumns}
        getCount={getCount}
        maxCount={12}
        view="table"
        countNoun="investigations"
        rowAxisLabel="Education level"
        columnAxisLabel="Education theme"
        onColumnClick={vi.fn()}
      />,
    );
    expect(headerTooltipFor(container, "Literacy")).toBe(
      "Reading and writing\n\nClick to view matching investigations",
    );
    // No definition ⇒ just the action line.
    expect(headerTooltipFor(container, "Numeracy")).toBe(
      "Click to view matching investigations",
    );
  });

  test("a non-clickable header still shows the definition alone", () => {
    const { container } = render(
      <EvidenceMapGrid
        rows={rows}
        columns={definedColumns}
        getCount={getCount}
        maxCount={12}
        view="table"
        countNoun="investigations"
        rowAxisLabel="Education level"
        columnAxisLabel="Education theme"
      />,
    );
    expect(headerTooltipFor(container, "Literacy")).toBe("Reading and writing");
    expect(headerTooltipFor(container, "Numeracy")).toBeNull();
  });
});

describe("EvidenceMapGrid nested axis bands", () => {
  const rowScheme: ConceptScheme = {
    uri: "scheme:rows",
    label: "Rows Scheme",
    topConcepts: [
      {
        uri: "row:responses",
        label: "Interventions / responses / solutions",
        narrower: [
          { uri: "row:policy", label: "Policy" },
          { uri: "row:technology", label: "Technology / infrastructure" },
        ],
      },
      { uri: "row:other", label: "Other response" },
    ],
  };
  const columnScheme: ConceptScheme = {
    uri: "scheme:columns",
    label: "Columns Scheme",
    topConcepts: [
      {
        uri: "column:health",
        label: "Communicable, maternal, neonatal, and nutritional diseases",
        narrower: [
          {
            uri: "column:mortality",
            label: "Mortality",
            definition: "Deaths in the population",
          },
          { uri: "column:morbidity", label: "Morbidity" },
        ],
      },
      { uri: "column:wellbeing", label: "Wellbeing" },
    ],
  };
  const rowTree = buildConceptTree(rowScheme);
  const columnTree = buildConceptTree(columnScheme);
  const nestedCount = () => 1;

  function nestedGrid({
    rowBands = buildAxisBands(rowTree, new Set(["row:responses"])),
    columnBands = buildAxisBands(columnTree, new Set(["column:health"])),
    view = "table",
    onToggleRow,
    onToggleColumn,
    onRowClick,
    onColumnClick,
  }: {
    rowBands?: AxisBands;
    columnBands?: AxisBands;
    view?: "bubble" | "table";
    onToggleRow?: (key: string) => void;
    onToggleColumn?: (key: string) => void;
    onRowClick?: (row: AxisCategory) => void;
    onColumnClick?: (column: AxisCategory) => void;
  } = {}) {
    return (
      <EvidenceMapGrid
        rows={rowBands.leaves}
        columns={columnBands.leaves}
        rowBands={rowBands}
        columnBands={columnBands}
        getCount={nestedCount}
        maxCount={1}
        view={view}
        countNoun="investigations"
        rowAxisLabel="Rows"
        columnAxisLabel="Columns"
        onToggleRow={onToggleRow}
        onToggleColumn={onToggleColumn}
        onRowClick={onRowClick}
        onColumnClick={onColumnClick}
      />
    );
  }

  test("column bands use colSpan, tier span, and column-group semantics", () => {
    const { container } = render(nestedGrid());
    expect(container.querySelectorAll("thead tr")).toHaveLength(2);

    const band = screen
      .getByText(
        "Communicable, maternal, neonatal, and nutritional diseases",
      )
      .closest("th")!;
    expect(band).toHaveAttribute("scope", "colgroup");
    expect(band).toHaveAttribute("colspan", "2");
    expect(band).not.toHaveAttribute("rowspan");

    const terminal = screen.getByText("Wellbeing").closest("th")!;
    expect(terminal).toHaveAttribute("scope", "col");
    expect(terminal).toHaveAttribute("rowspan", "2");
    expect(container.querySelector(".evidence-map__corner")).toHaveAttribute(
      "rowspan",
      "2",
    );
    expect(container.querySelector(".evidence-map__corner")).not.toHaveAttribute(
      "scope",
    );
  });

  test("row bands use rowSpan, tier span, and row-group semantics", () => {
    const { container } = render(nestedGrid());
    const band = screen
      .getByText("Interventions / responses / solutions")
      .closest("th")!;
    expect(band).toHaveAttribute("scope", "rowgroup");
    expect(band).toHaveAttribute("rowspan", "2");
    expect(band).not.toHaveAttribute("colspan");

    const terminal = screen.getByText("Other response").closest("th")!;
    expect(terminal).toHaveAttribute("scope", "row");
    expect(terminal).toHaveAttribute("colspan", "2");
    expect(container.querySelector(".evidence-map__corner")).toHaveAttribute(
      "colspan",
      "2",
    );
  });

  test("a collapsed branch has independent expand and Search actions", () => {
    const onToggleColumn = vi.fn();
    const onColumnClick = vi.fn();
    const columnBands = buildAxisBands(columnTree, new Set());
    render(
      nestedGrid({ columnBands, onToggleColumn, onColumnClick }),
    );

    const expand = screen.getByRole("button", {
      name: "Expand Communicable, maternal, neonatal, and nutritional diseases",
    });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(expand);
    expect(onToggleColumn).toHaveBeenCalledWith("column:health");
    expect(onColumnClick).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", {
        name: /Communicable.*view matching investigations/,
      }),
    );
    expect(onColumnClick).toHaveBeenCalledWith({
      key: "column:health",
      label: "Communicable, maternal, neonatal, and nutritional diseases",
    });
  });

  test("an expanded band only collapses while its visible children open Search", () => {
    const onToggleRow = vi.fn();
    const onToggleColumn = vi.fn();
    const onRowClick = vi.fn();
    const onColumnClick = vi.fn();
    render(
      nestedGrid({
        onToggleRow,
        onToggleColumn,
        onRowClick,
        onColumnClick,
      }),
    );

    const columnCollapse = screen.getByRole("button", {
      name: "Collapse Communicable, maternal, neonatal, and nutritional diseases",
    });
    expect(columnCollapse).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(columnCollapse);
    expect(onToggleColumn).toHaveBeenCalledWith("column:health");
    expect(
      screen.queryByRole("button", {
        name: /Communicable.*view matching investigations/,
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Mortality: view matching investigations.",
      }),
    );
    expect(onColumnClick).toHaveBeenCalledWith({
      key: "column:mortality",
      label: "Mortality",
      definition: "Deaths in the population",
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Policy: view matching investigations.",
      }),
    );
    expect(onRowClick).toHaveBeenCalledWith({
      key: "row:policy",
      label: "Policy",
    });
    expect(onToggleRow).not.toHaveBeenCalled();
  });

  test("column-band and row-rail labels retain their full text in tooltips", () => {
    const { container } = render(nestedGrid());
    const columnLabel = Array.from(
      container.querySelectorAll(".evidence-map__col-head-label"),
    ).find((element) => element.textContent?.startsWith("Communicable"))!;
    expect(columnLabel.closest(".tooltip")).toHaveAttribute(
      "data-tooltip",
      "Communicable, maternal, neonatal, and nutritional diseases",
    );
    const rowLabel = Array.from(
      container.querySelectorAll(".evidence-map__row-head-label"),
    ).find((element) => element.textContent?.startsWith("Interventions"))!;
    expect(rowLabel.closest(".tooltip")).toHaveAttribute(
      "data-tooltip",
      "Interventions / responses / solutions",
    );
  });

  test("Bubble and Table change cells without changing nested headers or callbacks", () => {
    const onToggleColumn = vi.fn();
    const onColumnClick = vi.fn();
    const { container, rerender } = render(
      nestedGrid({ view: "bubble", onToggleColumn, onColumnClick }),
    );
    const signature = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          ".evidence-map__col-head--tiered, .evidence-map__row-head--tiered",
        ),
      ).map((header) => ({
        text: header.textContent,
        scope: header.getAttribute("scope"),
        rowSpan: header.getAttribute("rowspan"),
        colSpan: header.getAttribute("colspan"),
      }));
    const bubbleSignature = signature();
    expect(container.querySelector(".evidence-map__bubble")).not.toBeNull();

    rerender(nestedGrid({ view: "table", onToggleColumn, onColumnClick }));
    expect(signature()).toEqual(bubbleSignature);
    expect(container.querySelector(".evidence-map__count")).not.toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Collapse Communicable, maternal, neonatal, and nutritional diseases",
      }),
    );
    expect(onToggleColumn).toHaveBeenCalledWith("column:health");
  });

  test("omitting nested layouts preserves the flat header structure", () => {
    const { container } = renderGrid("table");
    expect(container.querySelectorAll("thead tr")).toHaveLength(1);
    expect(
      container.querySelector(".evidence-map__col-head--tiered"),
    ).toBeNull();
    expect(
      container.querySelector(".evidence-map__row-head--tiered"),
    ).toBeNull();
    expect(container.querySelector(".evidence-map__expand-toggle")).toBeNull();
    expect(container.querySelector(".evidence-map__corner")).not.toHaveAttribute(
      "scope",
    );
  });

  test("one hierarchical axis aligns with one flat country-like axis", () => {
    const flatCountries: AxisCategory[] = [
      { key: "AU", label: "Australia" },
      { key: "NZ", label: "New Zealand" },
    ];
    const columnBands = buildAxisBands(
      columnTree,
      new Set(["column:health"]),
    );
    const rowBands = buildAxisBands(rowTree, new Set(["row:responses"]));
    const common = {
      getCount: nestedCount,
      maxCount: 1,
      view: "table" as const,
      countNoun: "investigations",
    };
    const { container, rerender } = render(
      <EvidenceMapGrid
        {...common}
        rows={flatCountries}
        columns={columnBands.leaves}
        columnBands={columnBands}
        rowAxisLabel="Countries"
        columnAxisLabel="Outcomes"
      />,
    );

    expect(container.querySelectorAll("thead tr")).toHaveLength(2);
    expect(container.querySelectorAll(".evidence-map__row-head--tiered"))
      .toHaveLength(0);
    expect(container.querySelector(".evidence-map__corner")).toHaveAttribute(
      "rowspan",
      "2",
    );
    expect(screen.getByText("Australia").closest("th")).toHaveAttribute(
      "scope",
      "row",
    );

    rerender(
      <EvidenceMapGrid
        {...common}
        rows={rowBands.leaves}
        columns={flatCountries}
        rowBands={rowBands}
        rowAxisLabel="Responses"
        columnAxisLabel="Countries"
      />,
    );

    expect(container.querySelectorAll("thead tr")).toHaveLength(1);
    expect(container.querySelectorAll(".evidence-map__col-head--tiered"))
      .toHaveLength(0);
    expect(container.querySelector(".evidence-map__corner")).toHaveAttribute(
      "colspan",
      "2",
    );
    expect(screen.getByText("Australia").closest("th")).toHaveAttribute(
      "scope",
      "col",
    );
  });
});
