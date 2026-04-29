import { describe, test, expect } from "vitest";
import { parseYear } from "@/utils/year";

describe("parseYear", () => {
  test("accepts a plain decimal positive integer", () => {
    expect(parseYear("2020")).toBe(2020);
    expect(parseYear("1")).toBe(1);
    expect(parseYear("9999")).toBe(9999);
  });

  test("trims surrounding whitespace", () => {
    expect(parseYear("  2020  ")).toBe(2020);
    expect(parseYear("\t2020\n")).toBe(2020);
  });

  test("rejects null and undefined", () => {
    expect(parseYear(null)).toBeUndefined();
    expect(parseYear(undefined)).toBeUndefined();
  });

  test("rejects empty and whitespace-only strings", () => {
    expect(parseYear("")).toBeUndefined();
    expect(parseYear("   ")).toBeUndefined();
  });

  test("rejects zero and negatives", () => {
    expect(parseYear("0")).toBeUndefined();
    expect(parseYear("-5")).toBeUndefined();
  });

  test("rejects scientific notation, hex, decimals, leading +", () => {
    expect(parseYear("2e3")).toBeUndefined();
    expect(parseYear("0x10")).toBeUndefined();
    expect(parseYear("2.5")).toBeUndefined();
    expect(parseYear("+2020")).toBeUndefined();
  });

  test("rejects values past Number.MAX_SAFE_INTEGER", () => {
    // 16 nines is past 2**53 - 1 (9007199254740991)
    expect(parseYear("9999999999999999")).toBeUndefined();
  });

  test("rejects non-numeric strings", () => {
    expect(parseYear("twenty")).toBeUndefined();
    expect(parseYear("2020a")).toBeUndefined();
    expect(parseYear("a2020")).toBeUndefined();
  });
});
