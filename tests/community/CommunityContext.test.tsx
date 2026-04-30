import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/preact";
import { CommunityProvider, useCommunity } from "@/community/CommunityContext";
import { URL_CHANGE_EVENT } from "@/services/navigation";

function TestConsumer() {
  const community = useCommunity();
  return (
    <span data-testid="community">{community ? community.name : "null"}</span>
  );
}

function setPath(path: string) {
  window.history.replaceState(null, "", path);
}

describe("useCommunity", () => {
  beforeEach(() => {
    setPath("/");
  });

  test("returns the community matching the URL's first path segment on mount", () => {
    setPath("/esea");
    render(
      <CommunityProvider>
        <TestConsumer />
      </CommunityProvider>,
    );
    expect(screen.getByTestId("community")).toHaveTextContent("Education");
  });

  test("updates when the browser fires popstate", () => {
    setPath("/");
    render(
      <CommunityProvider>
        <TestConsumer />
      </CommunityProvider>,
    );
    expect(screen.getByTestId("community")).toHaveTextContent("null");

    act(() => {
      setPath("/esea");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByTestId("community")).toHaveTextContent("Education");
  });

  test("returns null when the slug does not match any registered community", () => {
    setPath("/not-a-real-community");
    render(
      <CommunityProvider>
        <TestConsumer />
      </CommunityProvider>,
    );
    expect(screen.getByTestId("community")).toHaveTextContent("null");
  });

  test("updates when navigation fires URL_CHANGE_EVENT", () => {
    setPath("/");
    render(
      <CommunityProvider>
        <TestConsumer />
      </CommunityProvider>,
    );
    expect(screen.getByTestId("community")).toHaveTextContent("null");

    act(() => {
      setPath("/esea");
      window.dispatchEvent(new Event(URL_CHANGE_EVENT));
    });
    expect(screen.getByTestId("community")).toHaveTextContent("Education");
  });

  test("throws when used outside CommunityProvider", () => {
    // Suppress Preact's expected error noise from the throw during render.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow(
      /useCommunity must be used within a CommunityProvider/,
    );
    spy.mockRestore();
  });
});
