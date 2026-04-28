import { createContext, type ComponentChildren } from "preact";
import { useContext, useEffect, useState } from "preact/hooks";
import { keycloak } from "./keycloak";

interface AuthState {
  authenticated: boolean;
  username: string | undefined;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function readUsername(): string | undefined {
  const token = keycloak.tokenParsed as
    | { name?: string; preferred_username?: string; email?: string }
    | undefined;
  return token?.name ?? token?.preferred_username ?? token?.email;
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

  const value: AuthState = {
    authenticated: !!keycloak.authenticated,
    username: readUsername(),
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
