import { useCommunity } from "@/community/CommunityContext";
import { NotFoundPage } from "./NotFoundPage";
import "./VisualisePage.css";

interface VisualisePageProps {
  path?: string;
}

export function VisualisePage(_props: VisualisePageProps) {
  const community = useCommunity();
  // Gate the route as well as the tab: a community without the flag should 404
  // here rather than see a placeholder for a feature it doesn't have.
  if (!community || !community.features.evidenceMap) return <NotFoundPage />;
  return (
    <div class="visualise-page">
      <h1 class="visualise-page__title">Evidence map</h1>
      <p class="visualise-page__lede">
        Visualise where evidence sits across two taxonomy dimensions. Coming
        soon.
      </p>
    </div>
  );
}
