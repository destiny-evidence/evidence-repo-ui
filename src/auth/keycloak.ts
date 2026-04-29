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

export async function initKeycloak(): Promise<void> {
  await keycloak.init({
    onLoad: "login-required",
    pkceMethod: "S256",
    checkLoginIframe: false,
  });
}
