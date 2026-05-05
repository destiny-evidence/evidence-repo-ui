import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/preact";
import {
  EffectEstimateCard,
  classifyEstimate,
} from "@/components/EffectEstimateCard";
import { makeArm, makeEffectEstimate } from "../fixtures";

const intervention = { id: "_:int", name: "Vanguard program" };
const control = { id: "_:ctrl", description: "Business as usual" };

function renderCard(
  estimate = makeEffectEstimate(),
  arms = [] as ReturnType<typeof makeArm>[],
) {
  return render(
    <EffectEstimateCard
      estimate={estimate}
      arms={arms}
      intervention={intervention}
      control={control}
    />,
  );
}

describe("classifyEstimate", () => {
  test("positive significant when both CI bounds > 0", () => {
    expect(classifyEstimate({ ciLower: 0.1, ciUpper: 0.5 })).toBe("pos");
  });
  test("negative significant when both CI bounds < 0", () => {
    expect(classifyEstimate({ ciLower: -0.5, ciUpper: -0.1 })).toBe("neg");
  });
  test("non-significant when CI crosses zero", () => {
    expect(classifyEstimate({ ciLower: -0.1, ciUpper: 0.3 })).toBe("ns");
  });
  test("non-significant when CI bound is exactly zero", () => {
    expect(classifyEstimate({ ciLower: 0, ciUpper: 0.3 })).toBe("ns");
  });
  test("non-significant when CI bounds missing", () => {
    expect(classifyEstimate({ pointEstimate: 0.3 })).toBe("ns");
  });
});

describe("EffectEstimateCard", () => {
  test("renders point estimate with metric and SE", () => {
    renderCard();
    expect(screen.getByText("0.33")).toBeDefined();
    expect(screen.getByText("Hedges' g")).toBeDefined();
    expect(screen.getByText("SE = 0.078")).toBeDefined();
    expect(screen.getByText(/0.18, 0.48/)).toBeDefined();
  });

  test("renders negative point estimate with U+2212 minus and applies neg class", () => {
    const { container } = renderCard(
      makeEffectEstimate({
        pointEstimate: -0.48,
        ciLower: -0.67,
        ciUpper: -0.29,
        standardError: 0.096,
      }),
    );
    expect(screen.getByText("−0.48")).toBeDefined();
    const estimate = container.querySelector(".ee-card__estimate");
    expect(estimate?.classList.contains("ee-card__estimate--neg")).toBe(true);
  });

  test("CI crossing zero renders ns classifier on point estimate", () => {
    const { container } = renderCard(
      makeEffectEstimate({
        pointEstimate: 0.05,
        ciLower: -0.1,
        ciUpper: 0.2,
        standardError: 0.05,
      }),
    );
    const estimate = container.querySelector(".ee-card__estimate");
    expect(estimate?.classList.contains("ee-card__estimate--ns")).toBe(true);
  });

  test("Baseline adjusted tag visible only when baselineAdjusted is true", () => {
    const { rerender } = renderCard(
      makeEffectEstimate({ baselineAdjusted: true }),
    );
    expect(screen.getByText("Baseline adjusted")).toBeDefined();

    rerender(
      <EffectEstimateCard
        estimate={makeEffectEstimate({ baselineAdjusted: false })}
        arms={[]}
        intervention={intervention}
        control={control}
      />,
    );
    expect(screen.queryByText("Baseline adjusted")).toBeNull();
  });

  test("Not adjusted for clustering text only when clusteringAdjusted === 'no'", () => {
    const { rerender } = renderCard(
      makeEffectEstimate({ clusteringAdjusted: "no" }),
    );
    expect(screen.getByText("Not adjusted for clustering")).toBeDefined();

    rerender(
      <EffectEstimateCard
        estimate={makeEffectEstimate({ clusteringAdjusted: "yes" })}
        arms={[]}
        intervention={intervention}
        control={control}
      />,
    );
    expect(screen.queryByText("Not adjusted for clustering")).toBeNull();
  });

  test("renders ArmDataTable when arms present", () => {
    renderCard(makeEffectEstimate(), [
      makeArm({ id: "_:armI", conditionRef: "_:int", n: 222 }),
      makeArm({ id: "_:armC", conditionRef: "_:ctrl", n: 222 }),
    ]);
    expect(screen.getByText("Vanguard program")).toBeDefined();
    expect(screen.getByText("Control")).toBeDefined();
  });

  test("hides ArmDataTable when no arms", () => {
    const { container } = renderCard(makeEffectEstimate(), []);
    expect(container.querySelector(".arm-data")).toBeNull();
  });

  test("renders em-dash for missing point estimate", () => {
    const { container } = renderCard(
      makeEffectEstimate({ pointEstimate: undefined }),
    );
    expect(container.querySelector(".ee-card__estimate")?.textContent).toBe("—");
  });
});
