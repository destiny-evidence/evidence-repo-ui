import type { RefObject } from "preact";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";
import type { WorldGeometry } from "./geo/worldGeometry";
import {
  bandLabel,
  formatShare,
  heatBands,
  heatShade,
  placePopup,
  type HeatBand,
  type Point,
} from "@/services/geoHeatMap";
import { countryName } from "@/utils/country";
import { Spinner } from "@/components/common/Spinner";
import { useDismiss } from "@/hooks/useDismiss";
import "@/components/common/Tooltip.css";
import "./GeographicHeatMap.css";

const DOT_RADIUS = 2.5;
const DOT_TARGET_RADIUS = 6;
const POPUP_GAP = 12;
const TIP_GAP = 8;
const ARROW_STEPS: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

// Loaded on first use so d3-geo and the shapes stay out of the main bundle.
let loaded: WorldGeometry | null = null;
function loadGeometry(): Promise<WorldGeometry> {
  return import("./geo/worldGeometry").then(
    (m) => (loaded = m.loadWorldGeometry()),
  );
}

export interface GeographicHeatMapProps {
  // Reference counts keyed by ISO alpha-2 code; undefined until they first load.
  counts: ReadonlyMap<string, number> | undefined;
  label: string;
  countNoun: string;
  // Unique references on the map, which each country's share is out of.
  total: number;
  viewHref: (code: string) => string;
  onSelect?: (code: string) => void;
  // Every click on a country's View link, plain or modified, before it navigates.
  onView: (code: string, event: MouseEvent) => void;
}

export function GeographicHeatMap({
  counts,
  ...props
}: GeographicHeatMapProps) {
  const [geometry, setGeometry] = useState(loaded);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (geometry) return;
    let cancelled = false;
    loadGeometry().then(
      (g) => !cancelled && setGeometry(g),
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <figure class="geo-heat-map">
        <div class="geo-heat-map__frame">
          <p class="geo-heat-map__status" role="alert">
            Couldn’t load the map.
          </p>
        </div>
      </figure>
    );
  }

  // Waits for both shapes and counts so the map doesn't draw empty and then fill.
  if (!geometry || !counts) {
    return (
      <figure class="geo-heat-map">
        <div class="geo-heat-map__frame">
          <p class="geo-heat-map__status" role="status">
            <Spinner size={20} />
            Loading map…
          </p>
        </div>
      </figure>
    );
  }

  return <HeatMap geometry={geometry} counts={counts} {...props} />;
}

interface Target {
  anchor: Point;
  shape: { d: string } | { cx: number; cy: number };
}

function HeatMap({
  geometry,
  counts,
  label,
  countNoun,
  total,
  viewHref,
  onSelect,
  onView,
}: GeographicHeatMapProps & {
  geometry: WorldGeometry;
  counts: ReadonlyMap<string, number>;
}) {
  const bands = useMemo(
    () => heatBands(Math.max(0, ...counts.values())),
    [counts],
  );
  // Exclude dots for countries with no references
  const dots = useMemo(
    () => geometry.dots.filter((d) => (counts.get(d.code) ?? 0) > 0),
    [geometry, counts],
  );
  const dotCodes = useMemo(() => new Set(dots.map((d) => d.code)), [dots]);

  // Countries with references, which are the ones that can be selected.
  const targets = useMemo(() => {
    const byCode = new Map<string, Target>();
    for (const { code, d, anchor } of geometry.countries) {
      if (code && !dotCodes.has(code) && (counts.get(code) ?? 0) > 0) {
        byCode.set(code, { anchor, shape: { d } });
      }
    }
    for (const { code, x, y } of dots) {
      byCode.set(code, { anchor: { x, y }, shape: { cx: x, cy: y } });
    }
    return byCode;
  }, [geometry, counts, dots, dotCodes]);
  // The order the arrow keys step through them.
  const order = useMemo(
    () =>
      [...targets.keys()].sort((a, b) =>
        countryName(a).localeCompare(countryName(b)),
      ),
    [targets],
  );

  // Held with the counts it was made on, so new counts drop it as they render.
  const [selection, setSelection] = useState<{
    code: string;
    counts: ReadonlyMap<string, number>;
  } | null>(null);
  const selected =
    selection?.counts === counts && targets.has(selection.code)
      ? selection.code
      : null;
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const tabStop = active && targets.has(active) ? active : order[0];

  const frameRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState(0);
  const countryElement = (code: string) =>
    frameRef.current?.querySelector<SVGElement>(`[data-country="${code}"]`) ??
    null;

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setLayout((n) => n + 1));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const selectedRef = useRef<SVGElement | null>(null);
  selectedRef.current = selected ? countryElement(selected) : null;
  const setOpen = useCallback((open: boolean) => {
    if (!open) setSelection(null);
  }, []);
  useDismiss(selected !== null, setOpen, popupRef, selectedRef, isCountry);

  function close() {
    setSelection(null);
    selectedRef.current?.focus();
  }

  const [vbX, vbY, vbWidth, vbHeight] = geometry.viewBox.split(" ").map(Number);
  function inFrame({ x, y }: Point, frame: HTMLElement): Point {
    return {
      x: ((x - vbX) / vbWidth) * frame.clientWidth,
      y: ((y - vbY) / vbHeight) * frame.clientHeight,
    };
  }

  useLayoutEffect(() => {
    const popup = popupRef.current;
    const frame = frameRef.current;
    const target = selected && targets.get(selected);
    if (!popup || !frame || !target) return;
    const placement = placePopup(
      inFrame(target.anchor, frame),
      { width: popup.offsetWidth, height: popup.offsetHeight },
      { width: frame.clientWidth, height: frame.clientHeight },
      POPUP_GAP,
    );
    popup.style.left = `${placement.left}px`;
    popup.style.top = `${placement.top}px`;
    popup.style.setProperty("--pointer-top", `${placement.pointerTop}px`);
    if (placement.side) popup.dataset.side = placement.side;
    else delete popup.dataset.side;
  }, [selected, targets, layout]);

  const tipCode = selected ? null : (hovered ?? focused);
  useLayoutEffect(() => {
    const tip = tipRef.current;
    const frame = frameRef.current;
    const target = tipCode && targets.get(tipCode);
    if (!tip || !frame || !target) return;
    const { x, y } = inFrame(target.anchor, frame);
    const { offsetWidth: width, offsetHeight: height } = tip;
    const left = Math.max(0, Math.min(x - width / 2, frame.clientWidth - width));
    const above = y - TIP_GAP - height;
    tip.style.left = `${left}px`;
    tip.style.top = `${above >= 0 ? above : y + TIP_GAP}px`;
  }, [tipCode, targets, layout]);

  function select(code: string) {
    if (selected === code) {
      setSelection(null);
      return;
    }
    setSelection({ code, counts });
    onSelect?.(code);
  }

  function handleKeyDown(e: KeyboardEvent) {
    const code = countryOf(e.target);
    if (!code) return;
    const step = ARROW_STEPS[e.key];
    if (step) {
      e.preventDefault();
      const next = order[order.indexOf(code) + step];
      if (next) {
        setActive(next);
        countryElement(next)?.focus();
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      select(code);
    }
  }

  function handleFocus(e: FocusEvent) {
    const code = countryOf(e.target);
    setFocused(code);
    if (code) setActive(code);
  }

  // Handlers live on the frame rather than each country, so hover and focus
  // changes leave this layer alone.
  const countryLayer = useMemo(() => {
    const countryLabel = (code: string) => {
      const count = counts.get(code) ?? 0;
      return `${countryName(code)}: ${count > 0 ? count.toLocaleString() : "no"} ${countNoun}`;
    };
    const shade = (code: string) => heatShade(counts.get(code) ?? 0, bands);
    const selectable = (code: string) => ({
      "data-country": code,
      role: "button" as const,
      tabindex: code === tabStop ? 0 : -1,
      "aria-label": countryLabel(code),
      "aria-haspopup": "dialog" as const,
      "aria-expanded": selected === code,
    });

    return (
      <g>
        <path
          class="geo-heat-map__outline"
          d={geometry.outline}
          aria-hidden="true"
        />
        {geometry.countries.map(({ code, d }, i) =>
          code && targets.has(code) && !dotCodes.has(code) ? (
            <path
              key={code}
              class="geo-heat-map__country is-selectable"
              d={d}
              data-shade={shade(code)}
              {...selectable(code)}
            />
          ) : code && !dotCodes.has(code) ? (
            <path
              key={code}
              class="geo-heat-map__country"
              d={d}
              data-shade={shade(code)}
              role="img"
              aria-label={countryLabel(code)}
            />
          ) : (
            <path
              key={code ?? `unkeyed-${i}`}
              class="geo-heat-map__country"
              d={d}
              data-shade={code ? shade(code) : 0}
              aria-hidden="true"
            />
          ),
        )}
        <path
          class="geo-heat-map__borders"
          d={geometry.borders}
          aria-hidden="true"
        />
        {dots.map(({ code, x, y }) => (
          <circle
            key={code}
            class="geo-heat-map__dot"
            cx={x}
            cy={y}
            r={DOT_RADIUS}
            data-shade={shade(code)}
            aria-hidden="true"
          />
        ))}
        {/* Wider than the dots themselves so small countries can be hit. */}
        {dots.map(({ code, x, y }) => (
          <circle
            key={code}
            class="geo-heat-map__dot-target is-selectable"
            cx={x}
            cy={y}
            r={DOT_TARGET_RADIUS}
            {...selectable(code)}
          />
        ))}
      </g>
    );
  }, [geometry, counts, countNoun, bands, targets, dots, dotCodes, tabStop, selected]);

  const highlight = (code: string, isSelected: boolean) => {
    const target = targets.get(code);
    if (!target) return null;
    const cls = `geo-heat-map__highlight${isSelected ? " is-selected" : ""}`;
    return "d" in target.shape ? (
      <path key={code} class={cls} d={target.shape.d} aria-hidden="true" />
    ) : (
      <circle
        key={code}
        class={cls}
        cx={target.shape.cx}
        cy={target.shape.cy}
        r={DOT_RADIUS}
        aria-hidden="true"
      />
    );
  };

  return (
    <figure class="geo-heat-map is-loaded">
      {/* Chrome makes SVG elements with focus listeners focusable, so these
          sit on the frame rather than the SVG. */}
      <div
        class="geo-heat-map__frame"
        ref={frameRef}
        onClick={(e) => {
          const code = countryOf(e.target);
          if (code) select(code);
        }}
        onKeyDown={handleKeyDown}
        onMouseOver={(e) => setHovered(countryOf(e.target))}
        onMouseLeave={() => setHovered(null)}
        onFocusCapture={handleFocus}
        onBlurCapture={() => setFocused(null)}
      >
        <svg
          class="geo-heat-map__svg"
          viewBox={geometry.viewBox}
          role="group"
          aria-label={label}
        >
          <g>
            {countryLayer}
            {[...new Set([hovered, focused])].map(
              (code) => code && code !== selected && highlight(code, false),
            )}
            {selected && highlight(selected, true)}
          </g>
        </svg>
        {tipCode && targets.has(tipCode) && (
          <div ref={tipRef} class="geo-heat-map__tip" aria-hidden="true">
            {countryName(tipCode)}
          </div>
        )}
        {selected && (
          <CountryPopup
            key={selected}
            popupRef={popupRef}
            code={selected}
            count={counts.get(selected) ?? 0}
            total={total}
            countNoun={countNoun}
            href={viewHref(selected)}
            onView={(e) => onView(selected, e)}
            onClose={close}
          />
        )}
      </div>
      <HeatMapLegend bands={bands} countNoun={countNoun} />
    </figure>
  );
}

function CountryPopup({
  popupRef,
  code,
  count,
  total,
  countNoun,
  href,
  onView,
  onClose,
}: {
  popupRef: RefObject<HTMLDivElement>;
  code: string;
  count: number;
  total: number;
  countNoun: string;
  href: string;
  onView: (event: MouseEvent) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const viewRef = useRef<HTMLAnchorElement>(null);
  const share = formatShare(count, total);

  useEffect(() => viewRef.current?.focus(), []);

  function trapFocus(e: KeyboardEvent) {
    if (e.key !== "Tab") return;
    const [first, last] = [closeRef.current, viewRef.current];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }

  return (
    <div
      ref={popupRef}
      class="geo-heat-map__popup"
      role="dialog"
      aria-labelledby={titleId}
      onKeyDown={trapFocus}
    >
      <span class="geo-heat-map__popup-pointer" aria-hidden="true" />
      <div class="geo-heat-map__popup-header">
        <h2 id={titleId} class="geo-heat-map__popup-title">
          {countryName(code)}
        </h2>
        <button
          ref={closeRef}
          type="button"
          class="geo-heat-map__popup-close"
          aria-label="Close"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <p class="geo-heat-map__popup-stats">
        <span class="geo-heat-map__popup-count">{count.toLocaleString()}</span>
        <span class="geo-heat-map__popup-detail">
          {countNoun}
          {share && ` · ${share} of total`}
        </span>
      </p>
      <a
        ref={viewRef}
        class="geo-heat-map__popup-view"
        href={href}
        onClick={onView}
      >
        View {countNoun} <span aria-hidden="true">→</span>
      </a>
    </div>
  );
}

function HeatMapLegend({
  bands,
  countNoun,
}: {
  bands: HeatBand[];
  countNoun: string;
}) {
  return (
    <figcaption class="geo-heat-map__legend">
      <span class="geo-heat-map__legend-label lg-label">{countNoun}</span>
      {[
        { shade: 0, label: "0" },
        ...bands.map((b) => ({ shade: b.shade, label: bandLabel(b) })),
      ].map(({ shade, label }) => (
        <span key={shade} class="geo-heat-map__legend-item">
          <span
            class="geo-heat-map__swatch"
            data-shade={shade}
            aria-hidden="true"
          />
          {label}
        </span>
      ))}
    </figcaption>
  );
}

function countryOf(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  return target.closest("[data-country]")?.getAttribute("data-country") ?? null;
}

function isCountry(target: Node): boolean {
  return countryOf(target) !== null;
}
