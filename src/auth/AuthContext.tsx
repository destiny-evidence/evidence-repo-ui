import { createContext, type ComponentChildren } from "preact";
import { useContext, useEffect, useState } from "preact/hooks";
import { keycloak } from "./keycloak";

interface AuthState {
  authenticated: boolean;
  username: string | undefined;
  /** Individual claims; prefer `username` for display. */
  name: string | undefined;
  email: string | undefined;
  /** Token carries the ai_summary.writer realm role (gates AI summaries). */
  aiSummaryWriter: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

interface ProfileClaims {
  name?: string;
  preferred_username?: string;
  email?: string;
}

const readProfile = (): ProfileClaims =>
  (keycloak.tokenParsed as ProfileClaims | undefined) ?? {};

const readUsername = (profile: ProfileClaims): string | undefined =>
  profile.name ?? profile.preferred_username ?? profile.email;

function hasRealmRole(role: string): boolean {
  const token = keycloak.tokenParsed as
    | { realm_access?: { roles?: string[] } }
    | undefined;
  return token?.realm_access?.roles?.includes(role) ?? false;
}

export function AuthProvider({ children }: { children: ComponentChildren }) {
  const [, setVersion] = useState(0);

  useEffect(() => {
    // Force consumers to re-read keycloak.tokenParsed when auth state changes.
    const bump = () => setVersion((v) => v + 1);
    keycloak.onAuthSuccess = bump;
    keycloak.onAuthRefreshSuccess = bump;
    keycloak.onAuthLogout = bump;
    return () => {
      keycloak.onAuthSuccess = undefined;
      keycloak.onAuthRefreshSuccess = undefined;
      keycloak.onAuthLogout = undefined;
    };
  }, []);

  const profile = readProfile();
  const value: AuthState = {
    authenticated: !!keycloak.authenticated,
    username: readUsername(profile),
    name: profile.name,
    email: profile.email,
    aiSummaryWriter: hasRealmRole("ai_summary.writer"),
    logout: () => keycloak.logout(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
