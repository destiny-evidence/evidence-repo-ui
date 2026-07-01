import { createContext, type ComponentChildren } from "preact";
import { useCallback, useContext, useRef } from "preact/hooks";
import {
  useReferenceSelection,
  type ReferenceSelection,
} from "@/hooks/useReferenceSelection";

export interface SelectionContextValue extends ReferenceSelection {
  /**
   * Clear the selection when the search identity changes. The identity should
   * encode community + query + filters (not page/sort). Called from the search
   * page; because this provider lives above the router it isn't remounted on
   * navigation, so paging/sorting keeps the selection and only a genuinely new
   * search clears it.
   */
  syncSearchIdentity: (identity: string) => void;
}

const SelectionCtx = createContext<SelectionContextValue | undefined>(undefined);

/**
 * Owns reference selection above the router so it survives navigation (paging,
 * sorting, visiting a record and returning). Mirrors AiSummaryProvider.
 */
export function SelectionProvider({ children }: { children: ComponentChildren }) {
  const selection = useReferenceSelection();
  const identityRef = useRef<string | null>(null);
  const { clear } = selection;

  const syncSearchIdentity = useCallback(
    (identity: string) => {
      if (identityRef.current === identity) return;
      identityRef.current = identity;
      clear();
    },
    [clear],
  );

  return (
    <SelectionCtx.Provider value={{ ...selection, syncSearchIdentity }}>
      {children}
    </SelectionCtx.Provider>
  );
}

export function useSelectionContext(): SelectionContextValue {
  const value = useContext(SelectionCtx);
  if (value === undefined) {
    throw new Error("useSelectionContext must be used within a SelectionProvider");
  }
  return value;
}
