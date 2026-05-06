import { describe, test, expect } from "vitest";
import { countryName } from "@/utils/country";

describe("countryName", () => {
  test("translates ISO 3166-1 alpha-2 codes to English names", () => {
    expect(countryName("AU")).toBe("Australia");
    expect(countryName("NL")).toBe("Netherlands");
  });

  test("returns the input unchanged when the code is not a valid region", () => {
    expect(countryName("Netherlands")).toBe("Netherlands");
    expect(countryName("Not reported")).toBe("Not reported");
    expect(countryName("")).toBe("");
  });
});
