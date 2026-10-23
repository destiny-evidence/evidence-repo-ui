import { NewTabLink } from "@/components/common/NewTabLink";
import { FEEDBACK_FORM_URL } from "@/config";

export function FeedbackLink() {
  if (!FEEDBACK_FORM_URL) return null;
  return (
    <NewTabLink
      class="app-nav__link"
      href={FEEDBACK_FORM_URL}
      aria-label="Send feedback (opens form in a new tab)"
      event={{ category: "Feedback", action: "Nav Clicked" }}
    >
      Feedback
    </NewTabLink>
  );
}
