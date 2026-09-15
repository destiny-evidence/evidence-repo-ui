import { Drawer } from "@/components/common/Drawer";
import { FilterCardList, type FilterCardOptions } from "./FilterCardList";
import { FilterActions } from "./FilterActions";
import {
  useFilterDraft,
  type AppliedFilters,
  type FilterDraftInputs,
} from "./useFilterDraft";
import { track } from "@/analytics/matomo";
import "./FilterDrawer.css";

export type { AppliedFilters };

interface FilterDrawerProps extends FilterDraftInputs, FilterCardOptions {
  open: boolean;
  title?: string;
  onApply: (next: AppliedFilters) => void;
  onCancel: () => void;
}

// Gates hook execution on `open` — users who never refine don't fetch facets.
export function FilterDrawer({ open, ...rest }: FilterDrawerProps) {
  if (!open) return null;
  return <FilterDrawerPanel {...rest} />;
}

type FilterDrawerPanelProps = Omit<FilterDrawerProps, "open">;

function FilterDrawerPanel({
  title = "Refine the evidence",
  schemes,
  appliedConceptFilters,
  appliedCountryCodes,
  appliedStartYear,
  appliedEndYear,
  params,
  onApply,
  onCancel,
  ...cardOptions
}: FilterDrawerPanelProps) {
  const draft = useFilterDraft({
    schemes,
    appliedConceptFilters,
    appliedCountryCodes,
    appliedStartYear,
    appliedEndYear,
    params,
  });

  function handleApply() {
    const applied = draft.buildApplied();
    if (applied) onApply(applied);
  }

  return (
    <Drawer
      open
      block="filter-drawer"
      title={title}
      // "*" is the browse-mode sentinel — don't echo it as a query.
      subtitle={
        params.q !== "" && params.q !== "*" ? (
          <p class="drawer__subtitle">
            Searching for “{params.q}”
          </p>
        ) : undefined
      }
      headerAction={
        <button
          type="button"
          class="filter-actions__btn filter-actions__btn--reset"
          onClick={onCancel}
        >
          Cancel
        </button>
      }
      footer={
        <FilterActions
          onReset={() => {
            track({ category: "Filters", action: "Reset All" });
            draft.reset();
          }}
          onApply={handleApply}
          applyDisabled={!draft.canApply}
        />
      }
      onClose={onCancel}
    >
      <FilterCardList draft={draft} {...cardOptions} />
    </Drawer>
  );
}
