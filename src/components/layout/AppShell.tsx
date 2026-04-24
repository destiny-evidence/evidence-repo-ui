import type { ComponentChildren } from "preact";
import "./AppShell.css";

interface AppShellProps {
  children: ComponentChildren;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div class="app-shell">
      <header class="app-header">
        <a href="/" class="app-header__logo">
          Evidence Repository
        </a>
        <div class="app-header__auth" aria-label="Sign in placeholder">
          Sign in
        </div>
      </header>
      <main class="app-main">{children}</main>
    </div>
  );
}
