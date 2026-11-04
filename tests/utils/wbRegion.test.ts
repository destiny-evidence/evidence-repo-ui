import { describe, expect, test } from "vitest";
import { isWbRegionId, wbRegionName } from "@/utils/wbRegion";

describe("wbRegion", () => {
  test("isWbRegionId accepts only the exact upper-case ids", () => {
    expect(isWbRegionId("SAS")).toBe(true);
    expect(isWbRegionId("sas")).toBe(false);
    expect(isWbRegionId("EU")).toBe(false);
    expect(isWbRegionId("")).toBe(false);
  });

  test("wbRegionName maps an id to its display name, else returns the id", () => {
    expect(wbRegionName("SSF")).toBe("Sub-Saharan Africa");
    expect(wbRegionName("XXX")).toBe("XXX");
  });
});
