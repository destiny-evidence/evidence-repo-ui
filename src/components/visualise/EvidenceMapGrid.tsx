import { useEffect, useRef, useState } from "preact/hooks";
import {
  bubbleRadius,
  formatCompact,
  legendTicks,
  type AxisBandCell,
  type AxisBands,
  type AxisCategory,
} from "@/services/evidenceMap";
import { Tooltip } from "../common/Tooltip";
import type { MapView } from "./ViewToggle";
import "./EvidenceMapGrid.css";

// Bubble sizing (px). The floor fits a single-digit label; the max sits within
// the cell's 64px row. A wide label can't clip: the bubble's CSS floors its
// width at the rendered text (min-content), so no font math lives here.
const BUBBLE_MAX_RADIUS = 22;
const BUBBLE_MIN_RADIUS = 9;

interface EvidenceMapGridProps {
  rows: AxisCategory[];
  columns: AxisCategory[];
  getCount: (rowKey: string, columnKey: string) => number | undefined;
  maxCount: number;
  view: MapView;
  countNoun: string;
  rowAxisLabel: string;
  columnAxisLabel: string;
  // Preformatted count of the references plotted on the map (e.g. "247"); shown
  // in the corner alongside the axes.
  total?: string;
  // Dims the grid while a new result is being fetched (the prior grid stays up).
  updating?: boolean;
  // Dims the grid in the over-filtered state (axes visible, but nothing matches).
  dimmed?: boolean;
  // When supplied, cells become clickable buttons.
  onCellClick?: (row: AxisCategory, column: AxisCategory) => void;
  // When supplied, row/column headers become clickable buttons that deep-link
  // into Search filtered by that single axis category.
  onRowClick?: (row: AxisCategory) => void;
  onColumnClick?: (column: AxisCategory) => void;
  // Optional hierarchy geometry; rows and columns match the respective leaves.
  rowBands?: AxisBands;
  columnBands?: AxisBands;
  onToggleRow?: (key: string) => void;
  onToggleColumn?: (key: string) => void;
}

// Bubble view shows a compact count, so its tooltip leads with the exact value;
// table view already shows the count, so its tooltip is only the action line.
// The action line (second, in bubble view) appears on cells that deep-link.
function cellTooltip(
  count: number | undefined,
  countNoun: string,
  clickable: boolean,
  view: MapView,
): string | undefined {
  const action = `Click to view matching ${countNoun}`;
  if (view === "table") return clickable ? action : undefined;
  const summary = `${(count ?? 0).toLocaleString()} ${countNoun}`;
  return clickable ? `${summary}\n${action}` : summary;
}

// The button's only visible content is the count, so a screen reader would
// announce just "5, button". Spell out the cell's coordinates and the action.
function cellAriaLabel(
  count: number,
  countNoun: string,
  rowLabel: string,
  columnLabel: string,
): string {
  return `${rowLabel}, ${columnLabel}: ${count.toLocaleString()} ${countNoun}. View matching ${countNoun}.`;
}

// The button's visible content is only its label, so the action is spelled out
// in the aria-label for screen readers (the tooltip conveys it to sighted users).
function headerAriaLabel(label: string, countNoun: string): string {
  return `${label}: view matching ${countNoun}.`;
}

// Header tooltip: the concept's definition (so the reader sees the scope of that
// row/column) above the click action.
function headerTooltip(
  definition: string | undefined,
  countNoun: string,
  clickable: boolean,
): string | undefined {
  const action = clickable ? `Click to view matching ${countNoun}` : undefined;
  if (definition && action) return `${definition}\n\n${action}`;
  return definition ?? action;
}

export function EvidenceMapGrid({
  rows,
  columns,
  getCount,
  maxCount,
  view,
  countNoun,
  rowAxisLabel,
  columnAxisLabel,
  total,
  updating = false,
  dimmed = false,
  onCellClick,
  onRowClick,
  onColumnClick,
  rowBands,
  columnBands,
  onToggleRow,
  onToggleColumn,
}: EvidenceMapGridProps) {
  // Track the hovered cell so we can highlight its full row and column — a
  // clear crosshair when the grid grows past a screenful.
  const [hover, setHover] = useState<{ row: string; column: string } | null>(
    null,
  );
  const nestedColumns =
    columnBands && columnBands.tiers.length > 0 ? columnBands : undefined;
  const rowRail = rowBands?.rail ?? null;
  const columnTierCount = nestedColumns?.tiers.length ?? 1;
  const rowTierCount = rowBands ? rowBands.maxDepth + 1 : 1;

  // Focuses a just-expanded band's first child; without it, Tab keeps moving
  // across that tier's remaining siblings instead of reaching the new band.
  const columnFocusTargets = useRef(new Map<string, HTMLButtonElement>());
  const rowFocusTargets = useRef(new Map<string, HTMLButtonElement>());
  const pendingColumnFocusKey = useRef<string | null>(null);
  const pendingRowFocusKey = useRef<string | null>(null);

  function registerColumnFocusTarget(key: string, el: HTMLButtonElement | null) {
    if (el) columnFocusTargets.current.set(key, el);
    else columnFocusTargets.current.delete(key);
  }
  function registerRowFocusTarget(key: string, el: HTMLButtonElement | null) {
    if (el) rowFocusTargets.current.set(key, el);
    else rowFocusTargets.current.delete(key);
  }

  const handleToggleColumn = onToggleColumn
    ? (key: string) => {
        pendingColumnFocusKey.current = key;
        onToggleColumn(key);
      }
    : undefined;
  const handleToggleRow = onToggleRow
    ? (key: string) => {
        pendingRowFocusKey.current = key;
        onToggleRow(key);
      }
    : undefined;

  useEffect(() => {
    const key = pendingColumnFocusKey.current;
    pendingColumnFocusKey.current = null;
    if (!key) return;
    const target = columnBands?.tiers
      .flat()
      .find((cell) => cell.key === key)?.firstChildKey;
    if (!target) return;
    columnFocusTargets.current.get(target)?.focus();
  }, [columnBands]);

  useEffect(() => {
    const key = pendingRowFocusKey.current;
    pendingRowFocusKey.current = null;
    if (!key) return;
    const target = rowBands?.tiers
      .flat()
      .find((cell) => cell.key === key)?.firstChildKey;
    if (!target) return;
    rowFocusTargets.current.get(target)?.focus();
  }, [rowBands]);

  const corner = (
    <>
      {total !== undefined && (
        <span class="evidence-map__total">
          <span class="evidence-map__total-count">{total}</span> unique{" "}
          {countNoun}
        </span>
      )}
      <span class="evidence-map__axis-key">
        <span class="evidence-map__axis">
          <span class="evidence-map__axis-role lg-label">
            <span class="evidence-map__axis-icon" aria-hidden="true">
              ↔
            </span>{" "}
            Columns
          </span>
          <span class="evidence-map__axis-name">{columnAxisLabel}</span>
        </span>
        <span class="evidence-map__axis">
          <span class="evidence-map__axis-role lg-label">
            <span class="evidence-map__axis-icon" aria-hidden="true">
              ↕
            </span>{" "}
            Rows
          </span>
          <span class="evidence-map__axis-name">{rowAxisLabel}</span>
        </span>
      </span>
    </>
  );

  return (
    <div
      class={`evidence-map${updating ? " is-updating" : ""}${
        dimmed ? " is-dimmed" : ""
      }`}
    >
      <div class="evidence-map__scroll">
        <table
          class={`evidence-map__table evidence-map__table--${view}`}
          onMouseLeave={() => setHover(null)}
        >
          <thead>
            {nestedColumns ? (
              nestedColumns.tiers.map((tier, tierIndex) => (
                <tr key={tierIndex}>
                  {tierIndex === 0 && (
                    <th
                      class="evidence-map__corner"
                      rowSpan={
                        columnTierCount > 1 ? columnTierCount : undefined
                      }
                      colSpan={rowTierCount > 1 ? rowTierCount : undefined}
                    >
                      {corner}
                    </th>
                  )}
                  {tier.map((cell) => (
                    <ColumnHeaderCell
                      key={cell.key}
                      cell={cell}
                      hoverColumn={hover?.column}
                      countNoun={countNoun}
                      onToggle={handleToggleColumn}
                      onColumnClick={onColumnClick}
                      registerFocusTarget={registerColumnFocusTarget}
                    />
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <th
                  class="evidence-map__corner"
                  colSpan={rowTierCount > 1 ? rowTierCount : undefined}
                >
                  {corner}
                </th>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    class={`evidence-map__col-head${
                      onColumnClick
                        ? " evidence-map__col-head--clickable"
                        : ""
                    }${hover?.column === column.key ? " is-active" : ""}`}
                    scope="col"
                  >
                    <HeaderLabel
                      label={column.label}
                      labelClass="evidence-map__col-head-label"
                      tooltip={headerTooltip(
                        column.definition,
                        countNoun,
                        onColumnClick !== undefined,
                      )}
                      ariaLabel={headerAriaLabel(column.label, countNoun)}
                      onClick={
                        onColumnClick ? () => onColumnClick(column) : undefined
                      }
                    />
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.key}>
                {rowRail ? (
                  <RowRailCells
                    cells={rowRail[rowIndex]}
                    hoverRow={hover?.row}
                    countNoun={countNoun}
                    onToggle={handleToggleRow}
                    onRowClick={onRowClick}
                    registerFocusTarget={registerRowFocusTarget}
                  />
                ) : (
                  <th
                    class={`evidence-map__row-head${
                      onRowClick ? " evidence-map__row-head--clickable" : ""
                    }${hover?.row === row.key ? " is-active" : ""}`}
                    scope="row"
                  >
                    <HeaderLabel
                      label={row.label}
                      labelClass="evidence-map__row-head-label"
                      tooltip={headerTooltip(
                        row.definition,
                        countNoun,
                        onRowClick !== undefined,
                      )}
                      ariaLabel={headerAriaLabel(row.label, countNoun)}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                    />
                  </th>
                )}
                {columns.map((column) => {
                  const count = getCount(row.key, column.key);
                  const empty = count === undefined || count <= 0;
                  const clickable = onCellClick !== undefined && !empty;
                  return (
                    <Cell
                      key={column.key}
                      empty={empty}
                      count={count ?? 0}
                      maxCount={maxCount}
                      view={view}
                      tooltip={cellTooltip(count, countNoun, clickable, view)}
                      ariaLabel={
                        clickable
                          ? cellAriaLabel(
                              count ?? 0,
                              countNoun,
                              row.label,
                              column.label,
                            )
                          : undefined
                      }
                      rowActive={hover?.row === row.key}
                      columnActive={hover?.column === column.key}
                      onHover={() =>
                        setHover({ row: row.key, column: column.key })
                      }
                      onClick={
                        clickable ? () => onCellClick(row, column) : undefined
                      }
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {view === "bubble" && (
        <MapLegend maxCount={maxCount} countNoun={countNoun} />
      )}
    </div>
  );
}

// A row/column header label. When clickable it's a button (the click target is
// the label; the whole cell shades on hover — see CSS); otherwise a plain span.
// Either way its tooltip carries the concept's definition when the axis has one,
// so a non-clickable header (over-filtered / refetching) still explains its scope.
function HeaderLabel({
  label,
  labelClass,
  tooltip,
  ariaLabel,
  onClick,
  buttonRef,
}: {
  label: string;
  labelClass?: string;
  tooltip: string | undefined;
  ariaLabel: string;
  onClick?: () => void;
  buttonRef?: (el: HTMLButtonElement | null) => void;
}) {
  const labelSpan = <span class={labelClass}>{label}</span>;
  if (!onClick) return <Tooltip text={tooltip}>{labelSpan}</Tooltip>;
  return (
    <Tooltip text={tooltip}>
      <button
        type="button"
        class="evidence-map__head-link"
        aria-label={ariaLabel}
        onClick={onClick}
        ref={buttonRef}
      >
        {labelSpan}
      </button>
    </Tooltip>
  );
}

function tieredHeaderTooltip(
  cell: AxisBandCell,
  countNoun: string,
  clickable: boolean,
): string {
  const detail = headerTooltip(cell.definition, countNoun, clickable);
  return detail ? `${cell.label}\n\n${detail}` : cell.label;
}

function axisCategory(cell: AxisBandCell): AxisCategory {
  return cell.definition !== undefined
    ? { key: cell.key, label: cell.label, definition: cell.definition }
    : { key: cell.key, label: cell.label };
}

function ExpandToggle({
  expanded,
  label,
  onToggle,
  buttonRef,
}: {
  expanded: boolean;
  label: string;
  onToggle: () => void;
  buttonRef?: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      type="button"
      class="evidence-map__expand-toggle"
      aria-expanded={expanded}
      aria-label={`${expanded ? "Collapse" : "Expand"} ${label}`}
      onClick={onToggle}
      ref={buttonRef}
    >
      <span aria-hidden="true">{expanded ? "−" : "+"}</span>
    </button>
  );
}

function TieredHeaderContent({
  cell,
  labelClass,
  countNoun,
  onToggle,
  onClick,
  registerFocusTarget,
}: {
  cell: AxisBandCell;
  labelClass: string;
  countNoun: string;
  onToggle: ((key: string) => void) | undefined;
  onClick: (() => void) | undefined;
  registerFocusTarget: (key: string, el: HTMLButtonElement | null) => void;
}) {
  const isBand = cell.expanded && cell.hasChildren;
  const clickable = !isBand && onClick !== undefined;
  // Register only the cell's primary control — its toggle if present, else
  // its Search label — so a parent's focus handoff has one unambiguous target.
  const hasToggle = cell.hasChildren && onToggle !== undefined;
  return (
    <div class="evidence-map__tiered-head-content">
      {hasToggle && (
        <ExpandToggle
          expanded={cell.expanded}
          label={cell.label}
          onToggle={() => onToggle(cell.key)}
          buttonRef={(el) => registerFocusTarget(cell.key, el)}
        />
      )}
      <HeaderLabel
        label={cell.label}
        labelClass={labelClass}
        tooltip={tieredHeaderTooltip(cell, countNoun, clickable)}
        ariaLabel={headerAriaLabel(cell.label, countNoun)}
        onClick={clickable ? onClick : undefined}
        buttonRef={
          !hasToggle && clickable
            ? (el) => registerFocusTarget(cell.key, el)
            : undefined
        }
      />
    </div>
  );
}

function ColumnHeaderCell({
  cell,
  hoverColumn,
  countNoun,
  onToggle,
  onColumnClick,
  registerFocusTarget,
}: {
  cell: AxisBandCell;
  hoverColumn: string | undefined;
  countNoun: string;
  onToggle: ((key: string) => void) | undefined;
  onColumnClick: ((column: AxisCategory) => void) | undefined;
  registerFocusTarget: (key: string, el: HTMLButtonElement | null) => void;
}) {
  const isBand = cell.expanded && cell.hasChildren;
  const clickable = !isBand && onColumnClick !== undefined;
  return (
    <th
      colSpan={cell.span > 1 ? cell.span : undefined}
      rowSpan={cell.tierSpan > 1 ? cell.tierSpan : undefined}
      class={`evidence-map__col-head evidence-map__col-head--tiered${
        clickable ? " evidence-map__col-head--clickable" : ""
      }${!isBand && hoverColumn === cell.key ? " is-active" : ""}`}
      scope={isBand ? "colgroup" : "col"}
      style={{ "--evidence-map-tier-index": cell.depth }}
    >
      <TieredHeaderContent
        cell={cell}
        labelClass="evidence-map__col-head-label"
        countNoun={countNoun}
        onToggle={onToggle}
        onClick={
          clickable ? () => onColumnClick(axisCategory(cell)) : undefined
        }
        registerFocusTarget={registerFocusTarget}
      />
    </th>
  );
}

function RowRailCells({
  cells,
  hoverRow,
  countNoun,
  onToggle,
  onRowClick,
  registerFocusTarget,
}: {
  cells: AxisBandCell[];
  hoverRow: string | undefined;
  countNoun: string;
  onToggle: ((key: string) => void) | undefined;
  onRowClick: ((row: AxisCategory) => void) | undefined;
  registerFocusTarget: (key: string, el: HTMLButtonElement | null) => void;
}) {
  return (
    <>
      {cells.map((cell) => {
        const isBand = cell.expanded && cell.hasChildren;
        const clickable = !isBand && onRowClick !== undefined;
        return (
          <th
            key={cell.key}
            rowSpan={cell.span > 1 ? cell.span : undefined}
            colSpan={cell.tierSpan > 1 ? cell.tierSpan : undefined}
            class={`evidence-map__row-head evidence-map__row-head--tiered${
              clickable ? " evidence-map__row-head--clickable" : ""
            }${!isBand && hoverRow === cell.key ? " is-active" : ""}`}
            scope={isBand ? "rowgroup" : "row"}
            style={{ "--evidence-map-tier-index": cell.depth }}
          >
            <TieredHeaderContent
              cell={cell}
              labelClass="evidence-map__row-head-label"
              countNoun={countNoun}
              onToggle={onToggle}
              onClick={
                clickable ? () => onRowClick(axisCategory(cell)) : undefined
              }
              registerFocusTarget={registerFocusTarget}
            />
          </th>
        );
      })}
    </>
  );
}

interface CellProps {
  empty: boolean;
  count: number;
  maxCount: number;
  view: MapView;
  tooltip: string | undefined;
  ariaLabel: string | undefined;
  rowActive: boolean;
  columnActive: boolean;
  onHover: () => void;
  onClick?: () => void;
}

function Cell({
  empty,
  count,
  maxCount,
  view,
  tooltip,
  ariaLabel,
  rowActive,
  columnActive,
  onHover,
  onClick,
}: CellProps) {
  const radius =
    view === "bubble" && !empty
      ? bubbleRadius(count, maxCount, BUBBLE_MIN_RADIUS, BUBBLE_MAX_RADIUS)
      : 0;

  const inner =
    view === "bubble" ? (
      <Bubble radius={radius} count={count} empty={empty} />
    ) : (
      <span class="evidence-map__count">
        {empty ? "" : count.toLocaleString()}
      </span>
    );

  const content = onClick ? (
    <button
      type="button"
      class="evidence-map__cell-button"
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {inner}
    </button>
  ) : (
    <span class="evidence-map__cell-inner">{inner}</span>
  );

  // Tooltip shows in both views; it no-ops when `tooltip` is undefined (a
  // non-clickable table cell, whose count is already on screen).
  const activeClass = `${rowActive ? " is-row-active" : ""}${
    columnActive ? " is-col-active" : ""
  }`;

  return (
    <td
      class={`evidence-map__cell${empty ? " is-empty" : ""}${activeClass}`}
      onMouseEnter={onHover}
    >
      <Tooltip text={tooltip}>{content}</Tooltip>
    </td>
  );
}

function Bubble({
  radius,
  count,
  empty,
}: {
  radius: number;
  count: number;
  empty: boolean;
}) {
  if (empty) {
    return <span class="evidence-map__bubble evidence-map__bubble--empty" />;
  }
  return (
    <span
      class="evidence-map__bubble"
      style={{ "--bubble-diameter": `${radius * 2}px` }}
    >
      <span class="evidence-map__bubble-count">{formatCompact(count)}</span>
    </span>
  );
}

function MapLegend({
  maxCount,
  countNoun,
}: {
  maxCount: number;
  countNoun: string;
}) {
  const ticks = legendTicks(maxCount);
  if (ticks.length === 0) return null;
  return (
    <div
      class="evidence-map__legend"
      aria-label={`Bubble scale (${countNoun})`}
    >
      <span class="evidence-map__legend-label lg-label">{countNoun}</span>
      <span class="evidence-map__legend-item">
        <span class="evidence-map__bubble evidence-map__bubble--empty" />
        <span class="evidence-map__legend-value">0</span>
      </span>
      {ticks.map((tick) => {
        const diameter =
          bubbleRadius(tick, maxCount, BUBBLE_MIN_RADIUS, BUBBLE_MAX_RADIUS) *
          2;
        return (
          <span key={tick} class="evidence-map__legend-item">
            <span
              class="evidence-map__bubble"
              style={{ width: `${diameter}px`, height: `${diameter}px` }}
            />
            <span class="evidence-map__legend-value">
              {tick.toLocaleString()}
            </span>
          </span>
        );
      })}
    </div>
  );
}
