import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";

// SEARCH_HELP_URL is read at module load, so the URL has to be in place before
// SearchBar is imported.
vi.mock("@/config", () => ({
  SEARCH_HELP_URL: "https://docs.google.com/document/d/search-help/preview",
}));

import { SearchBar } from "@/components/search/SearchBar";

function renderBar(overrides: Partial<Parameters<typeof SearchBar>[0]> = {}) {
  const props = {
    draftQ: "",
    onDraftQChange: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
  render(<SearchBar {...props} />);
  return props;
}

describe("SearchBar", () => {
  test("renders the draft query value from props", () => {
    renderBar({ draftQ: "phonics" });
    expect(screen.getByRole("searchbox")).toHaveValue("phonics");
  });

  test("typing in the query field calls onDraftQChange", () => {
    const props = renderBar();
    fireEvent.input(screen.getByRole("searchbox"), { target: { value: "phonics" } });
    expect(props.onDraftQChange).toHaveBeenCalledWith("phonics");
  });

  test("submit button calls onSubmit", () => {
    const props = renderBar({ draftQ: "phonics" });
    fireEvent.click(screen.getByRole("button", { name: /search/i }));
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  test("submitting the form (Enter) calls onSubmit exactly once", () => {
    const onSubmit = vi.fn();
    renderBar({ onSubmit });
    fireEvent.submit(document.querySelector("form")!);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  test("disabled prop disables the input and submit", () => {
    renderBar({ disabled: true });
    expect(screen.getByRole("searchbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: /search/i })).toBeDisabled();
  });

  test("shows the boolean-operator hint", () => {
    renderBar();
    expect(screen.getByText(/Boolean operators can be used to search/)).toBeVisible();
  });

  test("the query input is described by the hint", () => {
    renderBar();
    const hintId = screen.getByRole("searchbox").getAttribute("aria-describedby");
    expect(hintId).toBeTruthy();
    expect(document.getElementById(hintId!)).toHaveTextContent(
      /Boolean operators can be used to search/,
    );
  });

  test("the hint's link is in the tab order after the search button", () => {
    renderBar();
    const focusable = Array.from(
      document.querySelectorAll<HTMLElement>("input, button, a[href]"),
    );
    expect(focusable.map((el) => el.tagName)).toEqual(["INPUT", "BUTTON", "A"]);
  });

  test("the hint links out to the search help doc", () => {
    renderBar();
    const link = screen.getByRole("link", { name: /learn more/i });
    expect(link.getAttribute("href")).toContain("docs.google.com");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
