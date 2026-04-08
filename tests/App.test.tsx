import { render, screen } from "@testing-library/preact";
import { App } from "@/App";

test("renders the app header", () => {
  render(<App />);
  expect(screen.getByText("Evidence Repository")).toBeInTheDocument();
});
