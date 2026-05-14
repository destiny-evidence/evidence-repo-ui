import { useEffect } from "preact/hooks";
import { FEEDBACK_FORM_URL } from "@/config";
import "./FeedbackFAB.css";

function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = (el as HTMLElement).tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    (el as HTMLElement).isContentEditable
  );
}

export function FeedbackFAB() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "?" && !isTypingTarget(document.activeElement)) {
        e.preventDefault();
        window.open(FEEDBACK_FORM_URL, "_blank", "noopener,noreferrer");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <a
      class="feedback-fab"
      href={FEEDBACK_FORM_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Send feedback (opens form in a new tab)"
    >
      <span class="feedback-fab__icon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round">
          <path d="M7 1v12M1 7h12" />
        </svg>
      </span>
      Feedback
    </a>
  );
}
