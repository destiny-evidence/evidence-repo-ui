import { FilterOptionRow, resolveCount, useEverSelected } from "./FilterOptions";

export interface FixedListOption {
  id: string;
  name: string;
}

interface FixedListFilterProps {
  options: readonly FixedListOption[];
  selected: ReadonlySet<string>;
  counts?: ReadonlyMap<string, number> | null;
  countsLoading?: boolean;
  countNoun?: string;
  onChange: (next: ReadonlySet<string>) => void;
}

/**
 * A short, fixed list of checkbox rows (e.g. World Bank income groups), always
 * shown in the given order.
 */
export function FixedListFilter({
  options,
  selected,
  counts = null,
  countsLoading = false,
  countNoun = "results",
  onChange,
}: FixedListFilterProps) {
  const [everSelected, recordSelected] = useEverSelected(selected);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (!next.delete(id)) next.add(id);
    recordSelected(next);
    onChange(next);
  };

  return (
    <ul class="filter-options">
      {options.map(({ id, name }) => (
        <li key={id} class="filter-options__item">
          <FilterOptionRow
            label={name}
            count={resolveCount(counts, id)}
            countsLoading={countsLoading}
            countNoun={countNoun}
            checked={selected.has(id)}
            everSelected={everSelected.has(id)}
            onToggle={() => toggle(id)}
          />
        </li>
      ))}
    </ul>
  );
}
