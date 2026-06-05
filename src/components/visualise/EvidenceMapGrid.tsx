import {
  bubbleRadius,
  formatCompact,
  legendTicks,
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
  // Preformatted total (e.g. "247"); shown in the corner alongside the axes.
  total?: string;
  // When supplied, cells become clickable buttons.
  onCellClick?: (row: AxisCategory, column: AxisCategory) => void;
}

// Just the count for now; the row and column are evident from the headers and
// the dot's position. A line about where clicking navigates will follow.
function cellTooltip(count: number | undefined, countNoun: string): string {
  return `${(count ?? 0).toLocaleString()} ${countNoun}`;
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
  onCellClick,
}: EvidenceMapGridProps) {
  return (
    <div class="evidence-map">
      <div class="evidence-map__scroll">
        <table class={`evidence-map__table evidence-map__table--${view}`}>
          <thead>
            <tr>
              <th class="evidence-map__corner" scope="col">
                {total !== undefined && (
                  <span class="evidence-map__total">
                    <span class="evidence-map__total-count">{total}</span>{" "}
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
                    <span class="evidence-map__axis-name">
                      {columnAxisLabel}
                    </span>
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
              </th>
              {columns.map((column) => (
                <th key={column.key} class="evidence-map__col-head" scope="col">
                  <span class="evidence-map__col-head-label">
                    {column.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th class="evidence-map__row-head" scope="row">
                  {row.label}
                </th>
                {columns.map((column) => {
                  const count = getCount(row.key, column.key);
                  const empty = count === undefined || count <= 0;
                  return (
                    <Cell
                      key={column.key}
                      empty={empty}
                      count={count ?? 0}
                      maxCount={maxCount}
                      view={view}
                      tooltip={cellTooltip(count, countNoun)}
                      onClick={
                        onCellClick && !empty
                          ? () => onCellClick(row, column)
                          : undefined
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

interface CellProps {
  empty: boolean;
  count: number;
  maxCount: number;
  view: MapView;
  tooltip: string;
  onClick?: () => void;
}

function Cell({ empty, count, maxCount, view, tooltip, onClick }: CellProps) {
  // Bubble radius drives the tooltip/tail anchor (--evidence-map-dot): the dot
  // is centred in the cell, so the tail points at it rather than the cell edge.
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
    <button type="button" class="evidence-map__cell-button" onClick={onClick}>
      {inner}
    </button>
  ) : (
    <span class="evidence-map__cell-inner">{inner}</span>
  );

  // No tooltip on the table view yet — the count is already shown in the cell.
  // It returns once cells carry a second value beyond the count; the `tooltip`
  // prop stays wired so that's a one-line change to the condition below.
  return (
    <td
      class={`evidence-map__cell${empty ? " is-empty" : ""}`}
      style={{ "--evidence-map-dot": `${radius}px` }}
    >
      {view === "bubble" ? (
        <Tooltip text={tooltip}>{content}</Tooltip>
      ) : (
        content
      )}
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
