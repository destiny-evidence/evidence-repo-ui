import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { track } from "@/analytics/matomo";
import { useAuth } from "@/auth/AuthContext";
import { useCommunity } from "@/community/CommunityContext";
import { DEFAULT_COMMUNITY_SLUG } from "@/services/communities";
import { FeedbackFAB } from "@/components/feedback/FeedbackFAB";
import { ResourcesMenu } from "./ResourcesMenu";
import { URL_CHANGE_EVENT } from "@/services/navigation";
import "./AppShell.css";

function usePathname(): string {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  useEffect(() => {
    const onChange = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onChange);
    window.addEventListener(URL_CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener("popstate", onChange);
      window.removeEventListener(URL_CHANGE_EVENT, onChange);
    };
  }, []);
  return pathname;
}

interface AppShellProps {
  children: ComponentChildren;
}

export function AppShell({ children }: AppShellProps) {
  const { username, logout } = useAuth();
  const community = useCommunity();
  const pathname = usePathname();
  const searchActive =
    community != null &&
    (pathname === `/${community.slug}` ||
      pathname.startsWith(`/${community.slug}/references/`));
  const visualiseActive =
    community != null && pathname === `/${community.slug}/visualise`;
  // No "/" landing page yet (router only matches /:community/*), so point at
  // the current community root, falling back to the default off a community route.
  const brandHref = `/${community?.slug ?? DEFAULT_COMMUNITY_SLUG}`;
  const trackTab = (name: string) => () =>
    track({ category: "Navigation", action: "Tab Clicked", name });
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
        {community && (
          <nav class="app-nav" aria-label="Primary">
            <a
              class={`app-nav__link${searchActive ? " active" : ""}`}
              href={`/${community.slug}`}
              onClick={trackTab("Search")}
            >
              Search
            </a>
            {community.features.evidenceMap && (
              <a
                class={`app-nav__link${visualiseActive ? " active" : ""}`}
                href={`/${community.slug}/visualise`}
                onClick={trackTab("Visualise")}
              >
                Visualise
              </a>
            )}
            {community.externalResources && community.externalResources.length > 0 && (
              <ResourcesMenu resources={community.externalResources} />
            )}
          </nav>
        )}
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
