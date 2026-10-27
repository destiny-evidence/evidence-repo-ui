import { describe, test, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/preact";
import { MapSourceMenu } from "@/components/visualise/MapSourceMenu";

beforeEach(cleanup);

function setup({
  query = "phonics",
  scoped = true,
  matches = 12,
}: { query?: string; scoped?: boolean; matches?: number } = {}) {
  const props = {
    countMatches: vi.fn().mockResolvedValue(matches),
    onApply: vi.fn(),
    onMapRepository: vi.fn(),
  };
  render(
    <MapSourceMenu
      query={query}
      scoped={scoped}
      countNoun="investigations"
      {...props}
    />,
  );
  return props;
}

const trigger = () => screen.getByRole("button", { expanded: false });
const field = () => screen.getByLabelText("Search to map") as HTMLTextAreaElement;

function typeAndEnter(value: string) {
  fireEvent.input(field(), { target: { value } });
  fireEvent.keyDown(field(), { key: "Enter" });
}

describe("MapSourceMenu", () => {
  test("names the search, or the whole repository", () => {
    setup();
    expect(trigger()).toHaveTextContent("Search“phonics”");
    cleanup();
    setup({ query: "", scoped: false });
    expect(trigger()).toHaveTextContent("SourceWhole repository");
  });

  test("Enter applies a query that has matches", async () => {
    const { countMatches, onApply } = setup();
    fireEvent.click(trigger());
    typeAndEnter("  reading camps ");
    await waitFor(() => expect(onApply).toHaveBeenCalledWith("reading camps"));
    expect(countMatches).toHaveBeenCalledWith("reading camps");
  });

  test("refuses a query with no matches", async () => {
    const { onApply } = setup({ matches: 0 });
    fireEvent.click(trigger());
    typeAndEnter("nothing matches this");
    expect(await screen.findByRole("alert")).toHaveTextContent(/no investigations match/i);
    expect(onApply).not.toHaveBeenCalled();
    expect(field()).toBeInTheDocument();
  });

  test("Escape discards the edit", () => {
    setup();
    fireEvent.click(trigger());
    fireEvent.input(field(), { target: { value: "draft" } });
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(trigger());
    expect(field().value).toBe("phonics");
  });

  test("Clear empties the field without applying", () => {
    const { onApply } = setup();
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(field().value).toBe("");
    expect(onApply).not.toHaveBeenCalled();
  });

  test("Map whole repository is offered only when something narrows the map", () => {
    const { onMapRepository } = setup();
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("button", { name: "Map whole repository" }));
    expect(onMapRepository).toHaveBeenCalled();

    cleanup();
    setup({ query: "", scoped: false });
    fireEvent.click(trigger());
    expect(screen.queryByRole("button", { name: "Map whole repository" })).toBeNull();
  });
});
