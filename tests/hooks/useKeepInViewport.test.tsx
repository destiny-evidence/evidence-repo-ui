import { describe, test, expect } from "vitest";
import { render } from "@testing-library/preact";
import { useRef } from "preact/hooks";
import { useKeepInViewport } from "@/hooks/useKeepInViewport";

function panelAt(left: number, width: number) {
  function Panel() {
    const ref = useRef<HTMLDivElement>(null);
    useKeepInViewport(true, ref);
    return <div ref={ref} data-testid="panel" />;
  }
  const proto = HTMLElement.prototype;
  const original = proto.getBoundingClientRect;
  proto.getBoundingClientRect = () =>
    ({ left, right: left + width, top: 0, bottom: 0, width, height: 0 }) as DOMRect;
  try {
    return render(<Panel />).getByTestId("panel");
  } finally {
    proto.getBoundingClientRect = original;
  }
}

describe("useKeepInViewport", () => {
  test("shifts a panel that runs off the right edge back on screen", () => {
    Object.defineProperty(document.documentElement, "clientWidth", { value: 1000, configurable: true });
    expect(panelAt(800, 420).style.left).toBe("-236px");
  });

  test("never pushes it past the left edge", () => {
    Object.defineProperty(document.documentElement, "clientWidth", { value: 400, configurable: true });
    expect(panelAt(60, 380).style.left).toBe("-44px");
  });

  test("leaves a panel that fits alone", () => {
    Object.defineProperty(document.documentElement, "clientWidth", { value: 1000, configurable: true });
    expect(panelAt(100, 420).style.left).toBe("");
  });
});
