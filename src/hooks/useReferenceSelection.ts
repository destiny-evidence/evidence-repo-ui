import { useCallback, useState } from "preact/hooks";

/**
 * How the selection is expressed:
 * - `include`: exactly the ids in `included` are selected.
 * - `all`: every reference matching the current search is selected, minus the
 *   ids in `excluded`. The full matching set can't be enumerated client-side
 *   (other pages aren't loaded), so it's a flag plus an exclusion set; a
 *   consumer resolves the concrete list at submit time — `include` sends
 *   `included`, `all` sends every matching id minus `excluded`.
 */
export type SelectionMode = "include" | "all";

/** State of the master checkbox for the references currently on screen. */
export type MasterState = "none" | "some" | "all";

export interface ReferenceSelection {
  mode: SelectionMode;
  /** Selected ids (meaningful in `include` mode). */
  included: ReadonlySet<string>;
  /** Deselected ids after selecting everything (meaningful in `all` mode). */
  excluded: ReadonlySet<string>;
  /** Selected count given the total matching the search. */
  count: (total: number) => number;
  isSelected: (id: string) => boolean;
  masterState: (visibleIds: string[]) => MasterState;
  /** Toggle one row (adds/removes from `included`, or `excluded` in `all` mode). */
  toggle: (id: string) => void;
  /** Add or remove a whole page of ids, keeping any existing selection. */
  setPageSelected: (visibleIds: string[], selected: boolean) => void;
  /** Select every reference matching the search (`all` mode). */
  selectAllPages: () => void;
  clear: () => void;
}

interface SelectionState {
  mode: SelectionMode;
  included: Set<string>;
  excluded: Set<string>;
}

const EMPTY: SelectionState = {
  mode: "include",
  included: new Set(),
  excluded: new Set(),
};

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

  const masterState = useCallback(
    (visibleIds: string[]): MasterState => {
      if (visibleIds.length === 0) return "none";
      const selected = visibleIds.filter(isSelected).length;
      if (selected === 0) return "none";
      if (selected === visibleIds.length) return "all";
      return "some";
    },
    [isSelected],
  );

  const toggle = useCallback((id: string) => {
    setState((s) =>
      s.mode === "include"
        ? { ...s, included: withToggled(s.included, id) }
        : { ...s, excluded: withToggled(s.excluded, id) },
    );
  }, []);

  const setPageSelected = useCallback((visibleIds: string[], selected: boolean) => {
    setState((s) => {
      if (s.mode === "include") {
        const included = new Set(s.included);
        for (const id of visibleIds) {
          if (selected) included.add(id);
          else included.delete(id);
        }
        return { ...s, included };
      }
      // In `all` mode, selecting means clearing exclusions, deselecting means
      // adding them.
      const excluded = new Set(s.excluded);
      for (const id of visibleIds) {
        if (selected) excluded.delete(id);
        else excluded.add(id);
      }
      return { ...s, excluded };
    });
  }, []);

  const selectAllPages = useCallback(() => {
    setState({ mode: "all", included: new Set(), excluded: new Set() });
  }, []);

  const clear = useCallback(() => setState(EMPTY), []);

  return {
    mode: state.mode,
    included: state.included,
    excluded: state.excluded,
    count,
    isSelected,
    masterState,
    toggle,
    setPageSelected,
    selectAllPages,
    clear,
  };
}
