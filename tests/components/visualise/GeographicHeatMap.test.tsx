import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/preact";
import type { WorldGeometry } from "@/components/visualise/geo/worldGeometry";

const { mockLoad } = vi.hoisted(() => ({ mockLoad: vi.fn<() => WorldGeometry>() }));
vi.mock("@/components/visualise/geo/worldGeometry", () => ({
  loadWorldGeometry: mockLoad,
}));

const GEOMETRY: WorldGeometry = {
  viewBox: "0 0 960 440",
  outline: "M0,0Z",
  countries: [
    { code: "FR", d: "M1,1Z" },
    { code: "KE", d: "M2,2Z" },
    { code: "SG", d: "M3,3Z" },
    { code: null, d: "M4,4Z" },
  ],
  borders: "M5,5Z",
  dots: [
    { code: "SG", x: 10, y: 10 },
    { code: "GI", x: 20, y: 20 },
  ],
};

// The component caches the loaded shapes at module level, so each test gets a
// fresh copy of it.
async function renderMap(counts: Record<string, number> | undefined) {
  const { GeographicHeatMap } = await import("@/components/visualise/GeographicHeatMap");
  return render(
    <GeographicHeatMap
      counts={counts && new Map(Object.entries(counts))}
      label="References by country"
      countNoun="references"
    />,
  );
}

beforeEach(() => {
  vi.resetModules();
  mockLoad.mockReset().mockReturnValue(GEOMETRY);
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
    const props = { label: "References by country", countNoun: "references" };
    const { rerender } = render(<GeographicHeatMap counts={undefined} {...props} />);
    await vi.waitFor(() => expect(mockLoad).toHaveBeenCalled());
    expect(screen.getByRole("status")).toHaveTextContent("Loading map…");
    expect(screen.queryByRole("group")).not.toBeInTheDocument();

    rerender(<GeographicHeatMap counts={new Map([["FR", 3]])} {...props} />);
    expect(await screen.findByRole("img", { name: "France: 3 references" })).toBeInTheDocument();
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
    const france = await screen.findByRole("img", { name: "France: 1,234 references" });
    const kenya = screen.getByRole("img", { name: "Kenya: 3 references" });
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
    const [singapore] = await screen.findAllByRole("img", { name: /^Singapore/ });
    expect(screen.getAllByRole("img", { name: /^Singapore/ })).toHaveLength(1);
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
});
