import type { AbstractContentEnhancement } from "@/types/models";
import "./AbstractSection.css";

interface AbstractSectionProps {
  abstract: AbstractContentEnhancement | null;
}

// OpenAlex "unavailable" sentinel leaked into some abstract fields, for
// example W6946467789.
const OPENALEX_UNAVAILABLE_SENTINEL = ":unav";

export function AbstractSection({ abstract }: AbstractSectionProps) {
  if (!abstract) return null;
  const body = abstract.abstract.trim();
  if (!body || body === OPENALEX_UNAVAILABLE_SENTINEL) return null;
  return (
    <section class="abstract-section">
      <h2 class="abstract-section__heading lg-section-label">Abstract</h2>
      <div class="abstract-section__body">{body}</div>
    </section>
  );
}
