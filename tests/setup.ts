import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/preact";
import "@testing-library/jest-dom/vitest";

const defaultTokenParsed = () => ({
  name: "Test User",
  preferred_username: "testuser",
});

vi.mock("@/auth/keycloak", () => {
  const keycloak = {
    authenticated: true,
    token: "test-token",
    tokenParsed: defaultTokenParsed(),
    updateToken: vi.fn().mockResolvedValue(false),
    login: vi.fn(),
    logout: vi.fn(),
    onAuthSuccess: undefined as (() => void) | undefined,
    onAuthRefreshSuccess: undefined as (() => void) | undefined,
    onAuthLogout: undefined as (() => void) | undefined,
    onTokenExpired: undefined as (() => void) | undefined,
  };
  return {
    keycloak,
    initKeycloak: vi.fn().mockResolvedValue(undefined),
  };
});

beforeEach(async () => {
  const { keycloak } = await import("@/auth/keycloak");
  keycloak.authenticated = true;
  keycloak.token = "test-token";
  keycloak.tokenParsed = defaultTokenParsed();
  keycloak.onAuthSuccess = undefined;
  keycloak.onAuthRefreshSuccess = undefined;
  keycloak.onAuthLogout = undefined;
  keycloak.onTokenExpired = undefined;
  vi.mocked(keycloak.updateToken).mockReset().mockResolvedValue(false);
  vi.mocked(keycloak.login).mockReset();
  vi.mocked(keycloak.logout).mockReset();
});

afterEach(() => {
  cleanup();
});
