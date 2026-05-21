import { describe, test, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { FilterCard } from "@/components/filters/FilterCard";

describe("FilterCard", () => {
  test("renders the title", () => {
    render(
      <FilterCard title="Document type">
        <div>child</div>
      </FilterCard>,
    );
    expect(screen.getByText("Document type")).toBeDefined();
  });

  test("starts collapsed with the panel hidden", () => {
    const { container } = render(
      <FilterCard title="Document type">
        <div>child</div>
      </FilterCard>,
    );
    const button = screen.getByRole("button", { name: /Document type/ });
    const panel = container.querySelector<HTMLElement>(".filter-card__panel");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(panel?.hidden).toBe(true);
  });

  test("expands on click and reveals children", () => {
    const { container } = render(
      <FilterCard title="Document type">
        <div data-testid="child">child content</div>
      </FilterCard>,
    );
    const button = screen.getByRole("button", { name: /Document type/ });
    fireEvent.click(button);
    const panel = container.querySelector<HTMLElement>(".filter-card__panel");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(panel?.hidden).toBe(false);
    expect(screen.getByTestId("child").textContent).toBe("child content");
  });

  test("collapses again on a second click", () => {
    const { container } = render(
      <FilterCard title="Document type">
        <div>child</div>
      </FilterCard>,
    );
    const button = screen.getByRole("button", { name: /Document type/ });
    fireEvent.click(button);
    fireEvent.click(button);
    const panel = container.querySelector<HTMLElement>(".filter-card__panel");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(panel?.hidden).toBe(true);
  });

  test("aria-controls points at a panel that exists in the DOM when collapsed", () => {
    render(
      <FilterCard title="Document type">
        <div>child</div>
      </FilterCard>,
    );
    const button = screen.getByRole("button", { name: /Document type/ });
    const controlsId = button.getAttribute("aria-controls");
    expect(controlsId).toBeTruthy();
    expect(document.getElementById(controlsId!)).not.toBeNull();
  });

  test("shows a non-empty summary in the header while collapsed", () => {
    render(
      <FilterCard title="Document type" summary="3 selected">
        <div>child</div>
      </FilterCard>,
    );
    expect(screen.getByText("3 selected")).toBeDefined();
  });

  test("hides the summary once expanded", () => {
    render(
      <FilterCard title="Document type" summary="3 selected">
        <div>child</div>
      </FilterCard>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Document type/ }));
    expect(screen.queryByText("3 selected")).toBeNull();
  });

  test("renders no summary node when prop is omitted", () => {
    const { container } = render(
      <FilterCard title="Document type">
        <div>child</div>
      </FilterCard>,
    );
    expect(container.querySelector(".filter-card__summary")).toBeNull();
  });

  test("renders no summary node when prop is an empty string", () => {
    const { container } = render(
      <FilterCard title="Document type" summary="">
        <div>child</div>
      </FilterCard>,
    );
    expect(container.querySelector(".filter-card__summary")).toBeNull();
  });
});
