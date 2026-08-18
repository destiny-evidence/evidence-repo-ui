import { describe, test, expect } from "vitest";
import {
  buildEnrichmentFormUrl,
  referenceUrl,
} from "@/components/enrichment/enrichmentFormUrl";

const TEMPLATE =
  "https://forms.test/viewform?usp=pp_url&entry.1={referenceUrl}&entry.2={name}&entry.3={email}";
const REFERENCE_URL = "https://data.test/esea/references/019a4c8f?a=b";

const build = (values: Parameters<typeof buildEnrichmentFormUrl>[1]) =>
  buildEnrichmentFormUrl(TEMPLATE, values);

const paramsOf = (url: string | undefined) =>
  Object.fromEntries(new URL(url!).searchParams);

describe("buildEnrichmentFormUrl", () => {
  test("fills each placeholder with its encoded answer", () => {
    const url = build({
      referenceUrl: REFERENCE_URL,
      name: "Ada Lovelace",
      email: "ada@example.org",
    });

    // Encoded in the raw string, so the separators survive the query string...
    expect(url).toContain(
      "entry.1=https%3A%2F%2Fdata.test%2Fesea%2Freferences%2F019a4c8f%3Fa%3Db",
    );
    // ...and decode back to exactly the values we put in.
    expect(paramsOf(url)).toEqual({
      usp: "pp_url",
      "entry.1": REFERENCE_URL,
      "entry.2": "Ada Lovelace",
      "entry.3": "ada@example.org",
    });
  });

  test("leaves fields the session can't supply blank rather than tokenised", () => {
    const url = build({ referenceUrl: REFERENCE_URL });

    expect(url).toContain("entry.2=&entry.3=");
    expect(url).not.toContain("{name}");
    expect(url).not.toContain("{email}");
  });

  test("keeps placeholders it has no value for", () => {
    const url = buildEnrichmentFormUrl(
      "https://forms.test/viewform?entry.9={institution}",
      { referenceUrl: REFERENCE_URL },
    );

    expect(url).toBe("https://forms.test/viewform?entry.9={institution}");
  });

  test.each([["not-a-url"], [""], ["/forms/viewform"]])(
    "returns undefined for the unusable template %j",
    (template) => {
      expect(
        buildEnrichmentFormUrl(template, { referenceUrl: REFERENCE_URL }),
      ).toBeUndefined();
    },
  );
});

describe("referenceUrl", () => {
  test("builds the canonical record URL", () => {
    expect(referenceUrl("https://data.test", "esea", "019a4c8f")).toBe(
      "https://data.test/esea/references/019a4c8f",
    );
  });
});
