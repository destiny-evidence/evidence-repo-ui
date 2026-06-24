/** Triangle with exclamation mark — used for warnings and retracted state. */
export function WarningIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <path
        fill-rule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
        clip-rule="evenodd"
      />
    </svg>
  );
}

/** Magnifier — used as the search-bar leading icon. */
export function MagnifierIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <circle cx="9" cy="9" r="6" />
      <path d="m13.5 13.5 4 4" />
    </svg>
  );
}

/** Three horizontal sliders — used to denote a filter/refine control. */
export function FilterIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <path d="M3 5h10" />
      <path d="M16 5h1" />
      <path d="M3 10h4" />
      <path d="M10 10h7" />
      <path d="M3 15h10" />
      <path d="M16 15h1" />
      <circle cx="14.5" cy="5" r="1.75" fill="currentColor" />
      <circle cx="8.5" cy="10" r="1.75" fill="currentColor" />
      <circle cx="14.5" cy="15" r="1.75" fill="currentColor" />
    </svg>
  );
}

/**
 * Chevron pointing right — used to indicate a collapsed disclosure.
 * Sizes to the surrounding text by default so it tracks the header.
 */
export function ChevronRightIcon({ size = "1em" }: { size?: number | string } = {}) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <path d="m7 4 6 6-6 6" />
    </svg>
  );
}

/**
 * Chevron pointing down — used to indicate an expanded disclosure.
 * Sizes to the surrounding text by default so it tracks the header.
 */
export function ChevronDownIcon({ size = "1em" }: { size?: number | string } = {}) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <path d="m4 7 6 6 6-6" />
    </svg>
  );
}

/** Tray with a down arrow — used on download actions. */
export function DownloadIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <path d="M10 3v9" />
      <path d="m6 8.5 4 4 4-4" />
      <path d="M3.5 15.5h13" />
    </svg>
  );
}

/** Arrow pointing to upper-right — indicates an external link. */
export function ExternalLinkIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <path
        d="M3.5 1.5h7v7M10.5 1.5L1.5 10.5"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}
