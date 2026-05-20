import { describe, test, expect } from "vitest";
import { render } from "@testing-library/preact";
import { Tooltip } from "@/components/Tooltip";

describe("Tooltip", () => {
  test("wraps children in a span with data-tooltip when text is set", () => {
    const { container } = render(
      <Tooltip text="hello">
        <button type="button">click</button>
      </Tooltip>,
    );
    const wrap = container.querySelector(".tooltip");
    expect(wrap).not.toBeNull();
    expect(wrap?.getAttribute("data-tooltip")).toBe("hello");
    expect(wrap?.querySelector("button")?.textContent).toBe("click");
  });

  test("renders children unwrapped when text is undefined", () => {
    const { container } = render(
      <Tooltip text={undefined}>
        <button type="button">click</button>
      </Tooltip>,
    );
    expect(container.querySelector(".tooltip")).toBeNull();
    expect(container.querySelector("button")?.textContent).toBe("click");
  });

  test("renders children unwrapped when text is an empty string", () => {
    const { container } = render(
      <Tooltip text="">
        <span>x</span>
      </Tooltip>,
    );
    expect(container.querySelector(".tooltip")).toBeNull();
  });
});
