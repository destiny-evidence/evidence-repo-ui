import { findCommunity } from "@/services/communities";
import { NotFoundPage } from "./NotFoundPage";
import "./RecordDetailPage.css";

interface RecordDetailPageProps {
  path?: string;
  community?: string;
  id?: string;
}

export function RecordDetailPage({ community: slug, id }: RecordDetailPageProps) {
  const community = slug ? findCommunity(slug) : undefined;
  if (!community) return <NotFoundPage />;

  return (
    <div class="record-detail-page">
      <h1>Reference {id}</h1>
      <p>Record detail for reference {id} in {community.name}.</p>
    </div>
  );
}
