import type { ComponentChildren } from "preact";
import { useAuth } from "@/auth/AuthContext";
import { useCommunity } from "@/community/CommunityContext";
import { DEFAULT_COMMUNITY_SLUG } from "@/services/communities";
import { FeedbackFAB } from "@/components/feedback/FeedbackFAB";
import "./AppShell.css";

interface AppShellProps {
  children: ComponentChildren;
}

export function AppShell({ children }: AppShellProps) {
  const { username, logout } = useAuth();
  const community = useCommunity();
  // No "/" landing page yet (router only matches /:community/*), so point at
  // the current community root, falling back to the default off a community route.
  const brandHref = `/${community?.slug ?? DEFAULT_COMMUNITY_SLUG}`;
  return (
    <div class="app-shell">
      <header class="app-header">
        <a href={brandHref} class="app-header__brand">
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
      <FeedbackFAB />
    </div>
  );
}
