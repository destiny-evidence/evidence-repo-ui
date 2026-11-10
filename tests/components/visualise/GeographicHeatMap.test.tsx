import { describe, test, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/preact";
import type { WorldGeometry } from "@/components/visualise/geo/worldGeometry";

const { mockLoad } = vi.hoisted(() => ({ mockLoad: vi.fn<() => WorldGeometry>() }));
vi.mock("@/components/visualise/geo/worldGeometry", () => ({
  loadWorldGeometry: mockLoad,
}));

const GEOMETRY: WorldGeometry = {
  viewBox: "0 0 960 440",
  outline: "M0,0Z",
  countries: [
    { code: "FR", d: "M1,1Z", anchor: { x: 1, y: 1 } },
    { code: "KE", d: "M2,2Z", anchor: { x: 2, y: 2 } },
    { code: "SG", d: "M3,3Z", anchor: { x: 3, y: 3 } },
    { code: null, d: "M4,4Z", anchor: { x: 4, y: 4 } },
  ],
  borders: "M5,5Z",
  dots: [
    { code: "SG", x: 10, y: 10 },
    { code: "GI", x: 20, y: 20 },
  ],
};

const onSelect = vi.fn();
const onView = vi.fn();
const baseProps = {
  label: "References by country",
  countNoun: "references",
  total: 200,
  viewHref: (code: string) => `/esea?country=${code}`,
  onSelect,
  onView,
};

// The component caches the loaded shapes at module level, so each test gets a
// fresh copy of it.
async function renderMap(counts: Record<string, number> | undefined) {
  const { GeographicHeatMap } = await import("@/components/visualise/GeographicHeatMap");
  return render(
    <GeographicHeatMap counts={counts && new Map(Object.entries(counts))} {...baseProps} />,
  );
}

beforeEach(() => {
  vi.resetModules();
  mockLoad.mockReset().mockReturnValue(GEOMETRY);
  onSelect.mockReset();
  onView.mockReset();
});

describe("GeographicHeatMap", () => {
  test("shows a loading state until the shapes load", async () => {
    await renderMap({ FR: 10 });
    expect(screen.getByText("Loading map…")).toBeInTheDocument();
    expect(await screen.findByRole("group", { name: "References by country" })).toBeInTheDocument();
    expect(screen.queryByText("Loading map…")).not.toBeInTheDocument();
  });

  test("keeps loading until the counts arrive, rather than drawing an empty map", async () => {
    const { GeographicHeatMap } = await import("@/components/visualise/GeographicHeatMap");
    const { rerender } = render(<GeographicHeatMap counts={undefined} {...baseProps} />);
    await vi.waitFor(() => expect(mockLoad).toHaveBeenCalled());
    expect(screen.getByRole("status")).toHaveTextContent("Loading map…");
    expect(screen.queryByRole("group")).not.toBeInTheDocument();

    rerender(<GeographicHeatMap counts={new Map([["FR", 3]])} {...baseProps} />);
    expect(await screen.findByRole("button", { name: "France: 3 references" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  test("shows an error if the shapes fail to load", async () => {
    mockLoad.mockImplementation(() => {
      throw new Error("boom");
    });
    await renderMap({});
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn’t load the map.");
  });

  test("shades each country by its band and labels it with name and count", async () => {
    await renderMap({ FR: 1234, KE: 3 });
    const france = await screen.findByRole("button", { name: "France: 1,234 references" });
    const kenya = screen.getByRole("button", { name: "Kenya: 3 references" });
    expect(france).toHaveAttribute("data-shade", "5");
    expect(kenya).toHaveAttribute("data-shade", "1");
  });

  test("countries without references use the empty fill", async () => {
    await renderMap({ FR: 5 });
    expect(await screen.findByRole("img", { name: "Kenya: no references" })).toHaveAttribute(
      "data-shade",
      "0",
    );
  });

  test("a country with a dot is announced once, on the dot", async () => {
    await renderMap({ SG: 40 });
    const [singapore] = await screen.findAllByRole("button", { name: /^Singapore/ });
    expect(screen.getAllByRole("button", { name: /^Singapore/ })).toHaveLength(1);
    expect(screen.queryByRole("img", { name: /^Singapore/ })).not.toBeInTheDocument();
    expect(singapore.tagName).toBe("circle");
  });

  test("small countries without references get no dot and are labelled on their shape", async () => {
    const { container } = await renderMap({ FR: 5 });
    expect((await screen.findByRole("img", { name: "Singapore: no references" })).tagName).toBe("path");
    expect(screen.queryByRole("img", { name: /^Gibraltar/ })).not.toBeInTheDocument();
    expect(container.querySelectorAll("circle")).toHaveLength(0);
  });

  test("shapes without a code are hidden from assistive technology", async () => {
    const { container } = await renderMap({});
    await screen.findByRole("group");
    expect(container.querySelector('path[d="M4,4Z"]')).toHaveAttribute("aria-hidden", "true");
    expect(screen.getAllByRole("img")).toHaveLength(3);
  });

  test("the legend lists zero and each band's range", async () => {
    const { container } = await renderMap({ FR: 1234 });
    await screen.findByRole("group");
    const legend = container.querySelector("figcaption")!;
    expect(legend).toHaveTextContent("references");
    expect([...legend.querySelectorAll(".geo-heat-map__legend-item")].map((e) => e.textContent)).toEqual([
      "0",
      "1–4",
      "5–19",
      "20–49",
      "50–199",
      "200–1,234",
    ]);
  });

  describe("selecting a country", () => {
    const COUNTS = { FR: 50, KE: 25, GI: 1 };
    const country = (name: RegExp) => screen.getByRole("button", { name });

    async function openKenya() {
      await renderMap(COUNTS);
      fireEvent.click(await screen.findByRole("button", { name: /^Kenya/ }));
      return screen.getByRole("dialog", { name: "Kenya" });
    }

    test("opens a popup with the count and share instead of navigating", async () => {
      const popup = await openKenya();
      expect(popup).toHaveTextContent("25");
      expect(popup).toHaveTextContent("references · 13% of total");
      expect(country(/^Kenya/)).toHaveAttribute("aria-expanded", "true");
      expect(onSelect).toHaveBeenCalledWith("KE");
      expect(onView).not.toHaveBeenCalled();
    });

    test("moves focus into the popup and keeps it there", async () => {
      const popup = await openKenya();
      const view = screen.getByRole("link", { name: /view references/i });
      const close = screen.getByRole("button", { name: "Close" });
      expect(view).toHaveFocus();

      fireEvent.keyDown(view, { key: "Tab" });
      expect(close).toHaveFocus();
      fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
      expect(view).toHaveFocus();
      expect(popup).toContainElement(document.activeElement as HTMLElement);
    });

    test.each([
      ["Escape", () => fireEvent.keyDown(document.activeElement!, { key: "Escape" })],
      ["the close button", () => fireEvent.click(screen.getByRole("button", { name: "Close" }))],
    ])("%s closes it and returns focus to the country", async (_label, closeIt) => {
      await openKenya();
      closeIt();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(country(/^Kenya/)).toHaveFocus();
    });

    test("a click outside closes it", async () => {
      await openKenya();
      fireEvent.click(document.body);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    test("clicking another country moves the popup to it", async () => {
      await openKenya();
      fireEvent.click(country(/^France/));
      expect(screen.getByRole("dialog", { name: "France" })).toBeInTheDocument();
      expect(screen.getAllByRole("dialog")).toHaveLength(1);
    });

    test("View links to the country's search and hands every click over", async () => {
      await openKenya();
      const view = screen.getByRole("link", { name: /view references/i });
      expect(view).toHaveAttribute("href", "/esea?country=KE");
      fireEvent.click(view, { metaKey: true });
      expect(onView).toHaveBeenCalledWith("KE", expect.objectContaining({ metaKey: true }));
    });

    test("countries without references can't be selected", async () => {
      await renderMap({ FR: 5 });
      const kenya = await screen.findByRole("img", { name: "Kenya: no references" });
      fireEvent.click(kenya);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    test("new counts close the popup", async () => {
      const { GeographicHeatMap } = await import("@/components/visualise/GeographicHeatMap");
      const { rerender } = render(
        <GeographicHeatMap counts={new Map(Object.entries(COUNTS))} {...baseProps} />,
      );
      fireEvent.click(await screen.findByRole("button", { name: /^Kenya/ }));
      rerender(<GeographicHeatMap counts={new Map([["KE", 3]])} {...baseProps} />);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    test("keyboard focus stays outlined while the mouse rests on another country", async () => {
      const { container } = await renderMap(COUNTS);
      fireEvent.mouseOver(await screen.findByRole("button", { name: /^France/ }));
      fireEvent.focus(country(/^Kenya/));
      const outlined = [...container.querySelectorAll(".geo-heat-map__highlight")];
      expect(outlined.map((el) => el.getAttribute("d"))).toEqual(["M1,1Z", "M2,2Z"]);
    });

    test("shows the country's name on hover", async () => {
      const { container } = await renderMap(COUNTS);
      fireEvent.mouseOver(await screen.findByRole("button", { name: /^France/ }));
      expect(container.querySelector(".geo-heat-map__tip")).toHaveTextContent("France");
      fireEvent.mouseLeave(container.querySelector(".geo-heat-map__frame")!);
      expect(container.querySelector(".geo-heat-map__tip")).not.toBeInTheDocument();
    });
  });

  describe("keyboard", () => {
    test("the map is one tab stop, and arrows step through countries by name", async () => {
      await renderMap({ KE: 25, FR: 50, GI: 1 });
      const france = await screen.findByRole("button", { name: /^France/ });
      const gibraltar = screen.getByRole("button", { name: /^Gibraltar/ });
      const kenya = screen.getByRole("button", { name: /^Kenya/ });
      expect([france, gibraltar, kenya].map((el) => el.getAttribute("tabindex"))).toEqual([
        "0",
        "-1",
        "-1",
      ]);

      france.focus();
      fireEvent.keyDown(france, { key: "ArrowRight" });
      expect(gibraltar).toHaveFocus();
      fireEvent.keyDown(gibraltar, { key: "ArrowDown" });
      expect(kenya).toHaveFocus();
      fireEvent.keyDown(kenya, { key: "ArrowRight" });
      expect(kenya).toHaveFocus();
      fireEvent.keyDown(kenya, { key: "ArrowUp" });
      expect(gibraltar).toHaveFocus();
      expect(gibraltar).toHaveAttribute("tabindex", "0");
      expect(france).toHaveAttribute("tabindex", "-1");
    });

    test.each(["Enter", " "])("%j opens the popup", async (key) => {
      await renderMap({ KE: 25 });
      fireEvent.keyDown(await screen.findByRole("button", { name: /^Kenya/ }), { key });
      expect(screen.getByRole("dialog", { name: "Kenya" })).toBeInTheDocument();
    });
  });
});
