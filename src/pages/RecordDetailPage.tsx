import "./RecordDetailPage.css";

interface RecordDetailPageProps {
  path?: string;
  community?: string;
  id?: string;
}

export function RecordDetailPage({ community, id }: RecordDetailPageProps) {
  return (
    <div class="record-detail-page">
      <h1>Reference {id}</h1>
      <p>Record detail for reference {id} in the {community} community.</p>
    </div>
  );
}
