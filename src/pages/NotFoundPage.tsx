import "./NotFoundPage.css";

interface NotFoundPageProps {
  path?: string;
  default?: boolean;
}

export function NotFoundPage(_props: NotFoundPageProps) {
  return (
    <div class="not-found-page">
      <h1>Page not found</h1>
      <p>
        The page you're looking for doesn't exist.{" "}
        <a href="/esea">Go to search</a>.
      </p>
    </div>
  );
}
