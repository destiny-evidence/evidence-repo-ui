import { render, screen, fireEvent } from "@testing-library/preact";
import { App } from "@/App";

test("renders the app header", () => {
  render(<App />);
  expect(screen.getByText("Evidence Repository")).toBeInTheDocument();
});

test("renders search page for valid community", () => {
  history.pushState({}, "", "/esea");
  render(<App />);
  // Hero is the new SearchPage's stable content; corpus/result fetches may
  // hit the network without mocks, but the hero renders synchronously.
  expect(
    screen.getByRole("heading", { name: /search the evidence/i }),
  ).toBeInTheDocument();
});

test("renders record detail page for valid community", () => {
  history.pushState({}, "", "/esea/references/123");
  render(<App />);
  expect(screen.getByText("Loading…")).toBeInTheDocument();
});

test("renders not found for invalid community", () => {
  history.pushState({}, "", "/banana");
  render(<App />);
  expect(screen.getByText("Page not found")).toBeInTheDocument();
});

// Regression test for issue #27 review finding: preact-router intercepts
// internal anchor clicks and routes via history.pushState without firing
// popstate or our URL_CHANGE_EVENT. Without bridging that gap, the
// CommunityProvider stays on the old slug and SearchPage falls back to
// NotFound even though the router moved to /esea.
test("clicking Go to search from /banana shows the search page", () => {
  history.pushState({}, "", "/banana");
  render(<App />);
  expect(screen.getByText("Page not found")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("link", { name: /go to search/i }));

  expect(
    screen.getByRole("heading", { name: /search the evidence/i }),
  ).toBeInTheDocument();
});
