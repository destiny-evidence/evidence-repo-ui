import { describe, test, expect } from "vitest";
import { render } from "@testing-library/preact";
import { CIVisualization } from "@/components/CIVisualization";

describe("CIVisualization", () => {
  test("renders nothing when no values provided", () => {
    const { container } = render(<CIVisualization significance="ns" />);
    expect(container.querySelector(".ci-viz")).toBeNull();
  });

  test("applies significance modifier class to root", () => {
    const { container } = render(
      <CIVisualization
        pointEstimate={0.33}
        ciLower={0.18}
        ciUpper={0.48}
        significance="pos"
      />,
    );
    expect(container.querySelector(".ci-viz--pos")).not.toBeNull();
  });

  test("places point estimate dot at proportional offset", () => {
    const { container } = render(
      <CIVisualization
        pointEstimate={0.5}
        ciLower={0}
        ciUpper={1}
        significance="pos"
      />,
    );
    // axisMax = 1; dot at 0.5 → 75% of axis [-1, 1]
    const dot = container.querySelector(".ci-viz__dot") as HTMLElement;
    expect(dot.style.left).toBe("75%");
  });

  test("CI bar spans from lower to upper as percentage offsets", () => {
    const { container } = render(
      <CIVisualization
        pointEstimate={0}
        ciLower={-0.5}
        ciUpper={0.5}
        significance="ns"
      />,
    );
    const bar = container.querySelector(".ci-viz__bar") as HTMLElement;
    // axisMax = 0.5; bar from 0% to 100%
    expect(bar.style.left).toBe("0%");
    expect(bar.style.width).toBe("100%");
  });

  test("renders five tick labels including 0", () => {
    const { container } = render(
      <CIVisualization
        pointEstimate={0.3}
        ciLower={0.1}
        ciUpper={0.5}
        significance="pos"
      />,
    );
    const ticks = container.querySelectorAll(".ci-viz__tick");
    expect(ticks).toHaveLength(5);
    const labels = Array.from(ticks).map((t) => t.textContent);
    expect(labels).toContain("0");
  });

  test("scale expands when CI exceeds [-1, 1]", () => {
    const { container } = render(
      <CIVisualization
        pointEstimate={1.2}
        ciLower={0.8}
        ciUpper={1.6}
        significance="pos"
      />,
    );
    const ticks = Array.from(
      container.querySelectorAll(".ci-viz__tick"),
    ).map((t) => t.textContent);
    // axisMax = 2.0 -> outer ticks "2.0" / "−2.0"
    expect(ticks).toContain("2.0");
    expect(ticks).toContain("−2.0");
  });
});
