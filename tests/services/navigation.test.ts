import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { navigate, URL_CHANGE_EVENT } from "@/services/navigation";

describe("navigate", () => {
  let pushSpy: ReturnType<typeof vi.spyOn>;
  let replaceSpy: ReturnType<typeof vi.spyOn>;
  let dispatchSpy: ReturnType<typeof vi.spyOn>;

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
