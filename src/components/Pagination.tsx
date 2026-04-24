import "./Pagination.css";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

type Item = { kind: "page"; page: number } | { kind: "ellipsis"; id: string };

// Pages shown on each side of the current page in the ellipsis form.
const NEIGHBORS = 1;
// Full shape: [first, …, current-N, …, current, …, current+N, …, last]
// → 2 edges + 2 ellipses + (2N+1) window slots. Below this total, we render
// every page (no ellipsis savings possible).
const ELLIPSIS_SHAPE_WIDTH = 4 + (NEIGHBORS * 2 + 1);

function computeItems(current: number, total: number): Item[] {
  if (total <= ELLIPSIS_SHAPE_WIDTH) {
    return Array.from({ length: total }, (_, i) => ({ kind: "page" as const, page: i + 1 }));
  }

  const items: Item[] = [{ kind: "page", page: 1 }];

  let start: number;
  let end: number;
  if (current <= NEIGHBORS + 2) {
    // Near-start: anchor window to page 2 so there's no left ellipsis
    // adjacent to page 1 (avoids the [1, …, 2, …, last] awkwardness).
    start = 2;
    end = NEIGHBORS + 2;
  } else if (current >= total - NEIGHBORS - 1) {
    // Near-end: mirror the near-start rule against the last page.
    start = total - NEIGHBORS - 1;
    end = total - 1;
  } else {
    // Middle: window centered on current.
    start = current - NEIGHBORS;
    end = current + NEIGHBORS;
  }

  if (start > 2) items.push({ kind: "ellipsis", id: "left" });
  for (let p = start; p <= end; p++) items.push({ kind: "page", page: p });
  if (end < total - 1) items.push({ kind: "ellipsis", id: "right" });
  items.push({ kind: "page", page: total });

  return items;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const items = computeItems(currentPage, totalPages);

  return (
    <nav class="pagination" aria-label="Pagination">
      <button
        type="button"
        class="pagination__ctrl"
        aria-label="Previous page"
        disabled={disabled || currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        ←
      </button>
      {items.map((it) =>
        it.kind === "ellipsis" ? (
          <span key={it.id} class="pagination__ellipsis" aria-hidden="true">…</span>
        ) : (
          <button
            key={it.page}
            type="button"
            class={`pagination__page${it.page === currentPage ? " active" : ""}`}
            aria-label={`Page ${it.page}`}
            aria-current={it.page === currentPage ? "page" : undefined}
            disabled={disabled}
            onClick={() => onPageChange(it.page)}
          >
            {it.page}
          </button>
        ),
      )}
      <button
        type="button"
        class="pagination__ctrl"
        aria-label="Next page"
        disabled={disabled || currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        →
      </button>
    </nav>
  );
}
