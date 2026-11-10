import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/preact";
import { VisualiseMenu, type VisualiseOption } from "@/components/search/VisualiseMenu";
import { AXIS_COUNTRIES } from "@/services/crossFacets";
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

const EVIDENCE_MAP: VisualiseOption = {
  kind: "evidence-map",
  defaultAxes: AXES,
  schemes: [OUTCOME_SCHEME_FIXTURE, DOCUMENT_TYPE_SCHEME],
  literalAxes: [AXIS_COUNTRIES],
};
const HEAT_MAP: VisualiseOption = { kind: "heat-map" };

function setup({
  count = 342,
  scoped = true,
  loading = false,
  options = [EVIDENCE_MAP] as VisualiseOption[],
} = {}) {
  const onVisualise = vi.fn();
  const menu = (loading: boolean, opts = options) => (
    <VisualiseMenu
      total={{ count, is_lower_bound: false }}
      loading={loading}
      scoped={scoped}
      countNoun="investigations"
      options={opts}
      onVisualise={onVisualise}
    />
  );
  const { rerender } = render(menu(loading));
  return {
    onVisualise,
    startLoading: () => rerender(menu(true)),
    offer: (opts: VisualiseOption[]) => rerender(menu(loading, opts)),
  };
}

const trigger = () => screen.getByRole("button", { name: /^visualise$/i, expanded: false });

function openPanel() {
  fireEvent.click(trigger());
  return screen.getByRole("group", { name: /visualise these results/i });
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
      kind: "evidence-map",
      axes: { row: AXES.column, column: AXES.row },
    });
  });

  test("offers the heat map beside the evidence map, without the axes", () => {
    const { onVisualise } = setup({ options: [EVIDENCE_MAP, HEAT_MAP] });
    const panel = openPanel();
    const views = within(panel).getByRole("radiogroup", { name: "View as" });
    expect(within(views).getByRole("radio", { name: "Evidence map" })).toBeChecked();

    fireEvent.click(within(views).getByRole("radio", { name: "Geographic heat map" }));
    expect(within(panel).queryByLabelText("Rows (y)")).toBeNull();
    fireEvent.click(within(panel).getByRole("button", { name: /^visualise$/i }));
    expect(onVisualise).toHaveBeenCalledWith({ kind: "heat-map" });
  });

  test("goes straight to the heat map when it is the only view", () => {
    const { onVisualise } = setup({ options: [HEAT_MAP] });
    const panel = openPanel();
    expect(within(panel).queryByRole("radiogroup")).toBeNull();
    expect(within(panel).queryByLabelText("Rows (y)")).toBeNull();
    fireEvent.click(within(panel).getByRole("button", { name: /^visualise$/i }));
    expect(onVisualise).toHaveBeenCalledWith({ kind: "heat-map" });
  });

  test("falls back to the first view when the chosen one is no longer offered", () => {
    const { onVisualise, offer } = setup({ options: [EVIDENCE_MAP, HEAT_MAP] });
    const panel = openPanel();
    fireEvent.click(within(panel).getByRole("radio", { name: "Geographic heat map" }));
    offer([EVIDENCE_MAP]);
    fireEvent.click(within(panel).getByRole("button", { name: /^visualise$/i }));
    expect(onVisualise).toHaveBeenCalledWith({ kind: "evidence-map", axes: AXES });
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
