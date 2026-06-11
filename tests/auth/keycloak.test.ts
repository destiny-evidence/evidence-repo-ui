import { describe, test, expect, vi, beforeEach } from "vitest";

// The global setup mocks @/auth/keycloak wholesale; here we want the REAL
// module (via importActual) with only keycloak-js stubbed, so we can assert
// which onLoad mode initKeycloak() picks per community.
const initSpy = vi.fn().mockResolvedValue(true);
vi.mock("keycloak-js", () => ({
  default: vi.fn(() => ({ init: initSpy })),
}));

async function realInitKeycloak() {
  const mod =
    await vi.importActual<typeof import("@/auth/keycloak")>("@/auth/keycloak");
  return mod.initKeycloak;
}

function setPathname(pathname: string) {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, pathname },
  });
}

describe("initKeycloak onLoad selection", () => {
  beforeEach(() => initSpy.mockClear());

  test("self-signup community (hpv) uses silent check-sso so a logged-in user skips the landing without a full-page bounce", async () => {
    setPathname("/hpv/references/abc");
    await (await realInitKeycloak())();
    const opts = initSpy.mock.calls[0][0];
    expect(opts.onLoad).toBe("check-sso");
    expect(opts.silentCheckSsoRedirectUri).toMatch(/\/silent-check-sso\.html$/);
    expect(opts.silentCheckSsoFallback).toBe(false);
  });

  test("non-self-signup community (esea) stays gated behind login-required with no silent check", async () => {
    setPathname("/esea");
    await (await realInitKeycloak())();
    const opts = initSpy.mock.calls[0][0];
    expect(opts.onLoad).toBe("login-required");
    expect(opts.silentCheckSsoRedirectUri).toBeUndefined();
  });

  test("root / unknown path falls back to login-required", async () => {
    setPathname("/");
    await (await realInitKeycloak())();
    expect(initSpy.mock.calls[0][0].onLoad).toBe("login-required");
  });
});
