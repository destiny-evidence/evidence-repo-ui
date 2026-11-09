import { useState } from "preact/hooks";
import { Tooltip } from "../common/Tooltip";
import "./FilterOptions.css";

const countFormatter = new Intl.NumberFormat();

/**
 * The option's count, or undefined before the first response. Once a response
 * has arrived, an option missing from it has 0 matches (terms aggregations
 * omit 0-buckets). Keyed on `counts != null` alone so greyed-out rows stay
 * greyed out through a refetch.
 */
export function resolveCount(
  counts: ReadonlyMap<string, number> | null,
  id: string,
): number | undefined {
  const raw = counts?.get(id);
  return raw !== undefined ? raw : counts != null ? 0 : undefined;
}

/**
 * Every option selected at any point in this draft. Seeded from the applied
 * selection and grown on every change, so a row whose count later drops to 0
 * can still be re-ticked after un-ticking.
 */
export function useEverSelected(
  initial: Iterable<string>,
): [ReadonlySet<string>, (next: Iterable<string>) => void] {
  const [everSelected, setEverSelected] = useState<ReadonlySet<string>>(
    () => new Set(initial),
  );
  const record = (next: Iterable<string>) => {
    setEverSelected((current) => new Set([...current, ...next]));
  };
  return [everSelected, record];
}

interface FilterOptionRowProps {
  label: string;
  labelTooltip?: string;
  count: number | undefined;
  countTooltip?: string;
  countsLoading: boolean;
  countNoun: string;
  checked: boolean;
  indeterminate?: boolean;
  everSelected: boolean;
  onToggle: () => void;
}

/** One checkbox row with its live result count. */
export function FilterOptionRow({
  label,
  labelTooltip,
  count,
  countTooltip,
  countsLoading,
  countNoun,
  checked,
  indeterminate = false,
  everSelected,
  onToggle,
}: FilterOptionRowProps) {
  // 0 + unselected = guaranteed-empty pick → disable. Rows selected now or
  // earlier in this draft stay enabled, so un-ticking one is undoable.
  const isEmpty = count === 0 && !checked && !everSelected;
  const rowClass = `filter-options__row${
    isEmpty ? " filter-options__row--empty" : ""
  }`;
  const labelNode = (
    <span
      class={`filter-options__label${
        labelTooltip ? " filter-options__label--has-tooltip" : ""
      }`}
      tabIndex={labelTooltip ? 0 : undefined}
    >
      {label}
    </span>
  );
  const countNode = count !== undefined && count > 0 && (
    <span
      class={`filter-options__count${countsLoading ? " is-updating" : ""}${
        countTooltip ? " filter-options__count--has-tooltip" : ""
      }`}
      aria-label={`${countFormatter.format(count)} ${countNoun}`}
      tabIndex={countTooltip ? 0 : undefined}
    >
      {countFormatter.format(count)}
    </span>
  );
  return (
    <label class={rowClass}>
      <input
        class="filter-options__checkbox"
        type="checkbox"
        checked={checked}
        indeterminate={indeterminate && !checked}
        disabled={isEmpty}
        onChange={onToggle}
      />
      {labelTooltip ? (
        <Tooltip text={labelTooltip}>{labelNode}</Tooltip>
      ) : (
        labelNode
      )}
      {countNode && (
        <span class="filter-options__count-slot">
          {countTooltip ? (
            <Tooltip text={countTooltip}>{countNode}</Tooltip>
          ) : (
            countNode
          )}
        </span>
      )}
    </label>
  );
}
