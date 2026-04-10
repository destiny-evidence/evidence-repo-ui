import { render, screen } from "@testing-library/preact";
import { App } from "@/App";

test("renders the app header", () => {
  render(<App />);
  expect(screen.getByText("Evidence Repository")).toBeInTheDocument();
});

test("renders search page for valid community", () => {
  history.pushState({}, "", "/esea");
  render(<App />);
  expect(screen.getByText("Search ESEA")).toBeInTheDocument();
});

test("renders record detail page for valid community", () => {
  history.pushState({}, "", "/esea/references/123");
  render(<App />);
  expect(screen.getByText("Reference 123")).toBeInTheDocument();
});

test("renders not found for invalid community", () => {
  history.pushState({}, "", "/banana");
  render(<App />);
  expect(screen.getByText("Page not found")).toBeInTheDocument();
});
