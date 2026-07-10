import { useCallback, useState } from "preact/hooks";

/**
 * How the selection is expressed:
 * - `include`: exactly the ids in `included` are selected.
 * - `all`: every reference matching the current search is selected, minus the
 *   ids in `excluded`. The full matching set can't be enumerated client-side
 *   (other pages aren't loaded), so it's a flag plus an exclusion set.
 */
export type SelectionMode = "include" | "all";

// `all` can't be enumerated client-side; it's resolved against the search by
// resolveSelectedReferenceIds.
export type SelectionRequest =
  | { mode: "include"; ids: string[] }
  | { mode: "all"; excludedIds: string[] };

export interface ReferenceSelection {
  mode: SelectionMode;
  /** Selected count given the total matching the search. */
  count: (total: number) => number;
  isSelected: (id: string) => boolean;
  /** Toggle one row (adds/removes from `included`, or `excluded` in `all` mode). */
  toggle: (id: string) => void;
  /** Select every reference matching the search (`all` mode). */
  selectAll: () => void;
  clear: () => void;
  toRequest: () => SelectionRequest;
}

type SelectionState =
  | { mode: "include"; included: Set<string> }
  | { mode: "all"; excluded: Set<string> };

const EMPTY: SelectionState = { mode: "include", included: new Set() };

function withToggled(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/**
 * Holds reference selection, keyed by `reference.id` so it survives pagination
 * and re-sorting. Mounted in `SelectionProvider` above the router so navigation
 * doesn't drop it; the provider clears it when the search identity changes.
 */
export function useReferenceSelection(): ReferenceSelection {
  const [state, setState] = useState<SelectionState>(EMPTY);

  const isSelected = useCallback(
    (id: string) =>
      state.mode === "include" ? state.included.has(id) : !state.excluded.has(id),
    [state],
  );

  const count = useCallback(
    (total: number) =>
      state.mode === "include"
        ? state.included.size
        : Math.max(0, total - state.excluded.size),
    [state],
  );

  const toggle = useCallback((id: string) => {
    setState((s) =>
      s.mode === "include"
        ? { mode: "include", included: withToggled(s.included, id) }
        : { mode: "all", excluded: withToggled(s.excluded, id) },
    );
  }, []);

  const selectAll = useCallback(() => {
    setState({ mode: "all", excluded: new Set() });
  }, []);

  const clear = useCallback(() => setState(EMPTY), []);

  const toRequest = useCallback(
    (): SelectionRequest =>
      state.mode === "include"
        ? { mode: "include", ids: [...state.included] }
        : { mode: "all", excludedIds: [...state.excluded] },
    [state],
  );

  return { mode: state.mode, count, isSelected, toggle, selectAll, clear, toRequest };
}
