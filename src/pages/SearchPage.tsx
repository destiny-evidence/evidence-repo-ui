import { findCommunity } from "@/services/communities";
import { NotFoundPage } from "./NotFoundPage";
import "./SearchPage.css";

interface SearchPageProps {
  path?: string;
  community?: string;
}

export function SearchPage({ community: slug }: SearchPageProps) {
  const community = slug ? findCommunity(slug) : undefined;
  if (!community) return <NotFoundPage />;

  return (
    <div class="search-page">
      <h1>Search {community.name}</h1>
      <p>Search page for {community.name}.</p>
    </div>
  );
}
