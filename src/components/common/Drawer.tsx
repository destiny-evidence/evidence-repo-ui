import { useEffect, useId, useRef } from "preact/hooks";
import type { ComponentChildren } from "preact";
import "./Drawer.css";

interface DrawerProps {
  open: boolean;
  /** Drawer heading. */
  title: string;
  /** Inline element shown beside the title, e.g. a "BETA" chip. */
  titleAdornment?: ComponentChildren;
  /** Content under the title row (a query nudge, context chips, …). */
  subtitle?: ComponentChildren;
  /** Right-aligned header control, e.g. a Cancel or Close button. */
  headerAction?: ComponentChildren;
  /** Full footer element; rendered after the scrolling body. */
  footer?: ComponentChildren;
  /**
   * BEM block name for per-drawer styling/targeting. When set, each structural
   * node also carries a `${block}__…` companion class alongside the shared
   * `drawer__…` class, so consumers can override width/padding and tests can
   * bind to a stable selector.
   */
  block?: string;
  /** Close when the backdrop is clicked. Off by default (matches FilterDrawer). */
  closeOnBackdrop?: boolean;
  onClose: () => void;
  children: ComponentChildren;
}

/**
 * Right-anchored slide-over shell shared by the filter and AI-summary drawers.
 * Owns the modal mechanics — body scroll-lock, focus capture/restore,
 * Escape-to-close, backdrop — and the header/body/footer structure, while the
 * content and footer are supplied by the caller.
 *
 * Gating on `open` mounts the panel fresh each time it opens (so caller state
 * resets) and keeps the caller's body hooks from running while closed.
 */
export function Drawer({ open, ...rest }: DrawerProps) {
  if (!open) return null;
  return <DrawerPanel {...rest} />;
}

type DrawerPanelProps = Omit<DrawerProps, "open">;

function DrawerPanel({
  title,
  titleAdornment,
  subtitle,
  headerAction,
  footer,
  block,
  closeOnBackdrop = false,
  onClose,
  children,
}: DrawerPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<Element | null>(document.activeElement);
  const titleId = useId();

  // Shared `drawer__x` class plus an optional `${block}__x` companion.
  const bem = (suffix: string) => {
    const shared = suffix ? `drawer__${suffix}` : "drawer";
    if (!block) return shared;
    return `${shared} ${suffix ? `${block}__${suffix}` : block}`;
  };

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    panelRef.current?.focus();
    return () => {
      const target = previousFocusRef.current;
      if (target instanceof HTMLElement) target.focus();
    };
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div class={bem("")} role="presentation">
      <div
        class={bem("backdrop")}
        aria-hidden="true"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <aside
        ref={panelRef}
        class={bem("panel")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header class={bem("header")}>
          <div class={bem("heading")}>
            <div class={bem("titlerow")}>
              <h2 id={titleId} class={bem("title")}>
                {title}
              </h2>
              {titleAdornment}
            </div>
            {subtitle}
          </div>
          {headerAction}
        </header>

        <div class={bem("body")}>{children}</div>

        {footer}
      </aside>
    </div>
  );
}
