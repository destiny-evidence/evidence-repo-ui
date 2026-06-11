import Keycloak from "keycloak-js";
import { KEYCLOAK_CLIENT_ID, KEYCLOAK_REALM, KEYCLOAK_URL } from "@/config";
import { findCommunity } from "@/services/communities";

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

function allowsSelfSignup(): boolean {
  const slug = window.location.pathname.split("/").filter(Boolean)[0];
  return slug !== undefined && !!findCommunity(slug)?.features.selfSignup;
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
