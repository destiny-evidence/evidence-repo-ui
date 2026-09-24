import { NewTabLink } from "@/components/common/NewTabLink";
import { FEEDBACK_FORM_URL } from "@/config";
import "./FeedbackFAB.css";

export function FeedbackFAB() {
  if (!FEEDBACK_FORM_URL) return null;
  return (
    <NewTabLink
      class="feedback-fab"
      href={FEEDBACK_FORM_URL}
      aria-label="Send feedback (opens form in a new tab)"
      event={{ category: "Feedback", action: "FAB Clicked" }}
      icon={false}
    >
      Feedback
    </NewTabLink>
  );
}
