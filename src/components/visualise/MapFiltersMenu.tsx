import { useId, useMemo, useRef, useState } from "preact/hooks";
import { useDismiss } from "@/hooks/useDismiss";
import { useKeepInViewport } from "@/hooks/useKeepInViewport";
import { ChevronDownIcon, FilterIcon } from "@/components/common/icons";
import { TagGroup, type HierarchicalTag } from "@/components/common/TagGroup";
import {
  indexConceptPaths,
  parseConceptFilters,
  selectedUris,
} from "@/components/filters/conceptSchemeFilterState";
import {
  summary as yearSummary,
  yearRangeFromParams,
} from "@/components/filters/yearRangeFilterState";
import { localName } from "@/services/evidenceMap";
import {
  schemeDisplayLabel,
  type ConceptScheme,
} from "@/services/vocabulary/vocabularyService";
import type { SearchParams } from "@/services/searchParams";
import { countryName } from "@/utils/country";
import "@/components/search/ExportMenu.css";
import "@/components/search/RefineButton.css";
import "./MapScopeMenus.css";

interface FilterGroup {
  name: string;
  values: (string | HierarchicalTag)[];
}

// The applied filters, grouped the way the panel's cards group them. Concepts
// the vocabulary can't place (or a vocabulary that failed) still get listed.
function filterGroups(
  params: SearchParams,
  schemes: ConceptScheme[],
): FilterGroup[] {
  const paths = indexConceptPaths(schemes);
  // A nested concept carries its parent as a breadcrumb, as on the record page.
  const conceptTag = (uri: string): HierarchicalTag => {
    const path = paths.get(uri);
    return {
      parent: path && path.length > 1 ? path.at(-2) : undefined,
      label: path?.at(-1) ?? localName(uri),
    };
  };
  const groups: FilterGroup[] = [];
  const placed = new Set<string>();
  const bySchemeUri = parseConceptFilters(params.conceptFilters, schemes);
  for (const scheme of schemes) {
    const state = bySchemeUri.get(scheme.uri);
    if (!state) continue;
    const uris = selectedUris(state);
    uris.forEach((uri) => placed.add(uri));
    groups.push({
      name: schemeDisplayLabel(scheme.label),
      values: uris.map(conceptTag),
    });
  }
  const unplaced = params.conceptFilters
    .flat()
    .filter((uri) => !placed.has(uri));
  if (unplaced.length > 0) {
    groups.push({ name: "Other", values: unplaced.map(conceptTag) });
  }
  if (params.countryCodes.length > 0) {
    groups.push({
      name: "Countries",
      values: params.countryCodes.map(countryName),
    });
  }
  const years = yearSummary(
    yearRangeFromParams(params.startYear, params.endYear),
  );
  if (years) groups.push({ name: "Publication year", values: [years] });
  return groups;
}

interface MapFiltersMenuProps {
  params: SearchParams;
  count: number;
  schemes: ConceptScheme[];
  onEditInPanel: () => void;
}

/**
 * A read-only list of the map's filters; editing them happens in the panel.
 */
export function MapFiltersMenu({
  params,
  count,
  schemes,
  onEditInPanel,
}: MapFiltersMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const groups = useMemo(
    () => filterGroups(params, schemes),
    [params, schemes],
  );

  useDismiss(open, setOpen, containerRef, buttonRef);
  useKeepInViewport(open, panelRef);

  return (
    <div class="export-menu map-scope-menu" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        class="refine-btn"
        aria-expanded={open ? "true" : "false"}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <FilterIcon size={14} />
        <span class="refine-btn__label">Filters</span>
        {count > 0 && <span class="refine-btn__count">{count}</span>}
        <span
          class={`export-button__caret${open ? " is-open" : ""}`}
          aria-hidden="true"
        >
          <ChevronDownIcon size={12} />
        </span>
      </button>

      {open && (
        <div
          ref={panelRef}
          class="export-menu__panel map-scope-menu__panel"
          id={panelId}
          role="group"
          aria-label="Applied filters"
        >
          <p class="export-menu__label">Applied filters</p>
          {groups.length > 0 ? (
            <dl class="map-filters-menu__groups">
              {groups.map((group) => (
                <div class="map-filters-menu__group" key={group.name}>
                  <dt class="lg-label">{group.name}</dt>
                  <dd>
                    <TagGroup tags={group.values} />
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p class="map-filters-menu__none">None applied</p>
          )}
          <div class="map-scope-menu__footer">
            <button
              type="button"
              class="map-scope-menu__link"
              onClick={() => {
                setOpen(false);
                onEditInPanel();
              }}
            >
              Configure in panel <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
