const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

// Intl.DisplayNames throws RangeError on inputs that aren't structurally
// valid region codes (e.g. legacy data containing a full country name); fall
// back to the raw value so a bad row can't crash the surrounding view.
export function countryName(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}
