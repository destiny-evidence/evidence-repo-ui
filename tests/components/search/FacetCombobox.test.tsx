import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/preact";
import { useState } from "preact/hooks";
import { FacetCombobox, getTokenAtCursor } from "@/components/search/FacetCombobox";

interface HarnessProps {
  initialValue?: string;
  options?: string[];
  onCommit?: () => void;
}

// Wrapping FacetCombobox in a state holder so onChange updates re-render the
// controlled value the way SearchPage does.
function Harness({ initialValue = "", options = [], onCommit = () => {} }: HarnessProps) {
  const [value, setValue] = useState(initialValue);
  return (
    <FacetCombobox
      value={value}
      onChange={setValue}
      onCommit={onCommit}
      options={options}
      ariaLabel="Facet"
    />
  );
}

function getInput() {
  return screen.getByLabelText("Facet") as HTMLInputElement;
}
function queryListbox() {
  return screen.queryByRole("listbox");
}
function getOptions() {
  return screen.queryAllByRole("option");
}

describe("getTokenAtCursor", () => {
  test("single token, cursor at end", () => {
    expect(getTokenAtCursor("Journal Article", 15)).toEqual({ start: 0, end: 15 });
  });

  test("two tokens separated by ' OR ', cursor in second", () => {
    const v = "Journal Article OR Tec";
    const r = getTokenAtCursor(v, v.length);
    expect(v.slice(r.start, r.end)).toBe("Tec");
  });

  test("cursor at the start of the trailing token", () => {
    const v = "A OR B";
    const r = getTokenAtCursor(v, 5);
    expect(v.slice(r.start, r.end)).toBe("B");
  });

  test("case-insensitive separator", () => {
    const v = "A or B";
    const r = getTokenAtCursor(v, v.length);
    expect(v.slice(r.start, r.end)).toBe("B");
  });

  test("cursor inside first token", () => {
    const v = "Foo OR Bar";
    const r = getTokenAtCursor(v, 2);
    expect(v.slice(r.start, r.end)).toBe("Foo");
  });
});

describe("FacetCombobox", () => {
  test("renders input with the given value and aria-label", () => {
    render(<Harness initialValue="hello" />);
    expect(getInput().value).toBe("hello");
  });

  test("listbox is hidden until the input is focused", () => {
    render(<Harness options={["Alpha", "Beta"]} />);
    expect(queryListbox()).toBeNull();
    fireEvent.focus(getInput());
    expect(queryListbox()).not.toBeNull();
    expect(getOptions().map((o) => o.textContent)).toEqual(["Alpha", "Beta"]);
  });

  test("typing filters the listbox case-insensitively by includes", () => {
    render(<Harness options={["Apple", "Banana", "Cherry", "Date"]} />);
    const input = getInput();
    fireEvent.focus(input);
    input.value = "an";
    input.setSelectionRange(2, 2);
    fireEvent.input(input);
    expect(getOptions().map((o) => o.textContent)).toEqual(["Banana"]);

    input.value = "E";
    input.setSelectionRange(1, 1);
    fireEvent.input(input);
    expect(getOptions().map((o) => o.textContent)).toEqual(["Apple", "Cherry", "Date"]);
  });

  test("multi-token: cursor in second token scopes filter to that token only", () => {
    render(
      <Harness
        initialValue="Alpha OR Be"
        options={["Alpha", "Beta", "Carrot"]}
      />,
    );
    const input = getInput();
    fireEvent.focus(input);
    input.setSelectionRange(11, 11);
    fireEvent.click(input);
    expect(getOptions().map((o) => o.textContent)).toEqual(["Beta"]);
  });

  test("ArrowDown highlights successive options with wrap-around", () => {
    render(<Harness options={["A", "B", "C"]} />);
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(getOptions()[0].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(getOptions()[1].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(getOptions()[2].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(getOptions()[0].getAttribute("aria-selected")).toBe("true");
  });

  test("ArrowUp moves backward with wrap-around (starts at last from -1)", () => {
    render(<Harness options={["A", "B", "C"]} />);
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(getOptions()[2].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(getOptions()[1].getAttribute("aria-selected")).toBe("true");
  });

  test("Enter on a highlighted option replaces the token; does not commit", () => {
    const onCommit = vi.fn();
    render(<Harness options={["Alpha", "Beta"]} onCommit={onCommit} />);
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input.value).toBe("Alpha");
    expect(onCommit).not.toHaveBeenCalled();
  });

  test("Enter with no highlighted option commits and closes the listbox", () => {
    const onCommit = vi.fn();
    render(<Harness initialValue="hello" options={["Alpha"]} onCommit={onCommit} />);
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(queryListbox()).toBeNull();
  });

  test("Escape closes the listbox without committing", () => {
    const onCommit = vi.fn();
    render(<Harness options={["A"]} onCommit={onCommit} />);
    const input = getInput();
    fireEvent.focus(input);
    expect(queryListbox()).not.toBeNull();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(queryListbox()).toBeNull();
    expect(onCommit).not.toHaveBeenCalled();
  });

  test("clicking an option replaces just the current token, leaving siblings intact", () => {
    const onCommit = vi.fn();
    render(
      <Harness
        initialValue="Alpha OR Be"
        options={["Alpha", "Beta"]}
        onCommit={onCommit}
      />,
    );
    const input = getInput();
    fireEvent.focus(input);
    input.setSelectionRange(11, 11);
    fireEvent.click(input);
    const betaOption = getOptions().find((o) => o.textContent === "Beta")!;
    fireEvent.click(betaOption);
    expect(input.value).toBe("Alpha OR Beta");
    expect(onCommit).not.toHaveBeenCalled();
  });

  test("blurring outside the wrapper closes the listbox and commits once", async () => {
    const onCommit = vi.fn();
    render(
      <>
        <Harness options={["A"]} onCommit={onCommit} />
        <button type="button">Outside</button>
      </>,
    );
    const input = getInput();
    fireEvent.focus(input);
    expect(queryListbox()).not.toBeNull();
    const outside = screen.getByRole("button", { name: "Outside" });
    outside.focus();
    fireEvent.blur(input);
    await waitFor(() => expect(queryListbox()).toBeNull());
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  test("empty filtered list shows the 'no matching concepts' placeholder", () => {
    render(<Harness initialValue="zzz" options={["Alpha"]} />);
    const input = getInput();
    fireEvent.focus(input);
    expect(screen.getByText(/no matching concepts/i)).toBeInTheDocument();
    expect(getOptions()).toEqual([]);
  });
});
