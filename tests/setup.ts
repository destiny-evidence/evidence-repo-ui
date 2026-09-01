import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/preact";
import "@testing-library/jest-dom/vitest";

vi.stubEnv("VITE_ESEA_VOCABULARY_URL", "https://test.example/vocab");
vi.stubEnv("VITE_ESEA_CONTEXT_URL", "https://test.example/context");
vi.stubEnv("VITE_HPV_VOCABULARY_URL", "https://test.example/hpv-vocab");
vi.stubEnv("VITE_HPV_CONTEXT_URL", "https://test.example/hpv-context");
vi.stubEnv("VITE_DESTINY_VOCABULARY_URL", "https://test.example/dest-vocab");
vi.stubEnv("VITE_DESTINY_CONTEXT_URL", "https://test.example/dest-context");
vi.stubEnv("VITE_KEYCLOAK_URL", "https://kc.test.example");
vi.stubEnv("VITE_KEYCLOAK_REALM", "test-realm");
vi.stubEnv("VITE_KEYCLOAK_CLIENT_ID", "test-client");
vi.stubEnv(
  "VITE_ENRICHMENT_FORM_URL",
  "https://forms.test/viewform?usp=pp_url&entry.1={referenceUrl}&entry.2={name}&entry.3={email}",
);

const defaultTokenParsed = () => ({
  name: "Test User",
  preferred_username: "testuser",
  email: "test.user@example.org",
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
    login: vi.fn(),
    register: vi.fn(),
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
