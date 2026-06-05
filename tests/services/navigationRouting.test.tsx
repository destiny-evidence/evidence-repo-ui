import { describe, test, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/preact";
import Router from "preact-router";
import { navigate } from "@/services/navigation";

// Guards the cross-route behaviour the map's cell deep-link relies on:
// navigate() is a plain history.pushState, which preact-router ignores. The
// synthetic popstate it dispatches is what makes the Router actually swap the
// mounted page — without it the URL changes but the old page stays.
function PageA(_props: { path?: string }) {
  return <div>page-a</div>;
}
function PageB(_props: { path?: string }) {
  return <div>page-b</div>;
}

function renderRouter() {
  return render(
    <Router>
      <PageA path="/a" />
      <PageB path="/b" />
    </Router>,
  );
}

beforeEach(() => {
  history.replaceState(null, "", "/a");
});

describe("navigate() cross-route", () => {
  test("swaps the mounted preact-router route on a programmatic navigation", async () => {
    renderRouter();
    expect(screen.getByText("page-a")).toBeInTheDocument();

    navigate("/b");

    await waitFor(() => expect(screen.getByText("page-b")).toBeInTheDocument());
    expect(screen.queryByText("page-a")).toBeNull();
    expect(window.location.pathname).toBe("/b");
  });

  test("carries history.state to the destination route", async () => {
    renderRouter();
    navigate("/b", { state: { from: "/a" } });

    await waitFor(() => expect(screen.getByText("page-b")).toBeInTheDocument());
    expect(history.state).toEqual({ from: "/a" });
  });
});
