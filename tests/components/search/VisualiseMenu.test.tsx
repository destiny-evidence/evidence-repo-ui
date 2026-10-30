import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/preact";
import { VisualiseMenu } from "@/components/search/VisualiseMenu";
import type { EvidenceMapAxes } from "@/types/models";
import {
  DOCUMENT_TYPE_SCHEME,
  OUTCOME_SCHEME_FIXTURE,
} from "../filters/fixtures";

beforeEach(cleanup);

const AXES: EvidenceMapAxes = {
  row: { kind: "scheme", schemeUri: OUTCOME_SCHEME_FIXTURE.uri },
  column: { kind: "scheme", schemeUri: DOCUMENT_TYPE_SCHEME.uri },
};

function setup({ count = 342, scoped = true, loading = false } = {}) {
  const onVisualise = vi.fn();
  const menu = (loading: boolean) => (
    <VisualiseMenu
      total={{ count, is_lower_bound: false }}
      loading={loading}
      scoped={scoped}
      countNoun="investigations"
      defaultAxes={AXES}
      schemes={[OUTCOME_SCHEME_FIXTURE, DOCUMENT_TYPE_SCHEME]}
      includeCountries
      onVisualise={onVisualise}
    />
  );
  const { rerender } = render(menu(loading));
  return { onVisualise, startLoading: () => rerender(menu(true)) };
}

const trigger = () => screen.getByRole("button", { name: /^visualise$/i, expanded: false });

function openPanel() {
  fireEvent.click(trigger());
  return screen.getByRole("group", { name: /visualise as an evidence map/i });
}

describe("VisualiseMenu", () => {
  test("describes a search's results and their count", () => {
    setup();
    const panel = openPanel();
    expect(within(panel).getByText("All results for this search")).toBeInTheDocument();
    expect(within(panel).getByText("342")).toBeInTheDocument();
  });

  test("describes the whole repository when nothing narrows it", () => {
    setup({ scoped: false });
    expect(
      within(openPanel()).getByText("All investigations in the repository"),
    ).toBeInTheDocument();
  });

  test("maps with the chosen axes", () => {
    const { onVisualise } = setup();
    const panel = openPanel();
    fireEvent.change(within(panel).getByLabelText("Rows (y)"), {
      target: { value: DOCUMENT_TYPE_SCHEME.uri },
    });
    fireEvent.click(within(panel).getByRole("button", { name: /^visualise$/i }));
    expect(onVisualise).toHaveBeenCalledWith({
      row: AXES.column,
      column: AXES.row,
    });
  });

  test("closes on Escape", () => {
    setup();
    const panel = openPanel();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(panel).not.toBeVisible();
  });

  test("closes when a new search starts loading", () => {
    const { startLoading } = setup();
    const panel = openPanel();
    startLoading();
    expect(panel).not.toBeInTheDocument();
  });

  test.each([
    ["no results", { count: 0 }],
    ["a new search loading", { loading: true }],
  ])("won't open with %s", (_, props) => {
    setup(props);
    const button = trigger();
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });
});
