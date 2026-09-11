import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/preact";

// main.tsx decides, before anything renders, whether the URL belongs to a
// community and so needs Keycloak at all. It does that work at import time, so
// each case resets the module registry and imports it fresh against a
// pre-arranged URL and mount point.
describe("bootstrap", () => {
  let root: HTMLDivElement;

  beforeEach(async () => {
    vi.resetModules();
    // resetModules re-imports main, but the keycloak mock survives it, so its
    // call count carries over from the previous case unless cleared.
    const { initKeycloak } = await import("@/auth/keycloak");
    vi.mocked(initKeycloak).mockClear();
    // Analytics off: initMatomo injects its tracker next to the first <script>,
    // and jsdom's document has none. A local .env can otherwise switch this on.
    vi.stubEnv("VITE_MATOMO_URL", "");
    vi.stubEnv("VITE_MATOMO_SITE_ID", "");
    root = document.createElement("div");
    root.id = "app";
    document.body.appendChild(root);
  });

  afterEach(() => {
    root.remove();
  });

  async function boot(pathname: string) {
    history.pushState({}, "", pathname);
    // Import the mock before main so both share one module instance.
    const { initKeycloak } = await import("@/auth/keycloak");
    await import("@/main");
    return initKeycloak;
  }

  test("the slug-less root renders the home page without initialising Keycloak", async () => {
    const initKeycloak = await boot("/");

    expect(initKeycloak).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Welcome to the Evidence Repository" }),
    ).toBeInTheDocument();
  });

  test("a community route initialises Keycloak before rendering", async () => {
    const initKeycloak = await boot("/hpv");

    expect(initKeycloak).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("heading", {
        name: "Welcome to the Evidence Repository",
      }),
    ).not.toBeInTheDocument();
  });
});
