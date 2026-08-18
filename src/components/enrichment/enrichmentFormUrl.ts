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
 * Returns undefined for a template that isn't a URL, so a misconfigured
 * environment hides the request panel rather than offering a broken link.
 */
export function buildEnrichmentFormUrl(
  template: string,
  values: Prefill,
): string | undefined {
  try {
    new URL(template);
  } catch {
    return undefined;
  }
  return template.replace(PLACEHOLDER, (placeholder, token: string) =>
    isPrefillable(token)
      ? encodeURIComponent(values[token] ?? "")
      : placeholder,
  );
}

export const referenceUrl = (origin: string, slug: string, id: string) =>
  `${origin}/${slug}/references/${id}`;
