import { describe, test, expect, vi, beforeEach, afterEach, onTestFinished } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/preact";
import type { WorldGeometry } from "@/components/visualise/geo/worldGeometry";

const { mockLoad } = vi.hoisted(() => ({ mockLoad: vi.fn<() => WorldGeometry>() }));
vi.mock("@/components/visualise/geo/worldGeometry", () => ({
  loadWorldGeometry: mockLoad,
}));

const GEOMETRY: WorldGeometry = {
  viewBox: "0 0 960 440",
  outline: "M0,0Z",
  countries: [
    { countryCode: "FR", d: "M1,1Z", anchor: { x: 1, y: 1 } },
    { countryCode: "KE", d: "M2,2Z", anchor: { x: 2, y: 2 } },
    { countryCode: "SG", d: "M3,3Z", anchor: { x: 3, y: 3 } },
    { countryCode: null, d: "M4,4Z", anchor: { x: 4, y: 4 } },
  ],
  borders: "M5,5Z",
  dots: [
    { countryCode: "SG", x: 10, y: 10, size: 2 },
    { countryCode: "GI", x: 20, y: 20, size: null },
  ],
};

const onSelect = vi.fn();
const onView = vi.fn();
const baseProps = {
  label: "References by country",
  countNoun: "references",
  total: 200,
  viewHref: (countryCode: string) => `/esea?country=${countryCode}`,
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

  test("shapes without a countryCode are hidden from assistive technology", async () => {
    const { container } = await renderMap({});
    await screen.findByRole("group", { name: "References by country" });
    expect(container.querySelector('path[d="M4,4Z"]')).toHaveAttribute("aria-hidden", "true");
    expect(screen.getAllByRole("img")).toHaveLength(3);
  });

  test("the legend lists zero and each band's range", async () => {
    const { container } = await renderMap({ FR: 1234 });
    await screen.findByRole("group", { name: "References by country" });
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

    afterEach(() => {
      vi.restoreAllMocks();
    });
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

    test("a middle click on View is handed over too, but not a right click", async () => {
      await openKenya();
      const view = screen.getByRole("link", { name: /view references/i });
      fireEvent(view, new MouseEvent("auxclick", { bubbles: true, button: 2 }));
      expect(onView).not.toHaveBeenCalled();
      fireEvent(view, new MouseEvent("auxclick", { bubbles: true, button: 1 }));
      expect(onView).toHaveBeenCalledWith("KE", expect.objectContaining({ button: 1 }));
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
      act(() => country(/^Kenya/).focus());
      const outlined = [...container.querySelectorAll(".geo-heat-map__highlight")];
      expect(outlined.map((el) => el.getAttribute("d"))).toEqual(["M1,1Z", "M2,2Z"]);
    });

    test("closing the popup with the mouse doesn't leave the country outlined", async () => {
      // Browsers don't mark focus that follows a mouse click as focus-visible.
      const matches = Element.prototype.matches;
      const spy = vi
        .spyOn(Element.prototype, "matches")
        .mockImplementation(function (this: Element, selector) {
          return selector === ":focus-visible" ? false : matches.call(this, selector);
        });
      onTestFinished(() => spy.mockRestore());
      await openKenya();
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      expect(country(/^Kenya/)).toHaveFocus();
      expect(document.querySelector(".geo-heat-map__highlight")).toBeNull();
      expect(document.querySelector(".geo-heat-map__tip")).toBeNull();
    });

    test("a click opens the popup where it lands", async () => {
      vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(960);
      vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(440);
      vi.spyOn(SVGElement.prototype, "getBoundingClientRect").mockReturnValue(
        DOMRect.fromRect({ width: 960, height: 440 }),
      );
      await renderMap(COUNTS);
      fireEvent.click(await screen.findByRole("button", { name: /^Kenya/ }), {
        clientX: 300,
        clientY: 100,
        detail: 1,
      });
      expect(screen.getByRole("dialog", { name: "Kenya" })).toHaveStyle({ left: "312px" });
    });

    test("the hover tip sits below and right of the mouse, flipping at the edges", async () => {
      vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(960);
      vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(440);
      const { container } = await renderMap(COUNTS);
      const france = await screen.findByRole("button", { name: /^France/ });
      fireEvent.mouseOver(france);
      const tip = () => container.querySelector(".geo-heat-map__tip");
      fireEvent.mouseMove(france, { clientX: 200, clientY: 100 });
      expect(tip()).toHaveStyle({ left: "214px", top: "114px" });
      fireEvent.mouseMove(france, { clientX: 955, clientY: 435 });
      expect(tip()).toHaveStyle({ left: "941px", top: "421px" });
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

    test("the map tells screen readers how to move around it", async () => {
      await renderMap({ KE: 25 });
      expect(await screen.findByRole("group", { name: "References by country" })).toHaveAccessibleDescription(
        "Use the arrow keys to move between countries and Enter to select one.",
      );
    });

    test("no keyboard hint when no country can be selected", async () => {
      await renderMap({});
      expect(
        await screen.findByRole("group", { name: "References by country" }),
      ).not.toHaveAttribute("aria-describedby");
    });

    test.each(["Enter", " "])("%j opens the popup", async (key) => {
      await renderMap({ KE: 25 });
      fireEvent.keyDown(await screen.findByRole("button", { name: /^Kenya/ }), { key });
      expect(screen.getByRole("dialog", { name: "Kenya" })).toBeInTheDocument();
    });
  });

  describe("zoom", () => {
    // Reduced motion, so the controls zoom without animating.
    const matchMedia = (matches: boolean) => (media: string) => ({ matches, media });
    beforeEach(() => {
      vi.stubGlobal("matchMedia", matchMedia(true));
    });

    afterEach(() => {
      vi.stubGlobal("matchMedia", matchMedia(false));
      vi.restoreAllMocks();
    });

    const control = (name: string) => screen.getByRole("button", { name });
    const transform = (container: Element) =>
      container.querySelector(".geo-heat-map__svg > g")!.getAttribute("transform");

    test("the controls zoom in and out within their limits, and reset", async () => {
      const { container } = await renderMap({ FR: 5 });
      await screen.findByRole("group", { name: "Zoom" });
      expect(control("Zoom out")).toHaveAttribute("aria-disabled", "true");
      expect(control("Reset zoom")).toHaveAttribute("aria-disabled", "true");

      fireEvent.click(control("Zoom in"));
      expect(transform(container)).toBe("translate(-480 -220) scale(2)");
      expect(control("Zoom out")).toHaveAttribute("aria-disabled", "false");

      for (let i = 0; i < 4; i++) fireEvent.click(control("Zoom in"));
      expect(transform(container)).toMatch(/scale\(32\)$/);
      expect(control("Zoom in")).toHaveAttribute("aria-disabled", "true");

      fireEvent.click(control("Reset zoom"));
      expect(transform(container)).toBe("translate(0 0) scale(1)");
    });

    test("using the controls leaves an open popup open", async () => {
      await renderMap({ KE: 25 });
      fireEvent.click(await screen.findByRole("button", { name: /^Kenya/ }));
      fireEvent.click(control("Zoom in"));
      expect(screen.getByRole("dialog", { name: "Kenya" })).toBeInTheDocument();
    });

    test("dots are the same size on screen at any width or zoom", async () => {
      vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(480);
      const { container } = await renderMap({ GI: 1 });
      await screen.findByRole("button", { name: /^Gibraltar/ });
      const dot = () => container.querySelector(".geo-heat-map__dot");
      // 5px at half the viewBox's width is 10 units.
      expect(dot()).toHaveAttribute("r", "10");
      fireEvent.click(control("Zoom in"));
      expect(dot()).toHaveAttribute("r", "5");
    });

    test("a small country's shape takes over from its dot once it's big enough", async () => {
      vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(960);
      await renderMap({ SG: 40, GI: 1 });
      expect((await screen.findByRole("button", { name: /^Singapore/ })).tagName).toBe("circle");

      // Singapore's 2 units are 16px across at 8× and 32px at 16×.
      for (let i = 0; i < 3; i++) fireEvent.click(control("Zoom in"));
      expect(screen.getByRole("button", { name: /^Singapore/ }).tagName).toBe("circle");
      fireEvent.click(control("Zoom in"));
      expect(screen.getByRole("button", { name: /^Singapore/ }).tagName).toBe("path");
      expect(screen.getByRole("button", { name: /^Gibraltar/ }).tagName).toBe("circle");
    });

    test("closing returns focus to the selected country after its dot gives way", async () => {
      vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(960);
      const { container } = await renderMap({ SG: 40 });
      fireEvent.click(await screen.findByRole("button", { name: /^Singapore/ }));
      for (let i = 0; i < 4; i++) fireEvent.click(control("Zoom in"));
      // Zoomed past Singapore, so its popup is hidden but still there.
      fireEvent.click(container.querySelector(".geo-heat-map__popup-close")!);
      const singapore = screen.getByRole("button", { name: /^Singapore/ });
      expect(singapore.tagName).toBe("path");
      expect(singapore).toHaveFocus();
    });

    test("Enter on a country out of view pans there at once, ready for the popup", async () => {
      const { container } = await renderMap({ FR: 50 });
      const france = await screen.findByRole("button", { name: /^France/ });
      fireEvent.click(control("Zoom in"));
      fireEvent.click(control("Zoom in"));
      vi.stubGlobal("matchMedia", matchMedia(false));
      fireEvent.keyDown(france, { key: "Enter" });
      expect(transform(container)).toBe("translate(0 0) scale(4)");
    });

    test("arrow keys pan to a country that's out of view", async () => {
      const { container } = await renderMap({ FR: 50, GI: 1 });
      const france = await screen.findByRole("button", { name: /^France/ });
      fireEvent.click(control("Zoom in"));
      fireEvent.click(control("Zoom in"));
      expect(transform(container)).toBe("translate(-1440 -660) scale(4)");

      france.focus();
      fireEvent.keyDown(france, { key: "ArrowRight" });
      expect(transform(container)).toBe("translate(0 0) scale(4)");
    });
  });
});
