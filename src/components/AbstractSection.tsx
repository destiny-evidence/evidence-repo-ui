import type { AbstractContentEnhancement } from "@/types/models";
import {
  decodeHtmlEntities,
  stripAbstractLabelPrefix,
} from "@/services/textUtils";
import "./AbstractSection.css";

interface AbstractSectionProps {
  abstract: AbstractContentEnhancement | null;
}

// OpenAlex "unavailable" sentinel leaked into the abstract field for some
// records (e.g., W6946467789). Treat it as absent so we don't render a
// 5-character literal block.
const OPENALEX_UNAVAILABLE_SENTINEL = ":unav";

export function AbstractSection({ abstract }: AbstractSectionProps) {
  if (!abstract) return null;
  // Entity decoding only. Mojibake (double-encoded UTF-8 leaking from the
  // EEF EPPI parser) renders as-is — the fix belongs upstream in the
  // parser, not as silent client-side repair.
  const body = stripAbstractLabelPrefix(
    decodeHtmlEntities(abstract.abstract),
  ).trim();
  if (!body || body === OPENALEX_UNAVAILABLE_SENTINEL) return null;
  return (
    <section class="abstract-section">
      <h2 class="abstract-section__heading">Abstract</h2>
      <div class="abstract-section__body">{body}</div>
    </section>
  );
}
