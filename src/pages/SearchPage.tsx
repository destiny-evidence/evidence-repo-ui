import "./SearchPage.css";

interface SearchPageProps {
  path?: string;
  community?: string;
}

export function SearchPage({ community }: SearchPageProps) {
  return (
    <div class="search-page">
      <h1>Search {community}</h1>
      <p>Search page for {community}.</p>
    </div>
  );
}
