import { select } from "d3-selection";
import "d3-transition";
import { zoom, zoomIdentity, zoomTransform } from "d3-zoom";
import type { Point, ViewBox, ZoomState } from "@/services/geoHeatMap";

export interface MapZoom {
  scaleBy(factor: number): void;
  reset(): void;
  // Centres the point if it's out of view.
  reveal(point: Point, animate?: boolean): void;
  destroy(): void;
}

const DURATION_MS = 250;
const CLICK_DISTANCE_PX = 4;

export function attachZoom(
  svg: SVGSVGElement,
  viewBox: ViewBox,
  maxScale: number,
  onZoom: (state: ZoomState) => void,
): MapZoom {
  const extent: [[number, number], [number, number]] = [
    [viewBox.x, viewBox.y],
    [viewBox.x + viewBox.width, viewBox.y + viewBox.height],
  ];
  const behaviour = zoom<SVGSVGElement, unknown>()
    .extent(extent)
    .translateExtent(extent)
    .scaleExtent([1, maxScale])
    .clickDistance(CLICK_DISTANCE_PX)
    // One finger scrolls the page, as on other maps; two pan and zoom.
    .filter((event) =>
      event.type === "touchstart"
        ? event.touches.length > 1
        : (!event.ctrlKey || event.type === "wheel") && !event.button,
    )
    .on("zoom", ({ transform: { k, x, y } }) => onZoom({ k, x, y }));

  const selection = select(svg);
  // Double-click would also toggle the country under it.
  selection.call(behaviour).on("dblclick.zoom", null);

  const target = (animate = true) =>
    !animate || matchMedia("(prefers-reduced-motion: reduce)").matches
      ? selection
      : selection.transition().duration(DURATION_MS);

  return {
    scaleBy: (factor) => behaviour.scaleBy(target(), factor),
    reset: () => behaviour.transform(target(), zoomIdentity),
    reveal({ x, y }, animate) {
      const t = zoomTransform(svg);
      const [left, top] = t.invert(extent[0]);
      const [right, bottom] = t.invert(extent[1]);
      if (x >= left && x <= right && y >= top && y <= bottom) return;
      behaviour.translateTo(target(animate), x, y);
    },
    destroy: () => {
      selection.interrupt().on(".zoom", null);
    },
  };
}
