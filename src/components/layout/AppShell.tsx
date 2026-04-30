import type { ComponentChildren } from "preact";
import { useAuth } from "@/auth/AuthContext";
import { useCommunity } from "@/community/CommunityContext";
import "./AppShell.css";

interface AppShellProps {
  children: ComponentChildren;
}

// Brand link target: there's no real "/" landing page yet — the router only
// matches /:community/* — so point at the lone live community root. Revisit
// when a multi-community switcher or a true root page lands.
const BRAND_HREF = "/esea";

export function AppShell({ children }: AppShellProps) {
  const { username, logout } = useAuth();
  const community = useCommunity();
  return (
    <div class="app-shell">
      <header class="app-header">
        <a href={BRAND_HREF} class="app-header__brand">
          <span class="app-header__logo-mark" aria-hidden="true">E</span>
          <span class="app-header__brand-text">
            <span class="app-header__brand-name">Evidence Repository</span>
            {community && (
              <>
                <span class="app-header__brand-sep" aria-hidden="true">/</span>
                <span class="app-header__brand-community">{community.name}</span>
              </>
            )}
          </span>
        </a>
        <div class="app-header__user">
          {username && <span class="app-header__username">{username}</span>}
          <button type="button" class="app-header__signout" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
      <main class="app-main">{children}</main>
    </div>
  );
}
