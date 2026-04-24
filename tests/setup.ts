import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/preact";
import "@testing-library/jest-dom/vitest";

vi.mock("@/auth/keycloak", () => {
  const keycloak = {
    authenticated: true,
    token: "test-token",
    tokenParsed: { name: "Test User", preferred_username: "testuser" },
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

afterEach(() => {
  cleanup();
});
