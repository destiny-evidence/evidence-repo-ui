import { render, screen } from "@testing-library/preact";
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
