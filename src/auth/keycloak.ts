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
  const selfSignup = allowsSelfSignup();
  // Self-signup communities are an open front door. check-sso detects an
  // existing session via a hidden iframe — so a logged-in user skips the
  // landing — without the full-page Keycloak bounce a plain check-sso does.
  // silentCheckSsoFallback:false keeps cookie-restricted browsers from
  // bouncing too: they just see the landing and click Sign in once.
  return keycloak.init({
    onLoad: selfSignup ? "check-sso" : "login-required",
    ...(selfSignup && {
      silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
      silentCheckSsoFallback: false,
    }),
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
