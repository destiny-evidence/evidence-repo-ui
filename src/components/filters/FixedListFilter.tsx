import { useState } from "preact/hooks";
import "./ConceptSchemeFilter.css";

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

const countFormatter = new Intl.NumberFormat();

/**
 * A short, fixed list of checkbox rows (e.g. World Bank income groups), always
 * shown in the given order. Styled like a concept-scheme card: rows with no
 * results are greyed out and disabled unless selected.
 */
export function FixedListFilter({
  options,
  selected,
  counts = null,
  countsLoading = false,
  countNoun = "results",
  onChange,
}: FixedListFilterProps) {
  // Seeded from the applied selection and grown on every toggle, so a row
  // whose count later drops to 0 can still be re-ticked after un-ticking.
  const [everSelected, setEverSelected] = useState<ReadonlySet<string>>(
    () => new Set(selected),
  );

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (!next.delete(id)) next.add(id);
    setEverSelected((current) => new Set([...current, ...next]));
    onChange(next);
  };

  const countClass = `concept-scheme-filter__count${
    countsLoading ? " is-updating" : ""
  }`;

  return (
    <ul class="concept-scheme-filter">
      {options.map(({ id, name }) => {
        const rawCount = counts?.get(id);
        // Once a response has arrived, an id missing from it has 0 matches.
        const count: number | undefined =
          rawCount !== undefined ? rawCount : counts != null ? 0 : undefined;
        const isSelected = selected.has(id);
        const isEmpty = count === 0 && !isSelected && !everSelected.has(id);
        const rowClass = `concept-scheme-filter__row${
          isEmpty ? " concept-scheme-filter__row--empty" : ""
        }`;
        return (
          <li key={id} class="concept-scheme-filter__item">
            <label class={rowClass}>
              <input
                class="concept-scheme-filter__checkbox"
                type="checkbox"
                checked={isSelected}
                disabled={isEmpty}
                onChange={() => toggle(id)}
              />
              <span class="concept-scheme-filter__label">{name}</span>
              {count !== undefined && count > 0 && (
                <span class="concept-scheme-filter__count-slot">
                  <span
                    class={countClass}
                    aria-label={`${countFormatter.format(count)} ${countNoun}`}
                  >
                    {countFormatter.format(count)}
                  </span>
                </span>
              )}
            </label>
          </li>
        );
      })}
    </ul>
  );
}
