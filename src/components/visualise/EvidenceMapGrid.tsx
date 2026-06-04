import {
  bubbleRadius,
  legendTicks,
  type AxisCategory,
} from "@/services/evidenceMap";
import type { MapView } from "./ViewToggle";
import "./EvidenceMapGrid.css";

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

// An absent count means no reference carries that (row, column) pair — zero.
function cellTooltip(
  rowLabel: string,
  columnLabel: string,
  count: number | undefined,
  countNoun: string,
): string {
  return `${rowLabel} · ${columnLabel}: ${(count ?? 0).toLocaleString()} ${countNoun}`;
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
              </th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  class="evidence-map__col-head"
                  scope="col"
                  title={column.label}
                >
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
                      tooltip={cellTooltip(
                        row.label,
                        column.label,
                        count,
                        countNoun,
                      )}
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
      {view === "bubble" && <MapLegend maxCount={maxCount} countNoun={countNoun} />}
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
  const inner =
    view === "bubble" ? (
      <Bubble count={count} maxCount={maxCount} empty={empty} />
    ) : (
      <span class="evidence-map__count">
        {empty ? "" : count.toLocaleString()}
      </span>
    );

  return (
    <td class={`evidence-map__cell${empty ? " is-empty" : ""}`}>
      {onClick ? (
        <button
          type="button"
          class="evidence-map__cell-button"
          title={tooltip}
          onClick={onClick}
        >
          {inner}
        </button>
      ) : (
        <div class="evidence-map__cell-inner" title={tooltip}>
          {inner}
        </div>
      )}
    </td>
  );
}

function Bubble({
  count,
  maxCount,
  empty,
}: {
  count: number;
  maxCount: number;
  empty: boolean;
}) {
  // Empty intersections render a faint dashed marker, matching the legend's 0.
  if (empty) {
    return <span class="evidence-map__bubble evidence-map__bubble--empty" />;
  }
  const diameter = bubbleRadius(count, maxCount) * 2;
  return (
    <span
      class="evidence-map__bubble"
      style={{ width: `${diameter}px`, height: `${diameter}px` }}
    >
      <span class="visually-hidden">{count.toLocaleString()}</span>
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
    <div class="evidence-map__legend" aria-label={`Bubble scale (${countNoun})`}>
      <span class="evidence-map__legend-label lg-label">{countNoun}</span>
      <span class="evidence-map__legend-item">
        <span class="evidence-map__bubble evidence-map__bubble--empty" />
        <span class="evidence-map__legend-value">0</span>
      </span>
      {ticks.map((tick) => {
        const diameter = bubbleRadius(tick, maxCount) * 2;
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
