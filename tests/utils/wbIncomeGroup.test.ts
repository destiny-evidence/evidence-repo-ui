import { describe, expect, test } from "vitest";
import { isWbIncomeGroupId, wbIncomeGroupName } from "@/utils/wbIncomeGroup";

describe("wbIncomeGroup", () => {
  test("isWbIncomeGroupId accepts only the exact upper-case ids", () => {
    expect(isWbIncomeGroupId("LIC")).toBe(true);
    expect(isWbIncomeGroupId("lic")).toBe(false);
    expect(isWbIncomeGroupId("HI")).toBe(false);
    expect(isWbIncomeGroupId("")).toBe(false);
  });

  test("wbIncomeGroupName maps an id to its display name, else returns the id", () => {
    expect(wbIncomeGroupName("LMC")).toBe("Lower middle income");
    expect(wbIncomeGroupName("XXX")).toBe("XXX");
  });
});
