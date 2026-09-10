import { describe, test, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import {
  navigate,
  pathSlug,
  recordDetailPath,
  URL_CHANGE_EVENT,
} from "@/services/navigation";

describe("recordDetailPath", () => {
  test("matches the RecordDetailPage route shape", () => {
    expect(recordDetailPath("esea", "019a4c8f")).toBe(
      "/esea/references/019a4c8f",
    );
  });
});

describe("pathSlug", () => {
  test.each([
    ["/hpv", "hpv"],
    ["/hpv/references/019a4c8f", "hpv"],
    ["/hpv/", "hpv"],
  ])("reads the community slug from %s", (pathname, slug) => {
    expect(pathSlug(pathname)).toBe(slug);
  });

  test.each(["/", ""])("is undefined for the slug-less root (%s)", (pathname) => {
    expect(pathSlug(pathname)).toBeUndefined();
  });
});

describe("navigate", () => {
  let pushSpy: MockInstance;
  let replaceSpy: MockInstance;
  let dispatchSpy: MockInstance;

  beforeEach(() => {
    pushSpy = vi.spyOn(history, "pushState");
    replaceSpy = vi.spyOn(history, "replaceState");
    dispatchSpy = vi.spyOn(window, "dispatchEvent");
  });

  afterEach(() => {
    pushSpy.mockRestore();
    replaceSpy.mockRestore();
    dispatchSpy.mockRestore();
  });

  test("push writes via history.pushState and fires urlchange", () => {
    navigate("/test_community?q=phonics", { mode: "push" });
    expect(pushSpy).toHaveBeenCalledWith(null, "", "/test_community?q=phonics");
    expect(replaceSpy).not.toHaveBeenCalled();
    const eventArg = dispatchSpy.mock.calls[0][0] as Event;
    expect(eventArg.type).toBe(URL_CHANGE_EVENT);
  });

  test("replace writes via history.replaceState and fires urlchange", () => {
    navigate("/test_community?q=phonics", { mode: "replace" });
    expect(replaceSpy).toHaveBeenCalledWith(null, "", "/test_community?q=phonics");
    expect(pushSpy).not.toHaveBeenCalled();
    const eventArg = dispatchSpy.mock.calls[0][0] as Event;
    expect(eventArg.type).toBe(URL_CHANGE_EVENT);
  });

  test("defaults to push mode", () => {
    navigate("/test_community");
    expect(pushSpy).toHaveBeenCalled();
  });
});
