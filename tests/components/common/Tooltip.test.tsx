import { describe, test, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/preact";
import { Tooltip } from "@/components/common/Tooltip";

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

  test("shows the bubble on hover and removes it on leave", () => {
    const { container } = render(
      <Tooltip text="bubble text">
        <button type="button">click</button>
      </Tooltip>,
    );
    const wrap = container.querySelector(".tooltip")!;

    fireEvent.mouseEnter(wrap);
    expect(screen.getByText("bubble text")).toBeInTheDocument();

    fireEvent.mouseLeave(wrap);
    expect(screen.queryByText("bubble text")).not.toBeInTheDocument();
  });

  test("shows the bubble when the trigger is focused and hides it on blur", () => {
    render(
      <Tooltip text="focus text">
        <button type="button">click</button>
      </Tooltip>,
    );
    const button = screen.getByRole("button");

    fireEvent.focus(button);
    expect(screen.getByText("focus text")).toBeInTheDocument();

    fireEvent.blur(button);
    expect(screen.queryByText("focus text")).not.toBeInTheDocument();
  });
});
