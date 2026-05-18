import { FEEDBACK_FORM_URL } from "@/config";
import "./FeedbackFAB.css";

export function FeedbackFAB() {
  return (
    <a
      class="feedback-fab"
      href={FEEDBACK_FORM_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Send feedback (opens form in a new tab)"
    >
      Feedback
    </a>
  );
}
