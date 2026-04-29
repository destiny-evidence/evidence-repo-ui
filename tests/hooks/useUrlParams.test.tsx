import { describe, test, expect } from "vitest";
import { renderHook, act } from "@testing-library/preact";
import { useUrlParams } from "@/hooks/useUrlParams";
import { URL_CHANGE_EVENT } from "@/services/navigation";

describe("useUrlParams", () => {
  test("returns current window.location.search", () => {
    history.replaceState(null, "", "/test_community?q=phonics");
    const { result } = renderHook(() => useUrlParams());
    expect(result.current).toBe("?q=phonics");
  });

  test("rerenders on urlchange event", () => {
    history.replaceState(null, "", "/test_community?q=a");
    const { result } = renderHook(() => useUrlParams());
    expect(result.current).toBe("?q=a");

    act(() => {
      history.pushState(null, "", "/test_community?q=b");
      window.dispatchEvent(new Event(URL_CHANGE_EVENT));
    });
    expect(result.current).toBe("?q=b");
  });

  test("rerenders on popstate", () => {
    history.replaceState(null, "", "/test_community?q=a");
    const { result } = renderHook(() => useUrlParams());
    expect(result.current).toBe("?q=a");

    act(() => {
      history.pushState(null, "", "/test_community?q=b");
      window.dispatchEvent(new Event("popstate"));
    });
    expect(result.current).toBe("?q=b");
  });
});
