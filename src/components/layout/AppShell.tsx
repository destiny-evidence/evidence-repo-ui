import type { ComponentChildren } from "preact";
import { useAuth } from "@/auth/AuthContext";
import "./AppShell.css";

interface AppShellProps {
  children: ComponentChildren;
}

export function AppShell({ children }: AppShellProps) {
  const { authenticated, username, logout } = useAuth();

  return (
    <div class="app-shell">
      <header class="app-header">
        <a href="/" class="app-header__logo">
          Evidence Repository
        </a>
        {authenticated && (
          <div class="app-header__user">
            {username && <span class="app-header__username">{username}</span>}
            <button
              type="button"
              class="app-header__signout"
              onClick={logout}
            >
              Sign out
            </button>
          </div>
        )}
      </header>
      <main class="app-main">{children}</main>
    </div>
  );
}
