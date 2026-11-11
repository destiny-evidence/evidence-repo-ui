import type { ComponentChild, RefObject } from "preact";
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
import type { attachZoom as AttachZoom, MapZoom } from "./geo/mapZoom";
import {
  bandLabel,
  formatShare,
  fromFrame,
  heatBands,
  heatShade,
  inFrame,
  needsDot,
  NO_ZOOM,
  parseViewBox,
  placePopup,
  toFrame,
  type HeatBand,
  type Point,
  type ZoomState,
} from "@/services/geoHeatMap";
import { countryName } from "@/utils/country";
import { Spinner } from "@/components/common/Spinner";
import { MinusIcon, PlusIcon, ResetIcon } from "@/components/common/icons";
import { useDismiss } from "@/hooks/useDismiss";
import "@/components/common/Tooltip.css";
import "./GeographicHeatMap.css";

// In screen pixels, at every frame width and zoom.
const DOT_RADIUS_PX = 5;
const DOT_TARGET_RADIUS_PX = 12;
const POPUP_GAP = 12;
const TIP_GAP = 14;
const MAX_ZOOM = 32;
const ZOOM_STEP = 2;
const ARROW_STEPS: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

interface MapAssets {
  geometry: WorldGeometry;
  attachZoom: typeof AttachZoom;
}

// Loaded on first use so d3 and the shapes stay out of the main bundle.
let loaded: MapAssets | null = null;
function loadAssets(): Promise<MapAssets> {
  return Promise.all([import("./geo/worldGeometry"), import("./geo/mapZoom")]).then(
    ([geo, zoom]) =>
      (loaded = { geometry: geo.loadWorldGeometry(), attachZoom: zoom.attachZoom }),
  );
}

export interface GeographicHeatMapProps {
  // Reference counts keyed by ISO alpha-2 code; undefined until they first load.
  counts: ReadonlyMap<string, number> | undefined;
  label: string;
  countNoun: string;
  // Unique references on the map, which each country's share is out of.
  total: number;
  viewHref: (countryCode: string) => string;
  onSelect?: (countryCode: string) => void;
  // Every click on a country's View link, plain or modified, before it navigates.
  onView: (countryCode: string, event: MouseEvent) => void;
}

export function GeographicHeatMap({
  counts,
  ...props
}: GeographicHeatMapProps) {
  const [assets, setAssets] = useState(loaded);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (assets) return;
    let cancelled = false;
    loadAssets().then(
      (a) => !cancelled && setAssets(a),
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
  if (!assets || !counts) {
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

  return <HeatMap {...assets} counts={counts} {...props} />;
}

interface Target {
  anchor: Point;
  shape: { d: string } | { cx: number; cy: number };
}

function HeatMap({
  geometry,
  attachZoom,
  counts,
  label,
  countNoun,
  total,
  viewHref,
  onSelect,
  onView,
}: GeographicHeatMapProps &
  MapAssets & {
    counts: ReadonlyMap<string, number>;
  }) {
  const viewBox = useMemo(() => parseViewBox(geometry.viewBox), [geometry]);
  const [zoom, setZoom] = useState<ZoomState>(NO_ZOOM);
  const [frameWidth, setFrameWidth] = useState(0);
  const keyboardHintId = useId();
  const zoomRef = useRef<MapZoom | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const bands = useMemo(
    () => heatBands(Math.max(0, ...counts.values())),
    [counts],
  );
  // Dots for countries with references whose shape is too small to see or hit.
  // Until the frame's measured, take it to be the viewBox's width.
  const pxPerUnit = (zoom.k * (frameWidth || viewBox.width)) / viewBox.width;
  // Keyed by code so the layers below rebuild when the set of dots changes, not every zoom frame.
  const dotKey = geometry.dots
    .filter((d) => (counts.get(d.countryCode) ?? 0) > 0 && needsDot(d.size, pxPerUnit))
    .map((d) => d.countryCode)
    .join(" ");
  const dotCountryCodes = useMemo(() => new Set(dotKey.split(" ").filter(Boolean)), [dotKey]);
  const dots = useMemo(
    () => geometry.dots.filter((d) => dotCountryCodes.has(d.countryCode)),
    [geometry, dotCountryCodes],
  );

  // Countries with references, which are the ones that can be selected.
  const targets = useMemo(() => {
    const byCountryCode = new Map<string, Target>();
    for (const { countryCode, d, anchor } of geometry.countries) {
      if (countryCode && !dotCountryCodes.has(countryCode) && (counts.get(countryCode) ?? 0) > 0) {
        byCountryCode.set(countryCode, { anchor, shape: { d } });
      }
    }
    for (const { countryCode, x, y } of dots) {
      byCountryCode.set(countryCode, { anchor: { x, y }, shape: { cx: x, cy: y } });
    }
    return byCountryCode;
  }, [geometry, counts, dots, dotCountryCodes]);
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
    countryCode: string;
    counts: ReadonlyMap<string, number>;
    anchor: Point;
  } | null>(null);
  const selected =
    selection?.counts === counts && targets.has(selection.countryCode)
      ? selection.countryCode
      : null;
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const tabStop = active && targets.has(active) ? active : order[0];

  const frameRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const countryElement = (countryCode: string) =>
    frameRef.current?.querySelector<SVGElement>(`[data-country="${countryCode}"]`) ??
    null;
  // Zoomed in, a shape can run past the viewport, and focusing it would scroll the page.
  const focusCountry = (element: SVGElement | null) =>
    element?.focus({ preventScroll: true });

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    setFrameWidth(frame.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setFrameWidth(frame.clientWidth));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const controls = attachZoom(svgRef.current!, viewBox, MAX_ZOOM, setZoom);
    zoomRef.current = controls;
    return () => controls.destroy();
  }, [attachZoom, viewBox]);

  // Set after render, since a zoom can swap the selected dot for its shape.
  const selectedRef = useRef<SVGElement | null>(null);
  useLayoutEffect(() => {
    selectedRef.current = selected ? countryElement(selected) : null;
  });
  const setOpen = useCallback((open: boolean) => {
    if (!open) setSelection(null);
  }, []);
  useDismiss(selected !== null, setOpen, popupRef, selectedRef, isMapControl);

  function close() {
    setSelection(null);
    focusCountry(selectedRef.current);
  }

  function frameSize(frame: HTMLElement) {
    return { width: frame.clientWidth, height: frame.clientHeight };
  }

  // Where an anchor sits in the frame, or null once it's zoomed or panned out of view.
  function anchorInFrame(anchor: Point, frame: HTMLElement): Point | null {
    const point = toFrame(anchor, viewBox, zoom, frameSize(frame));
    return inFrame(point, frameSize(frame)) ? point : null;
  }

  useLayoutEffect(() => {
    const popup = popupRef.current;
    const frame = frameRef.current;
    if (!popup || !frame || !selected || !selection) return;
    const anchor = anchorInFrame(selection.anchor, frame);
    popup.style.visibility = anchor ? "" : "hidden";
    if (!anchor) return;
    const placement = placePopup(
      anchor,
      { width: popup.offsetWidth, height: popup.offsetHeight },
      frameSize(frame),
      POPUP_GAP,
    );
    popup.style.left = `${placement.left}px`;
    popup.style.top = `${placement.top}px`;
    popup.style.setProperty("--pointer-top", `${placement.pointerTop}px`);
    if (placement.side) popup.dataset.side = placement.side;
    else delete popup.dataset.side;
  }, [selected, selection, frameWidth, zoom]);

  // The tip sits below and right of the mouse, or of a focused country's
  // anchor, flipping at the frame's edges.
  const tipCountryCode = selected ? null : (hovered ?? focused);
  const pointerRef = useRef<Point | null>(null);
  function placeTip() {
    const tip = tipRef.current;
    const frame = frameRef.current;
    const target = tipCountryCode && targets.get(tipCountryCode);
    if (!tip || !frame || !target) return;
    const at = hovered ? pointerRef.current : anchorInFrame(target.anchor, frame);
    tip.style.visibility = at ? "" : "hidden";
    if (!at) return;
    const { x, y } = at;
    const { offsetWidth: width, offsetHeight: height } = tip;
    const right = x + TIP_GAP + width <= frame.clientWidth;
    const below = y + TIP_GAP + height <= frame.clientHeight;
    tip.style.left = `${right ? x + TIP_GAP : x - TIP_GAP - width}px`;
    tip.style.top = `${below ? y + TIP_GAP : y - TIP_GAP - height}px`;
  }
  useLayoutEffect(placeTip, [tipCountryCode, hovered, targets, frameWidth, zoom]);

  // A click opens the popup where it lands; the keyboard opens it at the
  // country's anchor, panning there if it's out of view.
  function select(countryCode: string, clicked?: Point) {
    if (selected === countryCode) {
      setSelection(null);
      return;
    }
    const anchor = clicked ?? targets.get(countryCode)!.anchor;
    // Instantly, so the popup is visible when it takes focus.
    if (!clicked) zoomRef.current?.reveal(anchor, false);
    setSelection({ countryCode, counts, anchor });
    onSelect?.(countryCode);
  }

  function clickedPoint(e: MouseEvent): Point {
    const { left, top, width, height } = svgRef.current!.getBoundingClientRect();
    return fromFrame({ x: e.clientX - left, y: e.clientY - top }, viewBox, zoom, {
      width,
      height,
    });
  }

  function handleKeyDown(e: KeyboardEvent) {
    const countryCode = countryOf(e.target);
    if (!countryCode) return;
    const step = ARROW_STEPS[e.key];
    if (step) {
      e.preventDefault();
      const next = order[order.indexOf(countryCode) + step];
      if (next) {
        setActive(next);
        focusCountry(countryElement(next));
        zoomRef.current?.reveal(targets.get(next)!.anchor);
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      select(countryCode);
    }
  }

  // Clicks and closing the popup focus countries too, but only keyboard focus
  // needs showing; otherwise it lingers once the mouse moves on.
  function handleFocus(e: FocusEvent) {
    const countryCode = countryOf(e.target);
    if (countryCode) setActive(countryCode);
    const visible = (e.target as Element).matches(":focus-visible");
    setFocused(visible ? countryCode : null);
  }

  const countryLabel = (countryCode: string) => {
    const count = counts.get(countryCode) ?? 0;
    return `${countryName(countryCode)}: ${count > 0 ? count.toLocaleString() : "no"} ${countNoun}`;
  };
  const shade = (countryCode: string) => heatShade(counts.get(countryCode) ?? 0, bands);
  const selectable = (countryCode: string) => ({
    "data-country": countryCode,
    role: "button" as const,
    tabindex: countryCode === tabStop ? 0 : -1,
    "aria-label": countryLabel(countryCode),
    "aria-haspopup": "dialog" as const,
    "aria-expanded": selected === countryCode,
  });

  // Handlers live on the frame rather than each country, so hovering and
  // zooming leave this layer alone. Moving focus still redraws it to move the
  // tab stop.
  const countryLayer = useMemo(
    () => (
      <g>
        <path
          class="geo-heat-map__outline"
          d={geometry.outline}
          aria-hidden="true"
        />
        {geometry.countries.map(({ countryCode, d }, i) =>
          countryCode && targets.has(countryCode) && !dotCountryCodes.has(countryCode) ? (
            <path
              key={countryCode}
              class="geo-heat-map__country is-selectable"
              d={d}
              data-shade={shade(countryCode)}
              {...selectable(countryCode)}
            />
          ) : countryCode && !dotCountryCodes.has(countryCode) ? (
            <path
              key={countryCode}
              class="geo-heat-map__country"
              d={d}
              data-shade={shade(countryCode)}
              role="img"
              aria-label={countryLabel(countryCode)}
            />
          ) : (
            <path
              key={countryCode ?? `unkeyed-${i}`}
              class="geo-heat-map__country"
              d={d}
              data-shade={countryCode ? shade(countryCode) : 0}
              aria-hidden="true"
            />
          ),
        )}
        <path
          class="geo-heat-map__borders"
          d={geometry.borders}
          aria-hidden="true"
        />
      </g>
    ),
    [geometry, counts, countNoun, bands, targets, dotCountryCodes, tabStop, selected],
  );

  const dotLayer = (
    <g>
      {dots.map(({ countryCode, x, y }) => (
        <circle
          key={countryCode}
          class="geo-heat-map__dot"
          cx={x}
          cy={y}
          r={DOT_RADIUS_PX / pxPerUnit}
          data-shade={shade(countryCode)}
          aria-hidden="true"
        />
      ))}
      {/* Wider than the dots themselves so small countries can be hit. */}
      {dots.map(({ countryCode, x, y }) => (
        <circle
          key={countryCode}
          class="geo-heat-map__dot-target is-selectable"
          cx={x}
          cy={y}
          r={DOT_TARGET_RADIUS_PX / pxPerUnit}
          {...selectable(countryCode)}
        />
      ))}
    </g>
  );

  const highlight = (countryCode: string, isSelected: boolean) => {
    const target = targets.get(countryCode);
    if (!target) return null;
    const cls = `geo-heat-map__highlight${isSelected ? " is-selected" : ""}`;
    return "d" in target.shape ? (
      <path key={countryCode} class={cls} d={target.shape.d} aria-hidden="true" />
    ) : (
      <circle
        key={countryCode}
        class={cls}
        cx={target.shape.cx}
        cy={target.shape.cy}
        r={DOT_RADIUS_PX / pxPerUnit}
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
          const countryCode = countryOf(e.target);
          // Clicks from assistive tech (detail 0) have no real position.
          if (countryCode) select(countryCode, e.detail > 0 ? clickedPoint(e) : undefined);
        }}
        onKeyDown={handleKeyDown}
        onMouseOver={(e) => setHovered(countryOf(e.target))}
        onMouseMove={(e) => {
          const { left, top } = frameRef.current!.getBoundingClientRect();
          pointerRef.current = { x: e.clientX - left, y: e.clientY - top };
          placeTip();
        }}
        onMouseLeave={() => setHovered(null)}
        onFocusCapture={handleFocus}
        onBlurCapture={() => setFocused(null)}
      >
        <svg
          ref={svgRef}
          class="geo-heat-map__svg"
          viewBox={geometry.viewBox}
          role="group"
          aria-label={label}
          aria-describedby={order.length > 0 ? keyboardHintId : undefined}
        >
          <g transform={`translate(${zoom.x} ${zoom.y}) scale(${zoom.k})`}>
            {countryLayer}
            {dotLayer}
            {[...new Set([hovered, focused])].map(
              (countryCode) =>
                countryCode &&
                countryCode !== selected &&
                highlight(countryCode, false),
            )}
            {selected && highlight(selected, true)}
          </g>
        </svg>
        <p id={keyboardHintId} hidden>
          Use the arrow keys to move between countries and Enter to select one.
        </p>
        <ZoomControls zoom={zoom} controls={zoomRef} />
        {tipCountryCode && targets.has(tipCountryCode) && (
          <div ref={tipRef} class="geo-heat-map__tip" aria-hidden="true">
            {countryName(tipCountryCode)}
          </div>
        )}
        {selected && (
          <CountryPopup
            key={selected}
            popupRef={popupRef}
            countryCode={selected}
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
  countryCode,
  count,
  total,
  countNoun,
  href,
  onView,
  onClose,
}: {
  popupRef: RefObject<HTMLDivElement>;
  countryCode: string;
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
          {countryName(countryCode)}
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
        // A middle click opens a new tab without a click event.
        onAuxClick={(e) => e.button === 1 && onView(e)}
      >
        View {countNoun} <span aria-hidden="true">→</span>
      </a>
    </div>
  );
}

function ZoomControls({
  zoom,
  controls,
}: {
  zoom: ZoomState;
  controls: RefObject<MapZoom | null>;
}) {
  // aria-disabled rather than disabled, so focus stays put at the limits.
  const button = (
    label: string,
    icon: ComponentChild,
    off: boolean,
    act: (zoom: MapZoom) => void,
  ) => (
    <button
      type="button"
      class="geo-heat-map__zoom-button"
      aria-label={label}
      aria-disabled={off}
      onClick={() => !off && controls.current && act(controls.current)}
    >
      {icon}
    </button>
  );
  const zoomed = zoom.k !== 1 || zoom.x !== 0 || zoom.y !== 0;
  return (
    <div class="geo-heat-map__zoom" role="group" aria-label="Zoom">
      {button("Zoom in", <PlusIcon />, zoom.k >= MAX_ZOOM, (z) => z.scaleBy(ZOOM_STEP))}
      {button("Zoom out", <MinusIcon />, zoom.k <= 1, (z) => z.scaleBy(1 / ZOOM_STEP))}
      {button("Reset zoom", <ResetIcon />, !zoomed, (z) => z.reset())}
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

// Clicks that leave an open popup alone.
function isMapControl(target: Node): boolean {
  return (
    target instanceof Element &&
    target.closest("[data-country], .geo-heat-map__zoom") !== null
  );
}
