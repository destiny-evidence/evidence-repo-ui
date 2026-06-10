import Keycloak from "keycloak-js";
import { KEYCLOAK_CLIENT_ID, KEYCLOAK_REALM, KEYCLOAK_URL } from "@/config";

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const keycloak = new Keycloak({
  url: requireEnv("VITE_KEYCLOAK_URL", KEYCLOAK_URL),
  realm: requireEnv("VITE_KEYCLOAK_REALM", KEYCLOAK_REALM),
  clientId: requireEnv("VITE_KEYCLOAK_CLIENT_ID", KEYCLOAK_CLIENT_ID),
});

keycloak.onTokenExpired = () => {
  keycloak.updateToken(30).catch(() => keycloak.login());
};

// Communities that allow self-service registration: visitors land on a
// Sign in / Create account screen instead of being forced straight to login.
const SELF_SIGNUP_COMMUNITIES = new Set(["hpv"]);

function allowsSelfSignup(): boolean {
  const slug = window.location.pathname.split("/").filter(Boolean)[0];
  return slug !== undefined && SELF_SIGNUP_COMMUNITIES.has(slug);
}

export async function initKeycloak(): Promise<boolean> {
  return keycloak.init({
    onLoad: allowsSelfSignup() ? "check-sso" : "login-required",
    pkceMethod: "S256",
    checkLoginIframe: false,
  });
}

export function login(): void {
  keycloak.login();
}

export function register(): void {
  keycloak.register();
}
