import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/preact";
import { ArmDataTable } from "@/components/ArmDataTable";
import { makeArm } from "../fixtures";

const intervention = { id: "_:int", name: "Vanguard program" };
const control = { id: "_:ctrl", description: "Business as usual" };

describe("ArmDataTable", () => {
  test("renders nothing when arms array is empty", () => {
    const { container } = render(
      <ArmDataTable arms={[]} intervention={intervention} control={control} />,
    );
    expect(container.querySelector(".arm-data")).toBeNull();
  });

  test("only renders columns that have at least one populated value", () => {
    const { container } = render(
      <ArmDataTable
        arms={[
          makeArm({ id: "_:armI", conditionRef: "_:int", n: 222 }),
          makeArm({ id: "_:armC", conditionRef: "_:ctrl", n: 222 }),
        ]}
        intervention={intervention}
        control={control}
      />,
    );
    const headers = Array.from(
      container.querySelectorAll(".arm-data__header"),
    ).map((h) => h.textContent);
    expect(headers).toContain("Arm");
    expect(headers).toContain("n");
    expect(headers).not.toContain("Mean");
    expect(headers).not.toContain("SD");
  });

  test("resolves intervention/control labels via conditionRef", () => {
    render(
      <ArmDataTable
        arms={[
          makeArm({ id: "_:armI", conditionRef: "_:int", n: 100 }),
          makeArm({ id: "_:armC", conditionRef: "_:ctrl", n: 100 }),
        ]}
        intervention={intervention}
        control={control}
      />,
    );
    expect(screen.getByText("Vanguard program")).toBeDefined();
    expect(screen.getByText("Control")).toBeDefined();
  });

  test("falls back to 'Arm N' label when conditionRef does not match", () => {
    render(
      <ArmDataTable
        arms={[makeArm({ id: "_:armX", conditionRef: "_:other", n: 50 })]}
        intervention={intervention}
        control={control}
      />,
    );
    expect(screen.getByText("Arm 1")).toBeDefined();
  });

  test("renders mean/sd cells when those fields are populated", () => {
    render(
      <ArmDataTable
        arms={[
          makeArm({
            id: "_:armI",
            conditionRef: "_:int",
            n: 30,
            mean: 12.5,
            sd: 2.1,
          }),
        ]}
        intervention={intervention}
        control={control}
      />,
    );
    expect(screen.getByText("Mean")).toBeDefined();
    expect(screen.getByText("12.5")).toBeDefined();
    expect(screen.getByText("2.1")).toBeDefined();
  });
});
