interface Prefill {
  referenceUrl: string;
  name?: string;
  email?: string;
}

const PLACEHOLDER = /\{(\w+)\}/g;

const PREFILLABLE = [
  "referenceUrl",
  "name",
  "email",
] as const satisfies readonly (keyof Prefill)[];

const isPrefillable = (token: string): token is keyof Prefill =>
  (PREFILLABLE as readonly string[]).includes(token);

/**
 * Fill a Google Forms pre-filled link template with this request's answers.
 * Anything but an https URL yields undefined, which hides the request panel —
 * a misconfigured environment must not put a broken link, or a scheme like
 * javascript:, into an href.
 */
export function buildEnrichmentFormUrl(
  template: string,
  values: Prefill,
): string | undefined {
  try {
    if (new URL(template).protocol !== "https:") return undefined;
  } catch {
    return undefined;
  }
  return template.replace(PLACEHOLDER, (placeholder, token: string) =>
    isPrefillable(token)
      ? encodeURIComponent(values[token] ?? "")
      : placeholder,
  );
}
